import java.util.*;
import java.util.concurrent.*;

/** Authenticated, unpaid, unredeemed and always-cancellable requests only. */
public final class CouponCancellation {
    enum State { CREATED, CANCELLED }
    record Key(long tenant,String intent) {}
    record Row(String immutablePayload,State state) {}
    final Map<Key,Row> rows=new HashMap<>();
    long allocated;
    synchronized State apply(Key key,String payload,boolean cancel) {
        if(key.tenant()<=0||key.intent()==null||key.intent().isBlank()||payload==null||payload.isBlank())
            throw new IllegalArgumentException();
        Row old=rows.get(key);
        if(old!=null&&!old.immutablePayload().equals(payload)) throw new IllegalArgumentException("identity conflict");
        if(old!=null&&old.state()==State.CANCELLED)return State.CANCELLED;
        if(cancel) {
            if(old!=null)allocated=Math.subtractExact(allocated,1);
            rows.put(key,new Row(payload,State.CANCELLED));return State.CANCELLED;
        }
        if(old==null){allocated=Math.addExact(allocated,1);rows.put(key,new Row(payload,State.CREATED));}
        return State.CREATED;
    }
    synchronized long allocated(){return allocated;}
    static void check(boolean b){if(!b)throw new AssertionError();}
    static int permutations(int depth,int[] order,boolean[] used) {
        if(depth==4) {
            CouponCancellation m=new CouponCancellation();Key k=new Key(1,"purchase");
            for(int op:order){m.apply(k,"owner:sku",op>=2);check(m.allocated()>=0&&m.allocated()<=1);}
            check(m.allocated()==0&&m.rows.get(k).state()==State.CANCELLED);return 1;
        }
        int count=0;
        for(int i=0;i<4;i++)if(!used[i]){
            used[i]=true;order[depth]=i;count+=permutations(depth+1,order,used);used[i]=false;
        }
        return count;
    }
    public static void main(String[] args)throws Exception {
        check(permutations(0,new int[4],new boolean[4])==24);
        CouponCancellation m=new CouponCancellation();Key k=new Key(1,"purchase");
        ExecutorService pool=Executors.newFixedThreadPool(8);
        Throwable primary=null;
        try {
            List<Callable<State>> tasks=new ArrayList<>();
            for(int i=0;i<100;i++){final boolean cancel=i%2==0;tasks.add(()->m.apply(k,"owner:sku",cancel));}
            for(Future<State> f:pool.invokeAll(tasks,5,TimeUnit.SECONDS)) {
                check(!f.isCancelled());f.get(1,TimeUnit.SECONDS);
            }
            check(m.allocated()==0&&m.rows.get(k).state()==State.CANCELLED);
            check(m.apply(k,"owner:sku",false)==State.CANCELLED);
            check(m.apply(new Key(1,"new-purchase"),"owner:sku",false)==State.CREATED);
            check(m.apply(new Key(2,"purchase"),"owner:sku",false)==State.CREATED);
            try{m.apply(k,"other-owner",true);throw new AssertionError();}catch(IllegalArgumentException expected){}
            check(m.allocated()==2);
        } catch(Exception|Error failure){primary=failure;throw failure;}
        finally { FailureTools.cleanup(primary, () -> { pool.shutdownNow();check(pool.awaitTermination(5,TimeUnit.SECONDS)); }); }
        System.out.println("PASS: 24 permutations, 100 bounded concurrent calls, tombstone, new intent, tenant isolation, payload conflict; memory only");
    }
}

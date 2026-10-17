import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

/** Deterministic contracts, randomized state oracles and bounded concurrent runs. */
public final class OSMechanismsTest {
    private static int checks;
    private static void check(boolean ok, String label) {
        if (!ok) throw new AssertionError(label);
        checks++;
    }
    private static void rejects(Runnable r, Class<? extends Throwable> expected) {
        try { r.run(); throw new AssertionError("expected " + expected.getName()); }
        catch (Throwable e) { if (!expected.isInstance(e)) throw e; checks++; }
    }
    private static boolean oracle(int[] work, int[][] max, int[][] allocation, int mask) {
        if (mask == (1 << max.length)-1) return true;
        for (int i=0; i<max.length; i++) {
            if ((mask & (1 << i)) != 0) continue;
            boolean fits=true;
            for (int j=0;j<work.length;j++) fits &= max[i][j]-allocation[i][j] <= work[j];
            if (!fits) continue;
            int[] next=work.clone();
            for (int j=0;j<work.length;j++) next[j]+=allocation[i][j];
            if (oracle(next,max,allocation,mask|(1 << i))) return true;
        }
        return false;
    }
    private static void bankers() {
        for (int total=0;total<=6;total++) for(int a=0;a<=total;a++)
        for(int b=0;b<=total-a;b++) for(int ma=a;ma<=total;ma++) for(int mb=b;mb<=total;mb++) {
            int[] av={total-a-b}; int[][] max={{ma},{mb}}, alloc={{a},{b}};
            Banker bank=new Banker(av,max,alloc);
            check((bank.safeSequence()!=null)==oracle(av,max,alloc,0),"banker safety oracle");
            for (int p=0;p<2;p++) for(int q=0;q<=total+1;q++) {
                Banker copy=new Banker(av,max,alloc); String before=copy.toString();
                Banker.Result result=copy.request(p,new int[]{q});
                Banker.Result wanted;
                if(q>max[p][0]-alloc[p][0]) wanted=Banker.Result.EXCEEDS_NEED;
                else if(q>av[0]) wanted=Banker.Result.WAIT_AVAILABLE;
                else {
                    int[][] after={{a},{b}}; after[p][0]+=q;
                    wanted=oracle(new int[]{av[0]-q},max,after,0)
                        ? Banker.Result.GRANTED : Banker.Result.WAIT_UNSAFE;
                }
                check(result==wanted,"banker request oracle");
                if(result==Banker.Result.GRANTED) copy.release(p,new int[]{q});
                check(copy.toString().equals(before),"banker rollback/release");
            }
        }
        rejects(()->new Banker(new int[]{-1},new int[0][1],new int[0][1]),IllegalArgumentException.class);
    }
    private static void queues() throws Exception {
        for (int capacity : new int[]{1,2,17}) for(int round=0;round<10;round++) {
            BoundedIntQueue q=new BoundedIntQueue(capacity);
            AtomicIntegerArray seen=new AtomicIntegerArray(600);
            ExecutorService pool=Executors.newFixedThreadPool(6);
            List<Future<?>> consumers=new ArrayList<>(), producers=new ArrayList<>();
            try {
                for(int c=0;c<3;c++) consumers.add(pool.submit(()->{
                    try { for (;;) { OptionalInt v=q.take(); if(v.isEmpty()) return; seen.incrementAndGet(v.getAsInt()); } }
                    catch(InterruptedException e){Thread.currentThread().interrupt(); throw new RuntimeException(e);}
                }));
                for(int p=0;p<3;p++) { final int id=p; producers.add(pool.submit(()->{
                    try {for(int i=0;i<200;i++) if(!q.put(id*200+i)) throw new AssertionError("premature close");}
                    catch(InterruptedException e){Thread.currentThread().interrupt();throw new RuntimeException(e);}
                })); }
                for(Future<?> f:producers) f.get(5,TimeUnit.SECONDS);
                q.close(); q.close();
                for(Future<?> f:consumers) f.get(5,TimeUnit.SECONDS);
                for(int i=0;i<600;i++) check(seen.get(i)==1,"MPMC exact delivery");
                check(!q.put(1)&&q.take().isEmpty(),"closed queue contract");
            } finally {q.close();pool.shutdownNow();check(pool.awaitTermination(5,TimeUnit.SECONDS),"queue workers reaped");}
        }
        BoundedIntQueue q=new BoundedIntQueue(1);q.put(7);q.close();
        check(q.take().orElseThrow()==7&&q.take().isEmpty(),"close drains queued items");
        AtomicBoolean interrupted=new AtomicBoolean(); BoundedIntQueue empty=new BoundedIntQueue(1);
        Thread t=new Thread(()->{try{empty.take();throw new AssertionError("expected interrupt");}
            catch(InterruptedException expected){interrupted.set(true);}});
        t.start();t.interrupt();t.join(3000);check(!t.isAlive()&&interrupted.get(),"wait cancellation");
        rejects(()->new BoundedIntQueue(0),IllegalArgumentException.class);
    }
    private static void wheel() {
        TickWheel w=new TickWheel(10,4,10000);Map<Long,Long> oracle=new HashMap<>();Random r=new Random(811);
        long now=0;
        for(int op=0;op<10000;op++) {
            if(r.nextInt(3)==0&&!oracle.isEmpty()) {
                long id=oracle.keySet().iterator().next();check(w.cancel(id),"cancel live");oracle.remove(id);check(!w.cancel(id),"cancel idempotent");
            } else if(r.nextBoolean()) {
                long delay=r.nextInt(500);long due=Math.max((now+delay+9)/10,now/10+1);
                oracle.put(w.schedule(delay),due);
            } else {
                now+=r.nextInt(6000);Set<Long> expected=new HashSet<>();
                for(var e:oracle.entrySet())if(e.getValue()<=now/10)expected.add(e.getKey());
                Set<Long> got=new HashSet<>();
                for(var f:w.advanceTo(now)){check(got.add(f.id()),"no duplicate expiry");check(oracle.get(f.id())==f.dueTick(),"due preserved");}
                check(got.equals(expected),"wheel scan oracle");expected.forEach(oracle::remove);
            }
            check(w.pending()==oracle.size(),"wheel occupancy");
        }
        rejects(()->w.advanceTo(-1),IllegalArgumentException.class);
        TickWheel limit=new TickWheel(10,4,1);limit.schedule(0);
        rejects(()->limit.schedule(1),IllegalStateException.class);
    }
    private static void snapshots() throws Exception {
        CowIntMap m=new CowIntMap(10);m.putAll(Map.of("a",1));var old=m.snapshot();m.putAll(Map.of("a",2));
        check(old.values().get("a")==1&&m.snapshot().values().get("a")==2,"old snapshot stable");
        rejects(()->old.values().put("a",99),UnsupportedOperationException.class);
        ExecutorService pool=Executors.newFixedThreadPool(4);
        try{List<Future<?>> fs=new ArrayList<>();for(int i=0;i<4;i++){final int n=i;fs.add(pool.submit(()->{for(int j=0;j<100;j++)m.putAll(Map.of("k"+n,j));}));}
            for(var f:fs)f.get(5,TimeUnit.SECONDS);check(m.snapshot().version()==402,"serialized publishers");
            for(int i=0;i<4;i++)check(m.snapshot().values().get("k"+i)==99,"no lost distinct-key update");
        }finally{pool.shutdownNow();check(pool.awaitTermination(5,TimeUnit.SECONDS),"snapshot pool closed");}
        CowIntMap one=new CowIntMap(1);one.putAll(Map.of("a",1));var prior=one.snapshot();
        rejects(()->one.putAll(Map.of("b",2)),IllegalStateException.class);check(one.snapshot()==prior,"failed publication unchanged");
    }
    private static void sharedFlight() throws Exception {
        ExecutorService work=Executors.newSingleThreadExecutor(),callers=Executors.newFixedThreadPool(2);
        CountDownLatch started=new CountDownLatch(1),release=new CountDownLatch(1);AtomicInteger runs=new AtomicInteger();
        SharedFlight<String,Integer> f=new SharedFlight<>(work);
        Callable<Integer> loader=()->{runs.incrementAndGet();started.countDown();if(!release.await(3,TimeUnit.SECONDS))throw new TimeoutException();return 42;};
        try{
            Future<Integer> waiting=callers.submit(()->f.call("k",loader,3,TimeUnit.SECONDS));
            check(started.await(2,TimeUnit.SECONDS),"loader started");
            try{f.call("k",loader,1,TimeUnit.MILLISECONDS);throw new AssertionError("timeout");}catch(TimeoutException expected){checks++;}
            check(runs.get()==1&&f.activeKeys()==1,"waiter timeout keeps root alive");release.countDown();
            check(waiting.get(3,TimeUnit.SECONDS)==42,"remaining waiter succeeds");
            check(f.call("k",()->43,3,TimeUnit.SECONDS)==43,"finished generation not cache");
            SharedFlight<String,Integer> reject=new SharedFlight<>(r->{throw new RejectedExecutionException();});
            try{reject.call("x",()->1,1,TimeUnit.SECONDS);throw new AssertionError();}catch(ExecutionException e){check(e.getCause() instanceof RejectedExecutionException,"reject propagated");}
            check(reject.activeKeys()==0,"reject registration cleaned");
        }finally{release.countDown();work.shutdownNow();callers.shutdownNow();check(work.awaitTermination(5,TimeUnit.SECONDS)&&callers.awaitTermination(5,TimeUnit.SECONDS),"flight pools closed");}
    }
    private static void companions() throws Exception {
        List<Integer> values=new ArrayList<>();SemaphoreHandoff.transfer(1000,i->i*2,values::add);
        for(int i=0;i<values.size();i++)check(values.get(i)==i*2,"semaphore order");check(values.size()==1000,"handoff count");
        rejects(()->{try{SemaphoreHandoff.transfer(3,i->{throw new IllegalArgumentException();},v->{});}catch(InterruptedException e){throw new RuntimeException(e);}},IllegalStateException.class);
        GraphCopy.Node a=new GraphCopy.Node("a"),b=new GraphCopy.Node("b");a.edges.add(b);a.edges.add(b);b.edges.add(a);a.edges.add(null);
        GraphCopy.Node c=GraphCopy.copy(a);check(c!=a&&c.edges.get(0)==c.edges.get(1)&&c.edges.get(0).edges.get(0)==c&&c.edges.get(2)==null,"graph identity and cycles");

    }
    public static void main(String[] args) throws Exception {
        bankers();queues();wheel();snapshots();sharedFlight();companions();
        System.out.println("OS_MECHANISMS_PASS checks="+checks);
    }
}

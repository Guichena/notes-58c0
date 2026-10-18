import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;

/** Bounded Java task control-plane state machine.
 * Single bounded in-memory authority, NOT a distributed database or execution sandbox.
 * Authenticated tenant/worker and trusted authority time are supplied by the adapter.
 * Reconciliation evidence must come from an authenticated supervisor, not the submitting user.
 */
public final class ScriptControl {
    public enum State { QUEUED, RUNNING, UNKNOWN, CANCEL_REQUESTED, CANCELLED, SUCCEEDED, FAILED }
    public enum Decision { NOT_STARTED_AND_CANNOT_START, SUCCEEDED, FAILED }
    public record Key(String tenant, String request) {}
    public record Input(Key key, String scriptSha, long deadline) {}
    public record Job(Input input, State state, String owner, long epoch, long leaseUntil, String output) {}
    private final Map<Key,Job> jobs = new HashMap<>();
    private final int capacity;
    public ScriptControl(int capacity) {
        if(capacity<=0) throw new IllegalArgumentException("positive capacity required");
        this.capacity=capacity;
    }
    private static void identifier(String s) {
        if(s==null||!s.matches("[A-Za-z0-9_-]{1,64}")) throw new IllegalArgumentException("identifier");
    }
    private static void time(long now) {if(now<0)throw new IllegalArgumentException("trusted nonnegative time");}
    private static void output(String output) {
        if(output==null||output.getBytes(StandardCharsets.UTF_8).length>4096)throw new IllegalArgumentException("output byte limit");
    }
    private Job require(Key key) {
        Job j=jobs.get(key);if(j==null)throw new IllegalStateException("missing job");return j;
    }
    private Job replace(Job j,State state,String owner,long epoch,long until,String output) {
        Job n=new Job(j.input(),state,owner,epoch,until,output);jobs.put(j.input().key(),n);return n;
    }
    public synchronized Job submit(Input in,long now) {
        Objects.requireNonNull(in);Objects.requireNonNull(in.key());time(now);
        identifier(in.key().tenant());identifier(in.key().request());
        if(in.scriptSha()==null||!in.scriptSha().matches("[a-f0-9]{64}")||in.deadline()<=0)
            throw new IllegalArgumentException("input");
        Job old=jobs.get(in.key());
        if(old!=null) {if(!old.input().equals(in))throw new IllegalArgumentException("payload conflict");return old;}
        if(in.deadline()<=now)throw new IllegalStateException("expired input");
        if(jobs.size()>=capacity)throw new IllegalStateException("capacity");
        Job j=new Job(in,State.QUEUED,null,0,0,"");jobs.put(in.key(),j);return j;
    }
    public synchronized Job claim(Key key,String owner,long now,long ttl) {
        identifier(owner);time(now);if(ttl<=0)throw new IllegalArgumentException("ttl");
        long until=Math.addExact(now,ttl);Job j=require(key);
        if(j.state()!=State.QUEUED||now>=j.input().deadline())throw new IllegalStateException("not claimable");
        return replace(j,State.RUNNING,owner,Math.incrementExact(j.epoch()),Math.min(until,j.input().deadline()),"");
    }
    public synchronized Job complete(Key key,String owner,long epoch,long now,String receipt) {
        time(now);output(receipt);Job j=require(key);
        if(!Objects.equals(j.owner(),owner)||j.epoch()!=epoch)throw new IllegalStateException("stale owner/epoch");
        if(j.state()==State.SUCCEEDED) {
            if(!j.output().equals(receipt))throw new IllegalArgumentException("receipt conflict");return j;
        }
        if(j.state()!=State.RUNNING||now>=j.leaseUntil())throw new IllegalStateException("not current running lease");
        return replace(j,State.SUCCEEDED,owner,epoch,j.leaseUntil(),receipt);
    }
    public synchronized void expire(long now) {
        time(now);
        for(Job j:List.copyOf(jobs.values()))
            if(j.state()==State.RUNNING&&now>=j.leaseUntil())
                replace(j,State.UNKNOWN,j.owner(),j.epoch(),j.leaseUntil(),j.output());
    }
    public synchronized Job cancel(Key key) {
        Job j=require(key);
        State next=switch(j.state()) {
            case QUEUED -> State.CANCELLED;
            case RUNNING,UNKNOWN -> State.CANCEL_REQUESTED;
            case CANCELLED,CANCEL_REQUESTED -> j.state();
            default -> throw new IllegalStateException("already terminal");
        };
        return replace(j,next,j.owner(),j.epoch(),j.leaseUntil(),j.output());
    }
    /** NOT_STARTED_AND_CANNOT_START requires proof old launch requests can never execute later. */
    public synchronized Job reconcile(Key key,long epoch,Decision decision,String receipt,long now) {
        time(now);output(receipt);Objects.requireNonNull(decision);Job j=require(key);
        if(j.epoch()!=epoch||(j.state()!=State.UNKNOWN&&j.state()!=State.CANCEL_REQUESTED))
            throw new IllegalStateException("stale reconciliation");
        State next=switch(decision) {
            case SUCCEEDED -> State.SUCCEEDED;
            case FAILED -> State.FAILED;
            case NOT_STARTED_AND_CANNOT_START -> j.state()==State.CANCEL_REQUESTED ? State.CANCELLED :
                now>=j.input().deadline() ? State.FAILED : State.QUEUED;
        };
        return replace(j,next,j.owner(),j.epoch(),j.leaseUntil(),receipt);
    }
    public synchronized Job get(Key key) {return require(key);}
    private static void check(boolean b) {if(!b)throw new AssertionError();}
    private static void rejects(Runnable f) {try{f.run();throw new AssertionError("expected rejection");}catch(IllegalArgumentException|IllegalStateException|ArithmeticException expected){}}
    public static void main(String[] args)throws Exception {
        Key key=new Key("tenant","request");Input input=new Input(key,"a".repeat(64),100);
        ScriptControl s=new ScriptControl(10);s.submit(input,0);check(s.submit(input,100).input().equals(input));
        rejects(()->s.submit(new Input(key,"b".repeat(64),100),0));
        try(var pool=Executors.newFixedThreadPool(10)) {
            List<Callable<Boolean>> tasks=new ArrayList<>();
            for(int i=0;i<30;i++)tasks.add(()->{try{s.claim(key,"worker",0,10);return true;}catch(IllegalStateException e){return false;}});
            int wins=0;for(Future<Boolean> f:pool.invokeAll(tasks))if(f.get())wins++;check(wins==1);
        }
        Job j=s.get(key);rejects(()->s.complete(key,"wrong",j.epoch(),1,"x"));
        s.expire(10);check(s.get(key).state()==State.UNKNOWN);
        rejects(()->s.claim(key,"new",10,10));rejects(()->s.complete(key,"worker",j.epoch(),10,"x"));
        s.reconcile(key,j.epoch(),Decision.NOT_STARTED_AND_CANNOT_START,"",10);
        Job next=s.claim(key,"new",10,10);check(next.epoch()==j.epoch()+1);
        rejects(()->s.complete(key,"worker",j.epoch(),11,"x"));
        s.complete(key,"new",next.epoch(),11,"ok");check(s.complete(key,"new",next.epoch(),200,"ok").state()==State.SUCCEEDED);
        rejects(()->s.complete(key,"new",next.epoch(),12,"different"));
        ScriptControl cancel=new ScriptControl(1);cancel.submit(input,0);Job run=cancel.claim(key,"w",0,10);
        check(cancel.cancel(key).state()==State.CANCEL_REQUESTED);rejects(()->cancel.complete(key,"w",run.epoch(),1,"done"));
        check(cancel.reconcile(key,run.epoch(),Decision.SUCCEEDED,"committed",2).state()==State.SUCCEEDED);
        rejects(()->cancel.submit(new Input(new Key("tenant","other"),"a".repeat(64),100),0));
        ScriptControl queued=new ScriptControl(1);queued.submit(input,0);check(queued.cancel(key).state()==State.CANCELLED);
        rejects(()->queued.claim(key,"w",1,1));rejects(()->queued.submit(input,-1));
        ScriptControl bounds=new ScriptControl(1);bounds.submit(input,0);Job b=bounds.claim(key,"w",0,Long.MAX_VALUE);
        check(b.leaseUntil()==100);rejects(()->bounds.complete(key,"w",b.epoch(),1,"中".repeat(1366)));
        bounds.expire(100);check(bounds.reconcile(key,b.epoch(),Decision.NOT_STARTED_AND_CANNOT_START,"",100).state()==State.FAILED);
        System.out.println("PASS ScriptControl: 30 racing claims yield one, payload/receipt conflict, exact expiry UNKNOWN, no blind retry, verified requeue advances epoch, stale completion rejected, cancel can reconcile to success, bounds/deadline/UTF8 output; in-memory control plane only.");
    }
}

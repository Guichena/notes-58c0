package interview.tools;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import static interview.tools.ToolPort.*;

/** Deterministic local fault tests: no network, database or real business side effects. */
public final class ToolExecutorTest {
    private static int passed;
    private static final Context CTX=new Context("tenant-a","alice","resource-1",Set.of("read","write"));
    private static Budget budget(int attempts){return Budget.after(Duration.ofSeconds(3),attempts,new Cancellation());}
    private static Call call(String name,String op,String args){return new Call("call-"+System.nanoTime(),op,name,args);}
    private static ToolExecutor.Spec spec(boolean read,int tries,long ms,int bytes,boolean empty,ToolExecutor.Handler h){
        return new ToolExecutor.Spec("1",read?"read":"write",read,tries,ms,bytes,empty,a->{
            if(!a.keySet().equals(Set.of("n"))||!(a.get("n") instanceof Long n)||n<0||n>100)throw new IllegalArgumentException();
        },h);
    }
    private static ToolExecutor ex(Map<String,ToolExecutor.Spec> specs){return new ToolExecutor(specs,(c,n,a)->true,2,4,100);}
    private static void check(boolean b){if(!b)throw new AssertionError();}
    private static void status(Status expected,Reply r){if(r.status()!=expected)throw new AssertionError(expected+" != "+r);}
    private static void bad(Runnable r){try{r.run();throw new AssertionError("accepted invalid input");}catch(IllegalArgumentException expected){}}
    private static void test(String name,Throwing r)throws Exception{r.run();passed++;System.out.println("PASS "+name);}
    @FunctionalInterface private interface Throwing{void run()throws Exception;}
    private static void await(CountDownLatch l)throws InterruptedException{if(!l.await(2,TimeUnit.SECONDS))throw new AssertionError("latch timeout");}
    public static void main(String[] ignored)throws Exception{
        test("strict-json",()->{
            for(String s:List.of("{\"n\":1,\"n\":2}","NaN","Infinity","01","1e999999","[1,]","\"\\u+123\"","\"\\uD800\"","{}{}","[".repeat(18)+"]".repeat(18),"["+"0,".repeat(256)+"0]"))bad(()->StrictJson.parse(s));
            check(StrictJson.canonical(StrictJson.parse("{\"b\":2,\"a\":1}")).equals("{\"a\":1,\"b\":2}"));
        });
        test("contract-invariants",()->{
            bad(()->new Reply("x","op",Status.OK,"",true));bad(()->new Reply("x","",Status.UNKNOWN,"",true));
            bad(()->new Context("","u","r",Set.of()));bad(()->Budget.after(Duration.ZERO,1,new Cancellation()));
            bad(()->new Budget(System.nanoTime()+Duration.ofDays(2).toNanos(),1,new Cancellation()));
            bad(()->new Budget(System.nanoTime()-Duration.ofDays(2).toNanos(),1,new Cancellation()));
            check(new Budget(System.nanoTime()-1_000_000,1,new Cancellation()).remainingNanos()==0);
            bad(()->new Budget(Long.MIN_VALUE,1,new Cancellation()));bad(()->new Budget(Long.MAX_VALUE,1,new Cancellation()));
            try{Budget.after(Duration.ofSeconds(Long.MAX_VALUE),1,new Cancellation());throw new AssertionError("duration overflow accepted");}catch(ArithmeticException expected){}
            bad(()->Budget.after(Duration.ofNanos(-1),1,new Cancellation()));
            // Signed subtraction remains correct across nanoTime wrap for bounded deltas.
            long now=Long.MAX_VALUE-10,deadline=now+100;check(deadline-now==100);check(deadline-(now+101)==-1);
        });
        test("atomic-shared-budget",()->{
            Budget b=budget(100);AtomicInteger wins=new AtomicInteger();List<Thread> threads=new ArrayList<>();
            for(int i=0;i<20;i++){Thread t=new Thread(()->{for(int j=0;j<20;j++)if(b.reserveAttempt())wins.incrementAndGet();});threads.add(t);t.start();}
            for(Thread t:threads)t.join();check(wins.get()==100&&b.attemptsRemaining()==0&&!b.reserveAttempt());
        });
        test("validation-authorization-result",()->{
            AtomicInteger hits=new AtomicInteger();try(ToolExecutor e=ex(Map.of("read",spec(true,1,500,100,false,(i,o)->{hits.incrementAndGet();o.write("{\"n\":2}");})))){
                status(Status.OK,e.invoke(CTX,call("read","","{\"n\":1}"),budget(1)));
                for(String s:List.of("{\"n\":true}","{\"n\":1.0}","{\"n\":1,\"extra\":0}","[]","{\"n\":-1}","{\"n\":1,\"n\":2}"))status(Status.INVALID_ARGUMENT,e.invoke(CTX,call("read","",s),budget(1)));
                status(Status.DENIED,e.invoke(new Context("t","u","r",Set.of()),call("read","","{\"n\":1}"),budget(1)));
                status(Status.UNKNOWN_TOOL,e.invoke(CTX,call("absent","","{}"),budget(1)));check(hits.get()==1);
            }
        });
        test("retry-global-budget-one-attempt-means-no-retry",()->{
            AtomicInteger hits=new AtomicInteger();try(ToolExecutor e=ex(Map.of("r",spec(true,3,500,100,false,(i,o)->{hits.incrementAndGet();throw new ToolExecutor.KnownFailure(Status.RETRYABLE_FAILURE,true);})))){
                status(Status.BUDGET_EXHAUSTED,e.invoke(CTX,call("r","","{\"n\":1}"),budget(1)));check(hits.get()==1);
                Budget b=budget(3);status(Status.RETRYABLE_FAILURE,e.invoke(CTX,call("r","","{\"n\":1}"),b));
                status(Status.BUDGET_EXHAUSTED,e.invoke(CTX,call("r","","{\"n\":1}"),b));check(hits.get()==4);
            }
        });
        test("read-retry-eventual-success",()->{
            AtomicInteger n=new AtomicInteger();try(ToolExecutor e=ex(Map.of("r",spec(true,2,500,100,false,(i,o)->{if(n.incrementAndGet()==1)throw new ToolExecutor.KnownFailure(Status.RETRYABLE_FAILURE,true);o.write("{}");})))){
                status(Status.OK,e.invoke(CTX,call("r","","{\"n\":1}"),budget(2)));check(n.get()==2);
            }
        });
        test("empty-output-bound-and-failure-classes",()->{
            try(ToolExecutor e=ex(Map.of("empty",spec(true,1,500,100,true,(i,o)->{}),"bad",spec(true,1,500,10,false,(i,o)->o.write("x".repeat(11))),"fail",spec(true,1,500,100,false,(i,o)->{throw new Exception("secret");}),"write",spec(false,3,500,10,false,(i,o)->o.write("bad"))))){
                status(Status.EMPTY_VALID,e.invoke(CTX,call("empty","","{\"n\":1}"),budget(1)));
                status(Status.INVALID_OUTPUT,e.invoke(CTX,call("bad","","{\"n\":1}"),budget(1)));
                status(Status.FAILED,e.invoke(CTX,call("fail","","{\"n\":1}"),budget(1)));
                status(Status.UNKNOWN,e.invoke(CTX,call("write","op","{\"n\":1}"),budget(3)));
            }
        });
        test("mutation-replay-conflict-scope-and-current-authorization",()->{
            AtomicInteger hits=new AtomicInteger();AtomicBoolean allowed=new AtomicBoolean(true);
            try(ToolExecutor e=new ToolExecutor(Map.of("w",spec(false,3,500,100,false,(i,o)->{hits.incrementAndGet();o.write("{}");})),(c,n,a)->allowed.get(),2,4,100)){
                status(Status.OK,e.invoke(CTX,call("w","op","{\"n\":1}"),budget(1)));
                status(Status.OK,e.invoke(CTX,call("w","op","{ \"n\" : 1 }"),budget(0)));check(hits.get()==1);
                status(Status.CONFLICT,e.invoke(CTX,call("w","op","{\"n\":2}"),budget(1)));
                allowed.set(false);status(Status.DENIED,e.invoke(CTX,call("w","op","{\"n\":1}"),budget(1)));allowed.set(true);
                status(Status.OK,e.invoke(new Context("tenant-b","alice","resource-1",Set.of("write")),call("w","op","{\"n\":1}"),budget(1)));check(hits.get()==2);
            }
        });
        test("concurrent-duplicate-never-executes-twice",()->{
            CountDownLatch entered=new CountDownLatch(1),release=new CountDownLatch(1);AtomicInteger hits=new AtomicInteger();
            try(ToolExecutor e=ex(Map.of("w",spec(false,1,1500,100,false,(i,o)->{hits.incrementAndGet();entered.countDown();release.await();o.write("{}");})))){
                AtomicReference<Reply> first=new AtomicReference<>();Thread t=new Thread(()->first.set(e.invoke(CTX,call("w","op","{\"n\":1}"),budget(1))));t.start();
                try{await(entered);status(Status.UNKNOWN,e.invoke(CTX,call("w","op","{\"n\":1}"),budget(1)));}finally{release.countDown();t.join(2000);}
                status(Status.OK,first.get());check(hits.get()==1);
            }
        });
        test("mutation-timeout-unknown-and-no-blind-retry",()->{
            AtomicInteger hits=new AtomicInteger();try(ToolExecutor e=ex(Map.of("w",spec(false,3,40,100,false,(i,o)->{hits.incrementAndGet();Thread.sleep(1000);o.write("{}");})))){
                Reply r=e.invoke(CTX,call("w","op","{\"n\":1}"),budget(3));status(Status.UNKNOWN,r);check(r.effectUncertain());
                status(Status.UNKNOWN,e.invoke(CTX,call("w","op","{\"n\":1}"),budget(3)));check(hits.get()==1);
            }
        });
        test("interrupt-retains-unknown-and-interrupt-flag",()->{
            CountDownLatch entered=new CountDownLatch(1);AtomicReference<Reply> got=new AtomicReference<>();AtomicBoolean flag=new AtomicBoolean();
            try(ToolExecutor e=ex(Map.of("w",spec(false,1,2000,100,false,(i,o)->{entered.countDown();Thread.sleep(2000);})))){
                Thread t=new Thread(()->{got.set(e.invoke(CTX,call("w","op","{\"n\":1}"),budget(1)));flag.set(Thread.currentThread().isInterrupted());});t.start();await(entered);t.interrupt();t.join(2000);check(!t.isAlive());status(Status.UNKNOWN,got.get());check(flag.get());
            }
        });
        test("parent-cancellation-and-expired-budget",()->{
            Cancellation c=new Cancellation();c.cancel();try(ToolExecutor e=ex(Map.of("r",spec(true,1,500,100,false,(i,o)->o.write("{}"))))){
                status(Status.CANCELLED,e.invoke(CTX,call("r","","{\"n\":1}"),Budget.after(Duration.ofSeconds(1),1,c)));
                status(Status.DEADLINE_EXCEEDED,e.invoke(CTX,call("r","","{\"n\":1}"),new Budget(System.nanoTime()-1_000_000,1,new Cancellation())));
            }
        });
        test("queue-cancellation-gate-and-overload",()->{
            CountDownLatch entered=new CountDownLatch(1),release=new CountDownLatch(1);AtomicInteger writes=new AtomicInteger();
            try(ToolExecutor e=new ToolExecutor(Map.of("block",spec(true,1,2000,100,false,(i,o)->{entered.countDown();release.await();o.write("{}");}),"w",spec(false,1,60,100,false,(i,o)->{writes.incrementAndGet();o.write("{}");})),(c,n,a)->true,1,1,100)){
                Thread t=new Thread(()->e.invoke(CTX,call("block","","{\"n\":1}"),budget(1)));t.start();await(entered);
                try{status(Status.DEADLINE_EXCEEDED,e.invoke(CTX,call("w","queued","{\"n\":1}"),budget(1)));check(writes.get()==0);
                    Thread q=new Thread(()->e.invoke(CTX,call("block","","{\"n\":1}"),budget(1)));q.start();long until=System.nanoTime()+TimeUnit.SECONDS.toNanos(1);while(e.queued()==0&&System.nanoTime()<until)Thread.onSpinWait();
                    status(Status.OVERLOADED,e.invoke(CTX,call("w","rejected","{\"n\":1}"),budget(1)));release.countDown();q.join(2000);
                }finally{release.countDown();t.join(2000);}check(writes.get()==0);
            }
        });
        test("revocation-while-queued-rechecked-at-worker-start",()->{
            CountDownLatch entered=new CountDownLatch(1),release=new CountDownLatch(1);AtomicBoolean allowed=new AtomicBoolean(true);AtomicInteger writes=new AtomicInteger();AtomicReference<Reply> result=new AtomicReference<>();
            try(ToolExecutor e=new ToolExecutor(Map.of("block",spec(true,1,2000,100,false,(i,o)->{entered.countDown();release.await();o.write("{}");}),"w",spec(false,1,2000,100,false,(i,o)->{writes.incrementAndGet();o.write("{}");})),(c,n,a)->!n.equals("w")||allowed.get(),1,2,100)){
                Thread t=new Thread(()->e.invoke(CTX,call("block","","{\"n\":1}"),budget(1)));t.start();await(entered);
                Thread w=new Thread(()->result.set(e.invoke(CTX,call("w","op","{\"n\":1}"),budget(1))));w.start();
                try{long until=System.nanoTime()+TimeUnit.SECONDS.toNanos(1);while(e.queued()==0&&System.nanoTime()<until)Thread.onSpinWait();check(e.queued()==1);allowed.set(false);}
                finally{release.countDown();t.join(2000);w.join(2000);}
                status(Status.DENIED,result.get());check(writes.get()==0);
            }
        });
        test("journal-capacity-and-read-timeout",()->{
            try(ToolExecutor e=new ToolExecutor(Map.of("w",spec(false,1,500,100,false,(i,o)->o.write("{}")),"r",spec(true,1,20,100,false,(i,o)->Thread.sleep(1000))),(c,n,a)->true,1,2,1)){
                status(Status.OK,e.invoke(CTX,call("w","op1","{\"n\":1}"),budget(1)));
                status(Status.OVERLOADED,e.invoke(CTX,call("w","op2","{\"n\":1}"),budget(1)));
                status(Status.OK,e.invoke(CTX,call("w","op1","{\"n\":1}"),budget(0)));
                status(Status.DEADLINE_EXCEEDED,e.invoke(CTX,call("r","","{\"n\":1}"),budget(1)));
            }
        });
        test("cleanup-primary-self-suppression-independent-stages",()->{
            Exception primary=new Exception("primary"),later=new Exception("later");AtomicInteger stages=new AtomicInteger();
            Throwable got=Cleanup.collect(primary,()->{stages.incrementAndGet();throw primary;},()->{stages.incrementAndGet();throw later;},()->{stages.incrementAndGet();throw later;});
            check(got==primary&&stages.get()==3&&primary.getSuppressed().length==1&&primary.getSuppressed()[0]==later);
            InterruptedException interruption=new InterruptedException();check(Cleanup.collect(null,()->{throw interruption;},stages::incrementAndGet)==interruption);check(Thread.interrupted());
        });
        System.out.println("ToolExecutorTest: "+passed+" test groups passed");
    }
}

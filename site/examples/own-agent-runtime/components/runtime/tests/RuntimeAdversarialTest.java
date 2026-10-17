import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

public final class RuntimeAdversarialTest {
    private static int passed;
    private static final DurableRuntime.Auth YES=new DurableRuntime.Auth("tenant-a","user-a",true);
    private static final String ACTION="set-limit|resource=module-c|expectedVersion=7|limit=20";
    @FunctionalInterface interface Test {void run()throws Exception;}
    static void test(String name,Test t)throws Exception{t.run();passed++;System.out.println("PASS "+name);}
    static void check(boolean b){if(!b)throw new AssertionError();}
    static void rejects(Test t)throws Exception{
        try{t.run();}catch(SecurityException|IllegalStateException|IllegalArgumentException|java.io.IOException e){return;}
        throw new AssertionError("expected rejection");
    }
    static DurableRuntime fresh(Path p)throws Exception{return new DurableRuntime(p,"tenant-a","user-a",1000,2);}
    static long prepare(DurableRuntime r)throws Exception{
        long e=r.claim("worker-a",0,200);r.requestApproval("worker-a",e,1,"op-1",ACTION);
        r.approve(YES,"op-1",r.view().digest(),2,400);return r.claim("worker-b",3,200);
    }
    public static void main(String[] args)throws Exception {
        Path dir=Files.createTempDirectory("runtime-teaching-");
        try {
            test("approval survives restart",()->{
                Path p=dir.resolve("approval.log");String digest;
                try(DurableRuntime r=fresh(p)){long e=r.claim("a",0,50);r.requestApproval("a",e,1,"op",ACTION);digest=r.view().digest();}
                try(DurableRuntime r=fresh(p)){check(r.view().phase()==DurableRuntime.Phase.WAITING_APPROVAL);r.approve(YES,"op",digest,2,80);check(r.view().phase()==DurableRuntime.Phase.READY);}
            });
            test("two claimants cannot own one epoch",()->{
                try(DurableRuntime r=fresh(dir.resolve("claim.log"))){
                    ExecutorService pool=Executors.newFixedThreadPool(2);AtomicInteger wins=new AtomicInteger();
                    try{List<Future<?>> fs=new ArrayList<>();for(int i=0;i<2;i++){String name="w"+i;fs.add(pool.submit(()->{try{r.claim(name,0,50);wins.incrementAndGet();}catch(IllegalStateException expected){}catch(Exception e){throw new RuntimeException(e);}}));}for(Future<?> f:fs)f.get();check(wins.get()==1);}finally{pool.shutdownNow();check(pool.awaitTermination(2,TimeUnit.SECONDS));}
                }
            });
            test("expired owner fenced",()->{try(DurableRuntime r=fresh(dir.resolve("fence.log"))){long old=r.claim("old",0,10);long newer=r.claim("new",11,30);check(newer>old);rejects(()->r.heartbeat("old",old,12,10));}});
            test("lease boundary is expired",()->{try(DurableRuntime r=fresh(dir.resolve("boundary.log"))){long e=r.claim("w",0,10);rejects(()->r.heartbeat("w",e,10,10));}});
            test("cross tenant approval denied",()->{try(DurableRuntime r=fresh(dir.resolve("tenant.log"))){long e=r.claim("w",0,10);r.requestApproval("w",e,1,"op",ACTION);rejects(()->r.approve(new DurableRuntime.Auth("tenant-b","user-a",true),"op",r.view().digest(),2,20));}});
            test("approval bound to digest and operation",()->{try(DurableRuntime r=fresh(dir.resolve("digest.log"))){long e=r.claim("w",0,10);r.requestApproval("w",e,1,"op",ACTION);rejects(()->r.approve(YES,"other",r.view().digest(),2,20));rejects(()->r.approve(YES,"op","bad",2,20));}});
            test("expired approval cannot dispatch",()->{try(DurableRuntime r=fresh(dir.resolve("expiry.log"))){long e=prepare(r);r.heartbeat("worker-b",e,100,500);rejects(()->r.dispatch(YES,"worker-b",e,400,ACTION));}});
            test("revocation checked at dispatch",()->{try(DurableRuntime r=fresh(dir.resolve("revoke.log"))){long e=prepare(r);rejects(()->r.dispatch(new DurableRuntime.Auth("tenant-a","user-a",false),"worker-b",e,4,ACTION));check(r.view().remaining()==2);}});
            test("changed action cannot reuse approval",()->{try(DurableRuntime r=fresh(dir.resolve("change.log"))){long e=prepare(r);rejects(()->r.dispatch(YES,"worker-b",e,4,ACTION+"0"));}});
            test("dispatch is durable and never blindly replayed",()->{
                Path p=dir.resolve("unknown.log");try(DurableRuntime r=fresh(p)){long e=prepare(r);r.dispatch(YES,"worker-b",e,4,ACTION);}
                try(DurableRuntime r=fresh(p)){r.recoverDispatched();check(r.view().phase()==DurableRuntime.Phase.UNKNOWN);check(r.view().remaining()==1);rejects(()->r.claim("new",500,20));r.reconcile(YES,DurableRuntime.RemoteState.APPLIED,"remote-receipt-1");check(r.view().phase()==DurableRuntime.Phase.SUCCEEDED);}
            });
            test("cancellation after dispatch retains uncertainty",()->{try(DurableRuntime r=fresh(dir.resolve("cancel.log"))){long e=prepare(r);r.dispatch(YES,"worker-b",e,4,ACTION);r.requestCancel();check(r.view().phase()==DurableRuntime.Phase.UNKNOWN);r.reconcile(YES,DurableRuntime.RemoteState.APPLIED,"receipt");check(r.view().cancelled());check(r.view().phase()==DurableRuntime.Phase.SUCCEEDED);}});
            test("cancel before dispatch means no tool",()->{try(DurableRuntime r=fresh(dir.resolve("pre-cancel.log"))){long e=prepare(r);r.requestCancel();rejects(()->r.dispatch(YES,"worker-b",e,4,ACTION));check(r.view().phase()==DurableRuntime.Phase.CANCELLED);}});
            test("deadline forbids claim",()->{try(DurableRuntime r=fresh(dir.resolve("deadline.log"))){rejects(()->r.claim("a",1000,50));}});
            test("duplicate completion cannot advance sequence",()->{try(DurableRuntime r=fresh(dir.resolve("done.log"))){long e=prepare(r);r.dispatch(YES,"worker-b",e,4,ACTION);r.complete("worker-b",e,5,"receipt");long seq=r.view().sequence();rejects(()->r.complete("worker-b",e,6,"receipt"));check(r.view().sequence()==seq);}});
            test("single local writer lock",()->{Path p=dir.resolve("lock.log");try(DurableRuntime r=fresh(p)){try(DurableRuntime ignored=fresh(p)){throw new AssertionError();}catch(java.nio.channels.OverlappingFileLockException expected){}}});
            test("torn journal fails closed",()->{Path p=dir.resolve("torn.log");try(DurableRuntime r=fresh(p)){}Files.writeString(p,"partial",StandardOpenOption.APPEND);rejects(()->{try(DurableRuntime ignored=fresh(p)){} });});
            test("checksum corruption fails closed",()->{Path p=dir.resolve("corrupt.log");try(DurableRuntime r=fresh(p)){}byte[] data=Files.readAllBytes(p);data[5]=data[5]=='A'?(byte)'B':(byte)'A';Files.write(p,data);rejects(()->{try(DurableRuntime ignored=fresh(p)){} });});
            test("DAG join waits for both independent parents",()->{Set<String> done=ConcurrentHashMap.newKeySet();Map<String,String> r=BoundedDag.run(List.of(new BoundedDag.Node("a",Set.of(),()->{done.add("a");return "A";}),new BoundedDag.Node("b",Set.of(),()->{done.add("b");return "B";}),new BoundedDag.Node("join",Set.of("a","b"),()->{check(done.size()==2);return "AB";})),2,1000);check(r.get("join").equals("AB"));});
            test("DAG rejects cycle before any execution",()->{AtomicInteger calls=new AtomicInteger();rejects(()->BoundedDag.run(List.of(new BoundedDag.Node("a",Set.of("b"),()->{calls.incrementAndGet();return "";}),new BoundedDag.Node("b",Set.of("a"),()->"")),2,1000));check(calls.get()==0);});
            test("DAG rejects unknown dependency",()->rejects(()->BoundedDag.run(List.of(new BoundedDag.Node("a",Set.of("missing"),()->"")),1,1000)));
            test("failed dependency cannot run child",()->{AtomicInteger child=new AtomicInteger();try{BoundedDag.run(List.of(new BoundedDag.Node("a",Set.of(),()->{throw new IllegalStateException("boom");}),new BoundedDag.Node("b",Set.of("a"),()->{child.incrementAndGet();return "";})),1,1000);throw new AssertionError();}catch(ExecutionException expected){}check(child.get()==0);});
            test("DAG deadline cancels cooperative work",()->{try{BoundedDag.run(List.of(new BoundedDag.Node("wait",Set.of(),()->{new CountDownLatch(1).await();return "";})),1,20);throw new AssertionError();}catch(TimeoutException expected){}});
            test("stream duplicates do not duplicate text",()->{StreamProjection s=new StreamProjection("r");s.accept(new StreamProjection.Event("r",1,StreamProjection.Type.START,"",""));var e=new StreamProjection.Event("r",2,StreamProjection.Type.TEXT,"","你");s.accept(e);s.accept(e);check(s.text().equals("你"));});
            test("stream gaps and cross run are rejected",()->{StreamProjection s=new StreamProjection("r");rejects(()->s.accept(new StreamProjection.Event("r",2,StreamProjection.Type.START,"","")));rejects(()->s.accept(new StreamProjection.Event("other",1,StreamProjection.Type.START,"","")));});
            test("partial tool arguments are not executable",()->{StreamProjection s=new StreamProjection("r");s.accept(new StreamProjection.Event("r",1,StreamProjection.Type.START,"",""));s.accept(new StreamProjection.Event("r",2,StreamProjection.Type.TOOL_START,"c",""));check(s.accept(new StreamProjection.Event("r",3,StreamProjection.Type.TOOL_DELTA,"c","{\"x\":" )).isEmpty());check(s.accept(new StreamProjection.Event("r",4,StreamProjection.Type.TOOL_DELTA,"c","1}")).isEmpty());check(s.accept(new StreamProjection.Event("r",5,StreamProjection.Type.TOOL_END,"c","")).orElseThrow().arguments().equals("{\"x\":1}"));rejects(()->s.accept(new StreamProjection.Event("r",6,StreamProjection.Type.END,"","")));s.accept(new StreamProjection.Event("r",6,StreamProjection.Type.TOOL_RESULT,"c","ok"));s.accept(new StreamProjection.Event("r",7,StreamProjection.Type.END,"",""));check(s.ended());});
            test("same stream ID different data rejected",()->{StreamProjection s=new StreamProjection("r");s.accept(new StreamProjection.Event("r",1,StreamProjection.Type.START,"",""));rejects(()->s.accept(new StreamProjection.Event("r",1,StreamProjection.Type.START,"","different")));});
            System.out.println("TOTAL "+passed+" passed");
        } finally {try(var walk=Files.walk(dir)){for(Path p:walk.sorted(Comparator.reverseOrder()).toList())Files.delete(p);}}
    }
}

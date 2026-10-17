import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;

public final class TaskTests {
    private static int checks;
    private static void check(boolean b,String m){checks++;if(!b)throw new AssertionError(m);}
    private static TaskOrchestrationLab.Input in(String tenant,String request,String document,long version,long deadline,int priority){
        return new TaskOrchestrationLab.Input(tenant,request,document,version,"snapshot-"+version,"a".repeat(64),123,deadline,priority);
    }
    private static void pipeline(TaskOrchestrationLab s,String key,long now)throws Exception{
        for(int n=0;n<4;n++){var t=s.claim(key,"worker",now+n*2,10);check(t!=null,"stage claim");check(s.complete(t,"artifact-"+n,now+n*2+1),"stage commit");}
    }
    public static void main(String[] args)throws Exception{
        Path root=Files.createTempDirectory("task-lab-");Path d=Files.createDirectory(root.resolve("store"));
        Throwable testFailure=null;
        try{
            try(TaskOrchestrationLab s=new TaskOrchestrationLab(d,100,30,3)){
                var input=in("tenant","normal","doc",1,100,1);s.submit(input,0);
                check(s.durableResponsibility(input.key()),"wakeup may only reference durable obligation");
                check(s.submit(input,200).input().equals(input),"replay original receipt after deadline");
                try{s.submit(in("tenant","normal","doc",2,100,1),0);throw new AssertionError();}catch(IllegalArgumentException expected){checks++;}
                pipeline(s,input.key(),1);check(s.get(input.key()).state()==TaskOrchestrationLab.State.SUCCEEDED,"all four stages");
                check(s.document("tenant/doc").publishedArtifact().equals("artifact-3"),"final publication");
                check(s.cancel(input.key(),50)==TaskOrchestrationLab.State.SUCCEEDED,"completion wins before cancellation");
                s.submit(in("tenant","retry","retrydoc",1,100,1),0);var old=s.claim("tenant/retry","one",0,10);
                check(s.retryKnownSafe(old,1,2),"known safe retry");check(s.claim("tenant/retry","two",2,10)==null,"backoff");
                var next=s.claim("tenant/retry","two",3,10);check(next.epoch()>old.epoch()&&next.operationId().equals(old.operationId()),"stable operation across attempts");
                check(!s.complete(old,"stale",4),"stale attempt rejected");check(s.heartbeat(next,4,10),"renew current token");
                check(!s.heartbeat(old,4,10),"stale heartbeat rejected");
                s.submit(in("tenant","unknown","unknown-doc",1,20,1),0);var uncertain=s.claim("tenant/unknown","one",0,10);
                check(!s.complete(uncertain,"too-late",10),"exact lease boundary");
                var observed=s.get("tenant/unknown");check(s.recover("tenant/unknown",observed.revision(),10),"recovery scanner");
                check(s.claim("tenant/unknown","two",10,10)==null,"UNKNOWN cannot blindly rerun");
                check(!s.reconcile("tenant/unknown",uncertain.epoch()+1,TaskOrchestrationLab.Receipt.NOT_STARTED_AND_FENCED,"",10),"wrong reconciliation epoch");
                check(s.reconcile("tenant/unknown",uncertain.epoch(),TaskOrchestrationLab.Receipt.NOT_STARTED_AND_FENCED,"",10),"trusted fence proof");
                var c=s.claim("tenant/unknown","two",11,4);check(c!=null&&c.epoch()==2,"new owner after proof");
                check(s.cancel("tenant/unknown",12)==TaskOrchestrationLab.State.CANCEL_REQUESTED,"running cancellation is a request");
                check(!s.complete(c,"late-output",12),"cancel rejects ordinary late completion");
                check(s.reconcile("tenant/unknown",c.epoch(),TaskOrchestrationLab.Receipt.SUCCEEDED,"late-output",13),"record remote result during cancel");
                check(s.get("tenant/unknown").state()==TaskOrchestrationLab.State.CANCELLED,"publication cancelled");
                check(s.document("tenant/unknown-doc").publishedArtifact().isEmpty(),"cancelled artifact never published");
                s.submit(in("tenant","v1","mutable",1,100,1),0);var v1=s.claim("tenant/v1","one",1,10);
                s.submit(in("tenant","v2","mutable",2,100,1),2);check(!s.complete(v1,"old",3),"superseded document generation");
                s.deleteDocument("tenant/mutable",3);check(s.claim("tenant/v2","two",4,10)==null,"tombstone prevents resurrection");
                s.submit(in("tenant","expiry","expires",1,5,1),0);
                var t=s.get("tenant/expiry");check(s.recover(t.input().key(),t.revision(),5),"queued deadline");
                check(s.get("tenant/expiry").state()==TaskOrchestrationLab.State.EXPIRED,"expiry is durable terminal, not deletion");
                s.submit(in("tenant","race","race-doc",1,100,1),0);
                ExecutorService pool=Executors.newFixedThreadPool(4);
                Throwable poolFailure=null;
                try{
                    List<Callable<Boolean>> jobs=new ArrayList<>();for(int i=0;i<30;i++)jobs.add(()->s.claim("tenant/race","racer",1,10)!=null);
                    int wins=0;for(Future<Boolean> f:pool.invokeAll(jobs,5,TimeUnit.SECONDS))if(f.get())wins++;
                    check(wins==1,"30 competing claims, one owner");
                }catch(Exception|Error failure){poolFailure=failure;throw failure;}finally{JdbcSafety.closePool(pool,poolFailure);}
                AtomicLong now=new AtomicLong(50);
                CompensationJobContract job=new CompensationJobContract(new CompensationJobContract.LocalPort(s),now::get,System::nanoTime);
                int inspected=0;for(int n=0;n<12;n++)inspected+=job.run(0,1,2,2,1_000_000_000L).inspected();
                check(inspected>0&&s.get("tenant/race").state()==TaskOrchestrationLab.State.UNKNOWN,"bounded cursor eventually reaches expired owner");
                Thread.currentThread().interrupt();check(job.run(0,1,2,2,1_000_000_000L).interrupted(),"cooperative cancellation");Thread.interrupted();
                s.saveScanCursor("edge","界".repeat(1365)+"x");
                check(s.scanCursor("edge").getBytes(java.nio.charset.StandardCharsets.UTF_8).length==4096,"exact byte boundary accepted");
                s.saveScanCursor("restart","tenant/normal");
                try{s.saveScanCursor("restart","界".repeat(1366));throw new AssertionError("multibyte cursor accepted");}
                catch(IllegalArgumentException expected){check(s.scanCursor("restart").equals("tenant/normal"),"UTF-8 byte bound before append");}
                try{s.saveScanCursor("restart",null);throw new AssertionError("null cursor accepted");}
                catch(NullPointerException expected){check(s.scanCursor("restart").equals("tenant/normal"),"null rejected before append");}
                try{s.saveScanCursor("restart","x".repeat(4097));throw new AssertionError("oversize cursor accepted");}
                catch(IllegalArgumentException expected){check(s.scanCursor("restart").equals("tenant/normal"),"oversize rejected before durable mutation");}
                try{s.saveScanCursor("restart","\uD800");throw new AssertionError("invalid Unicode cursor accepted");}
                catch(java.nio.charset.CharacterCodingException expected){check(s.scanCursor("restart").equals("tenant/normal"),"invalid encoding rejected before append");}
            }
            try(TaskOrchestrationLab s=new TaskOrchestrationLab(d,100,30,3)){
                check(s.get("tenant/normal").state()==TaskOrchestrationLab.State.SUCCEEDED,"restart retains completion");
                check(s.get("tenant/race").state()==TaskOrchestrationLab.State.UNKNOWN,"restart retains unknown responsibility");
                check(s.scanCursor("restart").equals("tenant/normal"),"persistent recovery cursor");
                check(s.scanCursor("edge").equals("界".repeat(1365)+"x"),"byte boundary survives reopen after rejected writes");
                check(s.document("tenant/mutable").deleted(),"durable tombstone");
            }
            Path cap=Files.createDirectory(root.resolve("capacity"));
            try(TaskOrchestrationLab s=new TaskOrchestrationLab(cap,2,1,2)){
                s.submit(in("a","r","d",1,10000,2),0);
                try{s.submit(in("a","other","e",1,10000,2),0);throw new AssertionError();}catch(IllegalStateException expected){checks++;}
                s.submit(in("b","r","d",1,10000,0),0);
                TaskOrchestrationLab.FairGate gate=new TaskOrchestrationLab.FairGate(2,1);
                var one=gate.choose(s.snapshot(),1);check(one!=null,"first permit");var two=gate.choose(s.snapshot(),1);
                check(two!=null&&two.task().input().priority()==0,"P0 reserved permit");check(gate.choose(s.snapshot(),1)==null,"bounded in flight");
                gate.release(one);gate.release(one);gate.release(two);check(gate.inFlight()==0,"idempotent release");
                TaskOrchestrationLab.FairGate single=new TaskOrchestrationLab.FairGate(1,0);
                var stalePermit=single.choose(s.snapshot(),1);single.release(stalePermit);
                var currentPermit=single.choose(List.of(stalePermit.task()),2);
                check(currentPermit!=null,"same task can acquire again");single.release(stalePermit);
                check(single.inFlight()==1&&single.choose(s.snapshot(),2)==null,"stale release cannot remove new permit");
                single.release(currentPermit);single.release(currentPermit);check(single.inFlight()==0,"exact permit release remains idempotent");
            }
            try{in("t","r","d",1,1,0);new TaskOrchestrationLab.Input("t","r","d",1,"s","a".repeat(64),128L*1024*1024+1,1,0);throw new AssertionError();}
            catch(IllegalArgumentException expected){checks++;}
            System.out.println("PASS TaskTests: "+checks+" bounded checks; durable four-stage state, replay, lease, UNKNOWN, cancellation, generation, scanner, fairness. No broker/model/XXL cluster.");
        }catch(Exception|Error failure){testFailure=failure;throw failure;}finally{FailureTools.cleanup(testFailure, () -> {JournalTests.delete(root);});}
    }
}

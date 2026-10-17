import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
public final class BusinessTests {
    private static int checks;
    private static void check(boolean b){checks++;if(!b)throw new AssertionError("check "+checks);}
    public static void main(String[] args)throws Exception{
        Path dir=Files.createTempDirectory("mq-business-test-");String slotId;
        Throwable testFailure=null;
        try{
            try(BusinessStateModels s=new BusinessStateModels(dir)){
                var v1=s.setBan("user",10,0);var v2=s.setBan("user",20,1);
                check(v2.version()==v1.version()+1);check(!s.expire("user",v1.version(),11));check(!s.expire("user",v2.version(),19));
                check(s.expire("user",v2.version(),20));check(!s.expire("user",v2.version(),21));check(!s.ban("user").active());
                check(s.pendingEffects().size()==3);String first=s.pendingEffects().getFirst().id();s.acknowledgeEffect(first);s.acknowledgeEffect(first);check(s.pendingEffects().size()==2);
                s.putRule("temp",1,10,true);check(s.claim("temp",1,11,"w",11,5)==null);check(s.claim("temp",1,20,"w",11,5)==null);
                ExecutorService pool=Executors.newFixedThreadPool(4);
                Throwable poolFailure=null;
                try{
                    List<Callable<BusinessStateModels.Slot>> calls=new ArrayList<>();for(int i=0;i<20;i++)calls.add(()->s.claim("temp",1,10,"w",10,5));
                    var futures=pool.invokeAll(calls,5,TimeUnit.SECONDS);int winners=0;BusinessStateModels.Slot ticket=null;
                    for(var f:futures){check(!f.isCancelled());var t=f.get();if(t!=null){winners++;ticket=t;}}
                    check(winners==1);slotId=Objects.requireNonNull(ticket).id();check(!s.complete(ticket,15));check(s.expireSlot(slotId,1,15));
                    check(s.claim("temp",1,10,"new",16,5)==null);check(!s.resolve(slotId,1,TaskOrchestrationLab.Receipt.UNRESOLVED));
                    check(s.resolve(slotId,1,TaskOrchestrationLab.Receipt.NOT_STARTED_AND_FENCED));var next=s.claim("temp",1,10,"new",16,5);
                    check(next.epoch()==2);check(!s.complete(ticket,17));check(s.complete(next,17));check(!s.complete(next,18));
                }catch(Exception|Error failure){poolFailure=failure;throw failure;}finally{JdbcSafety.closePool(pool,poolFailure);}
                var old=s.claim("temp",1,20,"w",20,5);s.putRule("temp",2,10,true);check(!s.complete(old,21));
                check(s.claim("temp",1,30,"w",30,5)==null);check(s.claim("temp",2,30,"w",30,5)!=null);
                check(BusinessStateModels.suggestedOwner("temp",3)>=0);
            }
            try(BusinessStateModels s=new BusinessStateModels(dir)){check(!s.ban("user").active());check(s.pendingEffects().size()==2);check(s.slot(slotId).state().equals("DONE"));}
            System.out.println("PASS BusinessTests: "+checks+" bounded checks; versioned unban/outbox and periodic-rule slot identity. No SQL/Redis/external delivery.");
        }catch(Exception|Error failure){testFailure=failure;throw failure;}finally{FailureTools.cleanup(testFailure, () -> {try(var paths=Files.walk(dir)){for(Path p:paths.sorted(Comparator.reverseOrder()).toList())Files.delete(p);}if(Files.exists(dir))throw new AssertionError("cleanup");});}
    }
}

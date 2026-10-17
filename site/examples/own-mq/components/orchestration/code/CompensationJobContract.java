import java.io.IOException;
import java.util.*;
import java.util.function.LongSupplier;

/** Same per-task CAS is used by normal delivery and recovery; scheduler log ID is never operation ID. */
public final class CompensationJobContract {
    public record Candidate(String key, long revision) { }
    public record Report(int inspected, int changed, boolean interrupted) { }
    public interface Port {
        String cursor(String scan) throws IOException;
        List<Candidate> page(String after, int limit) throws IOException;
        boolean recover(Candidate row, long authorityNow) throws IOException;
        void checkpoint(String scan, String cursor) throws IOException;
    }
    private final Port port;
    private final LongSupplier authorityClock, monotonicClock;
    public CompensationJobContract(Port port, LongSupplier authorityClock, LongSupplier monotonicClock) {
        this.port=Objects.requireNonNull(port);this.authorityClock=Objects.requireNonNull(authorityClock);
        this.monotonicClock=Objects.requireNonNull(monotonicClock);
    }
    public Report run(int shard,int shards,int batch,int maxRows,long budgetNanos) throws IOException {
        if(shards<1||shards>1024||shard<0||shard>=shards||batch<1||batch>100||maxRows<1||maxRows>500||budgetNanos<=0)
            throw new IllegalArgumentException("bounded scan configuration");
        String scan="compensation-"+shards+"-"+shard, cursor=port.cursor(scan);
        long started=monotonicClock.getAsLong();int inspected=0,changed=0;
        while(inspected<maxRows && monotonicClock.getAsLong()-started<budgetNanos) {
            if(Thread.currentThread().isInterrupted())return new Report(inspected,changed,true);
            List<Candidate> rows=port.page(cursor,Math.min(batch,maxRows-inspected));
            if(rows.isEmpty()){port.checkpoint(scan,"");break;}
            for(Candidate c:rows) {
                if(Thread.currentThread().isInterrupted())return new Report(inspected,changed,true);
                if(monotonicClock.getAsLong()-started>=budgetNanos)return new Report(inspected,changed,false);
                if(Math.floorMod(c.key().hashCode(),shards)==shard && port.recover(c,authorityClock.getAsLong()))changed++;
                inspected++; cursor=c.key();
            }
            port.checkpoint(scan,cursor);
        }
        return new Report(inspected,changed,false);
    }
    /** Local durable adapter only. A shared production database adapter implements the same port. */
    public static final class LocalPort implements Port {
        private final TaskOrchestrationLab tasks;
        public LocalPort(TaskOrchestrationLab tasks){this.tasks=Objects.requireNonNull(tasks);}
        public String cursor(String scan)throws IOException{return tasks.scanCursor(scan);}
        public List<Candidate> page(String after,int limit)throws IOException{
            return tasks.page(after.isEmpty()?null:after,limit).stream()
                    .map(t->new Candidate(t.input().key(),t.revision())).toList();
        }
        public boolean recover(Candidate c,long now)throws IOException{return tasks.recover(c.key(),c.revision(),now);}
        public void checkpoint(String scan,String cursor)throws IOException{tasks.saveScanCursor(scan,cursor);}
    }
}

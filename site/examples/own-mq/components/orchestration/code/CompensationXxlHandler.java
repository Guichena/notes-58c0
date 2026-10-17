import com.xxl.job.core.context.XxlJobHelper;
import com.xxl.job.core.handler.annotation.XxlJob;
import java.util.Objects;

/** Version-pinned to xxl-job-core 3.3.1. Handler success means this bounded scan returned. */
public final class CompensationXxlHandler {
    private final CompensationJobContract job;
    public CompensationXxlHandler(CompensationJobContract job){this.job=Objects.requireNonNull(job);}
    @XxlJob("compensateTasks")
    public void execute() throws Exception {
        int shard=XxlJobHelper.getShardIndex(), shards=XxlJobHelper.getShardTotal();
        if(shard<0||shards<1)throw new IllegalStateException("XXL shard context required");
        CompensationJobContract.Report r=job.run(shard,shards,25,200,2_000_000_000L);
        if(r.interrupted())throw new InterruptedException("scan interrupted; durable task responsibility remains");
        XxlJobHelper.handleSuccess("inspected="+r.inspected()+", recovered="+r.changed());
    }
}

import com.xxl.job.core.executor.impl.XxlJobSimpleExecutor;
import java.nio.file.*;
import java.util.List;
import java.util.concurrent.*;

/** Optional local integration entrypoint. Never started by the offline test suite. */
public final class CompensationExecutor {
    /** Every cleanup action is attempted; a primary failure is never replaced by cleanup. */
    static void cleanup(ExecutorService recovery,Runnable destroy,Runnable unhook,Throwable prior)throws Exception {
        Throwable failure=prior;
        try{JdbcSafety.closePool(recovery,prior);}catch(Exception|Error e){failure=e;}
        for(Runnable action:List.of(destroy,unhook)){
            try{action.run();}catch(RuntimeException|Error e){
                if(failure==null)failure=e;else if(failure!=e)failure.addSuppressed(e);
            }
        }
        if(prior==null&&failure!=null){
            if(failure instanceof Exception e)throw e;
            throw (Error)failure;
        }
    }
    public static void main(String[] args) throws Exception {
        if(args.length!=1)throw new IllegalArgumentException("one dedicated existing task directory required");
        String admin=System.getenv("XXL_ADMIN_ADDRESSES"), token=System.getenv("XXL_ACCESS_TOKEN");
        if(admin==null||admin.isBlank()||token==null||token.isBlank())throw new IllegalStateException("set authorized admin and token via environment");
        int port=Integer.parseInt(System.getenv().getOrDefault("XXL_EXECUTOR_PORT","19999"));
        if(port<1024||port>65535)throw new IllegalArgumentException("unprivileged executor port required");
        Path dir=Path.of(args[0]).toRealPath();
        CountDownLatch terminated=new CountDownLatch(1);
        try(TaskOrchestrationLab tasks=new TaskOrchestrationLab(dir,500,100,4)) {
            CompensationJobContract job=new CompensationJobContract(new CompensationJobContract.LocalPort(tasks),System::currentTimeMillis,System::nanoTime);
            XxlJobSimpleExecutor executor=new XxlJobSimpleExecutor();
            executor.setAdminAddresses(admin);executor.setAccessToken(token);executor.setAppname("mq-lab-compensation");
            // Registration address only: XXL 3.3.1 EmbedServer binds the wildcard port.
            // Operator must verify authorized network isolation before starting this entrypoint.
            executor.setIp("127.0.0.1");executor.setPort(port);
            executor.setLogPath(dir.resolve("xxl-logs").toString());executor.setLogRetentionDays(7);
            executor.setXxlJobBeanList(List.of(new CompensationXxlHandler(job)));
            CountDownLatch stop=new CountDownLatch(1);
            Thread hook=new Thread(()->{
                stop.countDown();
                try{if(!terminated.await(12,TimeUnit.SECONDS))System.err.println("bounded shutdown wait expired");}
                catch(InterruptedException e){Thread.currentThread().interrupt();}
            },"compensation-shutdown");
            // An independent local scanner remains active even if the admin is unavailable.
            ScheduledExecutorService recovery=Executors.newSingleThreadScheduledExecutor();
            Throwable failure=null; boolean hookRegistered=false;
            try {
                Runtime.getRuntime().addShutdownHook(hook);hookRegistered=true;
                executor.start();
                recovery.scheduleWithFixedDelay(()->{
                    try{job.run(0,1,25,200,2_000_000_000L);}catch(Exception e){System.err.println("recovery failed: "+e.getClass().getSimpleName());}
                },0,5,TimeUnit.SECONDS);
                stop.await(10,TimeUnit.MINUTES); // Bounded demo lifetime, not a production service manager.
            } catch(Exception|Error e) { failure=e;throw e;
            } finally {
                boolean registered=hookRegistered;
                cleanup(recovery,executor::destroy,()->{
                    if(registered)try{Runtime.getRuntime().removeShutdownHook(hook);}
                    catch(IllegalStateException shuttingDown){ /* JVM is already running the hook. */ }
                },failure);
            }
        } finally { terminated.countDown(); }
    }
}

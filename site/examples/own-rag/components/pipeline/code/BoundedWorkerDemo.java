import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

/** Complete synthetic saturation demonstration; not a persistent queue or an application scheduler. */
public final class BoundedWorkerDemo {
    private BoundedWorkerDemo() {}
    public static void main(String[] args) throws Exception {
        CountDownLatch started=new CountDownLatch(8), release=new CountDownLatch(1);
        AtomicInteger completed=new AtomicInteger();
        ThreadPoolExecutor worker=new ThreadPoolExecutor(8,8,0L,TimeUnit.MILLISECONDS,
                new ArrayBlockingQueue<>(8),new ThreadPoolExecutor.AbortPolicy());
        Runnable hold=()->{
            started.countDown();
            try {release.await();completed.incrementAndGet();}
            catch(InterruptedException e){Thread.currentThread().interrupt();}
        };
        try {
            for(int i=0;i<8;i++)worker.execute(hold);
            if(!started.await(5,TimeUnit.SECONDS))throw new AssertionError("workers failed to start");
            for(int i=0;i<8;i++)worker.execute(completed::incrementAndGet);
            if(worker.getQueue().size()!=8)throw new AssertionError("queue bound");
            try {worker.execute(completed::incrementAndGet);throw new AssertionError("expected rejection");}
            catch(RejectedExecutionException expected) { /* Leave durable task pending; do not claim acceptance. */ }
        } finally {
            release.countDown();worker.shutdown();
            if(!worker.awaitTermination(5,TimeUnit.SECONDS))worker.shutdownNow();
        }
        if(completed.get()!=16)throw new AssertionError("lost accepted work");
        System.out.println("PASS: 8 running + 8 queued; 17th rejected; all 16 accepted tasks completed. No database, broker, lease or crash recovery exercised.");
    }
}

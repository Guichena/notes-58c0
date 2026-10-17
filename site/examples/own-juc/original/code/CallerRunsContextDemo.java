import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;

/** 饱和时任务可能嵌套执行在调用者线程，ThreadLocal 必须按作用域恢复。 */
public final class CallerRunsContextDemo {
    private static final ThreadLocal<String> TRACE = new ThreadLocal<>();
    private static int assertions;
    private static void check(String name, boolean ok) {
        if (!ok) throw new AssertionError(name);
        assertions++;
        System.out.println("PASS " + name);
    }
    private static void await(CountDownLatch gate) throws InterruptedException {
        if (!gate.await(5, TimeUnit.SECONDS)) throw new AssertionError("gate stuck");
    }
    private static Runnable scoped(String captured, Runnable body) {
        return () -> {
            String previous = TRACE.get(); // 必须在实际执行线程上读取旧值。
            if (captured == null) TRACE.remove(); else TRACE.set(captured);
            try { body.run(); }
            finally {
                // null 在本示例表示“没有上下文”；不承诺区分显式 null 与不存在。
                if (previous == null) TRACE.remove(); else TRACE.set(previous);
            }
        };
    }
    public static void main(String[] args) throws Exception {
        ThreadPoolExecutor pool = new ThreadPoolExecutor(1, 1, 0, TimeUnit.SECONDS,
                new ArrayBlockingQueue<>(1), new ThreadPoolExecutor.CallerRunsPolicy());
        CountDownLatch workerEntered = new CountDownLatch(1);
        CountDownLatch releaseWorker = new CountDownLatch(1);
        Future<?> blocked = pool.submit(() -> {
            workerEntered.countDown();
            try { await(releaseWorker); }
            catch (InterruptedException ex) { Thread.currentThread().interrupt(); }
        });
        try {
            await(workerEntered);
            Future<?> queued = pool.submit(() -> {}); // 稳定占满唯一队列槽位。
            TRACE.set("outer-request");
            long callerId = Thread.currentThread().threadId();
            AtomicReference<String> observed = new AtomicReference<>();
            Future<?> inline = pool.submit(scoped("inner-request", () -> {
                observed.set(TRACE.get());
                check("饱和任务由提交线程执行", Thread.currentThread().threadId() == callerId);
            }));
            inline.get(5, TimeUnit.SECONDS);
            check("任务看见显式捕获的上下文", "inner-request".equals(observed.get()));
            check("内层完成后恢复外层上下文", "outer-request".equals(TRACE.get()));

            Future<?> failed = pool.submit(scoped("failed-request", () -> {
                throw new IllegalStateException("synthetic failure");
            }));
            boolean observedFailure = false;
            try { failed.get(5, TimeUnit.SECONDS); }
            catch (ExecutionException ex) { observedFailure = ex.getCause() instanceof IllegalStateException; }
            check("submit 的内联异常仍存入 Future", observedFailure);
            check("任务抛错也恢复外层上下文", "outer-request".equals(TRACE.get()));

            // 反例：无条件 remove 对可嵌套的执行边界是不够的。
            Future<?> badCleanup = pool.submit(() -> {
                TRACE.set("inner-request");
                try { /* This counterexample only installs and clears the context. */ }
                finally { TRACE.remove(); }
            });
            badCleanup.get(5, TimeUnit.SECONDS);
            check("无条件 remove 会擦掉调用者已有上下文", TRACE.get() == null);

            releaseWorker.countDown();
            blocked.get(5, TimeUnit.SECONDS); queued.get(5, TimeUnit.SECONDS);
            pool.shutdown();
            check("执行器确认终止", pool.awaitTermination(5, TimeUnit.SECONDS));
            Future<Integer> ghost = pool.submit(() -> 10);
            // CallerRunsPolicy 在池关闭后选择丢弃，并不会抛拒绝异常。
            check("关闭后的 CallerRuns 可返回未完成 Future", !ghost.isDone());
            check("此时没有可执行该任务的线程或队列", pool.isTerminated() && pool.getQueue().isEmpty());
            check("拥有者显式收回悬空句柄", ghost.cancel(false) && ghost.isCancelled());

            pool.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy());
            boolean rejected = false;
            try { pool.submit(() -> 11); }
            catch (RejectedExecutionException ex) { rejected = true; }
            check("AbortPolicy 明确返回提交失败", rejected);
        } finally {
            TRACE.remove(); releaseWorker.countDown();
            blocked.cancel(true); pool.shutdownNow();
            if (!pool.awaitTermination(5, TimeUnit.SECONDS)) throw new AssertionError("pool alive");
        }
        System.out.println("ASSERTIONS " + assertions);
    }
}

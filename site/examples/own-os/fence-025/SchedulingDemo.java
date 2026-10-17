import java.util.Arrays;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;

/** Java 8+: run() is an ordinary call; start() creates concurrent execution. */
public final class SchedulingDemo {
    private static int assertions;
    private static void check(String name, boolean ok) {
        if (!ok) throw new AssertionError(name);
        assertions++;
        System.out.println("PASS " + name);
    }
    private static void await(CountDownLatch latch) throws InterruptedException {
        if (!latch.await(3, TimeUnit.SECONDS)) throw new AssertionError("latch timeout");
    }
    public static void main(String[] args) throws Exception {
        final Thread caller = Thread.currentThread();
        final AtomicReference<Thread> observed = new AtomicReference<>();
        new Thread(() -> observed.set(Thread.currentThread())).run();
        check("run uses caller thread", observed.get() == caller);

        final CountDownLatch entered = new CountDownLatch(1);
        final CountDownLatch release = new CountDownLatch(1);
        final AtomicReference<Throwable> workerFailure = new AtomicReference<>();
        Thread thread = new Thread(() -> {
            try {
                observed.set(Thread.currentThread());
                entered.countDown();
                await(release); // A gate establishes order; a sleep would not.
            } catch (Throwable ex) { workerFailure.set(ex); }
        }, "started-worker");
        thread.start();
        try {
            await(entered);
            check("start uses another thread", observed.get() != caller);
            check("started worker waits at gate", thread.isAlive());
            boolean rejected = false;
            try { thread.start(); } catch (IllegalThreadStateException ex) { rejected = true; }
            check("thread cannot be started twice", rejected);
        } finally {
            release.countDown();
            thread.join(3000);
            if (thread.isAlive()) { thread.interrupt(); throw new AssertionError("worker stuck"); }
        }
        check("join observes worker completion", workerFailure.get() == null);

        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            CompletableFuture<Integer> source = CompletableFuture.supplyAsync(() -> 21, pool);
            // thenApply transforms a value; it does not promise a new thread.
            check("thenApply transforms value", source.thenApply(x -> x * 2).get(3, TimeUnit.SECONDS) == 42);
            // thenCompose flattens an asynchronous next step instead of nesting futures.
            CompletableFuture<Integer> composed = source.thenCompose(x ->
                    CompletableFuture.supplyAsync(() -> x + 1, pool));
            check("thenCompose flattens future", composed.get(3, TimeUnit.SECONDS) == 22);
            List<CompletableFuture<Integer>> jobs = Arrays.asList(source, composed);
            CompletableFuture<Void> all = CompletableFuture.allOf(jobs.toArray(new CompletableFuture<?>[0]));
            check("allOf returns completion only", all.get(3, TimeUnit.SECONDS) == null);
            check("collect results explicitly", jobs.get(0).get(3, TimeUnit.SECONDS) + jobs.get(1).get(3, TimeUnit.SECONDS) == 43);

            CompletableFuture<Integer> failed = new CompletableFuture<>();
            CompletableFuture<Integer> sibling = new CompletableFuture<>();
            CompletableFuture<Void> combined = CompletableFuture.allOf(failed, sibling);
            failed.completeExceptionally(new IllegalArgumentException("bad input"));
            check("allOf failure does not cancel sibling", !sibling.isCancelled());
            sibling.complete(7); // allOf is a completion barrier, not fail-fast cancellation.
            boolean failure = false;
            try { combined.get(3, TimeUnit.SECONDS); }
            catch (ExecutionException ex) { failure = ex.getCause() instanceof IllegalArgumentException; }
            check("allOf exposes exceptional completion", failure);
            check("handle recovers exception", failed.handle((value, ex) -> ex == null ? value : -1)
                    .get(3, TimeUnit.SECONDS) == -1);
        } finally {
            pool.shutdownNow();
            if (!pool.awaitTermination(3, TimeUnit.SECONDS)) throw new AssertionError("pool stuck");
        }
        System.out.println("ASSERTIONS " + assertions);
    }
}

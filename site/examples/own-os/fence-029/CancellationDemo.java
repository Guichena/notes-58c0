import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** Waiting, requesting cancellation, and observing actual termination are different operations. */
public final class CancellationDemo {
    private static int assertions;
    private static void check(String name, boolean ok) {
        if (!ok) throw new AssertionError(name);
        assertions++;
        System.out.println("PASS " + name);
    }
    private static void await(CountDownLatch latch) throws InterruptedException {
        if (!latch.await(3, TimeUnit.SECONDS)) throw new AssertionError("latch timeout");
    }
    private static <T> T beforeDeadline(Future<T> future, long deadline) throws Exception {
        long remaining = deadline - System.nanoTime(); // One monotonic budget for the whole operation.
        if (remaining <= 0) throw new TimeoutException("shared deadline expired");
        return future.get(remaining, TimeUnit.NANOSECONDS);
    }
    public static void main(String[] args) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch release = new CountDownLatch(1), supplierRelease = new CountDownLatch(1);
        CountDownLatch deadlineRelease = new CountDownLatch(1);
        try {
            CountDownLatch entered = new CountDownLatch(1);
            Future<Integer> waiting = pool.submit(() -> { entered.countDown(); await(release); return 42; });
            await(entered);
            boolean timeout = false;
            try { waiting.get(20, TimeUnit.MILLISECONDS); } catch (TimeoutException ex) { timeout = true; }
            check("get timeout only stops waiting", timeout && !waiting.isCancelled() && !waiting.isDone());
            release.countDown();
            check("timed-out task can still return", waiting.get(3, TimeUnit.SECONDS) == 42);

            CountDownLatch interruptEntered = new CountDownLatch(1), stopped = new CountDownLatch(1);
            AtomicBoolean sawInterrupt = new AtomicBoolean();
            Future<?> cooperative = pool.submit(() -> {
                try { interruptEntered.countDown(); await(new CountDownLatch(1)); }
                catch (InterruptedException ex) { sawInterrupt.set(true); Thread.currentThread().interrupt(); }
                finally { stopped.countDown(); } // Observe cleanup, not merely Future state.
            });
            await(interruptEntered);
            check("cancel true accepts request", cooperative.cancel(true));
            await(stopped);
            check("cooperative task observes interruption", sawInterrupt.get());
            boolean cancelled = false;
            try { cooperative.get(3, TimeUnit.SECONDS); } catch (CancellationException ex) { cancelled = true; }
            check("cancelled future has no result", cancelled);

            CountDownLatch supplierEntered = new CountDownLatch(1), supplierStopped = new CountDownLatch(1);
            AtomicBoolean supplierInterrupted = new AtomicBoolean(), supplierFinished = new AtomicBoolean();
            CompletableFuture<Integer> stage = CompletableFuture.supplyAsync(() -> {
                try {
                    supplierEntered.countDown(); await(supplierRelease);
                    supplierFinished.set(true); return 9;
                } catch (InterruptedException ex) {
                    supplierInterrupted.set(true); Thread.currentThread().interrupt(); return -1;
                } finally { supplierStopped.countDown(); }
            }, pool);
            await(supplierEntered);
            check("CompletableFuture accepts cancellation", stage.cancel(true) && stage.isCancelled());
            check("CompletableFuture cancel leaves supplier running", supplierStopped.getCount() == 1);
            supplierRelease.countDown(); await(supplierStopped);
            check("CompletableFuture cancellation does not interrupt supplier", supplierFinished.get() && !supplierInterrupted.get());

            Future<Integer> ready = pool.submit(() -> 1);
            ready.get(3, TimeUnit.SECONDS); // Remove scheduler speed from the deadline test.
            CountDownLatch deadlineEntered = new CountDownLatch(1);
            Future<Integer> blocked = pool.submit(() -> { deadlineEntered.countDown(); await(deadlineRelease); return 2; });
            await(deadlineEntered);
            long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(100);
            try {
                check("first result uses shared deadline", beforeDeadline(ready, deadline) == 1);
                boolean expired = false;
                try { beforeDeadline(blocked, deadline); } catch (TimeoutException ex) { expired = true; }
                check("later wait uses remaining deadline", expired);
            } finally { blocked.cancel(true); }
        } finally {
            release.countDown(); supplierRelease.countDown(); deadlineRelease.countDown();
            pool.shutdown();
            if (!pool.awaitTermination(3, TimeUnit.SECONDS)) {
                pool.shutdownNow();
                if (!pool.awaitTermination(3, TimeUnit.SECONDS)) throw new AssertionError("pool stuck");
            }
        }
        check("executor termination observed", pool.isTerminated());
        boolean rejected = false;
        try { pool.submit(() -> 0); } catch (RejectedExecutionException ex) { rejected = true; }
        check("shutdown executor rejects new work", rejected);
        System.out.println("ASSERTIONS " + assertions);
    }
}

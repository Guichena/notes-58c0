import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

public final class PoolLifecycleLab {
    /** Attach cleanup errors without replacing the primary error or self-suppressing. */
    static void record(Throwable primary, Throwable cleanup) {
        if (primary != cleanup) primary.addSuppressed(cleanup);
    }
    static final class NoSuppression extends Exception {
        NoSuppression() { super("suppression disabled", null, false, true); }
    }
    public static void main(String[] args) throws Exception {
        ThreadPoolExecutor pool = new ThreadPoolExecutor(1, 2, 1, TimeUnit.SECONDS,
                new ArrayBlockingQueue<>(1), new ThreadPoolExecutor.AbortPolicy());
        CountDownLatch firstStarted = new CountDownLatch(1), extraStarted = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        AtomicInteger interrupted = new AtomicInteger();
        Callable<Integer> blocker = () -> {
            try { Checks.await(release); return 1; }
            catch (InterruptedException e) { interrupted.incrementAndGet(); throw e; }
        };
        try {
            Future<Integer> first = pool.submit(() -> { firstStarted.countDown(); return blocker.call(); });
            Checks.await(firstStarted);
            Future<Integer> queued = pool.submit(() -> 2);
            Future<Integer> extra = pool.submit(() -> { extraStarted.countDown(); return blocker.call(); });
            Checks.await(extraStarted);
            Checks.that(pool.getPoolSize() == 2 && pool.getQueue().size() == 1, "core -> queue -> max");
            try { pool.submit(() -> 4); throw new AssertionError("saturation accepted"); }
            catch (RejectedExecutionException expected) { }
            List<Runnable> neverStarted = pool.shutdownNow();
            Checks.that(neverStarted.size() == 1, "queued task returned");
            Checks.that(!queued.isDone(), "shutdownNow alone did not cancel returned FutureTask");
            for (Runnable task : neverStarted) if (task instanceof Future<?> f) f.cancel(false);
            Checks.that(queued.isCancelled(), "owner gives unstarted future a terminal state");
            Checks.that(pool.awaitTermination(5, TimeUnit.SECONDS), "interruptible tasks ended");
            Checks.that(interrupted.get() == 2, "both running tasks observed interruption");
            for (Future<Integer> f : List.of(first, extra)) {
                try { Checks.get(f); throw new AssertionError("expected interrupted failure"); }
                catch (ExecutionException e) { Checks.that(e.getCause() instanceof InterruptedException, "cause"); }
            }
            try { pool.submit(() -> 5); throw new AssertionError("shutdown accepted"); }
            catch (RejectedExecutionException expected) { }
        } finally { release.countDown(); Checks.stop(pool); }
        ExecutorService single = Executors.newSingleThreadExecutor();
        try {
            Future<?> failed = single.submit(() -> { throw new IllegalStateException("business failure"); });
            try { Checks.get(failed); throw new AssertionError("failure hidden"); }
            catch (ExecutionException e) { Checks.that(e.getCause() instanceof IllegalStateException, "submit failure captured"); }
            Checks.that(Checks.get(single.submit(() -> 7)) == 7, "worker remains usable");
        } finally { Checks.stop(single); }
        CountDownLatch entered = new CountDownLatch(1), cooperate = new CountDownLatch(1), exited = new CountDownLatch(1);
        ExecutorService stubborn = Executors.newSingleThreadExecutor();
        try {
            Future<?> f = stubborn.submit(() -> {
                entered.countDown();
                try {
                    boolean done = false;
                    while (!done) {
                        try { done = cooperate.await(100, TimeUnit.MILLISECONDS); }
                        catch (InterruptedException ignored) { /* deliberate counterexample, bounded by owner */ }
                    }
                } finally { exited.countDown(); }
            });
            Checks.await(entered); f.cancel(true);
            Checks.that(f.isDone() && exited.getCount() == 1, "cancelled future != ended computation");
            cooperate.countDown(); Checks.await(exited);
        } finally { cooperate.countDown(); Checks.stop(stubborn); }
        Exception primary = new Exception("primary"), cleanup = new Exception("cleanup");
        record(primary, primary); record(primary, cleanup); record(primary, cleanup);
        Checks.that(primary.getSuppressed().length == 2, "same primary guarded; repeated secondary allowed");
        NoSuppression disabled = new NoSuppression(); record(disabled, disabled); record(disabled, cleanup);
        Checks.that(disabled.getSuppressed().length == 0, "suppression may be disabled");
        System.out.println("PoolLifecycleLab OK");
    }
}

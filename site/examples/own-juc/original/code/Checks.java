import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;

/** Small bounded test utilities; no assertion depends on -ea. */
public final class Checks {
    private Checks() {}
    public static void that(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }
    public static void await(CountDownLatch latch) throws InterruptedException {
        if (!latch.await(5, TimeUnit.SECONDS)) throw new AssertionError("latch timeout");
    }
    public static <T> T get(Future<T> f) throws Exception {
        return f.get(5, TimeUnit.SECONDS);
    }
    public static void join(Thread t) throws InterruptedException {
        t.join(5000);
        if (t.isAlive()) { t.interrupt(); throw new AssertionError("thread did not stop: " + t.getName()); }
    }
    public static void stop(ExecutorService executor) throws InterruptedException {
        for (Runnable queued : executor.shutdownNow())
            if (queued instanceof Future<?> f) f.cancel(false);
        if (!executor.awaitTermination(5, TimeUnit.SECONDS))
            throw new AssertionError("executor did not terminate");
    }
    public static Thread thread(String name, AtomicReference<Throwable> failure, Runnable body) {
        return Thread.ofPlatform().daemon().name(name).unstarted(() -> {
            try { body.run(); }
            catch (Throwable error) { failure.compareAndSet(null, error); }
        });
    }
    public static void rethrow(AtomicReference<Throwable> failure) {
        if (failure.get() != null) throw new AssertionError("worker failed", failure.get());
    }
}

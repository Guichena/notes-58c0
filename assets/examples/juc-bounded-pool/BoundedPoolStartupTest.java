import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;

/** Deterministic controlled failure injection. Never inject actual VM resource exhaustion. */
public final class BoundedPoolStartupTest {
    private static final class Injected extends Error { }
    private static void check(boolean ok, String message) {
        if (!ok) throw new AssertionError(message);
    }
    private static void failure(String stage) throws Exception {
        AtomicReference<BoundedPoolTeaching> observed = new AtomicReference<>();
        Injected expected = new Injected();
        BoundedPoolTeaching.Startup startup = new BoundedPoolTeaching.Startup() {
            public void beforeRegister(BoundedPoolTeaching pool, int index) {
                observed.set(pool);
                if (stage.equals("registration") && index == 1) throw expected;
            }
            public void start(Thread thread, int index) {
                if (stage.equals("start") && index == 1) throw expected;
                thread.start();
            }
            public void afterStart(BoundedPoolTeaching pool, int index) {
                if (stage.equals("post-start") && index == 0) throw expected;
            }
        };
        try {
            new BoundedPoolTeaching(2, 1, startup);
            throw new AssertionError("injection did not fire: " + stage);
        } catch (Injected actual) { check(actual == expected, "original failure preserved"); }
        BoundedPoolTeaching pool = observed.get();
        check(pool.awaitTermination(3, TimeUnit.SECONDS), stage + " workers terminated");
        check(pool.aliveForTest() == 0, stage + " reservation counted exactly once");
        try { pool.submit(() -> 1); throw new AssertionError("failed constructor accepts tasks"); }
        catch (RejectedExecutionException expectedRejection) { }
        pool.shutdownNow();
        for (Thread worker : pool.workersForTest()) {
            if (worker == null) continue;
            worker.join(1000);
            check(!worker.isAlive(), stage + " actual thread exited");
        }
    }
    public static void main(String[] args) throws Exception {
        failure("registration"); // No worker has started yet.
        failure("start"); // First worker started; second reservation rolls back.
        failure("post-start"); // First worker owns decrement, despite later failure.
        BoundedPoolTeaching.main(args); // Existing saturation, shutdown and isolation tests.
        System.out.println("BoundedPoolStartupTest OK: registration/start/post-start");
    }
}

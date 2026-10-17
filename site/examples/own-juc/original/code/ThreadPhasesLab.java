import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

public final class ThreadPhasesLab {
    static void afterAll(List<Runnable> prerequisites, Runnable successor) throws Exception {
        AtomicReference<Throwable> error = new AtomicReference<>();
        List<Thread> threads = new ArrayList<>();
        for (int n = 0; n < prerequisites.size(); n++)
            threads.add(Checks.thread("phase-" + n, error, prerequisites.get(n)));
        try {
            for (Thread thread : threads) thread.start();
            long start = System.nanoTime(), budget = TimeUnit.SECONDS.toNanos(5);
            for (Thread thread : threads) {
                long remaining = budget - (System.nanoTime() - start);
                if (remaining <= 0 || !thread.join(java.time.Duration.ofNanos(remaining)))
                    throw new TimeoutException("predecessors did not terminate");
            }
            Checks.rethrow(error);
            Thread next = Checks.thread("successor", error, successor);
            next.start(); threads.add(next); Checks.join(next); Checks.rethrow(error);
        } finally {
            for (Thread thread : threads) if (thread.isAlive()) thread.interrupt();
            // Bounded cleanup request; a task ignoring interruption may outlive this teaching scope.
            for (Thread thread : threads) if (thread.isAlive()) thread.join(100);
        }
    }
    public static void main(String[] args) throws Exception {
        AtomicInteger completed = new AtomicInteger();
        afterAll(List.of(completed::incrementAndGet, completed::incrementAndGet),
                () -> Checks.that(completed.get() == 2, "all predecessors terminated"));
        AtomicBoolean zero = new AtomicBoolean(); afterAll(List.of(), () -> zero.set(true));
        Checks.that(zero.get(), "zero predecessors");
        AtomicBoolean shouldNotRun = new AtomicBoolean();
        try {
            afterAll(List.of(() -> { throw new IllegalArgumentException("predecessor"); }), () -> shouldNotRun.set(true));
            throw new AssertionError("failure hidden");
        } catch (AssertionError expected) { Checks.that(expected.getCause() instanceof IllegalArgumentException, "recorded worker failure"); }
        Checks.that(!shouldNotRun.get(), "failed predecessor blocks successor");
        System.out.println("ThreadPhasesLab OK");
    }
}

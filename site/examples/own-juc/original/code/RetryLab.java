import java.time.Duration;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

/** Retry only operations whose repeatability has been explicitly established. */
public final class RetryLab {
    enum Kind { TRANSIENT, PERMISSION, UNKNOWN_COMMIT }
    static final class CallFailure extends Exception {
        final Kind kind;
        CallFailure(Kind kind) { super(kind.name()); this.kind = kind; }
    }
    static final class AttemptStillRunning extends Exception {
        AttemptStillRunning(Throwable cause) { super("timed-out attempt did not acknowledge termination; no retry", cause); }
    }
    record Policy(int maxAttempts, Duration total, Duration perAttempt, Duration backoff, Duration cleanupGrace) {
        Policy {
            if (maxAttempts <= 0 || total.isZero() || total.isNegative() || perAttempt.isZero()
                    || perAttempt.isNegative() || backoff.isNegative() || cleanupGrace.isNegative())
                throw new IllegalArgumentException();
            // Validate the representation before any operation can be submitted.
            total.toNanos(); perAttempt.toNanos(); backoff.toNanos(); cleanupGrace.toNanos();
        }
    }
    static <T> T run(Callable<T> operation, Policy policy, boolean repeatable,
                     ThreadPoolExecutor executor) throws Exception {
        long start = System.nanoTime(), total = policy.total.toNanos();
        OwnershipLab.Budget budget = new OwnershipLab.Budget(1);
        Exception last = null;
        for (int attempt = 1; attempt <= policy.maxAttempts; attempt++) {
            long remaining = total - (System.nanoTime() - start);
            if (remaining <= 0) throw new TimeoutException("total deadline before attempt");
            OwnershipLab.OwnedJob<T> task = OwnershipLab.OwnedJob.submit(executor,
                    budget.acquire(1, Duration.ofNanos(remaining)), operation);
            try {
                remaining = total - (System.nanoTime() - start);
                if (remaining <= 0) throw new TimeoutException("deadline during submission");
                return task.get(Math.min(remaining, policy.perAttempt.toNanos()), TimeUnit.NANOSECONDS);
            } catch (TimeoutException timeout) {
                task.cancel(true);
                long grace = Math.min(policy.cleanupGrace.toNanos(), Math.max(0, total - (System.nanoTime() - start)));
                if (!task.awaitActualDone(grace, TimeUnit.NANOSECONDS)) throw new AttemptStillRunning(timeout);
                last = timeout;
            } catch (InterruptedException interruption) {
                task.cancel(true); throw interruption; // Owner may separately await actual cleanup.
            } catch (ExecutionException failure) {
                if (failure.getCause() instanceof Error error) throw error;
                if (!(failure.getCause() instanceof Exception error)) throw failure;
                last = error;
            }
            boolean eligible = last instanceof TimeoutException
                    || (last instanceof CallFailure failure && failure.kind == Kind.TRANSIENT);
            if (!repeatable || !eligible || attempt == policy.maxAttempts) throw last;
            long delay = policy.backoff.toNanos();
            remaining = total - (System.nanoTime() - start);
            if (remaining <= delay) throw new TimeoutException("backoff would exhaust total deadline");
            TimeUnit.NANOSECONDS.sleep(delay); // Production can add capped exponential backoff plus jitter.
        }
        throw new AssertionError("unreachable");
    }
    static ThreadPoolExecutor executor() {
        return new ThreadPoolExecutor(1, 1, 0, TimeUnit.SECONDS, new ArrayBlockingQueue<>(1),
                new ThreadPoolExecutor.AbortPolicy());
    }
    public static void main(String[] args) throws Exception {
        Policy policy = new Policy(3, Duration.ofSeconds(2), Duration.ofMillis(200), Duration.ZERO, Duration.ofMillis(200));
        Duration huge = Duration.ofSeconds(Long.MAX_VALUE);
        for (int field = 0; field < 4; field++) {
            Duration[] values = {policy.total, policy.perAttempt, policy.backoff, policy.cleanupGrace};
            values[field] = huge;
            try { new Policy(1, values[0], values[1], values[2], values[3]); throw new AssertionError("overflow accepted"); }
            catch (ArithmeticException expected) { }
        }
        ThreadPoolExecutor executor = executor();
        AtomicInteger calls = new AtomicInteger();
        CountDownLatch release = new CountDownLatch(1), ended = new CountDownLatch(1);
        try {
            int value = run(() -> { if (calls.incrementAndGet() < 3) throw new CallFailure(Kind.TRANSIENT); return 7; }, policy, true, executor);
            Checks.that(value == 7 && calls.get() == 3, "bounded transient retry");
            for (Kind kind : new Kind[]{Kind.PERMISSION, Kind.UNKNOWN_COMMIT}) {
                calls.set(0);
                try { run(() -> { calls.incrementAndGet(); throw new CallFailure(kind); }, policy, true, executor); throw new AssertionError(); }
                catch (CallFailure expected) { Checks.that(calls.get() == 1, "no permission/unknown-commit retry"); }
            }
            calls.set(0);
            Policy once = new Policy(1, policy.total, policy.perAttempt, policy.backoff, policy.cleanupGrace);
            try { run(() -> { calls.incrementAndGet(); throw new CallFailure(Kind.TRANSIENT); }, once, true, executor); throw new AssertionError(); }
            catch (CallFailure expected) { Checks.that(calls.get() == 1, "maxAttempts=1 includes initial call"); }
            calls.set(0);
            Policy timed = new Policy(3, Duration.ofSeconds(1), Duration.ofMillis(30), Duration.ZERO, Duration.ofMillis(30));
            try {
                run(() -> {
                    calls.incrementAndGet();
                    try {
                        while (release.getCount() != 0) {
                            try { release.await(); } catch (InterruptedException ignored) { }
                        }
                        return 1;
                    } finally { ended.countDown(); }
                }, timed, true, executor);
                throw new AssertionError("expected unfinished attempt");
            } catch (AttemptStillRunning expected) { Checks.that(calls.get() == 1, "no overlapping retry"); }
            release.countDown(); Checks.await(ended);
            executor.shutdown();
            try { run(() -> 1, policy, true, executor); throw new AssertionError("rejection swallowed"); }
            catch (RejectedExecutionException expected) { }
            System.out.println("RetryLab OK");
        } finally { release.countDown(); Checks.stop(executor); }
    }
}

import java.time.Duration;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeoutException;
import java.util.function.LongSupplier;

public final class RetryBudget {
    public static final class Retryable extends Exception {
        public Retryable(String message) { super(message); }
    }
    @FunctionalInterface public interface Call<T> {
        // Adapter must enforce this timeout; this wrapper cannot kill an arbitrary call.
        T invoke(Duration attemptTimeout) throws Exception;
    }
    @FunctionalInterface public interface Sleep { void sleep(long nanos) throws InterruptedException; }
    @FunctionalInterface public interface Jitter { long choose(long upperInclusive); }
    private final LongSupplier clock;
    private final Sleep sleeper;
    private final Jitter jitter;
    public RetryBudget(LongSupplier clock, Sleep sleeper, Jitter jitter) {
        this.clock = clock; this.sleeper = sleeper; this.jitter = jitter;
    }
    public static RetryBudget system() {
        return new RetryBudget(System::nanoTime,
                nanos -> java.util.concurrent.TimeUnit.NANOSECONDS.sleep(nanos),
                upper -> upper == 0 ? 0 : ThreadLocalRandom.current().nextLong(upper + 1));
    }
    public <T> T execute(int maxAttempts, Duration total, Duration perAttempt,
                         Duration initialBackoff, Duration maxBackoff,
                         Call<T> call) throws Exception {
        long budget = total.toNanos(), single = perAttempt.toNanos();
        long delay = initialBackoff.toNanos(), cap = maxBackoff.toNanos();
        if (maxAttempts < 1 || budget <= 0 || single <= 0 || delay < 0 || cap < delay
                || budget > Long.MAX_VALUE / 4 || cap > Long.MAX_VALUE / 4)
            throw new IllegalArgumentException("invalid retry budget");
        long start = clock.getAsLong();
        Retryable last = null;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            if (Thread.currentThread().isInterrupted()) throw new InterruptedException("interrupted");
            long remaining = budget - (clock.getAsLong() - start);
            if (remaining <= 0) throw expired(last);
            try {
                T result = call.invoke(Duration.ofNanos(Math.min(single, remaining)));
                // Late success is reported as unknown to the caller, never auto-retried here.
                if (clock.getAsLong() - start >= budget) throw expired(null);
                return result;
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                throw interrupted;
            } catch (Retryable failure) {
                last = failure;
                if (attempt == maxAttempts) throw failure;
            }
            remaining = budget - (clock.getAsLong() - start);
            if (remaining <= 0) throw expired(last);
            long wait = jitter.choose(delay);
            if (wait < 0 || wait > delay) throw new IllegalArgumentException("bad jitter");
            if (wait >= remaining) throw expired(last);
            try { sleeper.sleep(wait); }
            catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                throw interrupted;
            }
            delay = delay > cap / 2 ? cap : Math.min(cap, delay * 2);
        }
        throw new AssertionError("unreachable");
    }
    private static TimeoutException expired(Throwable last) {
        TimeoutException e = new TimeoutException("total deadline exhausted; result may be unknown");
        if (last != null) e.initCause(last);
        return e;
    }
    static void require(boolean ok) { if (!ok) throw new AssertionError(); }
    public static void main(String[] args) throws Exception {
        long[] now = {0}; int[] calls = {0};
        RetryBudget retry = new RetryBudget(() -> now[0], n -> now[0] += n, upper -> upper);
        String value = retry.execute(3, Duration.ofMillis(100), Duration.ofMillis(20),
                Duration.ofMillis(2), Duration.ofMillis(8), timeout -> {
                    require(timeout.toMillis() <= 20);
                    if (++calls[0] < 3) throw new Retryable("temporary, safe to retry");
                    return "ok";
                });
        require(value.equals("ok") && calls[0] == 3 && now[0] == 6_000_000L);
        calls[0] = 0;
        try {
            retry.execute(1, Duration.ofSeconds(1), Duration.ofMillis(10),
                    Duration.ZERO, Duration.ZERO, timeout -> {
                        calls[0]++; throw new Retryable("one attempt");
                    });
            throw new AssertionError();
        } catch (Retryable expected) { require(calls[0] == 1); }
        calls[0] = 0;
        try {
            retry.execute(5, Duration.ofSeconds(1), Duration.ofMillis(10),
                    Duration.ZERO, Duration.ZERO, timeout -> {
                        calls[0]++; throw new SecurityException("permission denied");
                    });
            throw new AssertionError();
        } catch (SecurityException expected) { require(calls[0] == 1); }
        RetryBudget interrupt = new RetryBudget(() -> 0,
                n -> { throw new InterruptedException(); }, upper -> 0);
        try {
            interrupt.execute(2, Duration.ofSeconds(1), Duration.ofMillis(10),
                    Duration.ZERO, Duration.ZERO, timeout -> { throw new Retryable("retry"); });
            throw new AssertionError();
        } catch (InterruptedException expected) { require(Thread.currentThread().isInterrupted()); }
        Thread.interrupted();
        calls[0] = 0; now[0] = 0;
        try {
            retry.execute(5, Duration.ofMillis(3), Duration.ofMillis(2),
                    Duration.ofMillis(2), Duration.ofMillis(8), timeout -> {
                        calls[0]++; now[0] += 2_000_000L; throw new Retryable("temporary");
                    });
            throw new AssertionError();
        } catch (TimeoutException expected) { require(calls[0] == 1); }
        calls[0] = 0; now[0] = 0;
        try {
            retry.execute(5, Duration.ofMillis(3), Duration.ofMillis(2),
                    Duration.ZERO, Duration.ZERO, timeout -> {
                        calls[0]++; now[0] += 4_000_000L; return "late";
                    });
            throw new AssertionError();
        } catch (TimeoutException expected) { require(calls[0] == 1); }
        calls[0] = 0;
        try {
            retry.execute(5, Duration.ofSeconds(1), Duration.ofMillis(2),
                    Duration.ZERO, Duration.ZERO, timeout -> {
                        calls[0]++; throw new TimeoutException("unknown remote result");
                    });
            throw new AssertionError();
        } catch (TimeoutException expected) { require(calls[0] == 1); }
        System.out.println("RetryBudget OK");
    }
}

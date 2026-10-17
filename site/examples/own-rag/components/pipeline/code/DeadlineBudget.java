import java.time.Duration;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.LongSupplier;

/** Local monotonic budget only: does not cancel remote calls or interrupt threads. */
public final class DeadlineBudget {
    private final LongSupplier clock;
    private final long started;
    private final long budget;
    public DeadlineBudget(Duration total, LongSupplier clock) {
        this.clock = Objects.requireNonNull(clock);
        Objects.requireNonNull(total);
        if (total.isNegative() || total.isZero() || total.compareTo(Duration.ofDays(1)) > 0)
            throw new IllegalArgumentException("total must be in (0, one day]");
        budget = total.toNanos(); started = clock.getAsLong();
    }
    public long remainingNanos() {
        long elapsed = clock.getAsLong() - started;
        // nanoTime may wrap; subtraction is valid for elapsed intervals less than 2^63 ns.
        if (elapsed < 0) throw new IllegalStateException("clock moved backwards or interval too large");
        return elapsed >= budget ? 0 : budget - elapsed;
    }
    public Duration allowance(Duration stageCap, Duration reserveAfter) {
        Objects.requireNonNull(stageCap); Objects.requireNonNull(reserveAfter);
        if (stageCap.isNegative() || stageCap.isZero() || reserveAfter.isNegative()
                || stageCap.compareTo(Duration.ofDays(1)) > 0 || reserveAfter.compareTo(Duration.ofDays(1)) > 0)
            throw new IllegalArgumentException("invalid bounded stage durations");
        long left = remainingNanos(); long reserve = reserveAfter.toNanos();
        return Duration.ofNanos(left <= reserve ? 0 : Math.min(stageCap.toNanos(), left - reserve));
    }
    private static void check(boolean b) { if (!b) throw new AssertionError(); }
    private static void invalid(Runnable r) { try { r.run(); throw new AssertionError(); } catch (IllegalArgumentException ok) {} }
    public static void main(String[] args) {
        AtomicLong now = new AtomicLong(100);
        DeadlineBudget b = new DeadlineBudget(Duration.ofSeconds(10), now::get);
        check(b.allowance(Duration.ofSeconds(3), Duration.ofSeconds(4)).equals(Duration.ofSeconds(3)));
        now.addAndGet(Duration.ofSeconds(5).toNanos());
        check(b.allowance(Duration.ofSeconds(3), Duration.ofSeconds(4)).equals(Duration.ofSeconds(1)));
        now.addAndGet(Duration.ofSeconds(1).toNanos());
        check(b.allowance(Duration.ofSeconds(3), Duration.ofSeconds(4)).isZero());
        now.addAndGet(Duration.ofSeconds(4).toNanos()); check(b.remainingNanos() == 0);
        now.incrementAndGet(); check(b.remainingNanos() == 0);
        invalid(() -> new DeadlineBudget(Duration.ZERO, now::get));
        invalid(() -> new DeadlineBudget(Duration.ofDays(2), now::get));
        invalid(() -> b.allowance(Duration.ofSeconds(-1), Duration.ZERO));
        invalid(() -> b.allowance(Duration.ofSeconds(1), Duration.ofNanos(-1)));
        AtomicLong wrap = new AtomicLong(Long.MAX_VALUE - 5);
        DeadlineBudget w = new DeadlineBudget(Duration.ofNanos(20), wrap::get);
        wrap.addAndGet(10); check(w.remainingNanos() == 10);
        AtomicLong exact = new AtomicLong(-100);
        DeadlineBudget e = new DeadlineBudget(Duration.ofNanos(10000), exact::get);
        for (int i = 0; i <= 10000; i++) {
            exact.set(-100L + i); check(e.remainingNanos() == 10000 - i);
        }
        System.out.println("PASS DeadlineBudget: 10001 boundaries, reserve exhaustion, invalid duration, nanoTime wrap. Local fake clock only; no network timeout/cancellation execution.");
    }
}

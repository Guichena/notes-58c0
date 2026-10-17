import java.util.*;
import java.util.function.LongSupplier;

/** Exact per-user sliding window in one JVM; milliseconds from a monotonic relative clock. */
public final class SlidingWindowLimiter {
    private final Map<String, ArrayDeque<Long>> users = new HashMap<>();
    private final int maxUsers, limit;
    private final long window;
    private final LongSupplier clock;
    private long lastTime;
    public SlidingWindowLimiter(int maxUsers, int limit, long windowMillis, LongSupplier clock) {
        if (maxUsers <= 0 || limit <= 0 || windowMillis <= 0) throw new IllegalArgumentException();
        this.maxUsers = maxUsers; this.limit = limit; window = windowMillis; this.clock = Objects.requireNonNull(clock);
    }
    public synchronized boolean allow(String user) {
        Objects.requireNonNull(user);
        long now = clock.getAsLong();
        if (now < lastTime) throw new IllegalStateException("nonnegative monotonic clock required");
        lastTime = now;
        // Bounds retained user state; this simple scan trades throughput for an explicit memory ceiling.
        Iterator<ArrayDeque<Long>> values = users.values().iterator();
        while (values.hasNext()) {
            ArrayDeque<Long> times = values.next();
            while (!times.isEmpty() && now - times.peekFirst() >= window) times.removeFirst();
            if (times.isEmpty()) values.remove();
        }
        ArrayDeque<Long> times = users.get(user);
        if (times == null) {
            if (users.size() == maxUsers) return false;
            times = new ArrayDeque<>(); users.put(user, times);
        }
        if (times.size() == limit) return false;
        times.addLast(now); return true;
    }
    public static void main(String[] args) {
        long[] time = {0}; SlidingWindowLimiter limiter = new SlidingWindowLimiter(2, 10, 60_000, () -> time[0]);
        for (int n = 0; n < 10; n++) Checks.that(limiter.allow("user-a"), "first ten allowed");
        Checks.that(!limiter.allow("user-a") && limiter.allow("user-b"), "user isolation");
        Checks.that(!limiter.allow("user-c"), "bounded user state");
        time[0] = 59_999; Checks.that(!limiter.allow("user-a"), "within rolling minute");
        time[0] = 60_000; Checks.that(limiter.allow("user-a"), "left boundary expired");
        System.out.println("SlidingWindowLimiter OK");
    }
}

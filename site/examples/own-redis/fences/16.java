import java.util.ArrayDeque;

/** One principal in one JVM. Caller supplies nonnegative monotonic elapsed milliseconds. */
public final class SlidingWindow {
    private final long window;
    private final int limit;
    private final ArrayDeque<Long> accepted = new ArrayDeque<>();
    private long last = -1;
    public SlidingWindow(int limit, long windowMillis) {
        if (limit < 1 || limit > 1_000_000 || windowMillis < 1)
            throw new IllegalArgumentException("invalid window or limit");
        this.limit = limit; this.window = windowMillis;
    }
    public synchronized boolean allow(long now) {
        if (now < 0 || now < last) throw new IllegalArgumentException("clock moved backwards");
        last = now;
        while (!accepted.isEmpty() && now - accepted.peekFirst() >= window)
            accepted.removeFirst();
        if (accepted.size() >= limit) return false;
        accepted.addLast(now);
        return true;
    }
    public synchronized int retained() { return accepted.size(); }
}

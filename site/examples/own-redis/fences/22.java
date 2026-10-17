import java.util.concurrent.atomic.AtomicLong;

/** Monotonic allocation only: no releases, request deduplication, persistence or remote workers. */
public final class VcoreQuota {
    private final AtomicLong remaining;
    public VcoreQuota(long capacity) {
        if (capacity < 0) throw new IllegalArgumentException("negative capacity");
        remaining = new AtomicLong(capacity);
    }
    public boolean reserve(long amount) {
        if (amount <= 0) throw new IllegalArgumentException("amount must be positive");
        long before = remaining.get();
        while (before >= amount) {
            if (remaining.compareAndSet(before, before - amount)) return true;
            before = remaining.get();
        }
        return false;
    }
    public long remaining() { return remaining.get(); }
}

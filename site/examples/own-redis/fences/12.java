import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.OptionalLong;
import java.util.TreeMap;
import java.util.concurrent.RejectedExecutionException;
import java.util.function.LongSupplier;

/** Local bounded expiration index. No scheduler, Redis connection, or durability is implied. */
public final class DeadlineCache {
    private record Deadline(long at, long serial) implements Comparable<Deadline> {
        @Override public int compareTo(Deadline other) {
            int c = Long.compare(at, other.at);
            return c != 0 ? c : Long.compare(serial, other.serial);
        }
    }
    private record Entry(String value, Deadline deadline) { }
    private final Map<String, Entry> values = new HashMap<>();
    private final TreeMap<Deadline, String> deadlines = new TreeMap<>();
    private final LongSupplier clock;
    private final int capacity;
    private long lastTime, serial;

    public DeadlineCache(int capacity, LongSupplier monotonicMillis) {
        if (capacity <= 0) throw new IllegalArgumentException("positive capacity required");
        this.capacity = capacity;
        clock = Objects.requireNonNull(monotonicMillis);
    }
    public synchronized void put(String key, String value, long ttlMillis) {
        Objects.requireNonNull(key); Objects.requireNonNull(value);
        if (ttlMillis <= 0) throw new IllegalArgumentException("positive TTL required");
        long at = Math.addExact(now(), ttlMillis);
        long nextSerial = Math.incrementExact(serial);
        if (!values.containsKey(key) && values.size() >= capacity)
            throw new RejectedExecutionException("drain expired entries or apply an admission policy");
        remove(key);
        Deadline d = new Deadline(at, nextSerial);
        serial = nextSerial; values.put(key, new Entry(value, d)); deadlines.put(d, key);
    }
    public synchronized Optional<String> get(String key) {
        Objects.requireNonNull(key); long n = now(); Entry e = values.get(key);
        if (e == null) return Optional.empty();
        if (e.deadline().at() <= n) { remove(key); return Optional.empty(); }
        return Optional.of(e.value());
    }
    public synchronized boolean remove(String key) {
        Entry old = values.remove(Objects.requireNonNull(key));
        if (old == null) return false;
        deadlines.remove(old.deadline()); return true;
    }
    /** Bound the number of removals per call; caller repeats under a work/time budget. */
    public synchronized int drainExpired(int budget) {
        if (budget < 0) throw new IllegalArgumentException("negative budget");
        long n = now(); int removed = 0;
        while (removed < budget && !deadlines.isEmpty() && deadlines.firstKey().at() <= n) {
            Map.Entry<Deadline, String> first = deadlines.pollFirstEntry();
            Entry current = values.get(first.getValue());
            if (current == null || !current.deadline().equals(first.getKey()))
                throw new IllegalStateException("index invariant broken");
            values.remove(first.getValue()); removed++;
        }
        return removed;
    }
    public synchronized OptionalLong nextDeadline() {
        return deadlines.isEmpty() ? OptionalLong.empty() : OptionalLong.of(deadlines.firstKey().at());
    }
    public synchronized int residentSize() { return values.size(); }
    public synchronized int timerSize() { return deadlines.size(); }
    private long now() {
        long n = clock.getAsLong();
        if (n < 0 || n < lastTime) throw new IllegalStateException("nonnegative monotonic time required");
        lastTime = n; return n;
    }
}

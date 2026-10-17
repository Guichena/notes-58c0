import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Objects;

/** Exact LFU, LRU tie-break; one JVM. No TTL, persistence or frequency decay. */
public final class ExactLfuCache<K, V> {
    private static final class Entry<T> {
        T value;
        long frequency = 1;
        Entry(T value) { this.value = value; }
    }
    private final int capacity;
    private final Map<K, Entry<V>> entries = new HashMap<>();
    private final Map<Long, LinkedHashSet<K>> buckets = new HashMap<>();
    private long minFrequency;

    public ExactLfuCache(int capacity) {
        if (capacity < 0) throw new IllegalArgumentException("negative capacity");
        this.capacity = capacity;
    }
    /** Null means absent; null keys and values are disallowed. A hit counts once. */
    public synchronized V get(K key) {
        Entry<V> entry = entries.get(Objects.requireNonNull(key));
        if (entry == null) return null;
        touch(key, entry);
        return entry.value;
    }
    /** Updating an existing key counts as one access. Capacity zero stores nothing. */
    public synchronized void put(K key, V value) {
        Objects.requireNonNull(key); Objects.requireNonNull(value);
        Entry<V> entry = entries.get(key);
        if (entry != null) {
            touch(key, entry);
            entry.value = value;
            return;
        }
        if (capacity == 0) return;
        if (entries.size() == capacity) {
            LinkedHashSet<K> oldestBucket = buckets.get(minFrequency);
            K victim = oldestBucket.iterator().next();
            oldestBucket.remove(victim);
            entries.remove(victim);
            if (oldestBucket.isEmpty()) buckets.remove(minFrequency);
        }
        entries.put(key, new Entry<>(value));
        buckets.computeIfAbsent(1L, ignored -> new LinkedHashSet<>()).add(key);
        minFrequency = 1;
    }
    private void touch(K key, Entry<V> entry) {
        // Fail before mutation instead of wrapping the ordering counter.
        if (entry.frequency == Long.MAX_VALUE)
            throw new IllegalStateException("frequency exhausted");
        long old = entry.frequency;
        LinkedHashSet<K> oldBucket = buckets.get(old);
        oldBucket.remove(key);
        if (oldBucket.isEmpty()) {
            buckets.remove(old);
            if (minFrequency == old) minFrequency = old + 1;
        }
        entry.frequency = old + 1;
        buckets.computeIfAbsent(entry.frequency, ignored -> new LinkedHashSet<>()).add(key);
    }
    public synchronized int size() { return entries.size(); }
    /** Read-only diagnostic snapshot; does not count as access. O(capacity). */
    public synchronized Map<K, V> snapshot() {
        Map<K, V> copy = new HashMap<>();
        entries.forEach((key, entry) -> copy.put(key, entry.value));
        return Map.copyOf(copy);
    }
    // Test hook only: does not change frequency or LRU order.
    synchronized long frequencyOf(K key) { return entries.get(key).frequency; }
    synchronized void checkInvariants() {
        int seen = 0;
        long minimum = Long.MAX_VALUE;
        for (Map.Entry<Long, LinkedHashSet<K>> bucket : buckets.entrySet()) {
            if (bucket.getValue().isEmpty()) throw new AssertionError("empty bucket");
            minimum = Math.min(minimum, bucket.getKey());
            for (K key : bucket.getValue()) {
                if (!entries.containsKey(key) || entries.get(key).frequency != bucket.getKey())
                    throw new AssertionError("entry/bucket mismatch");
                seen++;
            }
        }
        if (seen != entries.size() || entries.size() > capacity
                || (!entries.isEmpty() && minimum != minFrequency))
            throw new AssertionError("size/minimum mismatch");
    }
}

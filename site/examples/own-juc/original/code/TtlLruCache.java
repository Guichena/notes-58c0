import java.util.*;
import java.util.function.LongSupplier;

/** Common write TTL, no read renewal; expiry index is independent of recency. */
public final class TtlLruCache<K, V> {
    private static final class Node<K, V> {
        final K key; final long sequence; V value; long expires;
        Node<K, V> previous, next;
        Node(K key, V value, long expires, long sequence) {
            this.key = key; this.value = value; this.expires = expires; this.sequence = sequence;
        }
    }
    private final int capacity;
    private final long ttl;
    private final LongSupplier clock;
    private final Map<K, Node<K, V>> map = new HashMap<>();
    private final NavigableSet<Node<K, V>> expiry = new TreeSet<>(
            Comparator.<Node<K, V>>comparingLong(n -> n.expires).thenComparingLong(n -> n.sequence));
    private Node<K, V> first, last;
    private long sequence, lastTime;
    public TtlLruCache(int capacity, long ttlTicks, LongSupplier monotonicNonnegativeClock) {
        if (capacity < 0 || ttlTicks <= 0) throw new IllegalArgumentException();
        this.capacity = capacity; ttl = ttlTicks; clock = Objects.requireNonNull(monotonicNonnegativeClock);
    }
    private long now() {
        long value = clock.getAsLong();
        if (value < lastTime) throw new IllegalStateException("clock must be nonnegative and monotonic");
        lastTime = value; return value;
    }
    private void unlink(Node<K, V> node) {
        if (node.previous == null) first = node.next; else node.previous.next = node.next;
        if (node.next == null) last = node.previous; else node.next.previous = node.previous;
        node.previous = node.next = null;
    }
    private void front(Node<K, V> node) {
        node.next = first;
        if (first == null) last = node; else first.previous = node;
        first = node;
    }
    private void remove(Node<K, V> node) { map.remove(node.key); expiry.remove(node); unlink(node); }
    private void purge(long time) {
        while (!expiry.isEmpty() && expiry.first().expires <= time) remove(expiry.first());
    }
    public synchronized V get(K key) {
        Objects.requireNonNull(key); long time = now(); Node<K, V> node = map.get(key);
        if (node == null) return null;
        if (node.expires <= time) { remove(node); return null; }
        unlink(node); front(node); return node.value;
    }
    public synchronized void put(K key, V value) {
        Objects.requireNonNull(key); Objects.requireNonNull(value);
        long time = now(), expires = Math.addExact(time, ttl);
        long newSequence = Math.incrementExact(sequence);
        purge(time); // Remove expired entries anywhere in the recency list before evicting live LRU.
        Node<K, V> node = map.get(key);
        if (node != null) {
            expiry.remove(node); node.expires = expires; node.value = value;
            expiry.add(node); unlink(node); front(node); return;
        }
        if (capacity == 0) return;
        Node<K, V> fresh = new Node<>(key, value, expires, newSequence);
        if (map.size() == capacity) remove(last);
        sequence = newSequence; map.put(key, fresh); expiry.add(fresh); front(fresh);
    }
    public synchronized int evict(int n) {
        if (n < 0) throw new IllegalArgumentException();
        int removed = 0;
        while (removed < n && last != null) { remove(last); removed++; }
        return removed;
    }
    /** A physical entry count; expired entries may remain until touched or a put purges them. */
    public synchronized int retainedSize() { return map.size(); }
    public static void main(String[] args) {
        long[] clock = {0}; TtlLruCache<String, Integer> cache = new TtlLruCache<>(2, 10, () -> clock[0]);
        cache.put("A", 1); clock[0] = 5; cache.put("B", 2);
        clock[0] = 9; Checks.that(cache.get("A") == 1, "A becomes MRU without renewing TTL");
        clock[0] = 10; cache.put("C", 3);
        Checks.that(cache.get("A") == null && cache.get("B") == 2 && cache.get("C") == 3,
                "expired MRU removed before live LRU");
        clock[0] = 14; cache.put("B", 22); clock[0] = 20;
        Checks.that(cache.get("C") == null && cache.get("B") == 22, "put renews, expiration is exclusive");
        Checks.that(cache.evict(100) == 1 && cache.retainedSize() == 0, "eviction removes both indices");
        TtlLruCache<String, Integer> sameExpiry = new TtlLruCache<>(3, 10, () -> 0);
        sameExpiry.put("x", 1); sameExpiry.put("y", 2); sameExpiry.put("z", 3);
        Checks.that(sameExpiry.retainedSize() == 3, "equal expiry nodes coexist");
        clock[0] = Long.MAX_VALUE;
        try { cache.put("overflow", 4); throw new AssertionError("deadline overflow accepted"); }
        catch (ArithmeticException expected) { }
        Checks.that(cache.retainedSize() == 0, "overflow before structural change");
        System.out.println("TtlLruCache OK");
    }
}

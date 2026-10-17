import java.util.*;
import java.util.concurrent.*;

/** Handwritten hash buckets + doubly linked access list; no LinkedHashMap/HashMap inside the cache. */
public final class LruCache<K, V> {
    private static final class Node<K, V> {
        final K key; final int hash; V value;
        Node<K, V> bucketPrevious, bucketNext, previous, next;
        Node(K key, V value, int hash) { this.key = key; this.value = value; this.hash = hash; }
    }
    private final Node<K, V>[] buckets;
    private final int capacity;
    private Node<K, V> first, last; // MRU -> LRU
    private int size;
    @SuppressWarnings("unchecked") public LruCache(int capacity) {
        if (capacity < 0 || capacity > (1 << 28)) throw new IllegalArgumentException("capacity out of teaching range");
        this.capacity = capacity;
        int length = 1;
        while (length < Math.max(1, 2 * capacity)) length <<= 1;
        buckets = (Node<K, V>[]) new Node<?, ?>[length];
    }
    private int hash(K key) {
        if (key == null) throw new NullPointerException("key");
        int h = key.hashCode(); return h ^ (h >>> 16);
    }
    private Node<K, V> find(K key, int hash) {
        for (Node<K, V> node = buckets[hash & (buckets.length - 1)]; node != null; node = node.bucketNext)
            if (node.hash == hash && key.equals(node.key)) return node;
        return null;
    }
    private void unlinkAccess(Node<K, V> node) {
        if (node.previous == null) first = node.next; else node.previous.next = node.next;
        if (node.next == null) last = node.previous; else node.next.previous = node.previous;
        node.previous = node.next = null;
    }
    private void linkFirst(Node<K, V> node) {
        node.next = first;
        if (first != null) first.previous = node; else last = node;
        first = node;
    }
    private void touch(Node<K, V> node) { unlinkAccess(node); linkFirst(node); }
    private void remove(Node<K, V> node) {
        int bucket = node.hash & (buckets.length - 1);
        if (node.bucketPrevious == null) buckets[bucket] = node.bucketNext;
        else node.bucketPrevious.bucketNext = node.bucketNext;
        if (node.bucketNext != null) node.bucketNext.bucketPrevious = node.bucketPrevious;
        node.bucketPrevious = null;
        unlinkAccess(node); node.bucketNext = null; size--;
    }
    public synchronized V get(K key) {
        Node<K, V> node = find(key, hash(key));
        if (node == null) return null;
        touch(node); return node.value;
    }
    public synchronized void put(K key, V value) {
        int hash = hash(key);
        if (value == null) throw new NullPointerException("value");
        Node<K, V> node = find(key, hash);
        if (node != null) { node.value = value; touch(node); return; }
        if (capacity == 0) return;
        Node<K, V> fresh = new Node<>(key, value, hash); // Allocate before evicting an existing value.
        if (size == capacity) remove(last);
        int bucket = hash & (buckets.length - 1);
        fresh.bucketNext = buckets[bucket];
        if (fresh.bucketNext != null) fresh.bucketNext.bucketPrevious = fresh;
        buckets[bucket] = fresh;
        linkFirst(fresh); size++;
    }
    public synchronized int evict(int n) {
        if (n < 0) throw new IllegalArgumentException("n >= 0");
        int removed = 0;
        while (removed < n && last != null) { remove(last); removed++; }
        return removed;
    }
    public synchronized int size() { return size; }
    public synchronized Object[] keysMostRecentFirst() {
        Object[] keys = new Object[size]; int i = 0;
        for (Node<K, V> node = first; node != null; node = node.next) keys[i++] = node.key;
        if (i != size) throw new AssertionError("access-list invariant");
        return keys;
    }
    public static void main(String[] args) throws Exception {
        LruCache<Integer, String> cache = new LruCache<>(2);
        cache.put(1, "a"); cache.put(2, "b"); Checks.that(cache.get(1).equals("a"), "hit touches");
        cache.put(3, "c"); Checks.that(cache.get(2) == null, "LRU eviction");
        cache.put(1, "A"); Checks.that(cache.size() == 2 && cache.get(1).equals("A"), "update no size growth");
        Checks.that(cache.evict(10) == 2 && cache.size() == 0, "evict beyond size");
        LruCache<Integer, Integer> zero = new LruCache<>(0); zero.put(1, 1);
        Checks.that(zero.get(1) == null && zero.size() == 0, "zero capacity");
        record Collision(int id) { public int hashCode() { return 1; } }
        LruCache<Collision, Integer> collided = new LruCache<>(3);
        for (int n = 0; n < 10; n++) collided.put(new Collision(n), n);
        Checks.that(collided.get(new Collision(9)) == 9 && collided.get(new Collision(6)) == null, "bucket collisions");
        LruCache<Integer, Integer> shared = new LruCache<>(32); ExecutorService pool = Executors.newFixedThreadPool(4);
        try {
            List<Future<?>> jobs = new ArrayList<>();
            for (int t = 0; t < 4; t++) { int base = t * 1000; jobs.add(pool.submit(() -> {
                for (int i = 0; i < 1000; i++) { shared.put(base + i, i); shared.get(base + i); }
            })); }
            for (Future<?> f : jobs) Checks.get(f);
            Checks.that(shared.size() == 32 && shared.keysMostRecentFirst().length == 32, "concurrent capacity/list invariant");
        } finally { Checks.stop(pool); }
        System.out.println("LruCache OK");
    }
}

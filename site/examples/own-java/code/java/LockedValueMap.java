import java.util.*;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/**
 * All map operations share this monitor. Keys/values must be stable and their equality/hash
 * must not call this object or mutate this map. Snapshots copy structure, not element objects.
 */
public final class LockedValueMap<K, V> {
    private LinkedHashMap<K, V> values = new LinkedHashMap<>();
    public synchronized V put(K key, V value) { return values.put(key, value); }
    public synchronized V get(K key) { return values.get(key); }
    public synchronized boolean containsKey(K key) { return values.containsKey(key); }
    public synchronized Map<K, V> snapshot() {
        return Collections.unmodifiableMap(new LinkedHashMap<>(values));
    }
    public synchronized int removeValue(V target) {
        LinkedHashMap<K, V> retained = new LinkedHashMap<>();
        int removed = 0;
        for (Map.Entry<K, V> entry : values.entrySet()) {
            if (Objects.equals(entry.getValue(), target)) removed++;
            else retained.put(entry.getKey(), entry.getValue());
        }
        // One commit after all equality/hash operations have succeeded.
        values = retained;
        return removed;
    }
    private static final class ExplosiveValue {
        final boolean explode;
        ExplosiveValue(boolean explode) { this.explode = explode; }
        @Override public boolean equals(Object other) {
            if (explode) throw new IllegalStateException("equality failure");
            return true;
        }
        @Override public int hashCode() { return 1; }
    }
    public static void main(String[] args) throws Exception {
        LockedValueMap<String, Integer> map = new LockedValueMap<>();
        map.put("a", 1); map.put("b", null); map.put("c", 1); map.put("d", 2);
        Map<String, Integer> old = map.snapshot();
        Checks.check(map.removeValue(1) == 2, "all matching values");
        Checks.equal(new ArrayList<>(map.snapshot().keySet()), Arrays.asList("b", "d"), "order retained");
        Checks.check(old.size() == 4, "old snapshot independent");
        Checks.expect(UnsupportedOperationException.class, () -> old.put("x", 3), "snapshot immutable");
        Checks.check(map.removeValue(null) == 1 && map.removeValue(null) == 0, "null and missing");
        LockedValueMap<String, ExplosiveValue> failed = new LockedValueMap<>();
        ExplosiveValue first = new ExplosiveValue(false), second = new ExplosiveValue(true);
        failed.put("first", first); failed.put("second", second);
        Checks.expect(IllegalStateException.class,
                () -> failed.removeValue(new ExplosiveValue(false)), "comparison abort");
        Checks.check(failed.snapshot().size() == 2 && failed.get("first") == first,
                "no partial structural delete");

        LockedValueMap<Integer, Integer> concurrent = new LockedValueMap<>();
        CountDownLatch start = new CountDownLatch(1), done = new CountDownLatch(4);
        AtomicReference<Throwable> failure = new AtomicReference<>();
        for (int worker = 0; worker < 4; worker++) {
            final int id = worker;
            Thread thread = new Thread(() -> {
                try {
                    if (!start.await(5, TimeUnit.SECONDS)) throw new AssertionError("start timeout");
                    for (int i = 0; i < 250; i++) concurrent.put(id * 250 + i, id);
                } catch (Throwable t) { failure.compareAndSet(null, t); }
                finally { done.countDown(); }
            }, "map-test-" + id);
            thread.setDaemon(true); thread.start();
        }
        start.countDown();
        Checks.check(done.await(5, TimeUnit.SECONDS), "bounded worker completion");
        if (failure.get() != null) throw new AssertionError("worker failed", failure.get());
        Checks.check(concurrent.snapshot().size() == 1_000, "all distinct writes retained");
        Checks.check(concurrent.removeValue(2) == 250 && concurrent.snapshot().size() == 750,
                "batch deletion after writers");
        Checks.done("LockedValueMap");
    }
}

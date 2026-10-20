import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Objects;
import java.util.Random;

public final class LruCacheTest {
    private static int checks;
    private static void eq(Object expected, Object actual) {
        checks++;
        if (!Objects.equals(expected, actual))
            throw new AssertionError("expected=" + expected + ", actual=" + actual);
    }
    private static void throwsType(Class<? extends Throwable> type, Runnable action) {
        checks++;
        try { action.run(); }
        catch (Throwable e) {
            if (type.isInstance(e)) return;
            throw new AssertionError("wrong exception", e);
        }
        throw new AssertionError("expected " + type.getSimpleName());
    }
    private static void state(LruCache<Integer, String> cache, Integer... keys) {
        cache.checkInvariants();
        eq(List.of(keys), cache.keysMostRecentFirst());
        eq(keys.length, cache.size());
    }
    private static void basic() {
        throwsType(IllegalArgumentException.class, () -> new LruCache<>(-1));
        LruCache<Integer, String> zero = new LruCache<>(0);
        zero.put(1, "a"); eq(null, zero.get(1)); state(zero);
        throwsType(NullPointerException.class, () -> zero.put(null, "a"));
        throwsType(NullPointerException.class, () -> zero.put(1, null));
        throwsType(NullPointerException.class, () -> zero.get(null));
        LruCache<Integer, String> one = new LruCache<>(1);
        eq(null, one.get(1)); state(one);
        one.put(1, "a"); one.put(1, "b"); eq("b", one.get(1)); state(one, 1);
        one.put(2, "c"); eq(null, one.get(1)); state(one, 2);
        LruCache<Integer, String> c = new LruCache<>(2);
        c.put(1, "a"); state(c, 1);
        c.put(2, "b"); state(c, 2, 1);
        eq("a", c.get(1)); state(c, 1, 2);
        eq(null, c.get(99)); state(c, 1, 2);
        c.put(3, "c"); eq(null, c.get(2)); state(c, 3, 1);
        c.put(1, "A"); state(c, 1, 3);
        c.put(4, "d"); eq(null, c.get(3)); eq("A", c.get(1)); state(c, 1, 4);
        c.put(Integer.MIN_VALUE, "min"); c.put(Integer.MAX_VALUE, "max");
        state(c, Integer.MAX_VALUE, Integer.MIN_VALUE);
        eq("min", c.get(Integer.MIN_VALUE)); state(c, Integer.MIN_VALUE, Integer.MAX_VALUE);
    }
    private static final class CollisionKey {
        final int id;
        CollisionKey(int id) { this.id = id; }
        @Override public int hashCode() { return 1; }
        @Override public boolean equals(Object other) {
            return other instanceof CollisionKey && ((CollisionKey) other).id == id;
        }
    }
    private static void collisions() {
        LruCache<CollisionKey, Integer> c = new LruCache<>(40);
        for (int i = 0; i < 100; i++) { c.put(new CollisionKey(i), i); c.checkInvariants(); }
        eq(null, c.get(new CollisionKey(59)));
        for (int i = 60; i < 100; i++) eq(i, c.get(new CollisionKey(i)));
        c.put(new CollisionKey(70), -1); eq(-1, c.get(new CollisionKey(70)));
        eq(40, c.size()); c.checkInvariants();
    }
    private static void differential() {
        for (int capacity : new int[] {0, 1, 2, 7, 32}) {
            Random random = new Random(20261020L + capacity);
            LruCache<Integer, Integer> actual = new LruCache<>(capacity);
            LinkedHashMap<Integer, Integer> oracle = new LinkedHashMap<>(16, 0.75f, true);
            for (int i = 0; i < 10000; i++) {
                int key = random.nextInt(80) - 40;
                if (random.nextBoolean()) {
                    int value = random.nextInt();
                    actual.put(key, value); oracle.put(key, value);
                    if (oracle.size() > capacity) oracle.remove(oracle.keySet().iterator().next());
                } else {
                    eq(oracle.get(key), actual.get(key));
                }
                actual.checkInvariants();
                List<Integer> expected = new ArrayList<>(oracle.keySet());
                Collections.reverse(expected);
                eq(expected, actual.keysMostRecentFirst());
                eq(oracle.size(), actual.size());
            }
        }
    }
    public static void main(String[] args) {
        basic(); collisions(); differential();
        System.out.println("PASS: " + checks + " assertions; 50000 randomized operations; invariants checked.");
    }
}

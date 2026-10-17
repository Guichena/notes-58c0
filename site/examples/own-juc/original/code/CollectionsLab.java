import java.util.*;
import java.util.concurrent.*;

public final class CollectionsLab {
    /** All methods share one monitor; batch comparison happens on a private candidate map. */
    static final class ValueMap<K, V> {
        private Map<K, V> data = new HashMap<>();
        private boolean inOperation;
        private void enter() {
            if (inOperation) throw new IllegalStateException("reentrant key/value callback");
            inOperation = true;
        }
        synchronized void put(K key, V value) {
            enter(); try { data.put(key, value); } finally { inOperation = false; }
        }
        synchronized V get(K key) {
            enter(); try { return data.get(key); } finally { inOperation = false; }
        }
        synchronized int removeValue(V target) {
            enter();
            try {
                Map<K, V> candidate = new HashMap<>(data);
                int before = candidate.size();
                candidate.entrySet().removeIf(entry -> Objects.equals(entry.getValue(), target));
                data = candidate; // Commit only after every comparison succeeded.
                return before - candidate.size();
            } finally { inOperation = false; }
        }
        synchronized int size() { enter(); try { return data.size(); } finally { inOperation = false; } }
    }
    static final class OrderedMap<K, V> {
        private final LinkedHashMap<K, V> data;
        OrderedMap(boolean accessOrder) { data = new LinkedHashMap<>(16, 0.75f, accessOrder); }
        synchronized V get(K key) { return data.get(key); }
        synchronized void put(K key, V value) { data.put(key, value); }
        synchronized Map<K, V> snapshot() {
            return Collections.unmodifiableMap(new LinkedHashMap<>(data));
        }
    }
    record Versioned(long version, String value) {}
    public static void main(String[] args) {
        ValueMap<String, String> map = new ValueMap<>();
        map.put("a", "delete"); map.put("b", "keep"); map.put("c", "delete");
        Checks.that(map.removeValue("delete") == 2 && map.size() == 1 && map.get("b").equals("keep"), "whole-batch deletion by value");
        ValueMap<String, Object> throwing = new ValueMap<>();
        Object broken = new Object() { public boolean equals(Object other) { throw new IllegalStateException("comparison failed"); } };
        throwing.put("a", "target"); throwing.put("b", broken);
        try { throwing.removeValue("target"); throw new AssertionError("expected comparison failure"); }
        catch (IllegalStateException expected) { }
        Checks.that(throwing.size() == 2, "failed batch did not commit partial deletion");
        ValueMap<String, Object> recursive = new ValueMap<>();
        recursive.put("a", new Object() { public boolean equals(Object other) { recursive.put("x", "x"); return true; } });
        try { recursive.removeValue("target"); throw new AssertionError("reentry accepted"); }
        catch (IllegalStateException expected) { }
        Checks.that(recursive.size() == 1, "reentrant mutation rejected");
        ConcurrentHashMap<String, Versioned> versions = new ConcurrentHashMap<>();
        Versioned observed = new Versioned(1, "delete"); versions.put("k", observed);
        versions.put("k", new Versioned(2, "delete"));
        Checks.that(!versions.remove("k", observed), "version prevents deleting an equal-payload replacement");
        for (var entry : versions.entrySet())
            if (entry.getValue().value().equals("delete")) versions.remove(entry.getKey(), entry.getValue());
        Checks.that(versions.isEmpty(), "weak per-entry deletion example");
        OrderedMap<String, Integer> insertion = new OrderedMap<>(false), access = new OrderedMap<>(true);
        for (OrderedMap<String, Integer> ordered : List.of(insertion, access)) {
            ordered.put("a", 1); ordered.put("b", 2); ordered.get("a");
        }
        Checks.that(new ArrayList<>(insertion.snapshot().keySet()).equals(List.of("a", "b")), "insertion order");
        Checks.that(new ArrayList<>(access.snapshot().keySet()).equals(List.of("b", "a")), "access order");
        CopyOnWriteArrayList<Integer> cow = new CopyOnWriteArrayList<>(List.of(1, 2));
        Iterator<Integer> snapshot = cow.iterator(); cow.add(3);
        List<Integer> old = new ArrayList<>(); snapshot.forEachRemaining(old::add);
        Checks.that(old.equals(List.of(1, 2)) && cow.size() == 3, "COW snapshot");
        System.out.println("CollectionsLab OK");
    }
}

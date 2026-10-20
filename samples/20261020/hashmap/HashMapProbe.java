import java.lang.reflect.Field;
import java.util.HashMap;
import java.util.Objects;

// Original learning probe. Reflection is used only to inspect JDK internals in a local test.
public class HashMapProbe {
    record Key(String id, int hash) {
        @Override public int hashCode() { return hash; }
    }
    static final class MutableKey {
        int id;
        MutableKey(int id) { this.id = id; }
        @Override public int hashCode() { return id; }
        @Override public boolean equals(Object other) {
            return other instanceof MutableKey k && id == k.id;
        }
    }
    static void expect(Object actual, Object expected, String name) {
        if (!Objects.equals(actual, expected))
            throw new AssertionError(name + ": " + actual + " != " + expected);
        System.out.println("PASS " + name + " = " + actual);
    }
    static Object[] table(HashMap<?, ?> map) throws Exception {
        Field f = HashMap.class.getDeclaredField("table");
        f.setAccessible(true);
        return (Object[]) f.get(map);
    }
    static String binKind(HashMap<?, ?> map, int bucket) throws Exception {
        return table(map)[bucket].getClass().getSimpleName();
    }
    public static void main(String[] args) throws Exception {
        HashMap<Key, String> notes = new HashMap<>(16);
        Key a = new Key("Java", 1), b = new Key("SQL", 17);
        expect(notes.get(a), null, "empty lookup");
        notes.put(a, "draft");
        notes.put(b, "ready");
        expect(notes.put(new Key("Java", 1), "checked"), "draft", "equal key replaces");
        expect(notes.size(), 2, "collision is not equality");
        expect(notes.get(b), "ready", "colliding key remains retrievable");
        notes.put(null, "unknown topic");
        notes.put(null, "renamed topic");
        expect(notes.get(null), "renamed topic", "one null key");
        notes.put(new Key("RAG", 33), null);
        expect(notes.containsKey(new Key("RAG", 33)), true, "explicit null value is present");
        expect(notes.containsKey(new Key("missing", 49)), false, "absent colliding key");

        HashMap<Integer, Integer> small = new HashMap<>(4);
        expect(table(small), null, "lazy allocation");
        for (int k : new int[]{1, 5, 2}) small.put(k, k);
        expect(table(small).length, 4, "capacity at three mappings");
        small.put(3, 3);
        expect(table(small).length, 8, "capacity after fourth mapping");
        expect(((java.util.Map.Entry<?, ?>) table(small)[1]).getKey(), 1, "hash 1 stays");
        expect(((java.util.Map.Entry<?, ?>) table(small)[5]).getKey(), 5, "hash 5 moves");

        HashMap<Key, Integer> collisions = new HashMap<>(64);
        for (int i = 0; i < 8; i++) collisions.put(new Key("k" + i, 7), i);
        expect(binKind(collisions, 7), "Node", "ordinary put at eight nodes");
        collisions.put(new Key("k8", 7), 8);
        expect(binKind(collisions, 7), "TreeNode", "ordinary put at ninth node");
        expect(collisions.get(new Key("k8", 7)), 8, "equal distinct key in tree bin");

        HashMap<MutableKey, String> unsafe = new HashMap<>();
        MutableKey key = new MutableKey(1);
        unsafe.put(key, "value");
        key.id = 2;
        expect(unsafe.get(key), null, "mutation pitfall on this runtime, not API guarantee");
        expect(unsafe.size(), 1, "entry still occupies storage");
        System.out.println("All 17 checks passed.");
    }
}

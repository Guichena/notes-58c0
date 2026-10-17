import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Random;

/** Single-threaded teaching map. Stable keys required; no Map-interface compatibility claim. */
public final class MiniHashMap<K, V> {
    private static final int MAX_CAPACITY = 1 << 20;
    private static final class Node<K, V> {
        final int hash;
        final K key;
        V value;
        Node<K, V> next;
        Node(int hash, K key, V value, Node<K, V> next) {
            this.hash = hash; this.key = key; this.value = value; this.next = next;
        }
    }
    private Node<K, V>[] table;
    private int size;
    private int threshold;

    public MiniHashMap(int initialCapacity) {
        if (initialCapacity < 0 || initialCapacity > MAX_CAPACITY)
            throw new IllegalArgumentException("capacity out of teaching limit");
        int capacity = 4;
        while (capacity < initialCapacity) capacity <<= 1;
        table = newTable(capacity);
        threshold = capacity * 3 / 4;
    }
    @SuppressWarnings("unchecked")
    private Node<K, V>[] newTable(int capacity) {
        // The array stays private; every stored node is created with this map's K and V.
        return (Node<K, V>[]) new Node<?, ?>[capacity];
    }
    private static int hash(Object key) {
        if (key == null) return 0;
        int h = key.hashCode();
        return h ^ (h >>> 16);
    }
    private Node<K, V> find(Object key) {
        int h = hash(key);
        for (Node<K, V> node = table[h & (table.length - 1)]; node != null; node = node.next) {
            if (node.hash == h && Objects.equals(key, node.key)) return node;
        }
        return null;
    }
    public int size() { return size; }
    public int capacity() { return table.length; }
    public boolean containsKey(Object key) { return find(key) != null; }
    public V get(Object key) {
        Node<K, V> node = find(key);
        return node == null ? null : node.value;
    }
    public V put(K key, V value) {
        Node<K, V> existing = find(key);
        if (existing != null) {
            V old = existing.value; existing.value = value; return old;
        }
        int h = hash(key);
        if (size + 1 > threshold) grow();
        int index = h & (table.length - 1);
        table[index] = new Node<>(h, key, value, table[index]);
        size++;
        return null;
    }
    private void grow() {
        if (table.length == MAX_CAPACITY)
            throw new IllegalStateException("teaching map capacity limit");
        Node<K, V>[] nextTable = newTable(table.length * 2);
        for (Node<K, V> head : table) {
            Node<K, V> node = head;
            while (node != null) {
                Node<K, V> next = node.next; // Save the old link before rewiring.
                int index = node.hash & (nextTable.length - 1);
                node.next = nextTable[index];
                nextTable[index] = node;
                node = next;
            }
        }
        table = nextTable;
        threshold = table.length * 3 / 4;
    }
    public V remove(Object key) {
        int h = hash(key), index = h & (table.length - 1);
        Node<K, V> previous = null;
        for (Node<K, V> node = table[index]; node != null; node = node.next) {
            if (node.hash == h && Objects.equals(key, node.key)) {
                if (previous == null) table[index] = node.next;
                else previous.next = node.next;
                size--;
                return node.value;
            }
            previous = node;
        }
        return null;
    }
    private record CollisionKey(int id) {
        @Override public int hashCode() { return id % 3; }
    }
    public static void main(String[] args) {
        Checks.expect(IllegalArgumentException.class, () -> new MiniHashMap<>(-1), "negative capacity");
        MiniHashMap<Integer, String> basic = new MiniHashMap<>(0);
        basic.put(1, "a"); basic.put(2, "b"); basic.put(3, "c");
        Checks.check(basic.capacity() == 4, "threshold no early resize");
        basic.put(3, "C");
        Checks.check(basic.size() == 3 && basic.capacity() == 4, "replace does not grow");
        basic.put(4, "d");
        Checks.check(basic.capacity() == 8 && basic.size() == 4, "resize on new mapping");
        basic.put(null, null);
        Checks.check(basic.containsKey(null) && basic.get(null) == null, "present null");
        basic.remove(null);
        Checks.check(!basic.containsKey(null), "remove null");

        MiniHashMap<CollisionKey, Integer> actual = new MiniHashMap<>(4);
        Map<CollisionKey, Integer> expected = new HashMap<>();
        Random random = new Random(81173);
        for (int step = 0; step < 5_000; step++) {
            CollisionKey key = random.nextInt(12) == 0 ? null : new CollisionKey(random.nextInt(121) - 60);
            Integer value = random.nextInt(7) == 0 ? null : random.nextInt();
            switch (random.nextInt(3)) {
                case 0 -> Checks.equal(actual.put(key, value), expected.put(key, value), "put " + step);
                case 1 -> Checks.equal(actual.remove(key), expected.remove(key), "remove " + step);
                default -> Checks.equal(actual.get(key), expected.get(key), "get " + step);
            }
            Checks.check(actual.size() == expected.size(), "size " + step);
            Checks.check(actual.containsKey(key) == expected.containsKey(key), "membership " + step);
            for (int id = -60; id <= 60; id++) {
                CollisionKey k = new CollisionKey(id);
                Checks.equal(actual.get(k), expected.get(k), "collision value " + step + "/" + id);
                Checks.check(actual.containsKey(k) == expected.containsKey(k), "collision membership");
            }
        }
        Checks.done("MiniHashMap");
    }
}

import java.util.ArrayList;
import java.util.HashMap;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/** Single-threaded, count-bounded LRU. Null keys/values are rejected. */
public final class LruCache<K, V> {
    private static final class Node<K, V> {
        final K key;
        V value;
        Node<K, V> prev;
        Node<K, V> next;
        Node(K key, V value) { this.key = key; this.value = value; }
    }
    private final int capacity;
    private final Map<K, Node<K, V>> index = new HashMap<>();
    private final Node<K, V> head = new Node<>(null, null);
    private final Node<K, V> tail = new Node<>(null, null);

    public LruCache(int capacity) {
        if (capacity < 0) throw new IllegalArgumentException("capacity < 0");
        this.capacity = capacity;
        head.next = tail;
        tail.prev = head;
    }

    /** Returns null on a miss. A hit becomes most recently used. */
    public V get(K key) {
        Objects.requireNonNull(key, "key");
        Node<K, V> node = index.get(key);
        if (node == null) return null;
        moveToFront(node);
        return node.value;
    }

    /** Updates count as accesses. A zero-capacity cache stores nothing. */
    public void put(K key, V value) {
        Objects.requireNonNull(key, "key");
        Objects.requireNonNull(value, "value");
        if (capacity == 0) return;
        Node<K, V> node = index.get(key);
        if (node != null) {
            node.value = value;
            moveToFront(node);
            return;
        }
        node = new Node<>(key, value);
        index.put(key, node);
        addFirst(node);
        if (index.size() > capacity) {
            Node<K, V> victim = tail.prev;
            unlink(victim);
            index.remove(victim.key);
        }
    }

    public int size() { return index.size(); }

    private void moveToFront(Node<K, V> node) {
        unlink(node);
        addFirst(node);
    }

    private void unlink(Node<K, V> node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
        node.prev = null;
        node.next = null;
    }

    private void addFirst(Node<K, V> node) {
        node.prev = head;
        node.next = head.next;
        head.next.prev = node;
        head.next = node;
    }

    // Package-private test aids, not part of the public cache API.
    List<K> keysMostRecentFirst() {
        List<K> result = new ArrayList<>();
        for (Node<K, V> n = head.next; n != tail; n = n.next) result.add(n.key);
        return result;
    }

    void checkInvariants() {
        if (head.prev != null || tail.next != null || head.next == null || tail.prev == null)
            throw new AssertionError("bad sentinels");
        IdentityHashMap<Node<K, V>, Boolean> seen = new IdentityHashMap<>();
        Node<K, V> previous = head;
        for (Node<K, V> n = head.next; n != tail; n = n.next) {
            if (n == null || n == head || seen.put(n, true) != null)
                throw new AssertionError("broken path or cycle");
            if (n.prev != previous || index.get(n.key) != n)
                throw new AssertionError("links/index disagree");
            previous = n;
        }
        if (tail.prev != previous || seen.size() != index.size() || index.size() > capacity)
            throw new AssertionError("size/tail mismatch");
        for (Node<K, V> n : index.values()) {
            if (!seen.containsKey(n)) throw new AssertionError("unlinked node");
        }
    }
}

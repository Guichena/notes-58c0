import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int capacity = Integer.parseInt(sc.nextLine().trim());
        LFUCache cache = new LFUCache(capacity);
        int count = Integer.parseInt(sc.nextLine().trim());
        if (count < 0) throw new IllegalArgumentException("negative operation count");
        StringBuilder answer = new StringBuilder();
        for (int i = 0; i < count; i++) {
            String[] parts = sc.nextLine().trim().split("\\s+");
            if (parts[0].equals("get") && parts.length == 2) {
                answer.append(cache.get(Integer.parseInt(parts[1]))).append('\n');
            } else if (parts[0].equals("put") && parts.length == 3) {
                cache.put(Integer.parseInt(parts[1]), Integer.parseInt(parts[2]));
            } else throw new IllegalArgumentException("expected get key or put key value");
        }
        System.out.print(answer);
    }
}

// 单线程整数 LFU；命中 get 和覆盖 put 都算访问，同频按 LRU 淘汰。
class LFUCache {
    static final class Node {
        final int key;
        int value;
        long frequency = 1;
        Node prev, next;
        Node(int key, int value) { this.key = key; this.value = value; }
    }

    // 桶内只保留首尾和节点链接，没有按历史峰值保留的哈希数组。
    static final class Bucket {
        Node first, last; // first 最旧，last 最新
        void append(Node node) {
            node.prev = last;
            node.next = null;
            if (last == null) first = node;
            else last.next = node;
            last = node;
        }
        void remove(Node node) {
            if (node.prev == null) first = node.next;
            else node.prev.next = node.next;
            if (node.next == null) last = node.prev;
            else node.next.prev = node.prev;
            node.prev = node.next = null;
        }
        boolean isEmpty() { return first == null; }
    }

    private final int capacity;
    private final Map<Integer, Node> nodes = new HashMap<>();
    private final Map<Long, Bucket> buckets = new HashMap<>();
    private long minimum;

    public LFUCache(int capacity) {
        if (capacity < 0) throw new IllegalArgumentException("capacity must be nonnegative");
        this.capacity = capacity;
    }

    public int get(int key) {
        Node node = nodes.get(key);
        if (node == null) return -1;
        touch(node);
        return node.value;
    }

    public void put(int key, int value) {
        Node node = nodes.get(key);
        if (node != null) {
            touch(node); // 先检查频率溢出，成功后才覆盖 value
            node.value = value;
            return;
        }
        if (capacity == 0) return;
        if (nodes.size() == capacity) {
            Bucket bucket = buckets.get(minimum);
            Node victim = bucket.first;
            bucket.remove(victim);
            nodes.remove(victim.key);
            if (bucket.isEmpty()) buckets.remove(minimum);
        }
        node = new Node(key, value);
        nodes.put(key, node);
        buckets.computeIfAbsent(1L, f -> new Bucket()).append(node);
        minimum = 1;
    }

    private void touch(Node node) {
        long nextFrequency = Math.addExact(node.frequency, 1L);
        Bucket old = buckets.get(node.frequency);
        old.remove(node);
        if (old.isEmpty()) {
            buckets.remove(node.frequency);
            if (minimum == node.frequency) minimum = nextFrequency;
        }
        node.frequency = nextFrequency;
        buckets.computeIfAbsent(nextFrequency, f -> new Bucket()).append(node);
    }
}

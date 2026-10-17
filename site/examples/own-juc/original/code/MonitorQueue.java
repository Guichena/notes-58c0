import java.util.ArrayDeque;
import java.util.Objects;

/** Close rejects puts; takes drain existing elements, then return null. */
public final class MonitorQueue<E> {
    private final ArrayDeque<E> queue = new ArrayDeque<>();
    private final int capacity;
    private boolean closed;
    public MonitorQueue(int capacity) {
        if (capacity <= 0) throw new IllegalArgumentException("capacity must be positive");
        this.capacity = capacity;
    }
    public synchronized void put(E value) throws InterruptedException {
        Objects.requireNonNull(value, "null is reserved for closed-and-drained");
        while (!closed && queue.size() == capacity) wait();
        if (closed) throw new IllegalStateException("queue closed");
        queue.addLast(value);            // put linearizes here, while holding the monitor.
        notifyAll();
    }
    public synchronized E take() throws InterruptedException {
        while (!closed && queue.isEmpty()) wait();
        if (queue.isEmpty()) return null;
        E value = queue.removeFirst();  // take linearizes here.
        notifyAll();
        return value;
    }
    public synchronized int size() { return queue.size(); }
    public synchronized void close() { closed = true; notifyAll(); }
}

import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.locks.*;

/** Fixed-capacity, in-memory queue. Null is not a valid element. */
public final class CloseableRing<E> {
    public enum Push { ACCEPTED, FULL, CLOSED }
    public enum State { VALUE, EMPTY, CLOSED }
    public record Pop<T>(State state, T value) {}
    public record Stats(long accepted, long rejected) {}
    private final Object[] elements;
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition notEmpty = lock.newCondition();
    private int head, tail, size;
    private boolean closed;
    private long accepted, rejected;

    public CloseableRing(int capacity) {
        if (capacity <= 0) throw new IllegalArgumentException("capacity must be positive");
        elements = new Object[capacity];
    }
    // Counts valid push calls; null argument rejection is not counted.
    public Push push(E value) {
        Objects.requireNonNull(value);
        lock.lock();
        try {
            if (closed) { rejected++; return Push.CLOSED; }
            if (size == elements.length) { rejected++; return Push.FULL; }
            elements[tail] = value;
            tail = (tail + 1) % elements.length;
            size++;
            accepted++;
            notEmpty.signal();
            return Push.ACCEPTED;
        } finally { lock.unlock(); }
    }
    public Pop<E> pop() {
        lock.lock();
        try { return remove(); }
        finally { lock.unlock(); }
    }
    // Blocks only while open and empty. Close drains existing elements, then ends.
    public Pop<E> take() throws InterruptedException {
        lock.lockInterruptibly();
        try {
            while (size == 0 && !closed) notEmpty.await();
            return remove();
        } finally { lock.unlock(); }
    }
    @SuppressWarnings("unchecked")
    private Pop<E> remove() {
        if (size == 0) return new Pop<>(closed ? State.CLOSED : State.EMPTY, null);
        E value = (E) elements[head];
        elements[head] = null;
        head = (head + 1) % elements.length;
        size--;
        return new Pop<>(State.VALUE, value);
    }
    public void close() {
        lock.lock();
        try { closed = true; notEmpty.signalAll(); }
        finally { lock.unlock(); }
    }
    public Stats stats() {
        lock.lock();
        try { return new Stats(accepted, rejected); }
        finally { lock.unlock(); }
    }
    static void require(boolean ok) { if (!ok) throw new AssertionError(); }
    public static void main(String[] args) throws Exception {
        CloseableRing<Integer> q = new CloseableRing<>(2);
        require(q.pop().state() == State.EMPTY);
        require(q.push(0) == Push.ACCEPTED);
        require(q.push(1) == Push.ACCEPTED);
        require(q.push(2) == Push.FULL);
        require(q.pop().value() == 0);
        require(q.push(2) == Push.ACCEPTED); // wrap around
        q.close(); q.close();
        require(q.push(3) == Push.CLOSED);
        require(q.take().value() == 1 && q.take().value() == 2);
        require(q.take().state() == State.CLOSED);
        require(q.stats().equals(new Stats(3, 2)));
        CloseableRing<Boolean> flags = new CloseableRing<>(1);
        flags.push(false);
        require(flags.pop().equals(new Pop<>(State.VALUE, false)));

        int producers = 4, each = 1000;
        CloseableRing<Integer> concurrent = new CloseableRing<>(producers * each);
        ExecutorService pool = Executors.newFixedThreadPool(8);
        try {
            List<Future<?>> jobs = new ArrayList<>();
            for (int p = 0; p < producers; p++) {
                final int id = p;
                jobs.add(pool.submit(() -> {
                    for (int i = 0; i < each; i++)
                        require(concurrent.push(id * each + i) == Push.ACCEPTED);
                }));
            }
            for (Future<?> f : jobs) f.get(10, TimeUnit.SECONDS);
            concurrent.close();
            Set<Integer> seen = ConcurrentHashMap.newKeySet();
            jobs.clear();
            for (int c = 0; c < 4; c++) jobs.add(pool.submit(() -> {
                try {
                    for (;;) {
                        Pop<Integer> item = concurrent.take();
                        if (item.state() == State.CLOSED) return;
                        require(seen.add(item.value()));
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new RuntimeException(e);
                }
            }));
            for (Future<?> f : jobs) f.get(10, TimeUnit.SECONDS);
            require(seen.size() == producers * each);
            CloseableRing<Integer> waiting = new CloseableRing<>(1);
            Future<Pop<Integer>> waiter = pool.submit(waiting::take);
            waiting.close();
            require(waiter.get(10, TimeUnit.SECONDS).state() == State.CLOSED);
        } finally {
            pool.shutdownNow();
            if (!pool.awaitTermination(10, TimeUnit.SECONDS))
                throw new IllegalStateException("workers did not stop");
        }
        System.out.println("CloseableRing OK");
    }
}

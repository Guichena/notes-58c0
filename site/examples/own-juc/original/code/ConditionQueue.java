import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.locks.*;

/** Bounded MPMC ring; close rejects puts and drains already accepted values. */
public final class ConditionQueue<E> {
    private final Object[] items;
    private int head, tail, size;
    private boolean closed;
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition notEmpty = lock.newCondition(), notFull = lock.newCondition();
    public ConditionQueue(int capacity) {
        if (capacity <= 0) throw new IllegalArgumentException(); items = new Object[capacity];
    }
    public void put(E value) throws InterruptedException {
        Objects.requireNonNull(value); lock.lockInterruptibly();
        try {
            while (!closed && size == items.length) notFull.await();
            if (closed) throw new IllegalStateException("closed");
            items[tail] = value; tail = (tail + 1) % items.length; size++; notEmpty.signal();
        } finally { lock.unlock(); }
    }
    public E take() throws InterruptedException {
        lock.lockInterruptibly();
        try {
            while (!closed && size == 0) notEmpty.await();
            if (size == 0) return null;
            @SuppressWarnings("unchecked") E value = (E) items[head];
            items[head] = null; head = (head + 1) % items.length; size--; notFull.signal(); return value;
        } finally { lock.unlock(); }
    }
    public void close() {
        lock.lock();
        try { closed = true; notEmpty.signalAll(); notFull.signalAll(); }
        finally { lock.unlock(); }
    }
    public static void main(String[] args) throws Exception {
        ConditionQueue<Integer> queue = new ConditionQueue<>(1); ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            queue.put(0); CountDownLatch started = new CountDownLatch(1);
            Future<?> full = pool.submit(() -> {
                started.countDown();
                try { queue.put(1); throw new AssertionError("closed put succeeded"); }
                catch (IllegalStateException expected) { }
                return null;
            });
            Checks.await(started); queue.close(); Checks.get(full);
            Checks.that(queue.take() == 0 && queue.take() == null, "drain closed ring");
            ConditionQueue<Integer> interruptedQueue = new ConditionQueue<>(1);
            CountDownLatch entered = new CountDownLatch(1), done = new CountDownLatch(1);
            Future<?> wait = pool.submit(() -> {
                entered.countDown();
                try { interruptedQueue.take(); throw new AssertionError("expected interrupt"); }
                catch (InterruptedException expected) { }
                finally { done.countDown(); }
            });
            Checks.await(entered); wait.cancel(true); Checks.await(done);
            ConditionQueue<Integer> wake = new ConditionQueue<>(1);
            Future<Integer> waiting = pool.submit(wake::take); wake.close();
            Checks.that(Checks.get(waiting) == null, "close wakes empty side");
        } finally { queue.close(); Checks.stop(pool); }
        System.out.println("ConditionQueue OK");
    }
}

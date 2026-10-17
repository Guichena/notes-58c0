import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import java.util.concurrent.locks.*;

/** Fixed storage, O(1) queue mutation. Null is invalid; zero/false are ordinary values. */
public final class CloseableRing<E> {
    public enum Status { ITEM, TIMEOUT, CLOSED }
    public record Pop<E>(Status status, E value) {}
    public record Stats(int size, long successfulPushes, long failedPushes, boolean closed) {}
    private final Object[] data;
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition notEmpty = lock.newCondition();
    private int head, tail, count;
    private long successes, failures;
    private boolean closed;
    public CloseableRing(int capacity) {
        if (capacity <= 0) throw new IllegalArgumentException("capacity > 0");
        data = new Object[capacity];
    }
    /** Nonblocking with respect to capacity. Acquiring the short mutex can still wait. */
    public boolean push(E value) {
        Objects.requireNonNull(value);
        lock.lock();
        try {
            if (closed || count == data.length) { failures = Math.incrementExact(failures); return false; }
            long next = Math.incrementExact(successes); // Validate before changing the queue.
            data[tail] = value; tail = (tail + 1) % data.length; count++; successes = next;
            notEmpty.signal(); return true;
        } finally { lock.unlock(); }
    }
    /** Timeout covers lock acquisition plus condition waiting, measured with nanoTime. */
    public Pop<E> pop(long timeout, TimeUnit unit) throws InterruptedException {
        if (timeout < 0) throw new IllegalArgumentException("timeout >= 0");
        long budget = unit.toNanos(timeout), start = System.nanoTime();
        if (!lock.tryLock(budget, TimeUnit.NANOSECONDS)) return new Pop<>(Status.TIMEOUT, null);
        try {
            long remaining = budget - (System.nanoTime() - start);
            while (count == 0 && !closed) {
                if (remaining <= 0) return new Pop<>(Status.TIMEOUT, null);
                notEmpty.awaitNanos(remaining);
                remaining = budget - (System.nanoTime() - start);
            }
            if (count == 0) return new Pop<>(Status.CLOSED, null);
            @SuppressWarnings("unchecked") E value = (E) data[head];
            data[head] = null; head = (head + 1) % data.length; count--;
            return new Pop<>(Status.ITEM, value);
        } finally { lock.unlock(); }
    }
    /** Reject future pushes, wake consumers, and allow already accepted items to drain. */
    public void close() {
        lock.lock();
        try { closed = true; notEmpty.signalAll(); }
        finally { lock.unlock(); }
    }
    public Stats stats() {
        lock.lock();
        try { return new Stats(count, successes, failures, closed); }
        finally { lock.unlock(); }
    }
    public static void main(String[] args) throws Exception {
        CloseableRing<Integer> small = new CloseableRing<>(1);
        Checks.that(small.push(0) && !small.push(1), "zero accepted, full rejected");
        small.close(); small.close();
        Checks.that(!small.push(2), "closed rejects push");
        Checks.that(small.pop(0, TimeUnit.NANOSECONDS).value() == 0, "drain after close");
        Checks.that(small.pop(0, TimeUnit.NANOSECONDS).status() == Status.CLOSED, "closed distinct from value");
        Checks.that(small.stats().successfulPushes() == 1 && small.stats().failedPushes() == 2, "atomic counters");
        try { small.push(null); throw new AssertionError("null accepted"); } catch (NullPointerException expected) { }
        CloseableRing<Integer> queue = new CloseableRing<>(8);
        Set<Integer> seen = ConcurrentHashMap.newKeySet(); ExecutorService pool = Executors.newFixedThreadPool(8);
        try {
            List<Future<?>> consumers = new ArrayList<>(), producers = new ArrayList<>();
            for (int i = 0; i < 4; i++) consumers.add(pool.submit(() -> {
                try {
                    for (;;) {
                        Pop<Integer> item = queue.pop(5, TimeUnit.SECONDS);
                        if (item.status() == Status.CLOSED) return;
                        Checks.that(item.status() == Status.ITEM && seen.add(item.value()), "no loss/duplicate");
                    }
                } catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new AssertionError(e); }
            }));
            for (int i = 0; i < 4; i++) {
                int base = i * 1000;
                producers.add(pool.submit(() -> {
                    long start = System.nanoTime();
                    for (int n = base; n < base + 1000; n++) while (!queue.push(n)) {
                        if (Thread.currentThread().isInterrupted() || System.nanoTime() - start > TimeUnit.SECONDS.toNanos(5))
                            throw new AssertionError("producer deadline");
                        Thread.yield(); // Only this finite test retries push; production should choose backpressure.
                    }
                }));
            }
            for (Future<?> producer : producers) Checks.get(producer);
            queue.close(); for (Future<?> consumer : consumers) Checks.get(consumer);
            Checks.that(seen.size() == 4000 && queue.stats().successfulPushes() == 4000 && queue.stats().size() == 0, "MPMC drain");
            CloseableRing<Integer> empty = new CloseableRing<>(1);
            Checks.that(empty.pop(0, TimeUnit.NANOSECONDS).status() == Status.TIMEOUT, "zero-time poll");
            CountDownLatch entered = new CountDownLatch(1), stopped = new CountDownLatch(1);
            Future<?> waiting = pool.submit(() -> {
                entered.countDown();
                try { empty.pop(1, TimeUnit.DAYS); throw new AssertionError("expected interrupt"); }
                catch (InterruptedException expected) { }
                finally { stopped.countDown(); }
            });
            Checks.await(entered); waiting.cancel(true); Checks.await(stopped);
            Future<Pop<Integer>> closing = pool.submit(() -> empty.pop(1, TimeUnit.DAYS));
            empty.close(); Checks.that(Checks.get(closing).status() == Status.CLOSED, "close wakes waiting consumers");
        } finally { queue.close(); Checks.stop(pool); }
        System.out.println("CloseableRing OK");
    }
}

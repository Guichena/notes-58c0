import java.util.Objects;
import java.util.concurrent.Semaphore;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.IntConsumer;
import java.util.function.IntUnaryOperator;

/** One producer, one consumer, one slot. Callbacks must finish or cooperate. */
public final class SemaphoreHandoff {
    private SemaphoreHandoff() {}
    public static void transfer(int count, IntUnaryOperator source, IntConsumer sink)
            throws InterruptedException {
        if (count < 0 || count > 100_000) throw new IllegalArgumentException("count 0..100000");
        Objects.requireNonNull(source);
        Objects.requireNonNull(sink);
        Semaphore empty = new Semaphore(1), full = new Semaphore(0);
        CountDownLatch started = new CountDownLatch(1);
        int[] slot = new int[1]; // Publication is via semaphores, not volatile.
        AtomicReference<Throwable> failure = new AtomicReference<>();
        Thread[] workers = new Thread[2];
        Runnable produce = () -> {
            try {
                started.await();
                for (int i = 0; i < count; i++) {
                    empty.acquire();
                    slot[0] = source.applyAsInt(i);
                    full.release();
                }
            } catch (Throwable e) {
                failure.compareAndSet(null, e);
                workers[1].interrupt();
            }
        };
        Runnable consume = () -> {
            try {
                started.await();
                for (int i = 0; i < count; i++) {
                    full.acquire();
                    sink.accept(slot[0]);
                    empty.release();
                }
            } catch (Throwable e) {
                failure.compareAndSet(null, e);
                workers[0].interrupt();
            }
        };
        workers[0] = new Thread(produce, "handoff-producer");
        workers[1] = new Thread(consume, "handoff-consumer");
        // Thread creation/start failure is outside this small teaching protocol.
        workers[0].start();
        workers[1].start();
        // Both peers are alive before a callback can fail and interrupt its peer.
        started.countDown();
        try {
            workers[0].join();
            workers[1].join();
        } catch (InterruptedException interrupted) {
            for (Thread t : workers) t.interrupt();
            // Reap owned workers before propagating caller cancellation.
            boolean again = false;
            for (Thread t : workers) {
                while (t.isAlive()) {
                    try { t.join(); }
                    catch (InterruptedException ignored) { again = true; }
                }
            }
            if (again) Thread.currentThread().interrupt();
            throw interrupted;
        }
        Throwable e = failure.get();
        if (e != null) throw new IllegalStateException("handoff failed", e);
    }
}


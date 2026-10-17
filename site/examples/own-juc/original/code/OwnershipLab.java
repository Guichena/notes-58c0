import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import java.util.concurrent.locks.*;

public final class OwnershipLab {
    static final class Budget {
        private final long capacity;
        private long available;
        private final ReentrantLock lock = new ReentrantLock();
        private final Condition changed = lock.newCondition();
        Budget(long capacity) { if (capacity <= 0) throw new IllegalArgumentException(); this.capacity = available = capacity; }
        Lease acquire(long weight, Duration timeout) throws InterruptedException, TimeoutException {
            if (weight <= 0 || weight > capacity || timeout.isNegative()) throw new IllegalArgumentException();
            long nanos = timeout.toNanos(), start = System.nanoTime();
            if (!lock.tryLock(nanos, TimeUnit.NANOSECONDS)) throw new TimeoutException("budget lock");
            try {
                while (available < weight) {
                    long remaining = nanos - (System.nanoTime() - start);
                    if (remaining <= 0) throw new TimeoutException("budget exhausted");
                    changed.awaitNanos(remaining);
                }
                available -= weight; return new Lease(this, weight);
            } finally { lock.unlock(); }
        }
        void release(long weight) {
            lock.lock();
            try {
                if (weight > capacity - available) throw new IllegalStateException("budget over-release");
                available += weight; changed.signalAll();
            } finally { lock.unlock(); }
        }
        long available() { lock.lock(); try { return available; } finally { lock.unlock(); } }
    }
    static final class Lease implements AutoCloseable {
        private final Budget budget; private final long weight; private final AtomicBoolean returned = new AtomicBoolean();
        Lease(Budget budget, long weight) { this.budget = budget; this.weight = weight; }
        public void close() { if (returned.compareAndSet(false, true)) budget.release(weight); }
    }
    /** Ownership transfer has a separate state from the externally visible Future terminal state. */
    static final class OwnedJob<T> implements RunnableFuture<T> {
        private static final int PENDING = 0, RUNNING = 1, RELEASED = 2;
        private final AtomicInteger ownership = new AtomicInteger(PENDING);
        private final CountDownLatch actualDone = new CountDownLatch(1);
        private final Lease lease;
        private final FutureTask<T> delegate;
        OwnedJob(Lease lease, Callable<T> action) {
            this.lease = Objects.requireNonNull(lease); Objects.requireNonNull(action);
            delegate = new FutureTask<>(() -> {
                if (!ownership.compareAndSet(PENDING, RUNNING)) throw new CancellationException();
                try { return action.call(); }
                finally { release(RUNNING); }
            });
        }
        private void release(int expected) {
            if (ownership.compareAndSet(expected, RELEASED)) {
                try { lease.close(); } finally { actualDone.countDown(); }
            }
        }
        public void run() { delegate.run(); }
        public boolean cancel(boolean interrupt) {
            boolean won = delegate.cancel(interrupt);
            if (won) release(PENDING); // Running work retains its lease until its finally really executes.
            return won;
        }
        public boolean isCancelled() { return delegate.isCancelled(); }
        public boolean isDone() { return delegate.isDone(); }
        public T get() throws InterruptedException, ExecutionException { return delegate.get(); }
        public T get(long timeout, TimeUnit unit) throws InterruptedException, ExecutionException, TimeoutException {
            return delegate.get(timeout, unit);
        }
        boolean awaitActualDone(long time, TimeUnit unit) throws InterruptedException { return actualDone.await(time, unit); }
        static <T> OwnedJob<T> submit(Executor executor, Lease lease, Callable<T> action) {
            OwnedJob<T> job;
            try { job = new OwnedJob<>(lease, action); }
            catch (RuntimeException | Error failure) { lease.close(); throw failure; }
            try { executor.execute(job); return job; }
            catch (RuntimeException | Error failure) { job.cancel(false); throw failure; }
        }
    }
    public static void main(String[] args) throws Exception {
        Budget budget = new Budget(10); ExecutorService executor = Executors.newSingleThreadExecutor();
        CountDownLatch entered = new CountDownLatch(1), release = new CountDownLatch(1);
        try {
            OwnedJob<Integer> active = OwnedJob.submit(executor, budget.acquire(7, Duration.ZERO), () -> {
                entered.countDown();
                for (;;) {
                    try { Checks.await(release); return 7; }
                    catch (InterruptedException ignored) { /* deliberate bounded cancellation counterexample */ }
                }
            });
            Checks.await(entered);
            OwnedJob<Integer> queued = OwnedJob.submit(executor, budget.acquire(3, Duration.ZERO), () -> 3);
            Checks.that(budget.available() == 0, "both pending and running payloads budgeted");
            queued.cancel(true);
            Checks.that(queued.awaitActualDone(5, TimeUnit.SECONDS) && budget.available() == 3, "pre-start cancel returns lease");
            active.cancel(true);
            Checks.that(active.isDone() && budget.available() == 3, "running cancellation does not prematurely release");
            release.countDown();
            Checks.that(active.awaitActualDone(5, TimeUnit.SECONDS) && budget.available() == 10, "actual completion releases");
            Lease lease = budget.acquire(10, Duration.ZERO);
            try {
                try { budget.acquire(1, Duration.ZERO); throw new AssertionError("over budget"); }
                catch (TimeoutException expected) { }
            } finally { lease.close(); lease.close(); }
            Checks.that(budget.available() == 10, "idempotent lease");
            Executor rejected = task -> { throw new RejectedExecutionException("closed"); };
            try { OwnedJob.submit(rejected, budget.acquire(4, Duration.ZERO), () -> 4); throw new AssertionError("rejection hidden"); }
            catch (RejectedExecutionException expected) { }
            Checks.that(budget.available() == 10, "rejected submission releases reservation");
            executor.shutdown();
        } finally { release.countDown(); Checks.stop(executor); }
        System.out.println("OwnershipLab OK");
    }
}

import java.io.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import java.util.concurrent.locks.*;

public final class LockLab {
    /** Deliberately non-reentrant teaching mutex, not a general ReentrantLock replacement. */
    static final class Mutex implements Lock, Serializable {
        private static final class Sync extends AbstractQueuedSynchronizer {
            protected boolean tryAcquire(int ignored) {
                if (compareAndSetState(0, 1)) {
                    setExclusiveOwnerThread(Thread.currentThread()); return true;
                }
                return false;
            }
            protected boolean tryRelease(int ignored) {
                if (!isHeldExclusively()) throw new IllegalMonitorStateException();
                setExclusiveOwnerThread(null); setState(0); return true;
            }
            protected boolean isHeldExclusively() {
                return getState() == 1 && getExclusiveOwnerThread() == Thread.currentThread();
            }
            Condition condition() { return new ConditionObject(); }
            private void readObject(ObjectInputStream in) throws IOException, ClassNotFoundException {
                in.defaultReadObject(); setState(0); // A deserialized mutex is unlocked.
            }
        }
        private final Sync sync = new Sync();
        public void lock() { sync.acquire(1); }
        public void lockInterruptibly() throws InterruptedException { sync.acquireInterruptibly(1); }
        public boolean tryLock() { return sync.tryAcquire(1); }
        public boolean tryLock(long time, TimeUnit unit) throws InterruptedException {
            return sync.tryAcquireNanos(1, unit.toNanos(time));
        }
        public void unlock() { sync.release(1); }
        public Condition newCondition() { return sync.condition(); }
    }
    static final class Point {
        private final StampedLock lock = new StampedLock();
        private double x, y;
        void move(double dx, double dy) {
            long stamp = lock.writeLock();
            try { x += dx; y += dy; }
            finally { lock.unlockWrite(stamp); }
        }
        double distance() {
            long stamp = lock.tryOptimisticRead();
            double a = x, b = y;
            if (!lock.validate(stamp)) {
                stamp = lock.readLock();
                try { a = x; b = y; }
                finally { lock.unlockRead(stamp); }
            }
            return Math.hypot(a, b); // Only use the validated local snapshot.
        }
    }
    public static void main(String[] args) throws Exception {
        Mutex mutex = new Mutex(); Condition ready = mutex.newCondition();
        boolean[] available = {false};
        CountDownLatch waiting = new CountDownLatch(1);
        AtomicReference<Throwable> failure = new AtomicReference<>();
        Thread consumer = Checks.thread("condition-consumer", failure, () -> {
            try {
                mutex.lockInterruptibly();
                try {
                    waiting.countDown();
                    while (!available[0]) ready.await();
                } finally { mutex.unlock(); }
            } catch (InterruptedException e) { throw new AssertionError(e); }
        });
        consumer.start(); Checks.await(waiting);
        mutex.lock();
        try { available[0] = true; ready.signal(); }
        finally { mutex.unlock(); }
        Checks.join(consumer); Checks.rethrow(failure);
        try { mutex.unlock(); throw new AssertionError("non-owner unlock accepted"); }
        catch (IllegalMonitorStateException expected) { }
        mutex.lock();
        CountDownLatch entered = new CountDownLatch(1);
        AtomicBoolean interrupted = new AtomicBoolean();
        Thread blocked = Checks.thread("interruptible-lock", failure, () -> {
            entered.countDown();
            try { mutex.lockInterruptibly(); try { throw new AssertionError("acquired"); }
                finally { mutex.unlock(); } }
            catch (InterruptedException expected) { interrupted.set(true); }
        });
        try { blocked.start(); Checks.await(entered); blocked.interrupt(); Checks.join(blocked); }
        finally { mutex.unlock(); }
        Checks.that(interrupted.get(), "interruptible acquisition"); Checks.rethrow(failure);
        Point point = new Point(); point.move(3, 4);
        Checks.that(point.distance() == 5, "validated snapshot");
        AtomicBoolean parkFlag = new AtomicBoolean();
        Thread parked = Checks.thread("park-interrupt", failure, () -> {
            Thread.currentThread().interrupt();
            LockSupport.park();
            parkFlag.set(Thread.currentThread().isInterrupted());
            Thread.interrupted();
        });
        parked.start(); Checks.join(parked); Checks.rethrow(failure);
        Checks.that(parkFlag.get(), "park returns without clearing interruption");
        System.out.println("LockLab OK");
    }
}

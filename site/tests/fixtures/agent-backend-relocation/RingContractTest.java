import java.lang.reflect.Field;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.locks.*;

/** Tests actual CloseableRing, not a substitute model. No external services. */
public final class RingContractTest {
    static int checks;
    static void check(boolean ok, String why) { checks++; Checks.that(ok, why); }
    static Object field(Object target, String name) throws Exception {
        Field f = target.getClass().getDeclaredField(name); f.setAccessible(true); return f.get(target);
    }
    static void set(Object target, String name, Object value) throws Exception {
        Field f = target.getClass().getDeclaredField(name); f.setAccessible(true); f.set(target, value);
    }
    static <T> CloseableRing.Pop<T> poll(CloseableRing<T> q) throws Exception {
        return q.pop(0, TimeUnit.NANOSECONDS);
    }
    static void expect(Class<? extends Throwable> kind, Throwing work) throws Exception {
        try { work.run(); throw new AssertionError("expected " + kind.getSimpleName()); }
        catch (Throwable t) { if (!kind.isInstance(t)) throw new AssertionError("unexpected failure", t); checks++; }
    }
    interface Throwing { void run() throws Exception; }
    // Observe the actual Condition wait set under its owning lock; no sleep guesses.
    static void awaitConsumerWait(CloseableRing<?> q) throws Exception {
        ReentrantLock lock = (ReentrantLock) field(q, "lock");
        Condition notEmpty = (Condition) field(q, "notEmpty");
        long start = System.nanoTime();
        for (;;) {
            lock.lock();
            try { if (lock.hasWaiters(notEmpty)) return; }
            finally { lock.unlock(); }
            if (System.nanoTime() - start > TimeUnit.SECONDS.toNanos(5)) throw new AssertionError("consumer never awaited");
            Thread.yield();
        }
    }
    public static void main(String[] args) throws Exception {
        expect(IllegalArgumentException.class, () -> new CloseableRing<>(0));
        expect(IllegalArgumentException.class, () -> new CloseableRing<>(-1));
        CloseableRing<Integer> q = new CloseableRing<>(3);
        check(poll(q).status() == CloseableRing.Status.TIMEOUT, "empty is TIMEOUT");
        check(q.push(0) && q.push(1) && q.push(2), "fill");
        check((int) field(q, "head") == 0 && (int) field(q, "tail") == 0 && q.stats().size() == 3, "full head==tail distinguished by count");
        check(!q.push(3), "full reject");
        check(poll(q).value() == 0 && (int) field(q, "head") == 1, "pop advances head");
        check(q.push(3) && (int) field(q, "head") == 1, "push does not move head");
        for (int n = 1; n <= 3; n++) check(poll(q).value() == n, "wrap FIFO");
        check(q.stats().size() == 0 && (int) field(q, "head") == (int) field(q, "tail"), "empty head==tail with count zero");
        for (int n = 0; n < 100; n++) { check(q.push(n), "repeat wrap push"); check(poll(q).value() == n, "repeat wrap FIFO"); }
        expect(NullPointerException.class, () -> q.push(null));
        check(q.stats().successfulPushes() == 104 && q.stats().failedPushes() == 1, "null does not alter counters");
        expect(IllegalArgumentException.class, () -> q.pop(-1, TimeUnit.SECONDS));
        CloseableRing<Boolean> bools = new CloseableRing<>(1);
        check(bools.push(false), "false accepted");
        CloseableRing.Pop<Boolean> f = poll(bools);
        check(f.status() == CloseableRing.Status.ITEM && Boolean.FALSE.equals(f.value()), "status separates false from failure");
        check(poll(bools).status() == CloseableRing.Status.TIMEOUT, "false not confused with empty");
        bools.push(false); bools.close(); bools.close();
        check(!bools.push(true), "closed push rejects");
        check(poll(bools).status() == CloseableRing.Status.ITEM && poll(bools).status() == CloseableRing.Status.CLOSED, "closed drains then CLOSED");
        check(bools.stats().successfulPushes() == 2 && bools.stats().failedPushes() == 1, "close stats");
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            CloseableRing<Integer> waking = new CloseableRing<>(1);
            Future<CloseableRing.Pop<Integer>> waiting = pool.submit(() -> waking.pop(1, TimeUnit.DAYS));
            awaitConsumerWait(waking); waking.close();
            check(Checks.get(waiting).status() == CloseableRing.Status.CLOSED, "close wakes actual waiter");
            CloseableRing<Integer> interrupted = new CloseableRing<>(1);
            java.util.concurrent.atomic.AtomicBoolean caught = new java.util.concurrent.atomic.AtomicBoolean();
            java.util.concurrent.atomic.AtomicReference<Throwable> failure = new java.util.concurrent.atomic.AtomicReference<>();
            Thread iw = Checks.thread("ring-interrupt", failure, () -> {
                try { interrupted.pop(1, TimeUnit.DAYS); throw new AssertionError("interrupted pop returned"); }
                catch (InterruptedException expected) { caught.set(true); }
            });
            iw.start();
            try { awaitConsumerWait(interrupted); iw.interrupt(); Checks.join(iw); Checks.rethrow(failure); check(caught.get(), "interrupt propagated from actual wait"); }
            finally { iw.interrupt(); interrupted.close(); Checks.join(iw); }
            CloseableRing<Integer> lockBusy = new CloseableRing<>(1);
            ReentrantLock gate = (ReentrantLock) field(lockBusy, "lock");
            gate.lock();
            try { Future<CloseableRing.Pop<Integer>> timed = pool.submit(() -> lockBusy.pop(0, TimeUnit.NANOSECONDS));
                  check(Checks.get(timed).status() == CloseableRing.Status.TIMEOUT, "timeout includes lock acquisition"); }
            finally { gate.unlock(); }
            for (int n = 0; n < 100; n++) {
                CloseableRing<Integer> race = new CloseableRing<>(1);
                CyclicBarrier start = new CyclicBarrier(2);
                Future<Boolean> push = pool.submit(() -> { start.await(5, TimeUnit.SECONDS); return race.push(0); });
                Future<?> close = pool.submit(() -> { start.await(5, TimeUnit.SECONDS); race.close(); return null; });
                boolean accepted = Checks.get(push); Checks.get(close);
                CloseableRing.Pop<Integer> item = poll(race);
                check(accepted ? item.status() == CloseableRing.Status.ITEM && item.value() == 0 : item.status() == CloseableRing.Status.CLOSED, "close/push linearization");
                check(poll(race).status() == CloseableRing.Status.CLOSED, "race drained");
                check(race.stats().successfulPushes() == (accepted ? 1 : 0) && race.stats().failedPushes() == (accepted ? 0 : 1), "race exact counters");
            }
        } finally { Checks.stop(pool); }
        CloseableRing<Integer> overflow = new CloseableRing<>(1);
        set(overflow, "successes", Long.MAX_VALUE);
        expect(ArithmeticException.class, () -> overflow.push(7));
        check(overflow.stats().size() == 0 && overflow.stats().successfulPushes() == Long.MAX_VALUE, "successful counter overflow before mutation");
        set(overflow, "successes", 0L); overflow.push(7); set(overflow, "failures", Long.MAX_VALUE);
        expect(ArithmeticException.class, () -> overflow.push(8));
        check(overflow.stats().size() == 1 && poll(overflow).value() == 7, "failure counter overflow preserves data");
        CloseableRing.main(new String[0]); // Actual implementation's 4x4 MPMC, interrupt, close, and stats tests.
        System.out.println("RingContractTest PASS " + checks + " focused assertions; implementation MPMC 4000 items");
    }
}

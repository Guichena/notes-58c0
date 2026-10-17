import java.lang.invoke.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

public final class AtomicsLab {
    static final class Inventory {
        private final AtomicInteger stock;
        Inventory(int initial) { if (initial < 0) throw new IllegalArgumentException(); stock = new AtomicInteger(initial); }
        boolean reserve(int amount) {
            if (amount <= 0) throw new IllegalArgumentException();
            for (;;) {
                int old = stock.get();
                if (old < amount) return false;
                if (stock.compareAndSet(old, old - amount)) return true;
            }
        }
    }
    /** Exactly one producer and one consumer; no null values, no MPMC promise. */
    static final class SpscSlot<E> {
        private Object value;
        private volatile boolean full;
        private static final VarHandle FULL;
        static {
            try { FULL = MethodHandles.lookup().findVarHandle(SpscSlot.class, "full", boolean.class); }
            catch (ReflectiveOperationException e) { throw new ExceptionInInitializerError(e); }
        }
        boolean offer(E item) {
            Objects.requireNonNull(item);
            if ((boolean) FULL.getAcquire(this)) return false;
            value = item;
            FULL.setRelease(this, true);
            return true;
        }
        @SuppressWarnings("unchecked") E poll() {
            if (!(boolean) FULL.getAcquire(this)) return null;
            E result = (E) value;
            value = null;
            FULL.setRelease(this, false);
            return result;
        }
    }
    public static void main(String[] args) throws Exception {
        Object a = new Object(), b = new Object();
        AtomicReference<Object> ordinary = new AtomicReference<>(a);
        Object observed = ordinary.get(); ordinary.set(b); ordinary.set(a);
        Checks.that(ordinary.compareAndSet(observed, b), "identity-only CAS misses ABA");
        AtomicStampedReference<Object> stamped = new AtomicStampedReference<>(a, 0);
        int[] stamp = new int[1]; Object old = stamped.get(stamp);
        Checks.that(stamped.compareAndSet(a, b, 0, 1), "A to B");
        Checks.that(stamped.compareAndSet(b, a, 1, 2), "B to A");
        Checks.that(!stamped.compareAndSet(old, b, stamp[0], 3), "stale version rejected");
        Inventory inventory = new Inventory(1000); LongAdder admitted = new LongAdder();
        ExecutorService pool = Executors.newFixedThreadPool(4);
        try {
            List<Future<?>> jobs = new ArrayList<>();
            for (int i = 0; i < 4; i++) jobs.add(pool.submit(() -> {
                for (int n = 0; n < 1000; n++) if (inventory.reserve(1)) admitted.increment();
            }));
            for (Future<?> f : jobs) Checks.get(f);
            Checks.that(admitted.sum() == 1000 && inventory.stock.get() == 0, "no oversell at quiescence");
            SpscSlot<Integer> slot = new SpscSlot<>();
            Future<?> producer = pool.submit(() -> {
                for (int n = 1; n <= 10000; n++) {
                    while (!slot.offer(n)) {
                        if (Thread.currentThread().isInterrupted()) return;
                        Thread.onSpinWait();
                    }
                }
            });
            Future<?> consumer = pool.submit(() -> {
                for (int n = 1; n <= 10000; n++) {
                    Integer value;
                    while ((value = slot.poll()) == null) {
                        if (Thread.currentThread().isInterrupted()) return;
                        Thread.onSpinWait();
                    }
                    Checks.that(value == n, "SPSC publication order");
                }
            });
            Checks.get(producer); Checks.get(consumer);
            System.out.println("AtomicsLab OK");
        } finally { Checks.stop(pool); }
    }
}

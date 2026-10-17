import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

public final class PublicationLab {
    static final class Dcl {
        private static volatile Dcl instance;
        final int answer;
        private Dcl() { answer = 42; }
        static Dcl get() {
            Dcl local = instance;
            if (local == null) {
                synchronized (Dcl.class) {
                    local = instance;
                    if (local == null) instance = local = new Dcl();
                }
            }
            return local;
        }
    }
    static final class HolderSingleton {
        private HolderSingleton() {}
        private static final class Holder {
            static final HolderSingleton INSTANCE = new HolderSingleton();
        }
        static HolderSingleton get() { return Holder.INSTANCE; }
    }
    static final class LockedCounter {
        private int value;
        synchronized void increment() { value++; }
        synchronized int value() { return value; }
    }
    public static void main(String[] args) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            AtomicInteger broken = new AtomicInteger();
            CountDownLatch bothRead = new CountDownLatch(2), release = new CountDownLatch(1);
            Callable<Void> splitIncrement = () -> {
                int old = broken.get();
                bothRead.countDown();
                Checks.await(release);
                broken.set(old + 1); // Atomic get/set do not make their composition atomic.
                return null;
            };
            Future<Void> a = pool.submit(splitIncrement), b = pool.submit(splitIncrement);
            Checks.await(bothRead); release.countDown();
            Checks.get(a); Checks.get(b);
            Checks.that(broken.get() == 1, "two read-modify-write operations lost one update");
            AtomicInteger atomic = new AtomicInteger();
            LockedCounter locked = new LockedCounter();
            Set<Dcl> identities = ConcurrentHashMap.newKeySet();
            List<Future<?>> work = new ArrayList<>();
            for (int t = 0; t < 2; t++) work.add(pool.submit(() -> {
                for (int i = 0; i < 500; i++) {
                    atomic.incrementAndGet(); locked.increment();
                    Dcl value = Dcl.get();
                    Checks.that(value.answer == 42, "initialized value");
                    identities.add(value);
                    Checks.that(HolderSingleton.get() == HolderSingleton.get(), "holder identity");
                }
            }));
            for (Future<?> f : work) Checks.get(f);
            Checks.that(atomic.get() == 1000 && locked.value() == 1000, "both fixes");
            Checks.that(identities.size() == 1, "one DCL instance");
            System.out.println("PublicationLab OK");
        } finally { Checks.stop(pool); }
    }
}

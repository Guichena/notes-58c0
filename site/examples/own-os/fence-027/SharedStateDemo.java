import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.locks.ReentrantLock;

/** Force one lost update, then protect a compound operation and transfer ownership via a queue. */
public final class SharedStateDemo {
    private static int assertions;
    private static void check(String name, boolean ok) {
        if (!ok) throw new AssertionError(name);
        assertions++;
        System.out.println("PASS " + name);
    }
    private static final class Ledger {
        final ReentrantLock lock = new ReentrantLock();
        int value;
        boolean nestedObserved;
        void increment() {
            lock.lock();
            try { value++; audit(); } finally { lock.unlock(); }
        }
        void audit() { // The same thread may acquire a ReentrantLock again.
            lock.lock();
            try { nestedObserved |= lock.getHoldCount() == 2; }
            finally { lock.unlock(); }
        }
    }
    public static void main(String[] args) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            final int[] broken = {0};
            CyclicBarrier bothRead = new CyclicBarrier(2);
            Callable<Void> loseUpdate = () -> {
                int snapshot = broken[0];
                bothRead.await(3, TimeUnit.SECONDS); // Both read 0 before either writes.
                broken[0] = snapshot + 1;
                return null;
            };
            Future<Void> a = pool.submit(loseUpdate), b = pool.submit(loseUpdate);
            a.get(3, TimeUnit.SECONDS); b.get(3, TimeUnit.SECONDS);
            check("barrier forces a lost update", broken[0] == 1);
            // volatile alone would not make a read-modify-write operation atomic.
            Ledger ledger = new Ledger();
            Runnable add = () -> { for (int i = 0; i < 1000; i++) ledger.increment(); };
            Future<?> c = pool.submit(add), d = pool.submit(add);
            c.get(3, TimeUnit.SECONDS); d.get(3, TimeUnit.SECONDS);
            check("lock protects compound updates", ledger.value == 2000);
            check("lock is reentrant", ledger.nestedObserved);
            check("all lock acquisitions released", !ledger.lock.isLocked());

            final int poison = Integer.MIN_VALUE; // Reserve a value outside the input domain.
            BlockingQueue<Integer> queue = new ArrayBlockingQueue<>(2);
            List<Integer> consumed = Collections.synchronizedList(new ArrayList<Integer>());
            Callable<Void> consumer = () -> {
                while (true) {
                    Integer item = queue.poll(3, TimeUnit.SECONDS);
                    if (item == null) throw new TimeoutException("missing item or poison");
                    if (item == poison) return null;
                    consumed.add(item * item);
                }
            };
            Future<Void> e = pool.submit(consumer), f = pool.submit(consumer);
            for (int input : new int[]{1, 2, 3, 4, poison, poison})
                if (!queue.offer(input, 3, TimeUnit.SECONDS)) throw new TimeoutException("queue full");
            e.get(3, TimeUnit.SECONDS); f.get(3, TimeUnit.SECONDS);
            Collections.sort(consumed); // Consumers finish out of order, so compare as a multiset.
            check("queue delivers every work item once", consumed.equals(Arrays.asList(1, 4, 9, 16)));
            check("one poison pill stops each consumer", e.isDone() && f.isDone() && queue.isEmpty());
            Future<Void> g = pool.submit(consumer), h = pool.submit(consumer);
            for (int i = 0; i < 2; i++)
                if (!queue.offer(poison, 3, TimeUnit.SECONDS)) throw new TimeoutException("queue full");
            g.get(3, TimeUnit.SECONDS); h.get(3, TimeUnit.SECONDS);
            check("empty input still stops every consumer", consumed.size() == 4 && queue.isEmpty());
        } finally {
            pool.shutdownNow();
            if (!pool.awaitTermination(3, TimeUnit.SECONDS)) throw new AssertionError("pool stuck");
        }
        System.out.println("ASSERTIONS " + assertions);
    }
}

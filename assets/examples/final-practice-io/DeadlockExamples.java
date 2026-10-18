import java.lang.management.ManagementFactory;
import java.lang.management.ThreadMXBean;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;

public final class DeadlockExamples {
    public static final class Account {
        private final long id;             // IDs must be globally unique among accounts.
        private final ReentrantLock lock = new ReentrantLock();
        private long balance;
        public Account(long id, long balance) {
            if (balance < 0) throw new IllegalArgumentException("negative balance");
            this.id = id; this.balance = balance;
        }
        public long balance() {
            lock.lock();
            try { return balance; } finally { lock.unlock(); }
        }
    }
    public static boolean transfer(Account from, Account to, long amount)
            throws InterruptedException {
        if (amount < 0) throw new IllegalArgumentException("negative amount");
        if (from == to) return true;
        if (from.id == to.id) throw new IllegalArgumentException("duplicate account ID");
        Account first = from.id < to.id ? from : to;
        Account second = from.id < to.id ? to : from;
        first.lock.lockInterruptibly();
        try {
            second.lock.lockInterruptibly();
            try {
                if (from.balance < amount) return false;
                long nextBalance = Math.addExact(to.balance, amount);
                from.balance -= amount; to.balance = nextBalance;
                return true;
            } finally { second.lock.unlock(); }
        } finally { first.lock.unlock(); }
    }
    public static boolean withBoth(ReentrantLock a, ReentrantLock b,
                                   long timeout, TimeUnit unit, Runnable action)
            throws InterruptedException {
        if (timeout < 0) throw new IllegalArgumentException("negative timeout");
        long budget = unit.toNanos(timeout), start = System.nanoTime();
        if (!a.tryLock(budget, TimeUnit.NANOSECONDS)) return false;
        try {
            long left = budget - (System.nanoTime() - start);
            if (left < 0) left = 0;
            if (!b.tryLock(left, TimeUnit.NANOSECONDS)) return false;
            try { action.run(); return true; }
            finally { b.unlock(); }
        } finally { a.unlock(); }
    }
    /** Deliberately forms a cycle, detects it, then interrupts both participants. */
    public static boolean demonstrateAndRecover() throws InterruptedException {
        ReentrantLock a = new ReentrantLock(), b = new ReentrantLock();
        CountDownLatch bothOwnOne = new CountDownLatch(2);
        Thread t1 = new Thread(() -> cycle(a, b, bothOwnOne), "deadlock-demo-A");
        Thread t2 = new Thread(() -> cycle(b, a, bothOwnOne), "deadlock-demo-B");
        t1.setDaemon(true); t2.setDaemon(true); // A broken demo must not trap the JVM.
        t1.start(); t2.start();
        boolean found = false;
        try {
            ThreadMXBean bean = ManagementFactory.getThreadMXBean();
            long start = System.nanoTime();
            while (System.nanoTime() - start < TimeUnit.SECONDS.toNanos(2)) {
                long[] ids = bean.findDeadlockedThreads();
                boolean one = false, two = false;
                if (ids != null) for (long id : ids) {
                    one |= id == t1.getId(); two |= id == t2.getId();
                }
                if (one && two) { found = true; break; }
                Thread.sleep(5);
            }
        } finally {
            t1.interrupt(); t2.interrupt();
            t1.join(1000); t2.join(1000);
        }
        return found && !t1.isAlive() && !t2.isAlive();
    }
    private static void cycle(ReentrantLock first, ReentrantLock second,
                              CountDownLatch ready) {
        try {
            first.lockInterruptibly();
            try {
                ready.countDown(); ready.await();
                second.lockInterruptibly();
                try { /* The interrupt-based cleanup may eventually allow this path. */ }
                finally { second.unlock(); }
            } finally { first.unlock(); }
        } catch (InterruptedException ex) { Thread.currentThread().interrupt(); }
    }
}

import java.lang.reflect.Field;
import java.util.ArrayDeque;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/** Bounded deterministic checks. Reflection only exposes the dequeue/run test boundary. */
public final class BoundedPoolContractTest {
    private static void check(boolean ok, String message) {
        if (!ok) throw new AssertionError(message);
    }
    private static void await(CountDownLatch latch) throws InterruptedException {
        check(latch.await(5, TimeUnit.SECONDS), "test coordination timeout");
    }
    private static void stopped(BoundedPoolTeaching pool) throws InterruptedException {
        pool.shutdownNow();
        check(pool.awaitTermination(5, TimeUnit.SECONDS), "pool did not terminate");
        for (Thread thread : pool.workersForTest()) {
            thread.join(5000);
            check(!thread.isAlive(), "worker still alive");
        }
        check(pool.aliveForTest() == 0, "alive must reach zero exactly");
    }
    private static void ignoringInterruptDelaysTermination() throws Exception {
        BoundedPoolTeaching pool = new BoundedPoolTeaching(1, 1);
        CountDownLatch entered = new CountDownLatch(1);
        CountDownLatch interrupted = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        try {
            Future<Integer> running = pool.submit(() -> {
                entered.countDown();
                while (release.getCount() != 0) {
                    try { release.await(); }
                    catch (InterruptedException expected) { interrupted.countDown(); }
                }
                return 7;
            });
            await(entered);
            Future<Integer> queued = pool.submit(() -> 8);
            List<Future<?>> abandoned = pool.shutdownNow();
            check(abandoned.size() == 1 && abandoned.get(0) == queued,
                    "only queue-owned future returned");
            check(queued.isCancelled(), "teaching pool cancels queue-owned future");
            await(interrupted);
            check(!pool.awaitTermination(20, TimeUnit.MILLISECONDS),
                    "ignoring interrupt must keep termination false");
            check(!running.isDone(), "stop request is not completion");
            release.countDown();
            check(running.get(5, TimeUnit.SECONDS) == 7, "cooperative test release");
        } finally { release.countDown(); stopped(pool); }
    }
    @SuppressWarnings("unchecked")
    private static void dequeuedBeforeCallableBegins() throws Exception {
        BoundedPoolTeaching pool = new BoundedPoolTeaching(1, 1);
        CountDownLatch dequeued = new CountDownLatch(1);
        CountDownLatch interrupted = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        AtomicBoolean began = new AtomicBoolean();
        AtomicBoolean callableSawInterrupt = new AtomicBoolean();
        FutureTask<Integer> boundary = new FutureTask<>(() -> {
            began.set(true);
            callableSawInterrupt.set(Thread.currentThread().isInterrupted());
            return 9;
        }) {
            @Override public void run() {
                // Called only after the real worker removed this task and released gate.
                dequeued.countDown();
                boolean restore = false;
                try {
                    while (release.getCount() != 0) {
                        try { release.await(); }
                        catch (InterruptedException expected) {
                            restore = true;
                            interrupted.countDown();
                        }
                    }
                    if (restore) Thread.currentThread().interrupt();
                    super.run();
                } catch (Throwable failure) { setException(failure); }
            }
        };
        try {
            Field gateField = BoundedPoolTeaching.class.getDeclaredField("gate");
            Field queueField = BoundedPoolTeaching.class.getDeclaredField("queue");
            gateField.setAccessible(true);
            queueField.setAccessible(true);
            Object gate = gateField.get(pool);
            synchronized (gate) {
                ArrayDeque<FutureTask<?>> queue =
                        (ArrayDeque<FutureTask<?>>) queueField.get(pool);
                check(queue.isEmpty(), "fresh queue");
                queue.addLast(boundary); // Test-only wrapper, inserted under the real gate.
                gate.notifyAll();
            }
            await(dequeued);
            check(!began.get(), "Callable has not begun");
            check(pool.shutdownNow().isEmpty(), "dequeued task cannot be drained again");
            await(interrupted);
            check(!began.get() && !boundary.isDone(), "ownership is not user-code start");
            check(!pool.awaitTermination(20, TimeUnit.MILLISECONDS), "worker remains owned");
            release.countDown();
            check(boundary.get(5, TimeUnit.SECONDS) == 9, "owned task may begin after STOP");
            check(callableSawInterrupt.get(), "STOP interrupt was not silently erased");
        } finally { release.countDown(); stopped(pool); }
    }
    private static void standardExecutorContracts() throws Exception {
        CountDownLatch hold = new CountDownLatch(1);
        CountDownLatch fourStarted = new CountDownLatch(4);
        ThreadPoolExecutor pool = new ThreadPoolExecutor(2, 4, 10, TimeUnit.SECONDS,
                new ArrayBlockingQueue<>(2), new ThreadPoolExecutor.AbortPolicy());
        try {
            check(pool.getPoolSize() == 0, "core workers are lazy by default");
            Runnable blocked = () -> {
                fourStarted.countDown();
                try { hold.await(); }
                catch (InterruptedException expected) { Thread.currentThread().interrupt(); }
            };
            for (int i = 0; i < 6; i++) pool.submit(blocked);
            await(fourStarted);
            check(pool.getPoolSize() == 4 && pool.getQueue().size() == 2,
                    "core -> queue -> max with blocked tasks");
            try { pool.submit(() -> 7); throw new AssertionError("must reject task seven"); }
            catch (RejectedExecutionException expected) { }
            pool.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
            Thread caller = Thread.currentThread();
            AtomicReference<Thread> actual = new AtomicReference<>();
            pool.execute(() -> actual.set(Thread.currentThread()));
            check(actual.get() == caller, "CallerRuns adds a submitting-thread executor");
            List<Runnable> drained = pool.shutdownNow();
            check(drained.size() == 2, "standard pool drains queue");
            for (Runnable task : drained) {
                Future<?> future = (Future<?>) task;
                check(!future.isCancelled(), "standard shutdownNow does not auto-cancel drained futures");
                future.cancel(false);
            }
            Future<Integer> silentlyDiscarded = pool.submit(() -> 8);
            check(!silentlyDiscarded.isDone(), "CallerRuns discards after shutdown");
            silentlyDiscarded.cancel(false); // No waiting on an orphaned future.
        } finally {
            hold.countDown();
            for (Runnable task : pool.shutdownNow())
                if (task instanceof Future<?> future) future.cancel(false);
            check(pool.awaitTermination(5, TimeUnit.SECONDS), "standard pool terminated");
        }
    }
    public static void main(String[] args) throws Exception {
        ignoringInterruptDelaysTermination();
        dequeuedBeforeCallableBegins();
        standardExecutorContracts();
        System.out.println("BoundedPoolContractTest OK: interrupt/await/dequeue/TPE/CallerRuns");
    }
}

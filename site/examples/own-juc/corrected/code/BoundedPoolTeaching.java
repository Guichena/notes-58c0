import java.util.*;
import java.util.concurrent.*;

/** Corrected R2 teaching version; immutable original remains in source/code.
 * Registration finishes before any start. Only failed start rolls back its reservation.
 * shutdownNow is cooperative: tasks ignoring interruption may keep workers alive.
 * This is a teaching pool, not a replacement for ThreadPoolExecutor.
 */
public final class BoundedPoolTeaching {
    private enum State { RUNNING, SHUTDOWN, STOP }
    private final Object gate = new Object();
    private final ArrayDeque<FutureTask<?>> queue = new ArrayDeque<>();
    private final Thread[] workers;
    private final int capacity;
    private State state = State.RUNNING;
    private int alive;
    // Package-private deterministic failure seam, not a public extension API.
    // start must either start normally or throw BEFORE starting the thread.
    interface Startup {
        default void beforeRegister(BoundedPoolTeaching pool, int index) { }
        default void start(Thread thread, int index) { thread.start(); }
        default void afterStart(BoundedPoolTeaching pool, int index) { }
    }
    public BoundedPoolTeaching(int workerCount, int queueCapacity) {
        this(workerCount, queueCapacity, new Startup() { });
    }
    BoundedPoolTeaching(int workerCount, int queueCapacity, Startup startup) {
        if (workerCount <= 0 || queueCapacity <= 0) throw new IllegalArgumentException();
        Objects.requireNonNull(startup);
        capacity = queueCapacity;
        workers = new Thread[workerCount];
        try {
            // Allocation/registration failure cannot strand a started, untracked worker.
            for (int i = 0; i < workerCount; i++) {
                startup.beforeRegister(this, i);
                workers[i] = Thread.ofPlatform().name("bounded-r2-" + i).unstarted(this::work);
            }
            for (int i = 0; i < workerCount; i++) {
                synchronized (gate) { alive++; }
                try { startup.start(workers[i], i); }
                catch (RuntimeException | Error failure) {
                    // No worker owns this reservation if start failed before starting.
                    synchronized (gate) { alive--; gate.notifyAll(); }
                    throw failure;
                }
                // Failure AFTER successful start must not decrement: work.finally owns it.
                startup.afterStart(this, i);
            }
        } catch (RuntimeException | Error failure) { shutdownNow(); throw failure; }
    }
    Thread[] workersForTest() { return workers.clone(); }
    int aliveForTest() { synchronized (gate) { return alive; } }
    public <T> Future<T> submit(Callable<T> job) {
        FutureTask<T> future = new FutureTask<>(Objects.requireNonNull(job));
        synchronized (gate) {
            if (state != State.RUNNING || queue.size() == capacity)
                throw new RejectedExecutionException("closed or saturated");
            queue.addLast(future); gate.notifyAll();
        }
        return future;
    }
    private void work() {
        try {
            for (;;) {
                FutureTask<?> task;
                synchronized (gate) {
                    while (queue.isEmpty() && state == State.RUNNING) {
                        try { gate.wait(); }
                        catch (InterruptedException ignored) { /* Recheck pool state under gate. */ }
                    }
                    if (state == State.STOP || (state == State.SHUTDOWN && queue.isEmpty())) return;
                    // A previous task can leave its worker interrupted. Do not leak that status to the next task.
                    Thread.interrupted();
                    task = queue.removeFirst();
                }
                task.run(); // FutureTask captures ordinary task exceptions; no queue lock around user code.
            }
        } finally { synchronized (gate) { alive--; gate.notifyAll(); } }
    }
    public void shutdown() {
        synchronized (gate) { if (state == State.RUNNING) state = State.SHUTDOWN; gate.notifyAll(); }
    }
    public List<Future<?>> shutdownNow() {
        List<Future<?>> abandoned = new ArrayList<>();
        synchronized (gate) {
            state = State.STOP;
            while (!queue.isEmpty()) abandoned.add(queue.removeFirst());
            gate.notifyAll();
        }
        for (Future<?> future : abandoned) future.cancel(false);
        for (Thread worker : workers) if (worker != null) worker.interrupt();
        return List.copyOf(abandoned);
    }
    public boolean awaitTermination(long timeout, TimeUnit unit) throws InterruptedException {
        if (timeout < 0) throw new IllegalArgumentException();
        long budget = unit.toNanos(timeout), start = System.nanoTime();
        synchronized (gate) {
            while (alive != 0) {
                long remaining = budget - (System.nanoTime() - start);
                if (remaining <= 0) return false;
                TimeUnit.NANOSECONDS.timedWait(gate, remaining);
            }
            return true;
        }
    }
    public static void main(String[] args) throws Exception {
        BoundedPoolTeaching pool = new BoundedPoolTeaching(1, 1);
        CountDownLatch running = new CountDownLatch(1), release = new CountDownLatch(1);
        try {
            Future<Integer> first = pool.submit(() -> { running.countDown(); Checks.await(release); return 1; });
            Checks.await(running); Future<Integer> next = pool.submit(() -> 2);
            try { pool.submit(() -> 3); throw new AssertionError("overflow accepted"); }
            catch (RejectedExecutionException expected) { }
            pool.shutdown(); release.countDown();
            Checks.that(Checks.get(first) == 1 && Checks.get(next) == 2, "graceful drain");
            Checks.that(pool.awaitTermination(5, TimeUnit.SECONDS), "graceful termination");
            try { pool.submit(() -> 4); throw new AssertionError("closed accepted"); }
            catch (RejectedExecutionException expected) { }
        } finally { release.countDown(); pool.shutdownNow(); Checks.that(pool.awaitTermination(5, TimeUnit.SECONDS), "pool stopped"); }
        BoundedPoolTeaching stopped = new BoundedPoolTeaching(1, 1);
        CountDownLatch entered = new CountDownLatch(1), cleaned = new CountDownLatch(1);
        try {
            Future<?> active = stopped.submit(() -> {
                entered.countDown(); try { new CountDownLatch(1).await(); }
                finally { cleaned.countDown(); }
                return null;
            });
            Checks.await(entered); Future<?> waiting = stopped.submit(() -> 9);
            Checks.that(stopped.shutdownNow().size() == 1 && waiting.isCancelled(), "queued future cancelled");
            Checks.await(cleaned); Checks.that(stopped.awaitTermination(5, TimeUnit.SECONDS), "active task stopped");
            try { Checks.get(active); throw new AssertionError("expected interrupted task"); }
            catch (ExecutionException e) { Checks.that(e.getCause() instanceof InterruptedException, "active interrupt"); }
        } finally { stopped.shutdownNow(); Checks.that(stopped.awaitTermination(5, TimeUnit.SECONDS), "stop joined"); }
        BoundedPoolTeaching isolated = new BoundedPoolTeaching(1, 2);
        try {
            Checks.get(isolated.submit(() -> { Thread.currentThread().interrupt(); return 1; }));
            Checks.that(!Checks.get(isolated.submit(() -> Thread.currentThread().isInterrupted())), "worker interrupt state reset");
            Future<?> failed = isolated.submit(() -> { throw new IllegalArgumentException("task"); });
            try { Checks.get(failed); throw new AssertionError("lost failure"); } catch (ExecutionException expected) { }
            Checks.that(Checks.get(isolated.submit(() -> 7)) == 7, "failure isolated");
        } finally { isolated.shutdownNow(); Checks.that(isolated.awaitTermination(5, TimeUnit.SECONDS), "isolated pool stopped"); }
        System.out.println("BoundedPoolTeaching OK");
    }
}

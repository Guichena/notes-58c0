package handbook;

import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Objects;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.LongSupplier;

public class LeakyBucketLab {
    // A bounded, FIFO, paced dispatcher. It spaces handoff attempts, not completion times.
    static final class PacedQueue implements AutoCloseable {
        private final ArrayDeque<Job<?>> pending = new ArrayDeque<>();
        private final int capacity;
        private final long interval;
        private final LongSupplier clock;
        private final ThreadPoolExecutor workers;
        private final ScheduledThreadPoolExecutor timer;
        private long lastHandoff;
        private boolean handedOff;
        private boolean closed;

        PacedQueue(int capacity, int parallelism, Duration spacing) {
            this(capacity, parallelism, spacing, System::nanoTime, true);
        }

        // Manual ticks and a fake monotonic clock make boundary tests deterministic.
        PacedQueue(int capacity, int parallelism, Duration spacing,
                   LongSupplier clock, boolean automatic) {
            if (capacity <= 0 || parallelism <= 0) throw new IllegalArgumentException();
            this.capacity = capacity;
            this.interval = boundedNanos(spacing);
            this.clock = Objects.requireNonNull(clock);
            workers = new ThreadPoolExecutor(parallelism, parallelism, 0,
                    TimeUnit.NANOSECONDS, new SynchronousQueue<>(),
                    runnable -> new Thread(runnable, "leaky-worker"),
                    new ThreadPoolExecutor.AbortPolicy());
            timer = new ScheduledThreadPoolExecutor(1,
                    runnable -> new Thread(runnable, "leaky-timer"));
            timer.setRemoveOnCancelPolicy(true);
            if (automatic) timer.scheduleWithFixedDelay(this::tick,
                    interval, interval, TimeUnit.NANOSECONDS);
        }

        synchronized <T> Future<T> submit(Callable<T> action, Duration ttl) {
            Objects.requireNonNull(action);
            long lifetime = boundedNanos(ttl);
            if (closed) throw new RejectedExecutionException("closed");
            if (pending.size() == capacity) throw new RejectedExecutionException("queue full");
            Job<T> job = new Job<>(action, clock.getAsLong(), lifetime);
            pending.addLast(job);
            return job;
        }

        private final class Job<T> extends FutureTask<T> {
            private final long submitted;
            private final long lifetime;

            Job(Callable<T> action, long submitted, long lifetime) {
                super(() -> {
                    // Check again on the worker: handoff does not imply immediate execution.
                    if (clock.getAsLong() - submitted >= lifetime)
                        throw new TimeoutException("expired before execution");
                    return action.call();
                });
                this.submitted = submitted;
                this.lifetime = lifetime;
            }

            boolean expired(long now) { return now - submitted >= lifetime; }
            void fail(Throwable failure) { setException(failure); }
            @Override protected void done() {
                synchronized (PacedQueue.this) { pending.remove(this); }
            }
        }

        synchronized void tick() {
            if (closed) return;
            long now = clock.getAsLong();
            // Remove expired entries even when a handoff is not yet allowed.
            while (!pending.isEmpty() && pending.peekFirst().expired(now))
                pending.removeFirst().fail(new TimeoutException("expired in queue"));
            if (pending.isEmpty()) return;
            if (handedOff && now - lastHandoff < interval) return;
            Job<?> job = pending.removeFirst();
            lastHandoff = now;
            handedOff = true;
            // One attempt per interval; a slow tick never creates a catch-up burst.
            try { workers.execute(job); }
            catch (RejectedExecutionException failure) { job.fail(failure); }
        }

        synchronized int queued() { return pending.size(); }

        @Override public void close() throws InterruptedException {
            synchronized (this) {
                closed = true;
                while (!pending.isEmpty()) pending.removeFirst().cancel(false);
                timer.shutdownNow();
                // Running jobs are interrupted cooperatively. No queued worker tasks exist.
                workers.shutdownNow();
            }
            boolean timerStopped = timer.awaitTermination(2, TimeUnit.SECONDS);
            boolean workersStopped = workers.awaitTermination(2, TimeUnit.SECONDS);
            if (!timerStopped || !workersStopped)
                throw new IllegalStateException("task ignored interruption; executor still alive");
        }

        private static long boundedNanos(Duration duration) {
            Objects.requireNonNull(duration);
            // Keep elapsed-time subtraction unambiguous; reject overflow/very long waits.
            if (duration.isZero() || duration.isNegative() || duration.compareTo(Duration.ofDays(1)) > 0)
                throw new IllegalArgumentException("duration must be in (0, one day]");
            return duration.toNanos();
        }
    }

    static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    static void failure(Future<?> future, Class<? extends Throwable> type) throws Exception {
        try { future.get(2, TimeUnit.SECONDS); throw new AssertionError("expected " + type); }
        catch (ExecutionException error) { check(type.isInstance(error.getCause()), "wrong cause"); }
    }

    static void rejected(Runnable action) {
        try { action.run(); throw new AssertionError("expected rejection"); }
        catch (RejectedExecutionException expected) { }
    }

    public static void main(String[] args) throws Exception {
        Duration interval = Duration.ofNanos(10);
        Duration ttl = Duration.ofNanos(1_000);
        AtomicLong clock = new AtomicLong();
        try (PacedQueue queue = new PacedQueue(2, 3, interval, clock::get, false)) {
            Future<Integer> first = queue.submit(() -> 1, ttl);
            Future<Integer> second = queue.submit(() -> 2, ttl);
            rejected(() -> queue.submit(() -> 3, ttl));
            queue.tick();
            check(first.get(2, TimeUnit.SECONDS) == 1, "first result");
            clock.set(9); queue.tick();
            check(queue.queued() == 1 && !second.isDone(), "early handoff");
            clock.set(10); queue.tick();
            check(second.get(2, TimeUnit.SECONDS) == 2, "exact boundary");
            Future<Integer> late = queue.submit(() -> 3, ttl);
            Future<Integer> later = queue.submit(() -> 4, ttl);
            clock.set(500); queue.tick();
            check(late.get(2, TimeUnit.SECONDS) == 3, "late tick");
            queue.tick();
            check(queue.queued() == 1 && !later.isDone(), "catch-up burst");
            check(later.cancel(false) && queue.queued() == 0, "cancel removes pending");
            Future<Integer> expired = queue.submit(() -> 5, Duration.ofNanos(2));
            clock.set(502); queue.tick();
            failure(expired, TimeoutException.class);
            check(queue.queued() == 0, "expired entry leaked");
        }

        clock.set(0);
        CountDownLatch started = new CountDownLatch(1);
        CountDownLatch interrupted = new CountDownLatch(1);
        try (PacedQueue queue = new PacedQueue(2, 1, interval, clock::get, false)) {
            Future<Integer> blocked = queue.submit(() -> {
                started.countDown();
                try { new CountDownLatch(1).await(); return 0; }
                catch (InterruptedException ex) { interrupted.countDown(); throw ex; }
            }, ttl);
            queue.tick();
            check(started.await(2, TimeUnit.SECONDS), "worker not started");
            Future<Integer> overloaded = queue.submit(() -> 1, ttl);
            clock.set(10); queue.tick();
            failure(overloaded, RejectedExecutionException.class);
            check(blocked.cancel(true), "running cancel");
            check(interrupted.await(2, TimeUnit.SECONDS), "interrupt not observed");
        }

        try (PacedQueue queue = new PacedQueue(2, 1, Duration.ofMillis(10))) {
            Future<Integer> failed = queue.submit(() -> { throw new IllegalStateException("business"); }, Duration.ofSeconds(2));
            failure(failed, IllegalStateException.class);
        }
        PacedQueue stopped = new PacedQueue(1, 1, interval, clock::get, false);
        Future<Integer> abandoned = stopped.submit(() -> 1, ttl);
        stopped.close();
        check(abandoned.isCancelled(), "pending shutdown outcome");
        rejected(() -> stopped.submit(() -> 1, ttl));
        check(stopped.workers.isTerminated() && stopped.timer.isTerminated(), "thread leak");
        System.out.println("PASS pacing, exact boundary, no catch-up burst, bounded admission, expiry, cancellation, worker rejection, business failure, shutdown");
    }

}

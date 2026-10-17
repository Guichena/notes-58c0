import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import java.util.function.Function;

/** Five parallel inputs followed by one dependent computation. Executors belong to the caller. */
public final class AsyncWorkflowLab {
    public static final class Batch<R> {
        private final Object gate = new Object();
        private final List<FutureTask<?>> tasks = new ArrayList<>();
        private final CompletableFuture<R> result = new CompletableFuture<>();
        private final AtomicReference<ScheduledFuture<?>> alarm = new AtomicReference<>();
        public CompletionStage<R> stage() { return result.minimalCompletionStage(); }
        public boolean cancel() { return fail(new CancellationException("batch cancelled")); }
        private boolean fail(Throwable error) {
            boolean won = result.completeExceptionally(error);
            if (won) {
                List<FutureTask<?>> copy;
                synchronized (gate) { copy = List.copyOf(tasks); }
                for (FutureTask<?> task : copy) task.cancel(true);
            }
            return won;
        }
        private void enqueue(FutureTask<?> task, Executor executor) {
            synchronized (gate) {
                if (result.isDone()) { task.cancel(false); return; }
                tasks.add(task);
            }
            // Cancellation can race this call. A cancelled FutureTask.run does no user work.
            try { executor.execute(task); }
            catch (RuntimeException e) { fail(e); task.cancel(false); }
        }
        private void setAlarm(ScheduledFuture<?> scheduled) {
            alarm.set(scheduled);
            if (result.isDone()) scheduled.cancel(false);
        }
        private Batch() {
            result.whenComplete((v, e) -> {
                ScheduledFuture<?> scheduled = alarm.get();
                if (scheduled != null) scheduled.cancel(false);
            });
        }
    }
    private static <T> FutureTask<T> bridge(Callable<T> work, CompletableFuture<T> stage) {
        return new FutureTask<>(work) {
            protected void done() {
                try { stage.complete(get()); } // done() runs only after this FutureTask is terminal.
                catch (CancellationException e) { stage.completeExceptionally(e); }
                catch (ExecutionException e) { stage.completeExceptionally(e.getCause()); }
                catch (InterruptedException e) {
                    Thread.currentThread().interrupt(); stage.completeExceptionally(e);
                }
            }
        };
    }
    public static <T, R> Batch<R> start(List<? extends Callable<T>> inputs,
            Function<List<T>, R> sixth, ThreadPoolExecutor executor, ScheduledExecutorService timer,
            Duration timeout) {
        Objects.requireNonNull(sixth); Objects.requireNonNull(executor); Objects.requireNonNull(timer);
        if (!(executor.getRejectedExecutionHandler() instanceof ThreadPoolExecutor.AbortPolicy))
            throw new IllegalArgumentException("non-inlining AbortPolicy executor required");
        List<? extends Callable<T>> work = List.copyOf(inputs);
        if (work.size() != 5 || timeout.isNegative() || timeout.isZero()) throw new IllegalArgumentException();
        long nanos = timeout.toNanos();
        Batch<R> batch = new Batch<>();
        List<CompletableFuture<T>> stages = new ArrayList<>();
        List<FutureTask<T>> tasks = new ArrayList<>();
        for (Callable<T> input : work) {
            CompletableFuture<T> stage = new CompletableFuture<>();
            stages.add(stage); tasks.add(bridge(input, stage));
            stage.whenComplete((v, e) -> { if (e != null) batch.fail(e); });
        }
        CompletableFuture.allOf(stages.toArray(CompletableFuture[]::new)).thenRun(() -> {
            List<T> values = stages.stream().map(CompletableFuture::join).toList();
            CompletableFuture<R> sixthStage = new CompletableFuture<>();
            sixthStage.whenComplete((v, e) -> {
                if (e == null) batch.result.complete(v); else batch.fail(e);
            });
            batch.enqueue(bridge(() -> sixth.apply(values), sixthStage), executor);
        });
        try {
            batch.setAlarm(timer.schedule(() -> batch.fail(new TimeoutException("batch deadline")),
                    nanos, TimeUnit.NANOSECONDS));
            for (FutureTask<T> task : tasks) batch.enqueue(task, executor);
        } catch (RuntimeException e) { batch.fail(e); }
        return batch; // No get/join on incomplete work on the caller's path.
    }
    private static Throwable failure(Batch<?> batch) throws Exception {
        try { batch.stage().toCompletableFuture().get(5, TimeUnit.SECONDS); throw new AssertionError("expected failure"); }
        catch (ExecutionException e) { return e.getCause(); }
    }
    public static void main(String[] args) throws Exception {
        ThreadPoolExecutor pool = new ThreadPoolExecutor(5, 5, 0, TimeUnit.SECONDS,
                new ArrayBlockingQueue<>(5), new ThreadPoolExecutor.AbortPolicy());
        ScheduledExecutorService timer = Executors.newSingleThreadScheduledExecutor();
        CountDownLatch release = new CountDownLatch(1);
        try {
            CountDownLatch started = new CountDownLatch(5);
            List<Callable<Integer>> jobs = new ArrayList<>();
            for (int n = 1; n <= 5; n++) {
                int value = n;
                jobs.add(() -> { started.countDown(); Checks.await(release); return value; });
            }
            AtomicInteger sixthCalls = new AtomicInteger();
            Batch<Integer> ok = start(jobs, values -> {
                sixthCalls.incrementAndGet(); return values.stream().mapToInt(Integer::intValue).sum();
            }, pool, timer, Duration.ofSeconds(4));
            Checks.await(started);
            Checks.that(!ok.stage().toCompletableFuture().isDone(), "start returned while tasks still blocked");
            release.countDown();
            Checks.that(Checks.get(ok.stage().toCompletableFuture()) == 15 && sixthCalls.get() == 1, "five then sixth once");
            List<Callable<Integer>> broken = List.of(() -> 1, () -> { throw new IllegalArgumentException("input"); }, () -> 3, () -> 4, () -> 5);
            Batch<Integer> bad = start(broken, v -> { throw new AssertionError("sixth must not run"); }, pool, timer, Duration.ofSeconds(4));
            Checks.that(failure(bad) instanceof IllegalArgumentException, "input failure");
            ThreadPoolExecutor rejecting = new ThreadPoolExecutor(1, 1, 0, TimeUnit.SECONDS,
                    new ArrayBlockingQueue<>(1), new ThreadPoolExecutor.AbortPolicy());
            rejecting.shutdown();
            Checks.that(failure(start(jobs, v -> 0, rejecting, timer, Duration.ofSeconds(4))) instanceof RejectedExecutionException,
                    "submission rejection is terminal");
            CountDownLatch blocking = new CountDownLatch(1), cleanup = new CountDownLatch(1);
            List<Callable<Integer>> slow = List.of(() -> {
                blocking.countDown(); try { new CountDownLatch(1).await(); return 1; }
                finally { cleanup.countDown(); }
            }, () -> 2, () -> 3, () -> 4, () -> 5);
            Batch<Integer> timed = start(slow, v -> 0, pool, timer, Duration.ofMillis(300));
            Checks.await(blocking);
            Checks.that(failure(timed) instanceof TimeoutException, "overall deadline");
            Checks.await(cleanup); // Separately observe the cooperative operation's cleanup.
            Batch<Integer> cancelled = start(slow, v -> 0, pool, timer, Duration.ofSeconds(4));
            cancelled.cancel();
            Checks.that(failure(cancelled) instanceof CancellationException, "explicit cancellation");
            System.out.println("AsyncWorkflowLab OK");
        } finally { release.countDown(); Checks.stop(pool); Checks.stop(timer); }
    }
}

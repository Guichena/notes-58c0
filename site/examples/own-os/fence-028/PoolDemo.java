import java.util.*;
import java.util.concurrent.*;
import java.util.function.IntBinaryOperator;

/** Bound the queue explicitly; result retrieval order is separate from execution order. */
public final class PoolDemo {
    private static int assertions;
    private static void check(String name, boolean ok) {
        if (!ok) throw new AssertionError(name);
        assertions++;
        System.out.println("PASS " + name);
    }
    private static void await(CountDownLatch gate) throws InterruptedException {
        if (!gate.await(3, TimeUnit.SECONDS)) throw new AssertionError("gate timeout");
    }
    private static void close(ExecutorService pool) throws InterruptedException {
        pool.shutdownNow();
        if (!pool.awaitTermination(3, TimeUnit.SECONDS)) throw new AssertionError("pool stuck");
    }
    public static void main(String[] args) throws Exception {
        CountDownLatch running = new CountDownLatch(1), release = new CountDownLatch(1);
        ThreadPoolExecutor bounded = new ThreadPoolExecutor(1, 1, 0, TimeUnit.MILLISECONDS,
                new ArrayBlockingQueue<Runnable>(1), new ThreadPoolExecutor.AbortPolicy());
        try {
            Future<Integer> first = bounded.submit(() -> { running.countDown(); await(release); return 1; });
            await(running);
            Future<Integer> second = bounded.submit(() -> 2); // The sole queue slot is occupied.
            boolean rejected = false;
            try { bounded.submit(() -> 3); } catch (RejectedExecutionException ex) { rejected = true; }
            check("full bounded pool rejects deterministically", rejected);
            check("pool has one queued task", bounded.getQueue().size() == 1);
            release.countDown();
            check("accepted tasks still finish", first.get(3, TimeUnit.SECONDS) + second.get(3, TimeUnit.SECONDS) == 3);
        } finally { release.countDown(); close(bounded); }

        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch slowRelease = new CountDownLatch(1), fastFinished = new CountDownLatch(1);
        try {
            CompletionService<String> completed = new ExecutorCompletionService<>(pool);
            Future<String> slow = completed.submit(() -> { await(slowRelease); return "slow"; });
            Future<String> fast = completed.submit(() -> { fastFinished.countDown(); return "fast"; });
            await(fastFinished);
            check("later submitted task can finish first", fast.get(3, TimeUnit.SECONDS).equals("fast") && !slow.isDone());
            Future<String> next = completed.poll(3, TimeUnit.SECONDS);
            check("completion service returns ready task", next == fast && next.get(3, TimeUnit.SECONDS).equals("fast"));
            // Iterating [slow, fast] and calling get() would wait for slow first.
            slowRelease.countDown();
            check("submission-order list retains input order", Arrays.asList(slow.get(3, TimeUnit.SECONDS), fast.get(3, TimeUnit.SECONDS))
                    .equals(Arrays.asList("slow", "fast")));
            Future<String> last = completed.poll(3, TimeUnit.SECONDS);
            check("remaining completion is slow task", last == slow);

            Future<Integer> failed = pool.submit(() -> { throw new IllegalStateException("boom"); });
            boolean propagated = false;
            try { failed.get(3, TimeUnit.SECONDS); }
            catch (ExecutionException ex) { propagated = ex.getCause() instanceof IllegalStateException; }
            check("Future get preserves task failure cause", propagated);

            IntBinaryOperator add = (x, y) -> x + y;
            final int x = 7, y = 8; // A Callable has no arguments; capture the inputs in a lambda.
            check("lambda captures multiple arguments", pool.submit(() -> add.applyAsInt(x, y)).get(3, TimeUnit.SECONDS) == 15);
            List<Future<Integer>> batches = new ArrayList<>();
            for (int start = 1; start <= 6; start += 2) {
                final int from = start;
                batches.add(pool.submit(() -> from + (from + 1)));
            }
            int sum = 0;
            for (Future<Integer> batch : batches) sum += batch.get(3, TimeUnit.SECONDS);
            check("batching preserves aggregate result", batches.size() == 3 && sum == 21);
        } finally { slowRelease.countDown(); close(pool); }
        System.out.println("ASSERTIONS " + assertions);
    }
}

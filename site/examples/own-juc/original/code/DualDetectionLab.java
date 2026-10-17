import java.time.Duration;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

public final class DualDetectionLab {
    enum Finding { CLEAR, VIOLATION, UNKNOWN }
    enum Action { PASS, BLOCK, REVIEW }
    record Document(String id, long version, String text) {}
    record Verdict(String id, long version, Finding rule, Finding model, Action action) {}
    @FunctionalInterface interface Detector { Finding inspect(Document snapshot) throws Exception; }
    static Action merge(Finding a, Finding b) {
        if (a == Finding.VIOLATION || b == Finding.VIOLATION) return Action.BLOCK;
        if (a == Finding.CLEAR && b == Finding.CLEAR) return Action.PASS;
        return Action.REVIEW;
    }
    static CompletableFuture<Finding> branch(Document input, Detector detector,
            ThreadPoolExecutor executor, long start, long budget) {
        CompletableFuture<Finding> future;
        try {
            future = CompletableFuture.supplyAsync(() -> {
                if (System.nanoTime() - start >= budget) return Finding.UNKNOWN;
                try {
                    Finding result = detector.inspect(input);
                    return result == null ? Finding.UNKNOWN : result;
                } catch (Exception failure) { return Finding.UNKNOWN; }
            }, executor);
        } catch (RejectedExecutionException rejected) {
            return CompletableFuture.completedFuture(Finding.UNKNOWN);
        }
        long remaining = Math.max(0, budget - (System.nanoTime() - start));
        return future.completeOnTimeout(Finding.UNKNOWN, remaining, TimeUnit.NANOSECONDS)
                .exceptionally(error -> Finding.UNKNOWN);
    }
    /** Requires ordinary non-inlining pools; completion deadline does not stop a detector already running. */
    static CompletionStage<Verdict> evaluate(Document snapshot, Detector rules, Detector model,
            ThreadPoolExecutor rulePool, ThreadPoolExecutor modelPool, Duration timeout) {
        if (timeout.isNegative() || timeout.isZero()) throw new IllegalArgumentException();
        if (!(rulePool.getRejectedExecutionHandler() instanceof ThreadPoolExecutor.AbortPolicy)
                || !(modelPool.getRejectedExecutionHandler() instanceof ThreadPoolExecutor.AbortPolicy))
            throw new IllegalArgumentException("non-inlining AbortPolicy pools required");
        long budget = timeout.toNanos(), start = System.nanoTime();
        return branch(snapshot, rules, rulePool, start, budget)
                .thenCombine(branch(snapshot, model, modelPool, start, budget),
                        (a, b) -> new Verdict(snapshot.id(), snapshot.version(), a, b, merge(a, b)))
                .minimalCompletionStage();
    }
    static ThreadPoolExecutor pool() {
        return new ThreadPoolExecutor(1, 1, 0, TimeUnit.SECONDS, new ArrayBlockingQueue<>(1),
                new ThreadPoolExecutor.AbortPolicy());
    }
    public static void main(String[] args) throws Exception {
        ThreadPoolExecutor rules = pool(), model = pool();
        CountDownLatch release = new CountDownLatch(1), entered = new CountDownLatch(1), ended = new CountDownLatch(1);
        try {
            Document input = new Document("doc", 7, "immutable content");
            for (Finding a : Finding.values()) for (Finding b : Finding.values()) {
                Verdict result = Checks.get(evaluate(input, d -> a, d -> b, rules, model, Duration.ofSeconds(2)).toCompletableFuture());
                Checks.that(result.version() == 7 && result.action() == merge(a, b), "nine policy combinations and version");
            }
            Verdict failed = Checks.get(evaluate(input, d -> Finding.CLEAR,
                    d -> { throw new IllegalArgumentException("invalid model payload"); }, rules, model,
                    Duration.ofSeconds(2)).toCompletableFuture());
            Checks.that(failed.action() == Action.REVIEW, "failure is unknown, not clear");
            CompletionStage<Verdict> timed = evaluate(input, d -> Finding.CLEAR, d -> {
                entered.countDown();
                try { Checks.await(release); return Finding.CLEAR; }
                finally { ended.countDown(); }
            }, rules, model, Duration.ofMillis(100));
            Checks.await(entered);
            Checks.that(Checks.get(timed.toCompletableFuture()).action() == Action.REVIEW, "deadline yields unknown");
            Checks.that(ended.getCount() == 1, "underlying detector still owns its resources");
            release.countDown(); Checks.await(ended);
            model.shutdown();
            Verdict rejected = Checks.get(evaluate(input, d -> Finding.CLEAR, d -> Finding.CLEAR,
                    rules, model, Duration.ofSeconds(2)).toCompletableFuture());
            Checks.that(rejected.action() == Action.REVIEW, "rejection also unknown");
            System.out.println("DualDetectionLab OK");
        } finally { release.countDown(); Checks.stop(rules); Checks.stop(model); }
    }
}

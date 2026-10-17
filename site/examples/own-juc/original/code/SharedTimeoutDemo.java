import java.util.concurrent.*;

/** Java 9+ API，使用 Java 21 实测：调用者的期限不能改写共享计算的结果。 */
public final class SharedTimeoutDemo {
    private static int assertions;
    private static void check(String name, boolean ok) {
        if (!ok) throw new AssertionError(name);
        assertions++;
        System.out.println("PASS " + name);
    }
    private static boolean timeoutResult(CompletableFuture<?> future) throws Exception {
        try { future.get(5, TimeUnit.SECONDS); return false; }
        catch (ExecutionException ex) {
            // copy 的异常可增加 CompletionException 包装，按因果链识别。
            Throwable cause = ex.getCause();
            while (cause instanceof CompletionException && cause.getCause() != null)
                cause = cause.getCause();
            return cause instanceof TimeoutException;
        }
        // get 本身的 TimeoutException 不捕获：它表示测试没完成，必须失败。
    }
    public static void main(String[] args) throws Exception {
        CompletableFuture<Integer> shared = new CompletableFuture<>();
        CompletableFuture<Integer> callerB = shared;
        CompletableFuture<Integer> callerA = shared.orTimeout(0, TimeUnit.NANOSECONDS);
        check("orTimeout 返回原对象", callerA == shared);
        // 根结果没有生产者，永远不会在定时器前完成；不依赖机器快慢。
        check("甲的期限使共享对象失败", timeoutResult(callerA));
        check("乙被同一个终态连带影响", timeoutResult(callerB));
        check("真实结果已无法覆盖超时终态", !shared.complete(42));

        CompletableFuture<Integer> source = new CompletableFuture<>();
        CompletableFuture<Integer> privateA = source.copy().orTimeout(0, TimeUnit.NANOSECONDS);
        CompletableFuture<Integer> privateB = source.copy();
        check("甲的私有视图按自己的期限失败", timeoutResult(privateA));
        check("甲超时不使源计算结束", !source.isDone());
        check("乙仍在等同一个源计算", !privateB.isDone());
        check("所有者仍能发布真实结果", source.complete(42));
        check("乙收到真实成功", privateB.get(5, TimeUnit.SECONDS) == 42);
        check("甲的终态保持超时", timeoutResult(privateA));

        CompletableFuture<Integer> nextSource = new CompletableFuture<>();
        CompletableFuture<Integer> cancelledView = nextSource.copy();
        check("只取消调用者自己的视图", cancelledView.cancel(true));
        check("视图取消不向源传播", !nextSource.isDone());
        nextSource.complete(7);
        check("源仍能成功而视图仍为取消", nextSource.join() == 7 && cancelledView.isCancelled());

        CompletionStage<Integer> readOnly = nextSource.minimalCompletionStage();
        CompletableFuture<Integer> clientCopy = readOnly.toCompletableFuture();
        // 客户端可改它拿到的副本，但不会拥有真实 source 的写权限。
        clientCopy.obtrudeValue(99);
        check("受限视图不会暴露源的完成权限", nextSource.join() == 7 && clientCopy.join() == 99);
        System.out.println("ASSERTIONS " + assertions);
    }
}

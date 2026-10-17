import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

/** Java 21：分别约束已提交未回收任务数和进入远端的任务数。 */
public final class VirtualBudgetDemo {
    private static int assertions;
    private static void check(String name, boolean ok) {
        if (!ok) throw new AssertionError(name);
        assertions++;
        System.out.println("PASS " + name);
    }
    private static void await(CountDownLatch latch) throws InterruptedException {
        // 只作失败保险；顺序由门闩决定，不靠线程睡眠猜测。
        if (!latch.await(5, TimeUnit.SECONDS)) throw new AssertionError("gate stuck");
    }
    private static final class Probe {
        final Semaphore remote = new Semaphore(2);
        final CountDownLatch admitted = new CountDownLatch(1);
        final CountDownLatch started = new CountDownLatch(4);
        final CountDownLatch firstRemote = new CountDownLatch(2);
        final CountDownLatch release = new CountDownLatch(1);
        final AtomicInteger submitted = new AtomicInteger();
        final AtomicInteger activeRemote = new AtomicInteger();
        final AtomicInteger peakRemote = new AtomicInteger();
        final AtomicInteger peakWindow = new AtomicInteger();
        final AtomicInteger virtualTasks = new AtomicInteger();
    }
    private static int runBatch(Probe p, int count, int window) throws Exception {
        ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
        CompletionService<Integer> completed = new ExecutorCompletionService<>(executor);
        // 集合只保存当前窗口，不把全部 Future 永久留在内存。
        Set<Future<Integer>> outstanding = new HashSet<>();
        int next = 0, received = 0, total = 0;
        try {
            while (received < count) {
                while (next < count && outstanding.size() < window) {
                    final int item = next++;
                    Future<Integer> f = completed.submit(() -> {
                        if (Thread.currentThread().isVirtual()) p.virtualTasks.incrementAndGet();
                        p.started.countDown();
                        p.remote.acquire(); // 获得许可之前，不算进入远端。
                        int active = p.activeRemote.incrementAndGet();
                        p.peakRemote.accumulateAndGet(active, Math::max);
                        try {
                            p.firstRemote.countDown();
                            await(p.release); // 使测试能稳定观察第一批的状态。
                            return item + 1;
                        } finally {
                            p.activeRemote.decrementAndGet();
                            p.remote.release(); // 仅在 acquire 成功后归还。
                        }
                    });
                    outstanding.add(f);
                    p.submitted.incrementAndGet();
                    p.peakWindow.accumulateAndGet(outstanding.size(), Math::max);
                }
                p.admitted.countDown();
                Future<Integer> done = completed.poll(5, TimeUnit.SECONDS);
                if (done == null) throw new AssertionError("missing completion");
                outstanding.remove(done);
                total += done.get(); // 已完成，仍需 get 才会观察任务异常。
                received++;
            }
            return total;
        } finally {
            for (Future<?> f : outstanding) f.cancel(true);
            executor.shutdownNow();
            if (!executor.awaitTermination(5, TimeUnit.SECONDS))
                throw new AssertionError("virtual tasks did not stop");
        }
    }
    public static void main(String[] args) throws Exception {
        Probe p = new Probe();
        CompletableFuture<Integer> result = new CompletableFuture<>();
        Thread coordinator = Thread.ofPlatform().name("collector").start(() -> {
            try { result.complete(runBatch(p, 32, 4)); }
            catch (Throwable failure) { result.completeExceptionally(failure); }
        });
        try {
            await(p.admitted); await(p.started); await(p.firstRemote);
            check("入口窗口只提交四项", p.submitted.get() == 4);
            check("远端同时只有两项", p.activeRemote.get() == 2);
            check("等待远端的任务仍计入窗口", p.peakWindow.get() == 4);
            p.release.countDown();
            check("全部结果回收", result.get(5, TimeUnit.SECONDS) == 528);
            check("所有业务任务使用虚拟线程", p.virtualTasks.get() == 32);
            check("远端并发上限未被突破", p.peakRemote.get() == 2);
            check("入口上限未被突破", p.peakWindow.get() == 4);
            check("许可与活动计数全部归还", p.remote.availablePermits() == 2
                    && p.activeRemote.get() == 0);
        } finally {
            p.release.countDown();
            coordinator.join(5000);
            if (coordinator.isAlive()) {
                coordinator.interrupt(); coordinator.join(5000);
            }
            if (coordinator.isAlive()) throw new AssertionError("collector still alive");
        }
        System.out.println("ASSERTIONS " + assertions);
    }
}

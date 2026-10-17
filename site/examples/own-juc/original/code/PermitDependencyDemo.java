import java.lang.management.ManagementFactory;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

/** 虚拟线程释放载体，并不会替任务释放它持有的业务许可。 */
public final class PermitDependencyDemo {
    private static int assertions;
    private static void check(String name, boolean ok) {
        if (!ok) throw new AssertionError(name);
        assertions++;
        System.out.println("PASS " + name);
    }
    private static void await(CountDownLatch gate) throws InterruptedException {
        if (!gate.await(5, TimeUnit.SECONDS)) throw new AssertionError("gate stuck");
    }
    private static void badDependency() throws Exception {
        Semaphore quota = new Semaphore(2);
        ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
        CountDownLatch parentsOwnBoth = new CountDownLatch(2);
        CountDownLatch parentsWaiting = new CountDownLatch(2);
        CountDownLatch childrenAttempt = new CountDownLatch(2);
        CountDownLatch parentsStopped = new CountDownLatch(2);
        CountDownLatch childrenStopped = new CountDownLatch(2);
        List<Future<Integer>> parents = new ArrayList<>();
        Queue<Future<Integer>> children = new ConcurrentLinkedQueue<>();
        Queue<Long> virtualIds = new ConcurrentLinkedQueue<>();
        try {
            for (int i = 0; i < 2; i++) {
                parents.add(executor.submit(() -> {
                    boolean acquired = false;
                    try {
                        quota.acquire(); acquired = true;
                        virtualIds.add(Thread.currentThread().threadId());
                        parentsOwnBoth.countDown(); await(parentsOwnBoth);
                        Future<Integer> child = executor.submit(() -> {
                            boolean childAcquired = false;
                            try {
                                childrenAttempt.countDown();
                                quota.acquire(); childAcquired = true;
                                return 7;
                            } finally {
                                if (childAcquired) quota.release();
                                childrenStopped.countDown();
                            }
                        });
                        children.add(child);
                        parentsWaiting.countDown();
                        return child.get(); // 父任务仍持许可，却等待也需要许可的子任务。
                    } finally {
                        if (acquired) quota.release();
                        parentsStopped.countDown();
                    }
                }));
            }
            await(parentsWaiting); await(childrenAttempt);
            check("所有业务许可都在父任务手里", quota.availablePermits() == 0);
            check("两个子任务都已开始但不能取得许可", children.size() == 2
                    && children.stream().noneMatch(Future::isDone));
            check("两个父任务的结果都依赖子任务", parents.stream().noneMatch(Future::isDone));
            // Java 21 ThreadMXBean 的管理对象是平台线程，不能据其空结果排除虚拟线程问题。
            boolean invisible = virtualIds.stream().allMatch(id ->
                    ManagementFactory.getThreadMXBean().getThreadInfo(id) == null);
            check("Java21 ThreadMXBean 不提供这些虚拟线程详情", invisible);
        } finally {
            // 已用门闩确认四个任务开始，所以 finally 门闩确实应当到达。
            for (Future<?> f : children) f.cancel(true);
            for (Future<?> f : parents) f.cancel(true);
            executor.shutdownNow();
            if (!executor.awaitTermination(5, TimeUnit.SECONDS)) throw new AssertionError("tasks alive");
            // Future 被取消与 finally 已执行是不同事实，显式观察业务清理。
            await(parentsStopped); await(childrenStopped);
        }
        check("父子任务均完成清理", parentsStopped.getCount() == 0 && childrenStopped.getCount() == 0);
        check("取消回收后无许可泄漏", quota.availablePermits() == 2);
    }
    private static void flattenedDependency() throws Exception {
        Semaphore quota = new Semaphore(2);
        AtomicInteger active = new AtomicInteger(), peak = new AtomicInteger(), steps = new AtomicInteger();
        List<Future<Integer>> jobs = new ArrayList<>();
        ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
        try {
            for (int i = 0; i < 20; i++) jobs.add(executor.submit(() -> {
                quota.acquire();
                int current = active.incrementAndGet();
                peak.accumulateAndGet(current, Math::max);
                try {
                    // 本例两步是顺序依赖；一个任务取得一次许可即可完成完整业务。
                    int first = 3; steps.incrementAndGet();
                    int second = first + 4; steps.incrementAndGet();
                    return second;
                } finally {
                    active.decrementAndGet(); quota.release();
                }
            }));
            int total = 0;
            for (Future<Integer> f : jobs) total += f.get(5, TimeUnit.SECONDS);
            check("展开依赖后全部业务成功", total == 140 && steps.get() == 40);
            check("修复未取消远端容量限制", peak.get() <= 2);
        } finally {
            for (Future<?> f : jobs) f.cancel(true);
            executor.shutdownNow();
            if (!executor.awaitTermination(5, TimeUnit.SECONDS)) throw new AssertionError("tasks alive");
        }
        check("修复方案也归还全部许可", quota.availablePermits() == 2 && active.get() == 0);
    }
    public static void main(String[] args) throws Exception {
        badDependency(); flattenedDependency();
        System.out.println("ASSERTIONS " + assertions);
    }
}

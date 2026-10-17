import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;

/** 可见的字段仍可组成错误版本；一次发布、一次取引用才能得到一致快照。 */
public final class SnapshotDemo {
    private static int assertions;
    private static void check(String name, boolean ok) {
        if (!ok) throw new AssertionError(name);
        assertions++;
        System.out.println("PASS " + name);
    }
    private static void await(CountDownLatch gate) throws InterruptedException {
        if (!gate.await(5, TimeUnit.SECONDS)) throw new AssertionError("gate stuck");
    }
    private static final class SplitConfig {
        volatile int revision = 1;
        volatile String route = "blue";
    }
    // 两个字段都是值；若换成 List/Map 等可变对象，还需要防御性复制。
    private record Config(int revision, String route) {
        Config {
            if (revision < 1 || route == null) throw new IllegalArgumentException();
        }
    }
    public static void main(String[] args) throws Exception {
        ExecutorService writer = Executors.newSingleThreadExecutor();
        CountDownLatch halfWritten = new CountDownLatch(1);
        CountDownLatch finishSplit = new CountDownLatch(1);
        CountDownLatch prepared = new CountDownLatch(1);
        CountDownLatch publish = new CountDownLatch(1);
        try {
            SplitConfig split = new SplitConfig();
            Future<?> broken = writer.submit(() -> {
                split.revision = 2;
                halfWritten.countDown();
                try { await(finishSplit); }
                catch (InterruptedException ex) { Thread.currentThread().interrupt(); return; }
                split.route = "green";
            });
            await(halfWritten);
            check("两个 volatile 字段仍可能组成混合版本",
                    split.revision == 2 && split.route.equals("blue"));
            finishSplit.countDown(); broken.get(5, TimeUnit.SECONDS);
            check("写完后才成为完整新版本",
                    split.revision == 2 && split.route.equals("green"));

            AtomicReference<Config> state = new AtomicReference<>(new Config(1, "blue"));
            Config captured = state.get(); // 每次业务读取只抓一个引用。
            int firstReadRevision = state.get().revision();
            Future<?> update = writer.submit(() -> {
                Config next = new Config(2, "green"); // 在发布前完成构造和校验。
                prepared.countDown();
                try { await(publish); }
                catch (InterruptedException ex) { Thread.currentThread().interrupt(); return; }
                state.set(next); // 整个配置版本的线性化点。
            });
            await(prepared);
            check("构造完成并不等于已经发布", state.get() == captured);
            publish.countDown(); update.get(5, TimeUnit.SECONDS);
            Config current = state.get();
            check("旧读者保留一致旧版本",
                    captured.revision() == 1 && captured.route().equals("blue"));
            check("新读者获得一致新版本",
                    current.revision() == 2 && current.route().equals("green"));
            check("版本切换只改变根引用", current != captured);
            String secondReadRoute = state.get().route();
            check("分别 get 两次仍能把两个版本拼在一起",
                    firstReadRevision == 1 && secondReadRoute.equals("green"));
            boolean invalid = false;
            try { new Config(0, "bad"); } catch (IllegalArgumentException ex) { invalid = true; }
            check("非法配置在发布前被拒绝", invalid && state.get() == current);
        } finally {
            finishSplit.countDown(); publish.countDown();
            writer.shutdownNow();
            if (!writer.awaitTermination(5, TimeUnit.SECONDS)) throw new AssertionError("writer alive");
        }
        System.out.println("ASSERTIONS " + assertions);
    }
}

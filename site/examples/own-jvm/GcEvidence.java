import java.lang.management.GarbageCollectorMXBean;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryUsage;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class GcEvidence {
    private static volatile int sink;
    private record Counter(long count, long millis) { }

    private static Map<String, Counter> snapshot(List<GarbageCollectorMXBean> beans) {
        Map<String, Counter> result = new LinkedHashMap<>();
        for (GarbageCollectorMXBean bean : beans) {
            result.put(bean.getName(), new Counter(bean.getCollectionCount(),
                    bean.getCollectionTime()));
        }
        return result;
    }

    private static String delta(long before, long after) {
        return before < 0 || after < 0 || after < before
                ? "UNKNOWN" : Long.toString(after - before);
    }

    private static void memory(String stage) {
        MemoryUsage u = ManagementFactory.getMemoryMXBean().getHeapMemoryUsage();
        System.out.println(stage + " HEAP used=" + u.getUsed()
                + " committed=" + u.getCommitted() + " max=" + u.getMax());
    }

    public static void main(String[] args) {
        if (Runtime.getRuntime().maxMemory() > 64L * 1024 * 1024) {
            throw new IllegalArgumentException("Use -Xmx32m or -Xmx64m");
        }
        System.out.println("VM=" + System.getProperty("java.vm.name")
                + " " + System.getProperty("java.runtime.version"));
        System.out.println("PID=" + ProcessHandle.current().pid()
                + " START_MS=" + ManagementFactory.getRuntimeMXBean().getStartTime());
        System.out.println("ARGS=" + ManagementFactory.getRuntimeMXBean().getInputArguments());
        List<GarbageCollectorMXBean> beans = ManagementFactory.getGarbageCollectorMXBeans();
        System.out.println("GC=" + beans.stream().map(GarbageCollectorMXBean::getName).toList());
        memory("BEFORE");
        Map<String, Counter> before = snapshot(beans);
        long start = System.nanoTime();
        byte[][] retained = new byte[32][];
        for (int i = 0; i < 10_000; i++) {
            byte[] chunk = new byte[16 * 1024];
            chunk[0] = (byte) i;
            retained[i % retained.length] = chunk;
            sink += chunk[0];
        }
        long elapsed = System.nanoTime() - start;
        Map<String, Counter> after = snapshot(beans);
        for (int slot = 0; slot < retained.length; slot++) {
            int last = 9_999 - ((9_999 - slot) % retained.length);
            if (retained[slot] == null || retained[slot].length != 16 * 1024
                    || retained[slot][0] != (byte) last) {
                throw new AssertionError("Bounded retention invariant failed");
            }
        }
        for (String name : before.keySet()) {
            Counter a = before.get(name);
            Counter b = after.get(name);
            System.out.println(name + " COUNT=" + b.count() + " TIME_MS=" + b.millis()
                    + " DELTA_COUNT=" + delta(a.count(), b.count())
                    + " DELTA_TIME_MS=" + delta(a.millis(), b.millis()));
        }
        memory("AFTER");
        System.out.println("WORKLOAD_NS=" + elapsed + " sink=" + sink);
        System.out.println("PASS bounded allocation; counters are not pause percentiles or a benchmark");
    }
}

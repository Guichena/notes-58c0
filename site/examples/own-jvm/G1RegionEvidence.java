import com.sun.management.HotSpotDiagnosticMXBean;
import java.lang.management.ManagementFactory;
import java.lang.ref.Reference;
import java.util.ArrayList;
import java.util.List;

/** HotSpot 21: region size and committed heap are different measurements. */
public final class G1RegionEvidence {
    public static void main(String[] args) {
        if (args.length != 1) {
            throw new IllegalArgumentException("Expected: region size in bytes");
        }
        long expected = Long.parseLong(args[0]);
        var bean = ManagementFactory.getPlatformMXBean(HotSpotDiagnosticMXBean.class);
        if (!Boolean.parseBoolean(bean.getVMOption("UseG1GC").getValue())) {
            throw new IllegalStateException("Run this example with -XX:+UseG1GC");
        }
        var before = bean.getVMOption("G1HeapRegionSize");
        long committedBefore = ManagementFactory.getMemoryMXBean()
                .getHeapMemoryUsage().getCommitted();
        List<byte[]> live = new ArrayList<>();
        for (int i = 0; i < 96; i++) {
            byte[] block = new byte[128 * 1024];
            block[0] = (byte) i;
            live.add(block);
        }
        var after = bean.getVMOption("G1HeapRegionSize");
        long committedAfter = ManagementFactory.getMemoryMXBean()
                .getHeapMemoryUsage().getCommitted();
        if (before.isWriteable() || after.isWriteable()
                || !before.getValue().equals(after.getValue())
                || Long.parseLong(after.getValue()) != expected) {
            throw new AssertionError("Unexpected region size or management capability");
        }
        if (live.size() != 96 || live.get(95)[0] != 95) {
            throw new AssertionError("Allocation workload incomplete");
        }
        System.out.println("VM=" + System.getProperty("java.vm.name") + " "
                + System.getProperty("java.runtime.version"));
        System.out.println("ARGS=" + ManagementFactory.getRuntimeMXBean().getInputArguments());
        System.out.println("PASS: region=" + after.getValue() + " not writeable; committed before="
                + committedBefore + " after=" + committedAfter);
        Reference.reachabilityFence(live);
    }
}

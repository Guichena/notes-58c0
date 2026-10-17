import com.sun.management.HotSpotDiagnosticMXBean;
import java.lang.management.ManagementFactory;

/** HotSpot 21: inspect a startup setting, not an object's promotion age. */
public final class TenuringEvidence {
    public static void main(String[] args) {
        if (args.length != 1) {
            throw new IllegalArgumentException("Expected: maximum tenuring threshold");
        }
        int expected = Integer.parseInt(args[0]);
        var bean = ManagementFactory.getPlatformMXBean(HotSpotDiagnosticMXBean.class);
        if (!Boolean.parseBoolean(bean.getVMOption("UseG1GC").getValue())) {
            throw new IllegalStateException("Run this example with -XX:+UseG1GC");
        }
        var threshold = bean.getVMOption("MaxTenuringThreshold");
        if (Integer.parseInt(threshold.getValue()) != expected || threshold.isWriteable()) {
            throw new AssertionError("Unexpected threshold or management capability");
        }
        System.out.println("VM=" + System.getProperty("java.vm.name") + " "
                + System.getProperty("java.runtime.version"));
        System.out.println("ARGS=" + ManagementFactory.getRuntimeMXBean().getInputArguments());
        System.out.println("PASS: startup MaxTenuringThreshold=" + expected
                + ", manageable=" + threshold.isWriteable());
        System.out.println("This checks configuration, not any object's actual promotion age.");
    }
}

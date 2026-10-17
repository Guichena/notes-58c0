import com.sun.management.HotSpotDiagnosticMXBean;
import java.lang.management.ManagementFactory;
import java.nio.ByteBuffer;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

public final class MemoryBoundaries {
    private static final int MIB = 1024 * 1024;
    private static final List<Object> ROOT = new ArrayList<>(10_000);
    private static int depth;

    private static final class Loader extends ClassLoader {
        Loader() { super(null); }
        Class<?> define(byte[] data) {
            return defineClass("Seed", data, 0, data.length);
        }
    }

    private static void recurse() {
        depth++;
        recurse();
    }

    private static long option(String name) {
        return Long.parseLong(ManagementFactory
                .getPlatformMXBean(HotSpotDiagnosticMXBean.class)
                .getVMOption(name).getValue());
    }

    public static void main(String[] args) throws Exception {
        if (args.length < 1 || Runtime.getRuntime().maxMemory() > 64L * MIB) {
            throw new IllegalArgumentException("Use an isolated child with -Xmx64m or less");
        }
        String mode = args[0];
        byte[] seed = null;
        switch (mode) {
            case "heap" -> {
                if (Runtime.getRuntime().maxMemory() >= 32L * MIB) {
                    throw new IllegalArgumentException("heap mode needs -Xmx16m");
                }
            }
            case "direct" -> {
                long cap = option("MaxDirectMemorySize");
                if (cap <= 0 || cap > MIB) {
                    throw new IllegalArgumentException("direct mode needs direct cap <= 1MiB");
                }
            }
            case "stack" -> {
                long kib = option("ThreadStackSize");
                if (kib <= 0 || kib > 512) {
                    throw new IllegalArgumentException("stack mode needs -Xss256k");
                }
            }
            case "metaspace" -> {
                long cap = option("MaxMetaspaceSize");
                if (cap <= 0 || cap > 16L * MIB || args.length != 2) {
                    throw new IllegalArgumentException("metaspace mode needs cap <= 16MiB and Seed.class");
                }
                Path path = Path.of(args[1]);
                if (Files.size(path) > 64 * 1024) {
                    throw new IllegalArgumentException("Unexpectedly large class file");
                }
                seed = Files.readAllBytes(path);
                ROOT.add(new Loader().define(seed));
            }
            default -> throw new IllegalArgumentException("Unknown mode");
        }
        System.out.println("START bounded boundary test");
        try {
            switch (mode) {
                case "heap" -> ROOT.add(new byte[32 * MIB]);
                case "direct" -> ROOT.add(ByteBuffer.allocateDirect(2 * MIB));
                case "stack" -> recurse();
                case "metaspace" -> {
                    for (int i = 1; i < 10_000; i++) {
                        ROOT.add(new Loader().define(seed));
                    }
                }
                default -> throw new AssertionError("Validated mode changed");
            }
        } catch (StackOverflowError error) {
            if (!mode.equals("stack") || depth == 0) throw error;
            System.out.println("PASS StackOverflowError");
            return;
        } catch (OutOfMemoryError error) {
            String message = error.getMessage();
            boolean expected = switch (mode) {
                case "heap" -> "Java heap space".equals(message);
                case "direct" -> message != null && message.contains("direct buffer memory");
                case "metaspace" -> "Metaspace".equals(message);
                default -> false;
            };
            if (!expected) throw error;
            // Constant output avoids new concatenation call sites after metaspace exhaustion.
            System.out.println(message);
            System.out.println("PASS expected OutOfMemoryError domain");
            return;
        }
        throw new AssertionError("Expected resource boundary was not reached");
    }
}

class Seed { int value; }

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.IOException;
import java.nio.ByteOrder;
import java.nio.MappedByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;

// Teaching protocol for cooperating processes on a tested local Linux filesystem.
// Not a portable cross-JVM memory model, transaction log, or crash-recovery store.
public final class MappedCounter {
    private static final int SIZE = 32;
    private static final long MAGIC = 0x4D4150434E543031L;
    private MappedCounter() {}
    private static void check(MappedByteBuffer b) throws IOException {
        if (b.getLong(0) != MAGIC || b.getLong(16) != ~b.getLong(8)) {
            throw new IOException("Bad header or incomplete/corrupt value");
        }
    }
    public static void main(String[] args) throws Exception {
        if (args.length < 2 || args.length > 3) {
            throw new IllegalArgumentException("init|read file, or run file count");
        }
        String mode = args[0];
        int count = 0;
        if (mode.equals("run") && args.length == 3) {
            count = Integer.parseInt(args[2]);
            if (count < 0 || count > 100_000) throw new IllegalArgumentException("count");
        } else if (!(args.length == 2 && (mode.equals("init") || mode.equals("read")))) {
            throw new IllegalArgumentException("mode/arguments");
        }
        Path path = Path.of(args[1]);
        StandardOpenOption[] options = mode.equals("init")
                ? new StandardOpenOption[] {StandardOpenOption.CREATE_NEW,
                    StandardOpenOption.READ, StandardOpenOption.WRITE}
                : new StandardOpenOption[] {StandardOpenOption.READ, StandardOpenOption.WRITE};
        try (FileChannel ch = FileChannel.open(path, options)) {
            if (mode.equals("init")) {
                // Extend before any worker is started; never truncate an active mapping.
                ch.position(SIZE - 1L);
                ch.write(java.nio.ByteBuffer.wrap(new byte[1]));
            } else if (ch.size() != SIZE) {
                throw new IOException("Unexpected file size");
            }
            MappedByteBuffer b = ch.map(FileChannel.MapMode.READ_WRITE, 0, SIZE);
            b.order(ByteOrder.BIG_ENDIAN);
            if (mode.equals("run")) {
                System.out.println("READY");
                System.out.flush();
                String signal = new BufferedReader(new InputStreamReader(
                        System.in, java.nio.charset.StandardCharsets.US_ASCII)).readLine();
                if (!"GO".equals(signal)) throw new IOException("Missing start signal");
                for (int i = 0; i < count; i++) {
                    try (FileLock lock = ch.lock(0, SIZE, false)) {
                        if (!lock.isValid()) throw new IOException("Invalid lock");
                        check(b);
                        long next = Math.addExact(b.getLong(8), 1);
                        b.putLong(8, next);
                        b.putLong(16, ~next);
                    }
                }
                b.force(); // Flushes dirty bytes; it is NOT the mutual-exclusion primitive.
                System.out.println("DONE " + count);
            } else {
                try (FileLock lock = ch.lock(0, SIZE, false)) {
                    if (!lock.isValid()) throw new IOException("Invalid lock");
                    if (mode.equals("init")) {
                        b.putLong(0, MAGIC);
                        b.putLong(8, 0);
                        b.putLong(16, ~0L);
                        b.putLong(24, 0);
                        b.force();
                    }
                    check(b);
                    System.out.println(b.getLong(8));
                }
            }
        }
        // Closing FileChannel does not explicitly unmap MappedByteBuffer in this API.
        // This short-lived process exits before the harness removes its own file.
    }
}


import java.io.RandomAccessFile;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
/** Owned sparse fixture only. Does not change RAM/swap limits or benchmark disk. */
public final class SparseFileWindow {
    private SparseFileWindow() {}
    public static void main(String[] args) throws Exception {
        Path path = Files.createTempFile("os011-sparse-", ".bin");
        long length = 2L * 1024 * 1024 * 1024 + 17;
        try (RandomAccessFile file = new RandomAccessFile(path.toFile(), "rw")) {
            file.setLength(length);
            byte[] marker = {1,2,3,4,5};
            file.seek(length - marker.length);
            file.write(marker);
            byte[] window = new byte[8192];
            file.seek(0);
            file.readFully(window);
            for (byte value : window) if (value != 0) throw new AssertionError("hole");
            byte[] tail = new byte[marker.length];
            file.seek(length - tail.length);
            file.readFully(tail);
            if (!Arrays.equals(marker, tail) || file.length() != length) throw new AssertionError("tail/size");
            if (file.read() != -1) throw new AssertionError("EOF");
            System.out.println("PASS sparse logical bytes=" + length + "; 8192-byte window and tail, long offsets; not full-file scan or physical-RAM/swap experiment");
        } finally { Files.deleteIfExists(path); }
    }
}


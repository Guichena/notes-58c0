import java.nio.ByteBuffer;
import java.nio.ReadOnlyBufferException;

public final class BufferStorage {
    private static int checks;
    private static void check(boolean condition) {
        checks++; if (!condition) throw new AssertionError(checks);
    }
    public static void main(String[] args) {
        byte[] bytes = {1, 2, 3, 4};
        ByteBuffer heap = ByteBuffer.wrap(bytes);
        check(heap.hasArray() && heap.array() == bytes);
        heap.put(0, (byte) 9);
        check(bytes[0] == 9 && heap.position() == 0);
        heap.position(1);
        ByteBuffer duplicate = heap.duplicate();
        duplicate.position(3);
        check(heap.position() == 1 && duplicate.position() == 3);
        duplicate.put(2, (byte) 8);
        check(heap.get(2) == 8);
        ByteBuffer slice = heap.slice();
        check(slice.arrayOffset() == 1 && slice.capacity() == 3);
        slice.put(0, (byte) 7);
        check(bytes[1] == 7);
        ByteBuffer readOnly = heap.asReadOnlyBuffer();
        check(readOnly.isReadOnly() && !readOnly.hasArray());
        boolean rejected = false;
        try { readOnly.put((byte) 5); } catch (ReadOnlyBufferException expected) { rejected = true; }
        check(rejected);
        ByteBuffer direct = ByteBuffer.allocateDirect(8);
        check(direct.isDirect() && !direct.hasArray());
        rejected = false;
        try { direct.array(); } catch (UnsupportedOperationException expected) { rejected = true; }
        check(rejected);
        direct.putInt(42); direct.flip();
        check(direct.limit() == 4 && direct.getInt() == 42 && !direct.hasRemaining());
        System.out.println("PASS " + checks + " checks; heap, direct, slice, duplicate, read-only");
    }
}


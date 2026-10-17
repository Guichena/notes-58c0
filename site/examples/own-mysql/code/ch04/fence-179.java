import java.nio.ByteBuffer;
import java.util.Arrays;
import java.util.Optional;

/** Original fixed-width byte codec; no HBase client or server is required. */
public final class TraceRowKey {
    private TraceRowKey() {}
    public record Decoded(long tenant, long trace, long sequence) {}
    public static byte[] prefix(long tenant, long trace) {
        if (tenant < 0 || trace < 0) throw new IllegalArgumentException("nonnegative IDs required");
        int salt = Long.hashCode(trace) & 15;
        return ByteBuffer.allocate(17).put((byte)salt).putLong(tenant).putLong(trace).array();
    }
    public static byte[] encode(long tenant, long trace, long sequence) {
        if (sequence < 0) throw new IllegalArgumentException("negative sequence");
        return ByteBuffer.allocate(25).put(prefix(tenant,trace)).putLong(sequence).array();
    }
    public static Decoded decode(byte[] key) {
        if (key == null || key.length != 25) throw new IllegalArgumentException("25 bytes required");
        ByteBuffer b = ByteBuffer.wrap(key); int salt = Byte.toUnsignedInt(b.get());
        long tenant=b.getLong(),trace=b.getLong(),sequence=b.getLong();
        if (tenant<0 || trace<0 || sequence<0 || salt!=(Long.hashCode(trace)&15))
            throw new IllegalArgumentException("invalid key");
        return new Decoded(tenant,trace,sequence);
    }
    /** Smallest exclusive upper bound of a prefix; empty means unbounded, never wrap to zero. */
    public static Optional<byte[]> exclusiveEnd(byte[] prefix) {
        if (prefix == null) throw new IllegalArgumentException("null prefix");
        byte[] end=prefix.clone();
        for (int i=end.length-1;i>=0;i--) {
            if (Byte.toUnsignedInt(end[i])<255) {
                end[i]++; return Optional.of(Arrays.copyOf(end,i+1));
            }
        }
        return Optional.empty();
    }
    public static boolean inPrefixRange(byte[] key, byte[] prefix) {
        if (Arrays.compareUnsigned(key,prefix)<0) return false;
        Optional<byte[]> end=exclusiveEnd(prefix);
        return end.isEmpty() || Arrays.compareUnsigned(key,end.orElseThrow())<0;
    }
}

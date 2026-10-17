import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.Random;

/** Teaching uint32 wire subset, not a general Protobuf parser or RPC protocol. */
public final class ProtobufVarint {
    public static byte[] encodeUInt32(long value) {
        if (value < 0 || value > 0xffff_ffffL) throw new IllegalArgumentException("uint32");
        ByteArrayOutputStream out = new ByteArrayOutputStream(5);
        do {
            int low = (int) (value & 0x7f);
            value >>>= 7;
            out.write(low | (value == 0 ? 0 : 0x80));
        } while (value != 0);
        return out.toByteArray();
    }
    public static long decodeUInt32(byte[] bytes) {
        if (bytes == null) throw new IllegalArgumentException("null");
        long result = 0;
        for (int i = 0; i < 5; i++) {
            if (i == bytes.length) throw new IllegalArgumentException("truncated");
            int b = bytes[i] & 0xff;
            if (i == 4 && (b & 0xf0) != 0) throw new IllegalArgumentException("overflow");
            result |= (long) (b & 0x7f) << (7 * i);
            if ((b & 0x80) == 0) {
                if (i + 1 != bytes.length) throw new IllegalArgumentException("trailing");
                return result;
            }
        }
        throw new IllegalArgumentException("too long");
    }
    public static long zigZag32(int value) {
        return Integer.toUnsignedLong((value << 1) ^ (value >> 31));
    }
    public static int unZigZag32(long value) {
        if (value < 0 || value > 0xffff_ffffL) throw new IllegalArgumentException("uint32");
        return (int) ((value >>> 1) ^ -(value & 1));
    }
    /** Schema: uint32 count = 1; string label = 2. Always emits both fields. */
    public static byte[] message(long count, String label) {
        if (label == null) throw new IllegalArgumentException("null label");
        byte[] text = label.getBytes(StandardCharsets.UTF_8);
        if (text.length > 1024) throw new IllegalArgumentException("label too large");
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(0x08); // (1 << 3) | VARINT
        out.writeBytes(encodeUInt32(count));
        out.write(0x12); // (2 << 3) | LEN
        out.writeBytes(encodeUInt32(text.length));
        out.writeBytes(text);
        return out.toByteArray();
    }
    private static int checks;
    private static void check(boolean ok) { checks++; if (!ok) throw new AssertionError(checks); }
    private static void reject(Runnable op) {
        boolean rejected = false;
        try { op.run(); } catch (IllegalArgumentException expected) { rejected = true; }
        check(rejected);
    }
    public static void main(String[] args) {
        long[] values = {0, 1, 127, 128, 150, 16383, 16384, 0xffff_ffffL};
        String[] hex = {"00", "01", "7f", "8001", "9601", "ff7f", "808001", "ffffffff0f"};
        for (int i = 0; i < values.length; i++) {
            check(HexFormat.of().formatHex(encodeUInt32(values[i])).equals(hex[i])
                    && decodeUInt32(HexFormat.of().parseHex(hex[i])) == values[i]);
        }
        Random random = new Random(7321);
        for (int i = 0; i < 10000; i++) {
            long value = Integer.toUnsignedLong(random.nextInt());
            byte[] bytes = encodeUInt32(value);
            int expectedLength = value == 0 ? 1 : (64 - Long.numberOfLeadingZeros(value) + 6) / 7;
            check(bytes.length == expectedLength && decodeUInt32(bytes) == value);
        }
        for (int value : new int[]{0, -1, 1, Integer.MIN_VALUE, Integer.MAX_VALUE}) {
            check(unZigZag32(zigZag32(value)) == value);
        }
        check(Arrays.equals(message(150, "中"), HexFormat.of().parseHex("0896011203e4b8ad")));
        reject(() -> encodeUInt32(-1)); reject(() -> encodeUInt32(0x1_0000_0000L));
        for (String invalid : new String[]{"", "80", "80808080", "ffffffff10", "808080808000", "0000"}) {
            reject(() -> decodeUInt32(HexFormat.of().parseHex(invalid)));
        }
        reject(() -> message(1, "x".repeat(1025)));
        System.out.println("PASS " + checks + " checks; wire example=0896011203e4b8ad (8 bytes)");
    }
}

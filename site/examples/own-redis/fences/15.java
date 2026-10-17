import java.nio.charset.StandardCharsets;
import java.util.Objects;

/** Redis Cluster CRC16/XMODEM and first-brace-pair rule; no network operations. */
public final class ClusterSlot {
    private ClusterSlot() { }
    public static int slot(String key) {
        return slot(Objects.requireNonNull(key).getBytes(StandardCharsets.UTF_8));
    }
    public static int slot(byte[] key) {
        Objects.requireNonNull(key);
        int begin = 0, end = key.length;
        for (int i = 0; i < key.length; i++) {
            if (key[i] != '{') continue;
            for (int j = i + 1; j < key.length; j++) {
                if (key[j] != '}') continue;
                if (j > i + 1) { begin = i + 1; end = j; }
                // The FIRST pair is authoritative, even if empty.
                return crc(key, begin, end) & 16383;
            }
            break;
        }
        return crc(key, begin, end) & 16383;
    }
    static int crc(byte[] bytes, int from, int to) {
        int value = 0;
        for (int i = from; i < to; i++) {
            value ^= (bytes[i] & 255) << 8;
            for (int b = 0; b < 8; b++)
                value = ((value & 0x8000) != 0 ? (value << 1) ^ 0x1021 : value << 1) & 0xffff;
        }
        return value;
    }
}

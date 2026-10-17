import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Objects;
import java.util.function.LongSupplier;

/** Exact one-JVM admission model, not a durable publication or Redis transaction. */
public final class TextCooldown {
    public static final long HOUR_MILLIS = 3_600_000L;
    private final DeadlineCache live;
    public TextCooldown(int capacity, LongSupplier clock) { live = new DeadlineCache(capacity, clock); }
    /** Clock/window starts at admission. Failed downstream work is NOT automatically released. */
    public synchronized boolean admit(String tenant, String authenticatedUser, String text) {
        String key = exactKey(tenant, authenticatedUser, text);
        live.drainExpired(64);
        if (live.get(key).isPresent()) return false;
        // Fail closed when full: silently evicting a live marker would permit duplicates.
        live.put(key, "admitted", HOUR_MILLIS); return true;
    }
    /** Lossless bounded encoding avoids hash collision assumptions; no Unicode normalization. */
    public static String exactKey(String tenant, String user, String text) {
        byte[] a = utf8(tenant, 128), b = utf8(user, 128), c = utf8(text, 4096);
        if (a.length == 0 || b.length == 0 || c.length == 0)
            throw new IllegalArgumentException("empty component");
        ByteBuffer frame = ByteBuffer.allocate(12 + a.length + b.length + c.length);
        frame.putInt(a.length).put(a).putInt(b.length).put(b).putInt(c.length).put(c);
        return "text-admission:v1:" + Base64.getUrlEncoder().withoutPadding().encodeToString(frame.array());
    }
    private static byte[] utf8(String value, int bound) {
        Objects.requireNonNull(value);
        if (value.length() > bound) throw new IllegalArgumentException("component too long");
        try {
            ByteBuffer encoded = StandardCharsets.UTF_8.newEncoder()
                .onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT)
                .encode(java.nio.CharBuffer.wrap(value));
            if (encoded.remaining() > bound) throw new IllegalArgumentException("UTF-8 byte bound");
            byte[] bytes = new byte[encoded.remaining()]; encoded.get(bytes); return bytes;
        } catch (CharacterCodingException e) { throw new IllegalArgumentException("invalid Unicode", e); }
    }
    public synchronized int residentSize() { return live.residentSize(); }
}

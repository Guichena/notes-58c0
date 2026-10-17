import java.io.*;
import java.security.MessageDigest;
import java.util.*;

/** Teaching envelope; only synthetic payloads belong in this lab. */
public record EventEnvelope(String eventId, String payload, int attempt, long deadlineMillis) {
    public static final int MAX_WIRE = 32768;
    public static final int MAX_PAYLOAD_UTF8 = 16000;
    public EventEnvelope {
        if (eventId == null || !eventId.matches("[A-Za-z0-9_.:-]{1,80}")
                || payload == null || payload.length() > MAX_PAYLOAD_UTF8
                || attempt < 0 || attempt > 2 || deadlineMillis <= 0)
            throw new IllegalArgumentException("invalid envelope");
        wireSize(eventId, payload); // validate before allocating encoded byte arrays
    }
    private static int wireSize(String id, String text) {
        int utf8 = 0, modifiedUtf8 = 0;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (Character.isHighSurrogate(c)) {
                if (i + 1 >= text.length() || !Character.isLowSurrogate(text.charAt(i + 1)))
                    throw new IllegalArgumentException("ill-formed UTF-16");
                i++; utf8 += 4; modifiedUtf8 += 6;
            } else if (Character.isLowSurrogate(c)) {
                throw new IllegalArgumentException("ill-formed UTF-16");
            } else {
                utf8 += c <= 0x7f ? 1 : c <= 0x7ff ? 2 : 3;
                modifiedUtf8 += c == 0 ? 2 : c <= 0x7f ? 1 : c <= 0x7ff ? 2 : 3;
            }
            if (utf8 > MAX_PAYLOAD_UTF8) throw new IllegalArgumentException("payload too large");
        }
        // Version, two UTF length prefixes, attempt and deadline take 20 bytes.
        int size = 20 + id.length() + modifiedUtf8; // eventId is bounded ASCII
        if (size > MAX_WIRE) throw new IllegalArgumentException("envelope too large");
        return size;
    }
    public EventEnvelope retry() { return new EventEnvelope(eventId, payload, attempt + 1, deadlineMillis); }
    public byte[] encode() throws IOException {
        var bytes = new ByteArrayOutputStream(wireSize(eventId, payload));
        try (var out = new DataOutputStream(bytes)) {
            out.writeInt(1); out.writeUTF(eventId); out.writeUTF(payload);
            out.writeInt(attempt); out.writeLong(deadlineMillis);
        }
        return bytes.toByteArray();
    }
    public static EventEnvelope decode(byte[] bytes) throws IOException {
        if (bytes.length > MAX_WIRE) throw new IOException("oversized");
        try (var in = new DataInputStream(new ByteArrayInputStream(bytes))) {
            if (in.readInt() != 1) throw new IOException("unknown schema");
            var e = new EventEnvelope(in.readUTF(), in.readUTF(), in.readInt(), in.readLong());
            if (in.available() != 0) throw new IOException("trailing bytes");
            return e;
        } catch (IllegalArgumentException e) { throw new IOException("invalid envelope", e); }
    }
    public static String hash(byte[] bytes) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
        catch (Exception impossible) { throw new AssertionError(impossible); }
    }
}

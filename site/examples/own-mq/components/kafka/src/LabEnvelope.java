import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Objects;

/** Teaching wire contract: version|eventId|entityKey|entityVersion|country|base64url(UTF-8 payload). */
public record LabEnvelope(String eventId, String entityKey, long entityVersion,
                          String country, String payload) {
    public LabEnvelope {
        Objects.requireNonNull(payload);
        // Reject invalid UTF-16 before getBytes can replace isolated surrogates.
        // Every valid UTF-16 code unit consumes at least one UTF-8 byte.
        if (payload.length() > 16384) throw new IllegalArgumentException("payload size");
        for (int i = 0; i < payload.length(); i++) {
            char c = payload.charAt(i);
            if (Character.isHighSurrogate(c)) {
                if (++i >= payload.length() || !Character.isLowSurrogate(payload.charAt(i)))
                    throw new IllegalArgumentException("isolated high surrogate");
            } else if (Character.isLowSurrogate(c)) {
                throw new IllegalArgumentException("isolated low surrogate");
            }
        }
        if (eventId == null || !eventId.matches("[A-Za-z0-9._:-]{1,100}")
                || entityKey == null || !entityKey.matches("[A-Za-z0-9._:-]{1,100}")
                || country == null || !country.matches("[A-Z]{2}") || entityVersion < 0
                || payload.getBytes(StandardCharsets.UTF_8).length > 16384)
            throw new IllegalArgumentException("invalid lab envelope");
    }
    public String encode() {
        return "1|" + eventId + "|" + entityKey + "|" + entityVersion + "|" + country + "|"
                + Base64.getUrlEncoder().withoutPadding().encodeToString(payload.getBytes(StandardCharsets.UTF_8));
    }
    public static LabEnvelope decode(byte[] wire) {
        if (wire == null || wire.length > 24000) throw new IllegalArgumentException("wire bytes/null");
        String text = new String(wire, StandardCharsets.UTF_8);
        if (!java.util.Arrays.equals(wire, text.getBytes(StandardCharsets.UTF_8)))
            throw new IllegalArgumentException("invalid wire UTF-8");
        return decode(text);
    }
    public static LabEnvelope decode(String wire) {
        if (wire == null || wire.length() > 24000) throw new IllegalArgumentException("wire size/null");
        String[] f = wire.split("\\|", -1);
        if (f.length != 6 || !f[0].equals("1")) throw new IllegalArgumentException("schema");
        byte[] bytes = Base64.getUrlDecoder().decode(f[5]);
        String payload = new String(bytes, StandardCharsets.UTF_8);
        if (!java.util.Arrays.equals(bytes, payload.getBytes(StandardCharsets.UTF_8)))
            throw new IllegalArgumentException("invalid UTF-8");
        return new LabEnvelope(f[1], f[2], Long.parseLong(f[3]), f[4], payload);
    }
    public static void main(String[] args) {
        LabEnvelope e = new LabEnvelope("e-1", "order-7", 9, "CN", "中文|payload\n");
        if (!decode(e.encode()).equals(e)) throw new AssertionError("roundtrip");
        try { decode("2|broken"); throw new AssertionError(); }
        catch (IllegalArgumentException expected) { }
        try { decode("1|e|k|1|CN|_w"); throw new AssertionError(); }
        catch (IllegalArgumentException expected) { }
        if (!decode(e.encode().getBytes(StandardCharsets.UTF_8)).equals(e)) throw new AssertionError("byte roundtrip");
        try { decode(new byte[]{(byte)0xff}); throw new AssertionError(); }
        catch (IllegalArgumentException expected) { }
        System.out.println("PASS LabEnvelope string/bytes roundtrip/schema/payload+wire UTF8; no broker");
    }
}

import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Objects;

/** A bounded, lossless naming contract; not authentication or encryption. */
public final class CacheKey {
    private CacheKey() { }
    public static String create(String environment, String service, String purpose,
                                int schema, String tenant, String atomicGroup,
                                String entity, long generation) {
        checkLabel(environment); checkLabel(service); checkLabel(purpose);
        if (schema <= 0 || generation < 0) throw new IllegalArgumentException("version");
        String tag = encode(environment, 32) + "." + encode(service, 32) + "."
                + encode(tenant, 128) + "." + encode(atomicGroup, 128);
        String key = "k1:" + environment + ":" + service + ":" + purpose + ":v" + schema
                + ":{" + tag + "}:" + encode(entity, 256) + ":g" + generation;
        if (key.length() > 2048) throw new IllegalArgumentException("key too large");
        return key; // All output characters are ASCII; char count equals byte count.
    }
    private static void checkLabel(String value) {
        Objects.requireNonNull(value);
        if (!value.matches("[a-z][a-z0-9_-]{0,31}"))
            throw new IllegalArgumentException("label");
    }
    private static String encode(String value, int byteLimit) {
        Objects.requireNonNull(value);
        if (value.isEmpty() || value.length() > byteLimit)
            throw new IllegalArgumentException("empty or oversized identifier");
        try {
            ByteBuffer buffer = StandardCharsets.UTF_8.newEncoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .encode(CharBuffer.wrap(value));
            if (buffer.remaining() > byteLimit) throw new IllegalArgumentException("byte limit");
            byte[] bytes = new byte[buffer.remaining()];
            buffer.get(bytes);
            return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        } catch (CharacterCodingException e) {
            throw new IllegalArgumentException("malformed Unicode", e);
        }
    }
}

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Date;
import java.util.Objects;

public final class SerializationLab {
    private SerializationLab() {}
    private static final int MAX_BYTES = 8_192;
    public static final class Message implements Serializable {
        @Serial private static final long serialVersionUID = 1L;
        private final int version;
        private final String text;
        public Message(int version, String text) {
            this.version = version; this.text = Objects.requireNonNull(text);
        }
        @Serial private void readObject(ObjectInputStream input) throws IOException, ClassNotFoundException {
            input.defaultReadObject();
            if (version != 1 || text == null || text.length() > 100)
                throw new InvalidObjectException("invalid message fields");
        }
    }
    static byte[] serialize(Serializable object) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ObjectOutputStream output = new ObjectOutputStream(bytes)) { output.writeObject(object); }
        return bytes.toByteArray();
    }
    static Message deserializeOwnMessage(byte[] data) throws IOException, ClassNotFoundException {
        Objects.requireNonNull(data);
        // A real network boundary must enforce this bound before allocating/reading all input.
        if (data.length > MAX_BYTES) throw new IOException("input byte limit");
        try (ObjectInputStream input = new ObjectInputStream(new ByteArrayInputStream(data))) {
            input.setObjectInputFilter(info -> {
                if (info.depth() > 4 || info.references() > 16 ||
                        info.streamBytes() > MAX_BYTES || info.arrayLength() > 100)
                    return ObjectInputFilter.Status.REJECTED;
                Class<?> type = info.serialClass();
                if (type == null) return ObjectInputFilter.Status.UNDECIDED;
                return type == Message.class || type == String.class
                        ? ObjectInputFilter.Status.ALLOWED : ObjectInputFilter.Status.REJECTED;
            });
            Object value = input.readObject();
            if (!(value instanceof Message message)) throw new InvalidObjectException("wrong root type");
            // This teaching protocol is one serialized Message per outer frame.
            return message;
        }
    }
    public static void main(String[] args) throws Exception {
        byte[] bytes = serialize(new Message(1, "中😀"));
        Message result = deserializeOwnMessage(bytes);
        Checks.equal(result.text, "中😀", "own DTO round trip");
        Checks.check(result.version == 1, "version");
        Checks.expect(InvalidClassException.class, () -> deserializeOwnMessage(serialize(new Date())),
                "class allowlist");
        Checks.expect(InvalidObjectException.class,
                () -> deserializeOwnMessage(serialize(new Message(2, "x"))), "business version");
        Checks.expect(InvalidObjectException.class,
                () -> deserializeOwnMessage(serialize(new Message(1, "x".repeat(101)))), "field length");
        Checks.expect(InvalidObjectException.class, () -> deserializeOwnMessage(serialize("text")),
                "string root still rejected after parsing");
        Checks.expect(IOException.class, () -> deserializeOwnMessage(new byte[MAX_BYTES + 1]),
                "byte limit before parsing");
        Checks.expect(IOException.class, () -> deserializeOwnMessage(Arrays.copyOf(bytes, bytes.length - 1)),
                "truncated stream");
        String json = "{\"name\":\"中\"}";
        Checks.check(json.length() == 12 && json.getBytes(StandardCharsets.UTF_8).length == 14,
                "JSON units vs exact UTF-8 bytes");
        Checks.done("SerializationLab");
    }
}

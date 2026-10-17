import java.nio.charset.StandardCharsets;
import java.util.Objects;

public final class SseCodecDemo {
    static String field(String text) {
        Objects.requireNonNull(text);
        if (text.length() > 128 || text.indexOf('\r') >= 0 || text.indexOf('\n') >= 0 || text.indexOf('\0') >= 0)
            throw new IllegalArgumentException("invalid SSE field");
        return text;
    }
    public static String encode(String id, String event, String data) {
        Objects.requireNonNull(data);
        if (data.getBytes(StandardCharsets.UTF_8).length > 65536)
            throw new IllegalArgumentException("event too large");
        StringBuilder out = new StringBuilder("id: ").append(field(id)).append('\n')
                .append("event: ").append(field(event)).append('\n');
        String normalized = data.replace("\r\n", "\n").replace('\r', '\n');
        for (String line : normalized.split("\n", -1)) out.append("data: ").append(line).append('\n');
        return out.append('\n').toString();
    }
    static int checks;
    static void check(boolean ok) { if (!ok) throw new AssertionError(); checks++; }
    static void bad(Runnable r) {
        try { r.run(); throw new AssertionError("expected validation failure"); }
        catch (IllegalArgumentException expected) { checks++; }
    }
    public static void main(String[] args) {
        check(encode("1", "delta", "甲🙂").equals("id: 1\nevent: delta\ndata: 甲🙂\n\n"));
        check(encode("2", "progress", "a\r\nb\rc\n").equals("id: 2\nevent: progress\ndata: a\ndata: b\ndata: c\ndata: \n\n"));
        check(encode("", "message", "").equals("id: \nevent: message\ndata: \n\n"));
        bad(() -> encode("1\nevent: evil", "delta", "x"));
        bad(() -> encode("1", "delta\r", "x"));
        bad(() -> encode("\0", "delta", "x"));
        bad(() -> encode("1", "delta", "界".repeat(22000)));
        check(encode("1", "delta", "x".repeat(65536)).endsWith("\n\n"));
        System.out.println("SseCodecDemo checks " + checks + " PASS; encoding only");
    }
}

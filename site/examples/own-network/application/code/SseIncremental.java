import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Objects;
import java.util.Random;
import java.util.function.Consumer;

// Bounded teaching parser. Single-threaded, non-reentrant consumer; HTTP is outside it.
public final class SseIncremental {
    public record Event(String type, String data, String id) {}
    private final int maxLineBytes, maxDataChars;
    private final Consumer<Event> sink;
    private final ByteArrayOutputStream line = new ByteArrayOutputStream();
    private final StringBuilder data = new StringBuilder();
    private String eventType = "", idBuffer = "", lastEventId = "";
    private BigInteger retryMillis = BigInteger.valueOf(3000);
    private boolean skipLf, firstLine = true, closed;

    public SseIncremental(int maxLineBytes, int maxDataChars, Consumer<Event> sink) {
        if (maxLineBytes < 1 || maxDataChars < 1) throw new IllegalArgumentException("limits");
        this.maxLineBytes = maxLineBytes; this.maxDataChars = maxDataChars;
        this.sink = Objects.requireNonNull(sink);
    }
    public String lastEventId() { return lastEventId; }
    public BigInteger retryMillis() { return retryMillis; }
    public void feed(byte[] b, int off, int len) {
        if (closed) throw new IllegalStateException("parser ended or failed");
        Objects.checkFromIndexSize(off, len, b.length);
        try {
            for (int i = off; i < off + len; i++) {
                int value = b[i] & 255;
                if (skipLf) { skipLf = false; if (value == 10) continue; }
                if (value == 13 || value == 10) {
                    processLine();
                    skipLf = value == 13;
                } else {
                    if (line.size() == maxLineBytes) throw new IllegalArgumentException("line limit");
                    line.write(value);
                }
            }
        } catch (RuntimeException e) { closed = true; line.reset(); data.setLength(0); throw e; }
    }
    private void processLine() {
        // A valid UTF-8 multibyte character cannot contain CR or LF bytes.
        // Buffering the whole bounded line therefore preserves characters across reads.
        String s = line.toString(StandardCharsets.UTF_8); line.reset();
        if (firstLine) { firstLine = false; if (s.startsWith("\ufeff")) s = s.substring(1); }
        if (s.isEmpty()) {
            lastEventId = idBuffer;
            if (data.length() == 0) { eventType = ""; return; }
            Event event = new Event(eventType.isEmpty() ? "message" : eventType,
                    data.substring(0, data.length() - 1), lastEventId);
            data.setLength(0); eventType = "";
            sink.accept(event);
            return;
        }
        if (s.charAt(0) == ':') return;
        int colon = s.indexOf(':');
        String name = colon < 0 ? s : s.substring(0, colon);
        String value = colon < 0 ? "" : s.substring(colon + 1);
        if (value.startsWith(" ")) value = value.substring(1);
        switch (name) {
            case "data" -> {
                // Includes the LF added for each data line; limit is UTF-16 code units.
                if ((long)data.length() + value.length() + 1 > maxDataChars)
                    throw new IllegalArgumentException("event limit");
                data.append(value).append('\n');
            }
            case "event" -> eventType = value;
            case "id" -> { if (value.indexOf('\0') < 0) idBuffer = value; }
            case "retry" -> {
                if (!value.isEmpty() && value.chars().allMatch(c -> c >= '0' && c <= '9'))
                    retryMillis = new BigInteger(value);
            }
            default -> { } // Unknown fields are ignored.
        }
    }
    public void end() {
        // EOF is not a blank line. Incomplete final event is intentionally discarded.
        line.reset(); data.setLength(0); eventType = ""; closed = true;
    }
    static final String FIXTURE = "\ufeff: keepalive\r\nid: 7\r\nevent: delta\r\n"
            + "data: {\"text\":\"甲🙂\\\"}\\\"\"}\r\n\r\n"
            + "data: {\"n\":1,\rdata: \"ok\":true}\r\r"
            + "id:\nevent:\ndata: not-json\n\n";
    static final List<Event> EXPECTED = List.of(
            new Event("delta", "{\"text\":\"甲🙂\\\"}\\\"\"}", "7"),
            new Event("message", "{\"n\":1,\n\"ok\":true}", "7"),
            new Event("message", "not-json", ""));
    static int checks;
    static void check(boolean b) { if (!b) throw new AssertionError(); checks++; }
    static void reject(Runnable r) {
        try { r.run(); throw new AssertionError("expected failure"); }
        catch (IllegalArgumentException | IllegalStateException expected) { checks++; }
    }
    static SseIncremental parser(List<Event> out) { return new SseIncremental(4096,8192,out::add); }
    static void text(SseIncremental p, String s) {
        byte[] bytes = s.getBytes(StandardCharsets.UTF_8); p.feed(bytes,0,bytes.length);
    }
    public static void main(String[] args) {
        byte[] bytes = FIXTURE.getBytes(StandardCharsets.UTF_8);
        if (args.length == 1 && args[0].equals("--fixture")) {
            List<Event> out = new ArrayList<>(); SseIncremental p = parser(out);
            for (int i=0;i<bytes.length;i++) p.feed(bytes,i,1);
            p.end();
            for (Event e:out) System.out.println(Base64.getEncoder().encodeToString(e.data().getBytes(StandardCharsets.UTF_8)));
            return;
        }
        for (int cut=0;cut<=bytes.length;cut++) {
            List<Event> out = new ArrayList<>(); SseIncremental p = parser(out);
            p.feed(bytes,0,cut); p.feed(bytes,cut,bytes.length-cut); p.end();
            check(out.equals(EXPECTED));
        }
        Random r = new Random(6455);
        for (int trial=0;trial<1000;trial++) {
            List<Event> out = new ArrayList<>(); SseIncremental p = parser(out);
            for (int at=0;at<bytes.length;) { int n=Math.min(1+r.nextInt(9),bytes.length-at);p.feed(bytes,at,n);at+=n; }
            p.end(); check(out.equals(EXPECTED));
        }
        List<Event> out = new ArrayList<>(); SseIncremental p = parser(out);
        text(p,"data: {\"a\":"); check(out.isEmpty());
        text(p,"1}\n"); check(out.isEmpty()); text(p,"\n");
        check(out.equals(List.of(new Event("message","{\"a\":1}",""))));
        text(p,"id: old\n\n"); check(p.lastEventId().equals("old"));
        text(p,"id: bad\0id\ndata:\n\n"); check(out.get(1).equals(new Event("message","","old")));
        text(p,"data:  x:y\nx:ignored\n\n"); check(out.get(2).data().equals(" x:y"));
        text(p,"retry: 19\nretry: +3\nretry: ３\n"); check(p.retryMillis().equals(BigInteger.valueOf(19)));
        text(p,"retry: 99999999999999999999\n"); check(p.retryMillis().equals(new BigInteger("99999999999999999999")));
        int size=out.size(); text(p,"data: unfinished\n"); p.end(); check(out.size()==size);
        reject(() -> text(p,"\n"));
        List<Event> invalid = new ArrayList<>(); SseIncremental q=parser(invalid);
        byte[] malformed={'d','a','t','a',':',' ',(byte)0xff,10,10};q.feed(malformed,0,malformed.length);
        check(invalid.get(0).data().equals("\ufffd"));
        List<Event> tightOut=new ArrayList<>(); SseIncremental tight=new SseIncremental(7,3,tightOut::add);
        text(tight,"data: x\n\n"); check(tightOut.get(0).data().equals("x"));
        reject(() -> text(tight,"data: xx")); reject(() -> text(tight,"\n"));
        SseIncremental eventLimit=new SseIncremental(100,3,e -> {});
        reject(() -> text(eventLimit,"data: x\ndata: y\n\n"));
        List<Event> noData=new ArrayList<>(); SseIncremental no=parser(noData);
        text(no,"event: stale\n\ndata\n\n"); check(noData.get(0).type().equals("message"));
        List<Event> bom=new ArrayList<>(); SseIncremental bp=parser(bom);
        text(bp,"\ufeffdata: first\n\ndata: \ufeffkept\n\n");
        check(bom.size()==2 && bom.get(1).data().equals("\ufeffkept"));
        System.out.println("SseIncremental PASS " + checks + "; no HTTP/browser/reconnection integration");
    }
}

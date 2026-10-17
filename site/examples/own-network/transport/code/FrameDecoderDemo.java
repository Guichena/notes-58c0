import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.function.Consumer;

/** Length-prefixed byte frames. One decoder per connection, single event-loop owner. */
public final class FrameDecoderDemo {
    static final class Decoder {
        private final int maximum;
        private final ByteBuffer header = ByteBuffer.allocate(4); // Big endian by default.
        private ByteBuffer body;
        private boolean closed;
        Decoder(int maximum) {
            if (maximum < 0) throw new IllegalArgumentException("negative maximum");
            this.maximum = maximum;
        }
        void feed(ByteBuffer input, Consumer<byte[]> sink) {
            if (closed) throw new IllegalStateException("decoder closed");
            Objects.requireNonNull(input); Objects.requireNonNull(sink);
            try {
                while (input.hasRemaining()) {
                    if (body == null) {
                        transfer(input, header);
                        if (header.hasRemaining()) return; // Preserve partial header.
                        header.flip(); int length = header.getInt(); header.clear();
                        if (length < 0 || length > maximum)
                            throw new IllegalArgumentException("invalid frame length: " + length);
                        body = ByteBuffer.allocate(length); // Allocate only AFTER validation.
                    }
                    transfer(input, body);
                    if (!body.hasRemaining()) {
                        byte[] result = body.array();
                        body = null; // Reset before delivery; callback must not re-enter decoder.
                        sink.accept(result); // Ownership passes to caller, no retained output list.
                    }
                }
            } catch (RuntimeException ex) {
                closed = true; body = null; // Fail closed: discard this connection after protocol failure.
                throw ex;
            }
        }
        void endOfInput() {
            if (closed) throw new IllegalStateException("decoder closed");
            closed = true;
            if (header.position() != 0 || body != null) {
                body = null;
                throw new IllegalStateException("truncated frame");
            }
        }
        private static void transfer(ByteBuffer from, ByteBuffer to) {
            int count = Math.min(from.remaining(), to.remaining());
            int limit = from.limit();
            from.limit(from.position() + count);
            to.put(from); // Copies exactly count bytes, advances both positions.
            from.limit(limit);
        }
    }
    static int assertions;
    static void check(String label, boolean condition) {
        if (!condition) throw new AssertionError(label);
        assertions++;
    }
    static byte[] frame(String value) {
        byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
        return ByteBuffer.allocate(4 + bytes.length).putInt(bytes.length).put(bytes).array();
    }
    static byte[] joined(byte[]... frames) {
        int size = Arrays.stream(frames).mapToInt(a -> a.length).sum();
        ByteBuffer all = ByteBuffer.allocate(size);
        for (byte[] frame : frames) all.put(frame);
        return all.array();
    }
    static List<String> decodeChunks(byte[] bytes, int width) {
        Decoder decoder = new Decoder(1024); List<String> output = new ArrayList<>();
        for (int start = 0; start < bytes.length; start += width) {
            decoder.feed(ByteBuffer.wrap(bytes, start, Math.min(width, bytes.length - start)),
                    b -> output.add(new String(b, StandardCharsets.UTF_8)));
        }
        decoder.endOfInput(); return output;
    }
    public static void main(String[] args) {
        byte[] bytes = joined(frame("甲🙂"), frame(""), frame("OK"));
        for (int width = 1; width <= bytes.length; width++)
            check("chunk width " + width, decodeChunks(bytes, width).equals(List.of("甲🙂", "", "OK")));
        Decoder empty = new Decoder(0); empty.feed(ByteBuffer.allocate(0), b -> {}); empty.endOfInput();
        check("empty stream", true);
        Decoder zero = new Decoder(0); List<byte[]> zeroOut = new ArrayList<>();
        zero.feed(ByteBuffer.wrap(frame("")), zeroOut::add); zero.endOfInput();
        check("zero maximum permits empty frame", zeroOut.size() == 1 && zeroOut.getFirst().length == 0);
        for (int length : new int[]{-1, 1025, Integer.MAX_VALUE}) {
            Decoder d = new Decoder(1024); boolean bad = false;
            try { d.feed(ByteBuffer.allocate(4).putInt(length).flip(), b -> {}); }
            catch (IllegalArgumentException expected) { bad = true; }
            check("reject invalid length " + length, bad);
            boolean closed = false;
            try { d.feed(ByteBuffer.allocate(0), b -> {}); }
            catch (IllegalStateException expected) { closed = true; }
            check("bad stream remains closed " + length, closed);
        }
        for (int prefix = 1; prefix < frame("OK").length; prefix++) {
            Decoder d = new Decoder(10); d.feed(ByteBuffer.wrap(Arrays.copyOf(frame("OK"), prefix)), b -> {});
            boolean bad = false;
            try { d.endOfInput(); } catch (IllegalStateException expected) { bad = true; }
            check("EOF at prefix " + prefix, bad);
        }
        Decoder max = new Decoder(2); List<byte[]> maxOut = new ArrayList<>();
        max.feed(ByteBuffer.wrap(frame("OK")), maxOut::add); max.endOfInput();
        check("exact maximum", maxOut.size() == 1 && maxOut.getFirst().length == 2);
        Decoder failSink = new Decoder(2); boolean propagated = false;
        try { failSink.feed(ByteBuffer.wrap(frame("OK")), b -> { throw new IllegalArgumentException("sink full"); }); }
        catch (IllegalArgumentException expected) { propagated = true; }
        check("delivery failure propagates", propagated);
        System.out.println("FrameDecoderDemo ASSERTIONS " + assertions);
    }
}

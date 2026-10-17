import java.io.*;
import java.nio.*;
import java.nio.channels.WritableByteChannel;
import java.nio.charset.*;
import java.util.*;

/** One connection, one owning thread. Wire format: 4-byte big-endian length, then strict UTF-8. */
public final class FrameDecoder {
    private final int maxFrameBytes;
    private final ByteBuffer header = ByteBuffer.allocate(4).order(ByteOrder.BIG_ENDIAN);
    private ByteBuffer payload;
    private boolean failed;
    private boolean ended;
    public FrameDecoder(int maxFrameBytes) {
        if (maxFrameBytes < 0) throw new IllegalArgumentException("negative limit");
        this.maxFrameBytes = maxFrameBytes;
    }
    private void requireOpen() {
        if (failed || ended) throw new IllegalStateException("decoder closed or failed");
    }
    private static void move(ByteBuffer source, ByteBuffer target) {
        int count = Math.min(source.remaining(), target.remaining());
        int oldLimit = source.limit();
        source.limit(source.position() + count);
        try { target.put(source); }
        finally { source.limit(oldLimit); }
    }
    public List<String> feed(ByteBuffer source) throws IOException {
        Objects.requireNonNull(source);
        requireOpen();
        List<String> complete = new ArrayList<>();
        try {
            while (source.hasRemaining()) {
                if (payload == null) {
                    move(source, header);
                    if (header.hasRemaining()) break;
                    header.flip();
                    int length = header.getInt();
                    header.clear();
                    if (length < 0 || length > maxFrameBytes)
                        throw new IOException("invalid frame byte length: " + length);
                    payload = ByteBuffer.allocate(length);
                }
                move(source, payload);
                if (!payload.hasRemaining()) {
                    payload.flip();
                    CharsetDecoder decoder = StandardCharsets.UTF_8.newDecoder()
                            .onMalformedInput(CodingErrorAction.REPORT)
                            .onUnmappableCharacter(CodingErrorAction.REPORT);
                    complete.add(decoder.decode(payload).toString());
                    payload = null;
                }
            }
            return complete;
        } catch (IOException | RuntimeException failure) {
            failed = true;
            throw failure;
        }
    }
    public void endOfInput() throws EOFException {
        requireOpen();
        ended = true;
        if (header.position() != 0 || payload != null) {
            failed = true;
            throw new EOFException("truncated frame");
        }
    }
    static ByteBuffer encode(String text) {
        byte[] bytes = Objects.requireNonNull(text).getBytes(StandardCharsets.UTF_8);
        ByteBuffer buffer = ByteBuffer.allocate(Math.addExact(4, bytes.length));
        buffer.putInt(bytes.length).put(bytes).flip();
        return buffer;
    }
    /** Stop on no progress; caller waits for writability before calling again. */
    static boolean drain(WritableByteChannel channel, ByteBuffer pending) throws IOException {
        while (pending.hasRemaining()) {
            if (channel.write(pending) == 0) return false;
        }
        return true;
    }
    static final class PartialChannel implements WritableByteChannel {
        final ByteArrayOutputStream result = new ByteArrayOutputStream();
        boolean open = true;
        boolean returnZero = true;
        @Override public int write(ByteBuffer source) throws IOException {
            if (!open) throw new IOException("closed");
            if (returnZero) { returnZero = false; return 0; }
            int size = Math.min(2, source.remaining());
            for (int i = 0; i < size; i++) result.write(source.get());
            return size;
        }
        @Override public boolean isOpen() { return open; }
        @Override public void close() { open = false; }
    }
    public static void main(String[] args) throws Exception {
        ByteBuffer first = encode("中😀"), second = encode("");
        byte[] wire = new byte[first.remaining() + second.remaining()];
        first.get(wire, 0, first.remaining());
        byte[] emptyFrame = new byte[second.remaining()]; second.get(emptyFrame);
        System.arraycopy(emptyFrame, 0, wire, wire.length - emptyFrame.length, emptyFrame.length);
        for (int split = 0; split <= wire.length; split++) {
            FrameDecoder decoder = new FrameDecoder(32);
            List<String> result = new ArrayList<>();
            result.addAll(decoder.feed(ByteBuffer.wrap(Arrays.copyOfRange(wire, 0, split))));
            result.addAll(decoder.feed(ByteBuffer.wrap(Arrays.copyOfRange(wire, split, wire.length))));
            decoder.endOfInput();
            Checks.equal(result, List.of("中😀", ""), "every split " + split);
            Checks.expect(IllegalStateException.class, () -> decoder.feed(ByteBuffer.allocate(0)),
                    "no input after EOF");
        }
        FrameDecoder bytewise = new FrameDecoder(32);
        List<String> result = new ArrayList<>();
        for (byte b : wire) result.addAll(bytewise.feed(ByteBuffer.wrap(new byte[]{b})));
        bytewise.endOfInput();
        Checks.equal(result, List.of("中😀", ""), "one byte at a time");
        FrameDecoder negative = new FrameDecoder(3);
        Checks.expect(IOException.class, () -> negative.feed(ByteBuffer.allocate(4).putInt(-1).flip()),
                "negative length");
        Checks.expect(IllegalStateException.class, () -> negative.feed(ByteBuffer.allocate(0)),
                "poisoned decoder");
        Checks.expect(IOException.class,
                () -> new FrameDecoder(3).feed(ByteBuffer.allocate(4).putInt(4).flip()), "oversize frame");
        FrameDecoder cutHeader = new FrameDecoder(3);
        cutHeader.feed(ByteBuffer.wrap(new byte[]{0}));
        Checks.expect(EOFException.class, cutHeader::endOfInput, "truncated header");
        FrameDecoder cutBody = new FrameDecoder(3);
        cutBody.feed(ByteBuffer.allocate(5).putInt(2).put((byte)'a').flip());
        Checks.expect(EOFException.class, cutBody::endOfInput, "truncated body");
        Checks.expect(CharacterCodingException.class, () ->
                new FrameDecoder(3).feed(ByteBuffer.allocate(6).putInt(2).put((byte)0xC3).put((byte)0x28).flip()),
                "malformed UTF-8 rejected");
        FrameDecoder zero = new FrameDecoder(0);
        Checks.equal(zero.feed(encode("")), List.of(""), "zero byte allowed");
        zero.endOfInput();

        ByteBuffer buffer = ByteBuffer.allocate(5);
        buffer.put(new byte[]{1, 2, 3}); buffer.flip();
        Checks.check(buffer.position() == 0 && buffer.limit() == 3, "flip");
        Checks.check(buffer.get() == 1, "consume one");
        buffer.compact();
        Checks.check(buffer.position() == 2 && buffer.get(0) == 2 && buffer.get(1) == 3, "compact");
        buffer.clear();
        Checks.check(buffer.position() == 0 && buffer.limit() == 5 && buffer.get(0) == 2,
                "clear does not erase");
        ByteBuffer alias = buffer.duplicate(); alias.put(0, (byte)9);
        Checks.check(buffer.get(0) == 9 && alias.position() == buffer.position(), "shared bytes");
        alias.position(3);
        Checks.check(buffer.position() == 0, "independent cursor");

        try (PartialChannel channel = new PartialChannel()) {
            ByteBuffer pending = encode("hello");
            byte[] expected = new byte[pending.remaining()]; pending.duplicate().get(expected);
            Checks.check(!drain(channel, pending) && pending.position() == 0, "zero means retry later");
            Checks.check(drain(channel, pending) && !pending.hasRemaining(), "partial writes drained");
            Checks.check(Arrays.equals(expected, channel.result.toByteArray()), "all wire bytes intact");
        }
        Checks.done("FrameDecoder");
    }
}

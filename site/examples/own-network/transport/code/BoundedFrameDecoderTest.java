import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.*;

public final class BoundedFrameDecoderTest {
    private static long assertions;
    private static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message);
        assertions++;
    }
    private static void throwsType(Class<? extends Throwable> type, Runnable run) {
        try { run.run(); throw new AssertionError("expected " + type); }
        catch (Throwable t) {
            if (!type.isInstance(t)) throw new AssertionError("wrong exception", t);
            assertions++;
        }
    }
    private static byte[] frame(byte[] body) {
        return ByteBuffer.allocate(4 + body.length).putInt(body.length).put(body).array();
    }
    private static byte[] concat(List<byte[]> frames) {
        int size = frames.stream().mapToInt(a -> a.length).sum();
        ByteBuffer b = ByteBuffer.allocate(size); for (byte[] f : frames) b.put(f);
        return b.array();
    }
    private static void consume(BoundedFrameDecoder d, ByteBuffer in, List<byte[]> out,
                                int frames, int bytes, long now) {
        int originalLimit = in.limit();
        while (in.hasRemaining()) {
            int before = in.position(), count = out.size();
            int emitted = d.feed(in, frames, bytes, now, out::add);
            check(in.position() > before, "progress");
            check(in.position() - before <= bytes, "byte budget");
            check(emitted <= frames && out.size() - count == emitted, "frame budget");
            check(in.limit() == originalLimit, "input limit unchanged");
            check(d.retainedBodyCapacity() <= 1024, "bounded allocation");
        }
    }
    private static void equal(List<byte[]> got, List<byte[]> expected) {
        check(got.size() == expected.size(), "frame count");
        for (int i = 0; i < got.size(); i++) check(Arrays.equals(got.get(i), expected.get(i)), "payload " + i);
    }
    public static void main(String[] args) {
        List<byte[]> expected = List.of("甲🙂".getBytes(StandardCharsets.UTF_8), new byte[0], new byte[]{0,-1,10}, new byte[1024]);
        List<byte[]> wireFrames = new ArrayList<>(); for (byte[] b : expected) wireFrames.add(frame(b));
        byte[] wire = concat(wireFrames);
        // Every two-way split, including empty head/tail, and every byte individually.
        for (int cut = 0; cut <= wire.length; cut++) {
            BoundedFrameDecoder d = new BoundedFrameDecoder(1000); List<byte[]> out = new ArrayList<>();
            consume(d, ByteBuffer.wrap(wire, 0, cut), out, 2, 19, 0);
            consume(d, ByteBuffer.wrap(wire, cut, wire.length - cut).asReadOnlyBuffer(), out, 2, 19, 1);
            d.endOfInput(2); equal(out, expected);
        }
        Random random = new Random(20261011);
        for (int trial = 0; trial < 300; trial++) {
            List<byte[]> payloads = new ArrayList<>(), encoded = new ArrayList<>();
            for (int f = 0; f < 12; f++) {
                byte[] b = new byte[random.nextInt(1025)]; random.nextBytes(b); payloads.add(b); encoded.add(frame(b));
            }
            byte[] all = concat(encoded); List<byte[]> got = new ArrayList<>();
            BoundedFrameDecoder d = new BoundedFrameDecoder(10000);
            for (int i = 0; i < all.length;) {
                int count = Math.min(1 + random.nextInt(79), all.length - i);
                ByteBuffer buf = ByteBuffer.allocateDirect(count + 6); buf.position(3); buf.put(all, i, count).flip(); buf.position(3);
                consume(d, buf.asReadOnlyBuffer(), got, 1 + random.nextInt(4), 1 + random.nextInt(70), 0); i += count;
            }
            d.endOfInput(1); equal(got, payloads);
        }
        for (int bad : new int[]{-1, Integer.MIN_VALUE, 1025, Integer.MAX_VALUE}) {
            BoundedFrameDecoder d = new BoundedFrameDecoder(100);
            ByteBuffer b = ByteBuffer.allocate(6).putInt(bad).putShort((short)7).flip();
            throwsType(IllegalArgumentException.class, () -> d.feed(b, 9, 99, 0, ignored -> {}));
            check(b.position() == 4 && d.retainedBodyCapacity() == 0 && d.isClosed(), "reject before allocating/body");
            throwsType(IllegalStateException.class, () -> d.feed(ByteBuffer.allocate(0), 1, 1, 0, ignored -> {}));
        }
        byte[] f = frame(new byte[]{1,2,3});
        for (int n = 1; n < f.length; n++) {
            BoundedFrameDecoder d = new BoundedFrameDecoder(100);
            d.feed(ByteBuffer.wrap(Arrays.copyOf(f, n)), 1, 20, 0, ignored -> {});
            throwsType(IllegalStateException.class, () -> d.endOfInput(1)); check(d.isClosed(), "EOF terminal");
        }
        BoundedFrameDecoder empty = new BoundedFrameDecoder(1);
        check(empty.feed(ByteBuffer.allocate(0),1,1,0, ignored -> {}) == 0, "zero input is not EOF");
        empty.checkTimeout(500); empty.endOfInput(500); check(empty.isClosed(), "clean EOF");
        // Header-only budget must still deliver a legal empty frame.
        BoundedFrameDecoder zero = new BoundedFrameDecoder(100); List<byte[]> zeros = new ArrayList<>();
        ByteBuffer manyZero = ByteBuffer.wrap(concat(Collections.nCopies(100,frame(new byte[0]))));
        check(zero.feed(manyZero, 3, 1000, 0, zeros::add) == 3 && manyZero.position() == 12, "empty-frame fairness");
        consume(zero, manyZero, zeros, 1, 4, 1); zero.endOfInput(2); check(zeros.size() == 100, "empty frames all emitted");
        // Fixed total deadline: additional bytes do not reset the frame's start.
        BoundedFrameDecoder slow = new BoundedFrameDecoder(10);
        slow.feed(ByteBuffer.wrap(new byte[]{0}),1,1,3, ignored -> {});
        slow.feed(ByteBuffer.wrap(new byte[]{0}),1,1,12, ignored -> {});
        throwsType(IllegalStateException.class, () -> slow.checkTimeout(13)); check(slow.isClosed(), "timer closes idle partial");
        BoundedFrameDecoder reset = new BoundedFrameDecoder(10);
        reset.feed(ByteBuffer.wrap(frame(new byte[0])),1,4,0, ignored -> {});
        reset.checkTimeout(100); reset.feed(ByteBuffer.wrap(new byte[]{0}),1,1,101, ignored -> {}); reset.checkTimeout(110);
        throwsType(IllegalStateException.class, () -> reset.checkTimeout(111));
        BoundedFrameDecoder callback = new BoundedFrameDecoder(100);
        int[] deliveries = {0};
        throwsType(IllegalArgumentException.class, () -> callback.feed(ByteBuffer.wrap(f),1,20,0, b -> { deliveries[0]++; throw new IllegalArgumentException("sink failure"); }));
        check(callback.isClosed() && deliveries[0] == 1, "callback failure no replay");
        BoundedFrameDecoder reentry = new BoundedFrameDecoder(100);
        throwsType(IllegalStateException.class, () -> reentry.feed(ByteBuffer.wrap(f),1,20,0, b -> reentry.feed(ByteBuffer.allocate(0),1,1,0,x -> {})));
        check(reentry.isClosed(), "uncaught callback reentry closes outer decoder");
        BoundedFrameDecoder backwards = new BoundedFrameDecoder(100); backwards.checkTimeout(5);
        throwsType(IllegalArgumentException.class, () -> backwards.checkTimeout(4)); check(backwards.isClosed(), "bad clock terminal");
        throwsType(IllegalArgumentException.class, () -> new BoundedFrameDecoder(0));
        BoundedFrameDecoder invalidBudget = new BoundedFrameDecoder(100);
        throwsType(IllegalArgumentException.class, () -> invalidBudget.feed(ByteBuffer.wrap(f),0,1,0,b -> {}));
        check(!invalidBudget.isClosed(), "precondition does not consume protocol state");
        invalidBudget.close(); invalidBudget.close();
        System.out.println("BoundedFrameDecoderTest PASS assertions=" + assertions + "; deterministic local bytes only");
    }
}

import java.nio.ByteBuffer;
import java.util.Objects;
import java.util.function.Consumer;

/**
 * Wire format: signed 32-bit big-endian byte length, then 0..1024 body bytes.
 * One connection, one serial owner; no reentrant callbacks.
 * No socket, text decoding, output queue or business acknowledgement is included.
 */
public final class BoundedFrameDecoder {
    public static final int MAX_BODY = 1024;
    private final byte[] header = new byte[4];
    private final long frameTimeoutNanos;
    private int headerBytes, bodyBytes;
    private byte[] body;
    private boolean closed, feeding, partial;
    private long startedAt, lastNow;

    // Time is nonnegative elapsed monotonic time supplied by the caller.
    public BoundedFrameDecoder(long frameTimeoutNanos) {
        if (frameTimeoutNanos <= 0) throw new IllegalArgumentException("timeout must be positive");
        this.frameTimeoutNanos = frameTimeoutNanos;
    }

    /**
     * Consumes at most byteBudget bytes and emits at most frameBudget frames.
     * Unconsumed input remains at its new position for the owner to reschedule.
     * Each output array transfers to sink and is never reused by this decoder.
     */
    public int feed(ByteBuffer input, int frameBudget, int byteBudget,
                    long now, Consumer<byte[]> sink) {
        ensureOpen();
        if (feeding) throw new IllegalStateException("reentrant call");
        Objects.requireNonNull(input); Objects.requireNonNull(sink);
        if (frameBudget < 1 || byteBudget < 1) throw new IllegalArgumentException("positive budgets required");
        feeding = true;
        try {
            tick(now);
            int emitted = 0, remaining = byteBudget;
            while (input.hasRemaining() && remaining > 0 && emitted < frameBudget) {
                if (!partial) { partial = true; startedAt = now; }
                if (body == null) {
                    int count = Math.min(Math.min(input.remaining(), 4 - headerBytes), remaining);
                    input.get(header, headerBytes, count);
                    headerBytes += count; remaining -= count;
                    if (headerBytes != 4) break;
                    int length = ((header[0] & 255) << 24) | ((header[1] & 255) << 16)
                               | ((header[2] & 255) << 8) | (header[3] & 255);
                    if (length < 0 || length > MAX_BODY)
                        throw new IllegalArgumentException("invalid body length: " + length);
                    body = new byte[length]; // No allocation based on an unchecked wire length.
                    headerBytes = 0;
                }
                int count = Math.min(Math.min(input.remaining(), body.length - bodyBytes), remaining);
                input.get(body, bodyBytes, count);
                bodyBytes += count; remaining -= count;
                if (bodyBytes == body.length) {
                    byte[] complete = body;
                    body = null; bodyBytes = 0; partial = false;
                    emitted++;
                    sink.accept(complete); // May have side effects: failure must never replay the frame.
                }
            }
            return emitted;
        } catch (RuntimeException | Error failure) {
            poison();
            throw failure;
        } finally {
            feeding = false;
        }
    }

    /** Called by the owner's timer even when no further bytes arrive. */
    public void checkTimeout(long now) {
        ensureOpen();
        if (feeding) throw new IllegalStateException("reentrant call");
        try { tick(now); }
        catch (RuntimeException failure) { poison(); throw failure; }
    }

    /** Call for SocketChannel.read == -1, after all buffered input has been fed. */
    public void endOfInput(long now) {
        ensureOpen();
        if (feeding) throw new IllegalStateException("reentrant call");
        try {
            tick(now);
            if (partial) throw new IllegalStateException("EOF inside a frame");
        } finally { poison(); }
    }

    public void close() {
        if (feeding) throw new IllegalStateException("reentrant call");
        poison();
    }
    public boolean isClosed() { return closed; }
    public int retainedBodyCapacity() { return body == null ? 0 : body.length; }
    public int bufferedBytes() { return headerBytes + bodyBytes; }
    private void tick(long now) {
        if (now < 0 || now < lastNow) throw new IllegalArgumentException("monotonic elapsed time required");
        lastNow = now;
        if (partial && now - startedAt >= frameTimeoutNanos)
            throw new IllegalStateException("incomplete frame deadline exceeded");
    }
    private void ensureOpen() {
        if (closed) throw new IllegalStateException("decoder closed");
    }
    private void poison() {
        closed = true; body = null; bodyBytes = headerBytes = 0; partial = false;
    }
}

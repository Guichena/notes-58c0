import java.io.IOException;
import java.util.*;
import java.util.concurrent.*;

/** One publisher object owns exactly one non-recovering channel generation. */
public final class RabbitPublisherLab implements AutoCloseable {
    public enum Outcome { ACK_ROUTED, RETURNED, NACK, UNKNOWN, REJECTED }
    public record Key(UUID generation, long sequence) {}
    public interface Listener {
        void returned(UUID generation, String attemptId);
        void confirm(UUID generation, long sequence, boolean multiple, boolean ack);
        void lost(UUID generation);
    }
    public interface Wire {
        void listen(UUID generation, Listener listener) throws Exception;
        long nextSequence(); // local client counter, no network call
        void send(String route, String eventId, String attemptId, byte[] body) throws Exception;
        void abort(); // bounded transport abort, may be invoked by watchdog
    }
    public static final class Ticket {
        public final Key key;
        public final String eventId, attemptId;
        final long expiresNanos;
        final CountDownLatch completed = new CountDownLatch(1);
        private volatile Outcome outcome;
        private volatile Throwable failure;
        public Throwable failure() { return failure; }
        boolean returned;
        Ticket(Key key, String id, long expires) {
            this.key = key; eventId = id; attemptId = UUID.randomUUID().toString(); expiresNanos = expires;
        }
        public Outcome outcome() { return outcome; }
        public Outcome await(long millis) throws InterruptedException {
            if (!completed.await(millis, TimeUnit.MILLISECONDS)) return Outcome.UNKNOWN;
            return outcome;
        }
        void finish(Outcome o) { outcome = o; completed.countDown(); }
    }
    private final Wire wire;
    private final UUID generation = UUID.randomUUID();
    private final long owner = Thread.currentThread().threadId();
    private final int capacity;
    private final NavigableMap<Long, Ticket> pending = new TreeMap<>();
    private final Map<String, Ticket> correlations = new HashMap<>();
    private final ScheduledThreadPoolExecutor watchdog;
    private boolean stopped;
    public RabbitPublisherLab(Wire wire, int capacity) throws Exception {
        if (capacity < 1 || capacity > 64) {
            var failure = new IllegalArgumentException("capacity 1..64");
            if (wire != null) RabbitCleanup.after(failure, wire::abort);
            throw failure;
        }
        this.wire = Objects.requireNonNull(wire); this.capacity = capacity;
        watchdog = new ScheduledThreadPoolExecutor(1, r -> {
            Thread t = new Thread(r, "rabbit-publish-deadline"); t.setDaemon(true); return t;
        });
        watchdog.setRemoveOnCancelPolicy(true);
        try {
            wire.listen(generation, new Listener() {
                public void returned(UUID g, String id) { onReturn(g, id); }
                public void confirm(UUID g, long seq, boolean multi, boolean ack) { onConfirm(g, seq, multi, ack); }
                public void lost(UUID g) { if (generation.equals(g)) failGeneration(); }
            });
            watchdog.scheduleAtFixedRate(this::expire, 5, 5, TimeUnit.MILLISECONDS);
        } catch (Exception | Error e) {
            RabbitCleanup.preserveInterrupt(e);
            RabbitCleanup.after(e, watchdog::shutdownNow);
            RabbitCleanup.after(e, wire::abort);
            throw e;
        }
    }
    public Ticket publish(String route, String eventId, byte[] body, long timeoutMillis) {
        if (Thread.currentThread().threadId() != owner) throw new IllegalStateException("channel owner only");
        if (eventId == null || !eventId.matches("[A-Za-z0-9_.:-]{1,80}") || body == null
                || body.length > EventEnvelope.MAX_WIRE || timeoutMillis < 10 || timeoutMillis > 5000
                || !Set.of("work", "dead", "missing").contains(route)) throw new IllegalArgumentException();
        byte[] immutable = body.clone();
        Ticket t;
        synchronized (this) {
            if (stopped || pending.size() >= capacity) {
                t = new Ticket(new Key(generation, -1), eventId, 0); t.finish(Outcome.REJECTED); return t;
            }
            long seq = wire.nextSequence();
            if (seq <= 0 || pending.containsKey(seq)) throw new IllegalStateException("sequence collision");
            t = new Ticket(new Key(generation, seq), eventId,
                    System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(timeoutMillis));
            pending.put(seq, t); correlations.put(t.attemptId, t);
        }
        // Register correlation before any bytes may leave. Do not hold state lock over socket I/O.
        try { if (t.outcome() == null) wire.send(route, eventId, t.attemptId, immutable); }
        catch (Exception e) {
            RabbitCleanup.preserveInterrupt(e);
            // Preserve the send failure even if bounded transport cleanup also fails.
            RabbitCleanup.after(e, () -> failGeneration(e));
        } // partial write is UNKNOWN, never definite failure
        return t;
    }
    private void onReturn(UUID g, String attempt) {
        boolean unmatched;
        synchronized (this) {
            if (!generation.equals(g) || stopped) return;
            Ticket t = correlations.get(attempt);
            unmatched = t == null;
            if (t != null) t.returned = true;
        }
        if (unmatched) failGeneration(); // broken correlation must not turn into false ACK success
    }
    private synchronized void onConfirm(UUID g, long seq, boolean multiple, boolean ack) {
        if (!generation.equals(g)) return;
        var selected = multiple ? new ArrayList<>(pending.headMap(seq, true).values())
                : pending.containsKey(seq) ? List.of(pending.get(seq)) : List.<Ticket>of();
        for (Ticket t : selected) finish(t, t.returned ? Outcome.RETURNED : ack ? Outcome.ACK_ROUTED : Outcome.NACK);
    }
    private void finish(Ticket t, Outcome o) { // called with this monitor
        if (pending.remove(t.key.sequence(), t)) {
            correlations.remove(t.attemptId, t); t.finish(o);
        }
    }
    private void expire() {
        boolean expired;
        synchronized (this) {
            long now = System.nanoTime();
            expired = pending.values().stream().anyMatch(t -> now - t.expiresNanos >= 0);
        }
        if (expired) failGeneration(); // retire whole generation; never recycle timed-out channel
    }
    private void failGeneration() { failGeneration(null); }
    private void failGeneration(Throwable cause) {
        synchronized (this) {
            if (stopped) return;
            stopped = true;
            for (Ticket t : new ArrayList<>(pending.values())) {
                t.failure = cause;
                finish(t, Outcome.UNKNOWN);
            }
        }
        wire.abort();
    }
    public synchronized int inflight() { return pending.size(); }
    public UUID generation() { return generation; }
    @Override public void close() {
        Throwable primary = null;
        try { failGeneration(); }
        catch (RuntimeException | Error failure) { primary = failure; throw failure; }
        finally {
            try {
                watchdog.shutdownNow();
                try {
                    if (!watchdog.awaitTermination(2, TimeUnit.SECONDS))
                        throw new IllegalStateException("watchdog remains");
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException("interrupted while stopping watchdog", e);
                }
            } catch (RuntimeException | Error cleanup) {
                if (primary == null) throw cleanup;
                if (cleanup != primary) primary.addSuppressed(cleanup);
            }
        }
    }
    public static void main(String[] args) throws Exception {
        LabRuntime.requireLocalOptIn(args);
        try (var runtime = new LabRuntime();
             var publisher = new RabbitPublisherLab(new RealRabbitWire(runtime), 4)) {
            long deadline = System.currentTimeMillis() + 15000;
            for (String payload : List.of("ok", "ok", "transient", "permanent")) {
                String id = payload.equals("ok") ? "same-event" : "event-" + payload;
                var e = new EventEnvelope(id, payload, 0, deadline);
                var t = publisher.publish("work", id, e.encode(), 1500);
                System.out.println(id + " " + t.await(2000));
            }
            var t = publisher.publish("missing", "unroutable", new byte[]{1}, 1500);
            System.out.println("mandatory missing route " + t.await(2000));
        }
    }
}

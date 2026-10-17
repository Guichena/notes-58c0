import com.rabbitmq.client.*;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

public final class RabbitConsumerLab {
    public enum Effect { COMMITTED, RETRYABLE, PERMANENT, UNKNOWN }
    /** COMMITTED means durable effect/receipt, or durable responsibility transfer in a real adapter.
     * A production adapter must enforce its own I/O deadline and authoritative identity checks. */
    public interface EffectPort { Effect apply(EventEnvelope e) throws Exception; }
    public interface Handoff { RabbitPublisherLab.Outcome send(String route, String eventId, byte[] body) throws Exception; }
    public interface AckPort { void ack(long tag) throws Exception; }
    public record Delivery(UUID generation, long tag, String exchange, String route,
                           String messageId, String publishAttempt, boolean redelivered, long redeliveryCount, byte[] body) {
        public Delivery {
            Objects.requireNonNull(generation); Objects.requireNonNull(body);
            exchange = Objects.toString(exchange, ""); route = Objects.toString(route, "");
            messageId = Objects.toString(messageId, ""); publishAttempt = Objects.toString(publishAttempt, "");
            body = body.clone();
        }
        public Delivery(UUID g, long tag, String exchange, String route, byte[] body) {
            this(g, tag, exchange, route, "", "", false, 0, body);
        }
        @Override public byte[] body() { return body.clone(); }
    }
    public enum Result { ACKED, STOP_UNACKED, STALE }
    public static Result handle(UUID current, Delivery d, EffectPort service, Handoff handoff,
                                AckPort acknowledger, long nowMillis) throws Exception {
        if (!current.equals(d.generation())) return Result.STALE;
        if (d.tag() <= 0) throw new IllegalArgumentException("positive channel delivery tag required");
        EventEnvelope e;
        try { e = EventEnvelope.decode(d.body()); }
        catch (IOException malformed) { return quarantine(d, "malformed-schema", handoff, acknowledger); }
        Effect effect;
        try { effect = service.apply(e); }
        catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            return Result.STOP_UNACKED;
        }
        catch (Exception unknown) { return Result.STOP_UNACKED; } // DB unavailable / COMMIT ambiguous
        if (effect == null || effect == Effect.UNKNOWN) return Result.STOP_UNACKED; // query same identity; no blind retry
        if (effect == Effect.COMMITTED) {
            acknowledger.ack(d.tag()); // kept outside business catch: ACK failure never rewinds effect
            return Result.ACKED;
        }
        if (effect == Effect.PERMANENT || e.attempt() == 2 || nowMillis >= e.deadlineMillis())
            return quarantine(d, effect == Effect.PERMANENT ? "permanent" : "retry-budget-exhausted", handoff, acknowledger);
        long delay = (20L << e.attempt()) + Math.floorMod(e.eventId().hashCode(), 11);
        if (e.deadlineMillis() - nowMillis <= delay + 1600)
            return quarantine(d, "deadline-insufficient", handoff, acknowledger);
        // Small bounded lab backoff while original stays unacked. A crash leaves broker responsibility.
        // For long delays use durable dueAt/Outbox, not a sleeping worker.
        Thread.sleep(delay);
        RabbitPublisherLab.Outcome o = handoff.send("work", e.eventId(), e.retry().encode());
        if (o != RabbitPublisherLab.Outcome.ACK_ROUTED) return Result.STOP_UNACKED;
        acknowledger.ack(d.tag()); // confirm-before-ACK: a crash here can duplicate, cannot erase both copies
        return Result.ACKED;
    }
    private static Result quarantine(Delivery d, String reason, Handoff h, AckPort ack) throws Exception {
        byte[] raw = d.body();
        if (raw.length > EventEnvelope.MAX_WIRE - 1024) return Result.STOP_UNACKED;
        String hash = EventEnvelope.hash(raw);
        String id;
        try { id = EventEnvelope.decode(raw).eventId(); } catch (IOException invalid) { id = "raw-" + hash; }
        var bytes = new ByteArrayOutputStream();
        try (var out = new DataOutputStream(bytes)) {
            out.writeInt(2); out.writeUTF(id); out.writeUTF(reason);
            out.writeUTF(d.exchange()); out.writeUTF(d.route());
            out.writeUTF(d.generation().toString()); out.writeLong(d.tag());
            out.writeLong(System.currentTimeMillis()); out.writeUTF(hash);
            out.writeUTF(d.messageId()); out.writeUTF(d.publishAttempt());
            out.writeBoolean(d.redelivered()); out.writeLong(d.redeliveryCount());
            out.writeInt(raw.length); out.write(raw); // complete bytes; do not log private payloads
        }
        if (bytes.size() > EventEnvelope.MAX_WIRE) return Result.STOP_UNACKED;
        if (h.send("dead", id, bytes.toByteArray()) != RabbitPublisherLab.Outcome.ACK_ROUTED)
            return Result.STOP_UNACKED;
        ack.ack(d.tag());
        return Result.ACKED;
    }
    /** Process-local mock ONLY: loss on restart is deliberate, not a durable inbox implementation. */
    public static final class MockEffects implements EffectPort {
        private final Map<String, String> completed = new HashMap<>();
        private int count;
        @Override public Effect apply(EventEnvelope e) {
            String identityPayload = e.payload() + "\n" + e.deadlineMillis();
            String prior = completed.get(e.eventId());
            if (prior != null) return prior.equals(identityPayload) ? Effect.COMMITTED : Effect.PERMANENT;
            if (System.currentTimeMillis() >= e.deadlineMillis()) return Effect.PERMANENT;
            if (e.payload().equals("unknown")) return Effect.UNKNOWN;
            if (e.payload().equals("permanent")) return Effect.PERMANENT;
            if (e.payload().equals("transient") && e.attempt() < 2) return Effect.RETRYABLE;
            if (completed.size() == 32) return Effect.UNKNOWN;
            completed.put(e.eventId(), identityPayload); count++;
            return Effect.COMMITTED;
        }
        public int count() { return count; }
    }
    public static void main(String[] args) throws Exception {
        LabRuntime.requireLocalOptIn(args);
        UUID generation = UUID.randomUUID();
        var inbox = new ArrayBlockingQueue<Delivery>(RabbitTopology.PREFETCH);
        var stopped = new AtomicBoolean();
        var mock = new MockEffects();
        try (var runtime = new LabRuntime();
             var publisher = new RabbitPublisherLab(new RealRabbitWire(runtime), 4)) {
            Connection connection = runtime.connect();
            Channel ch = connection.createChannel();
            RabbitTopology.declare(ch); ch.basicQos(RabbitTopology.PREFETCH, false);
            ch.addShutdownListener(s -> stopped.set(true));
            String consumer = ch.basicConsume(RabbitTopology.WORK, false,
                    (tag, message) -> {
                        var env = message.getEnvelope();
                        var props = message.getProperties();
                        Object count = props.getHeaders() == null ? null : props.getHeaders().get("x-delivery-count");
                        var d = new Delivery(generation, env.getDeliveryTag(), env.getExchange(), env.getRoutingKey(),
                                props.getMessageId(), props.getCorrelationId(), env.isRedeliver(),
                                count instanceof Number n ? n.longValue() : 0, message.getBody());
                        if (!inbox.offer(d)) { stopped.set(true); connection.abort(500); }
                    }, tag -> stopped.set(true));
            long until = System.nanoTime() + TimeUnit.SECONDS.toNanos(12);
            int deliveries = 0;
            Throwable processingFailure = null;
            try {
                while (!stopped.get() && System.nanoTime() < until && deliveries < 12) {
                    Delivery d = inbox.poll(100, TimeUnit.MILLISECONDS);
                    if (d == null) continue;
                    deliveries++;
                    Result result = handle(generation, d, mock,
                            (route, event, body) -> publisher.publish(route, event, body, 1500).await(1800),
                            tag -> ch.basicAck(tag, false), System.currentTimeMillis());
                    if (result != Result.ACKED) { stopped.set(true); break; }
                }
            } catch (Exception | Error failure) {
                processingFailure = failure;
                RabbitCleanup.preserveInterrupt(failure);
                throw failure;
            } finally {
                // No ACK for unprocessed queued work. Cleanup cannot replace processing failure.
                try { RabbitCleanup.after(processingFailure, () -> connection.abort(500)); }
                finally { inbox.clear(); }
            }
            System.out.println("Mock effects=" + mock.count() + ", deliveries=" + deliveries
                    + "; no database, no provider, no restart-persistent effects");
        }
    }
}

import java.io.*;
import java.util.*;
import java.util.concurrent.*;

/** Deterministic callback/fault tests: no socket, broker, SQL or real external action. */
public final class RabbitLabTest {
    static int checks;
    static void check(boolean b) { checks++; if (!b) throw new AssertionError("check " + checks); }
    static final class FakeWire implements RabbitPublisherLab.Wire {
        UUID generation; RabbitPublisherLab.Listener listener;
        long seq = 1; String lastAttempt; boolean aborted, failListen, failAbort;
        String behavior = "silent";
        public void listen(UUID g, RabbitPublisherLab.Listener l) throws IOException {
            generation = g; listener = l; if (failListen) throw new IOException("listen setup failed");
        }
        public long nextSequence() { return seq; }
        public void send(String route, String event, String attempt, byte[] bytes) throws Exception {
            lastAttempt = attempt; long sent = seq++;
            if (behavior.equals("throw")) throw new IOException("partial socket write");
            if (behavior.equals("return")) listener.returned(generation, attempt);
            if (!behavior.equals("silent")) listener.confirm(generation, sent, false, !behavior.equals("nack"));
        }
        public void abort() { aborted = true; if (failAbort) throw new IllegalStateException("abort failed"); }
    }
    static RabbitConsumerLab.Delivery delivery(UUID g, long tag, EventEnvelope e) throws IOException {
        return new RabbitConsumerLab.Delivery(g, tag, RabbitTopology.EXCHANGE, "work", e.encode());
    }
    public static void main(String[] args) throws Exception {
        long threadsBefore = Thread.getAllStackTraces().keySet().stream()
                .filter(t -> t.isAlive() && t.getName().startsWith("rabbit-")).count();
        // Standard UTF-8 payload budget and modified UTF-8 wire budget are distinct.
        for (String payload : List.of("", "a".repeat(16000), "\0".repeat(16000),
                "\uD83D\uDE00".repeat(4000), "界".repeat(5333))) {
            var valid = new EventEnvelope("e".repeat(80), payload, 0, 1);
            byte[] encoded = valid.encode();
            check(encoded.length <= EventEnvelope.MAX_WIRE);
            check(EventEnvelope.decode(encoded).equals(valid));
        }
        for (String payload : List.of("\uD800".repeat(16000), "\uDC00".repeat(16000),
                "\uD800", "\uDC00", "\uD800a", "a\uDC00", "a".repeat(16001),
                "\uD83D\uDE00".repeat(4001), "界".repeat(5334))) {
            try { new EventEnvelope("bad", payload, 0, 1); throw new AssertionError("accepted invalid payload"); }
            catch (IllegalArgumentException expected) { check(true); }
        }
        var malformedText = new ByteArrayOutputStream();
        try (var out = new DataOutputStream(malformedText)) {
            out.writeInt(1); out.writeUTF("bad"); out.writeUTF("\uD800"); out.writeInt(0); out.writeLong(1);
        }
        try { EventEnvelope.decode(malformedText.toByteArray()); throw new AssertionError("decoded ill-formed text"); }
        catch (IOException expected) { check(expected.getCause() instanceof IllegalArgumentException); }
        var sameFailure = new IllegalStateException("listen and abort share one failure");
        var aliasAborted = new java.util.concurrent.atomic.AtomicBoolean();
        var aliasWire = new RabbitPublisherLab.Wire() {
            public void listen(UUID id, RabbitPublisherLab.Listener listener) { throw sameFailure; }
            public long nextSequence() { return 1; }
            public void send(String route, String event, String attempt, byte[] body) { }
            public void abort() { aliasAborted.set(true); throw sameFailure; }
        };
        try { new RabbitPublisherLab(aliasWire, 1); throw new AssertionError("expected setup failure"); }
        catch (IllegalStateException expected) { check(expected == sameFailure && aliasAborted.get()); }
        var distinctFailure = new FakeWire(); distinctFailure.failListen = true; distinctFailure.failAbort = true;
        try { new RabbitPublisherLab(distinctFailure, 1); throw new AssertionError("expected setup failure"); }
        catch (IOException expected) {
            check(distinctFailure.aborted && expected.getSuppressed().length == 1
                    && expected.getSuppressed()[0] instanceof IllegalStateException);
        }
        var wire = new FakeWire();
        try (var p = new RabbitPublisherLab(wire, 2)) {
            var a = p.publish("work", "same", new byte[]{1}, 1000);
            var b = p.publish("work", "same", new byte[]{1}, 1000);
            check(!a.attemptId.equals(b.attemptId)); check(a.key.sequence() == 1 && b.key.sequence() == 2);
            check(p.publish("work", "full", new byte[]{1}, 1000).outcome() == RabbitPublisherLab.Outcome.REJECTED);
            wire.listener.returned(wire.generation, a.attemptId);
            wire.listener.confirm(UUID.randomUUID(), 2, true, true); check(p.inflight() == 2);
            wire.listener.confirm(wire.generation, 2, true, true);
            check(a.outcome() == RabbitPublisherLab.Outcome.RETURNED);
            check(b.outcome() == RabbitPublisherLab.Outcome.ACK_ROUTED); check(p.inflight() == 0);
            wire.behavior = "nack";
            check(p.publish("work", "nacked", new byte[]{2}, 1000).outcome() == RabbitPublisherLab.Outcome.NACK);
            wire.behavior = "throw";
            var unknown = p.publish("work", "part-written", new byte[]{3}, 1000);
            check(unknown.outcome() == RabbitPublisherLab.Outcome.UNKNOWN); check(p.inflight() == 0 && wire.aborted);
            wire.listener.confirm(wire.generation, unknown.key.sequence(), false, true);
            check(unknown.outcome() == RabbitPublisherLab.Outcome.UNKNOWN);
        }
        wire = new FakeWire();
        try (var p = new RabbitPublisherLab(wire, 2)) {
            var t = p.publish("work", "timeout", new byte[]{1}, 25);
            check(t.await(1000) == RabbitPublisherLab.Outcome.UNKNOWN);
            check(p.inflight() == 0);
        }
        check(wire.aborted);
        wire = new FakeWire();
        var p = new RabbitPublisherLab(wire, 2);
        var pending = p.publish("work", "closing", new byte[]{1}, 1000);
        p.close(); p.close(); check(pending.outcome() == RabbitPublisherLab.Outcome.UNKNOWN && p.inflight() == 0);
        UUID g = UUID.randomUUID(); long deadline = System.currentTimeMillis() + 10000;
        var service = new RabbitConsumerLab.MockEffects(); var acks = new ArrayList<Long>();
        RabbitConsumerLab.Handoff success = (route,id,body) -> RabbitPublisherLab.Outcome.ACK_ROUTED;
        var first = new EventEnvelope("effect", "ok", 0, deadline);
        check(EventEnvelope.decode(first.encode()).equals(first));
        for (int i = 1; i <= 2; i++) check(RabbitConsumerLab.handle(g, delivery(g,i,first), service, success, acks::add,
                System.currentTimeMillis()) == RabbitConsumerLab.Result.ACKED);
        check(service.count() == 1 && acks.equals(List.of(1L,2L)));
        check(RabbitConsumerLab.handle(UUID.randomUUID(), delivery(g,3,first), service, success, acks::add,
                System.currentTimeMillis()) == RabbitConsumerLab.Result.STALE); check(acks.size() == 2);
        try {
            RabbitConsumerLab.handle(g, delivery(g,4,first), service, success,
                    tag -> { throw new IOException("lost ACK"); }, System.currentTimeMillis());
            throw new AssertionError();
        } catch (IOException expected) { check(service.count() == 1); }
        var unknown = new EventEnvelope("unknown", "unknown", 0, deadline);
        check(RabbitConsumerLab.handle(g, delivery(g,5,unknown), service, success, acks::add,
                System.currentTimeMillis()) == RabbitConsumerLab.Result.STOP_UNACKED);
        check(RabbitConsumerLab.handle(g, delivery(g,6,first), e -> { throw new IOException("DB unavailable"); },
                success, acks::add, System.currentTimeMillis()) == RabbitConsumerLab.Result.STOP_UNACKED);
        var retry = new EventEnvelope("retry", "transient", 0, deadline);
        var sent = new ArrayList<byte[]>(); var routes = new ArrayList<String>();
        RabbitConsumerLab.Handoff capture = (route,id,body) -> { routes.add(route); sent.add(body); return RabbitPublisherLab.Outcome.ACK_ROUTED; };
        for (int i=0;i<3;i++) {
            check(RabbitConsumerLab.handle(g,delivery(g,7+i,retry),service,capture,acks::add,System.currentTimeMillis())
                    == RabbitConsumerLab.Result.ACKED);
            if (i<2) retry = EventEnvelope.decode(sent.getLast());
        }
        check(sent.size() == 2 && retry.eventId().equals("retry") && retry.attempt() == 2 && service.count() == 2);
        var poison = new EventEnvelope("poison", "permanent", 0, deadline);
        int ackBefore=acks.size();
        for (var outcome : List.of(RabbitPublisherLab.Outcome.RETURNED, RabbitPublisherLab.Outcome.NACK,
                RabbitPublisherLab.Outcome.UNKNOWN, RabbitPublisherLab.Outcome.REJECTED)) {
            check(RabbitConsumerLab.handle(g,delivery(g,20,poison),service,(route,id,body)->outcome,
                    acks::add,System.currentTimeMillis()) == RabbitConsumerLab.Result.STOP_UNACKED);
        }
        check(acks.size() == ackBefore);
        check(RabbitConsumerLab.handle(g,delivery(g,21,poison),service,capture,acks::add,System.currentTimeMillis())
                == RabbitConsumerLab.Result.ACKED);
        check(routes.getLast().equals("dead"));
        byte[] malformed={0,1,2};
        check(RabbitConsumerLab.handle(g,new RabbitConsumerLab.Delivery(g,22,"x","key",malformed),service,
                capture,acks::add,System.currentTimeMillis()) == RabbitConsumerLab.Result.ACKED);
        try(var in=new DataInputStream(new ByteArrayInputStream(sent.getLast()))) {
            check(in.readInt()==2); in.readUTF();check(in.readUTF().equals("malformed-schema"));
            in.readUTF();in.readUTF();in.readUTF();in.readLong();in.readLong();in.readUTF();
            in.readUTF();in.readUTF();in.readBoolean();in.readLong();
            int n=in.readInt();check(Arrays.equals(in.readNBytes(n),malformed));
        }
        var exhausted = new EventEnvelope("exhausted","transient",2,deadline);
        check(RabbitConsumerLab.handle(g,delivery(g,23,exhausted),e->RabbitConsumerLab.Effect.RETRYABLE,
                capture,acks::add,System.currentTimeMillis()) == RabbitConsumerLab.Result.ACKED);
        check(routes.getLast().equals("dead"));
        var expired = new EventEnvelope("expired","transient",0,1);
        check(RabbitConsumerLab.handle(g,delivery(g,24,expired),service,capture,acks::add,System.currentTimeMillis())
                == RabbitConsumerLab.Result.ACKED); check(routes.getLast().equals("dead"));
        // Identity conflict must not repeat the local effect.
        var conflict = new EventEnvelope("effect", "different", 0, deadline);
        check(RabbitConsumerLab.handle(g,delivery(g,25,conflict),service,capture,acks::add,System.currentTimeMillis())
                == RabbitConsumerLab.Result.ACKED); check(service.count() == 2 && routes.getLast().equals("dead"));
        int beforeException = acks.size();
        try { RabbitConsumerLab.handle(g,delivery(g,26,poison),service,
                (route,id,body)->{throw new IOException("handoff transport failure");},acks::add,System.currentTimeMillis());
            throw new AssertionError();
        } catch (IOException expected) { check(acks.size() == beforeException); }
        byte[] oversized = new byte[EventEnvelope.MAX_WIRE];
        check(RabbitConsumerLab.handle(g,new RabbitConsumerLab.Delivery(g,27,"x","key",oversized),service,
                capture,acks::add,System.currentTimeMillis()) == RabbitConsumerLab.Result.STOP_UNACKED);
        wire = new FakeWire();
        try (var pub = new RabbitPublisherLab(wire, 2)) {
            var t = pub.publish("work","uncorrelated-return",new byte[]{1},1000);
            wire.listener.returned(wire.generation,"not-a-live-attempt");
            check(t.outcome() == RabbitPublisherLab.Outcome.UNKNOWN && pub.inflight() == 0);
        }
        var setupFailed = new FakeWire(); setupFailed.failListen = true;
        try { new RabbitPublisherLab(setupFailed,2); throw new AssertionError(); }
        catch (IOException expected) { check(setupFailed.aborted); }
        var abortFailed = new FakeWire(); abortFailed.failAbort = true;
        var closing = new RabbitPublisherLab(abortFailed,2);
        var closingTicket = closing.publish("work","abort-failure",new byte[]{1},1000);
        try { closing.close(); throw new AssertionError(); }
        catch (IllegalStateException expected) { check(closingTicket.outcome() == RabbitPublisherLab.Outcome.UNKNOWN); }
        var owned = new FakeWire();
        try(var single = new RabbitPublisherLab(owned,2)) {
            var denied = new java.util.concurrent.atomic.AtomicBoolean();
            Thread other = new Thread(() -> {
                try { single.publish("work","other-thread",new byte[]{1},1000); }
                catch (IllegalStateException expected) { denied.set(true); }
            });
            other.start(); other.join(1000); check(!other.isAlive() && denied.get()); check(single.inflight()==0);
        }
        var declarations = new ArrayList<Object[]>();
        var channel = (com.rabbitmq.client.Channel) java.lang.reflect.Proxy.newProxyInstance(
                RabbitLabTest.class.getClassLoader(), new Class<?>[]{com.rabbitmq.client.Channel.class},
                (proxy,method,arguments) -> { declarations.add(arguments); return null; });
        RabbitTopology.declare(channel);
        check(declarations.size() == 5);
        check(declarations.get(1)[0].equals(RabbitTopology.DLQ));
        check(declarations.get(3)[0].equals(RabbitTopology.WORK));
        @SuppressWarnings("unchecked") var workArgs = (Map<String,Object>) declarations.get(3)[4];
        check(workArgs.get("x-dead-letter-strategy").equals("at-least-once"));
        check(workArgs.get("x-overflow").equals("reject-publish") && workArgs.get("x-delivery-limit").equals(5));
        // Interrupted cleanup must not replace a transport-abort failure.
        var interruptedAbort = new FakeWire(); interruptedAbort.failAbort = true;
        var interruptedPublisher = new RabbitPublisherLab(interruptedAbort, 1);
        RuntimeException closeFailure = null;
        boolean interruptPreserved;
        Thread.currentThread().interrupt();
        try { interruptedPublisher.close(); }
        catch (RuntimeException expected) { closeFailure = expected; }
        finally { interruptPreserved = Thread.interrupted(); } // clear this test's injected flag
        interruptedPublisher.close(); // now await actual timer termination without interruption
        check(closeFailure != null && closeFailure.getMessage().equals("abort failed") && interruptedAbort.aborted);
        // A timer already terminated before awaitTermination need not throw.
        // The interrupt flag must survive either legal branch; deterministic branch tests
        // in RabbitFailureTests separately hold a worker open to force interrupted waiting.
        check(closeFailure.getSuppressed().length == 0
                || (closeFailure.getSuppressed().length == 1
                && closeFailure.getSuppressed()[0].getCause() instanceof InterruptedException));
        check(interruptPreserved);
        long threadsAfter = Thread.getAllStackTraces().keySet().stream()
                .filter(t -> t.isAlive() && t.getName().startsWith("rabbit-")).count();
        check(threadsBefore == threadsAfter);
        System.out.println("PASS " + checks + " checks; local mock only; no broker, SQL or provider calls; timers stopped");
    }
}

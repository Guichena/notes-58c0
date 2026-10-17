import com.rabbitmq.client.Connection;
import java.lang.reflect.Proxy;
import java.util.UUID;

/** Bounded fault doubles: no sockets, credentials, broker or database. */
public final class RabbitFailureTests {
    static int checks;
    static void check(boolean ok) { checks++; if (!ok) throw new AssertionError("check " + checks); }
    static final class NoSuppression extends RuntimeException {
        private static final long serialVersionUID = 1L;
        NoSuppression() { super("primary", null, false, true); }
    }
    static final class Wire implements RabbitPublisherLab.Wire {
        Exception sendFailure; RuntimeException abortFailure; boolean aborted;
        public void listen(UUID generation, RabbitPublisherLab.Listener listener) { }
        public long nextSequence() { return 1; }
        public void send(String route, String id, String attempt, byte[] body) throws Exception { throw sendFailure; }
        public void abort() { aborted = true; if (abortFailure != null) throw abortFailure; }
    }
    static Connection connection(RuntimeException primary, RuntimeException cleanup) {
        return (Connection) Proxy.newProxyInstance(RabbitFailureTests.class.getClassLoader(),
                new Class<?>[]{Connection.class}, (proxy, method, args) -> {
                    if (method.getName().equals("createChannel")) throw primary;
                    if (method.getName().equals("abort")) throw cleanup;
                    throw new UnsupportedOperationException(method.getName());
                });
    }
    static java.util.concurrent.ScheduledThreadPoolExecutor timer(RabbitPublisherLab publisher)
            throws ReflectiveOperationException {
        java.lang.reflect.Field field = RabbitPublisherLab.class.getDeclaredField("watchdog");
        field.setAccessible(true);
        return (java.util.concurrent.ScheduledThreadPoolExecutor) field.get(publisher);
    }

    static void alreadyTerminated() throws Exception {
        Wire wire = new Wire();
        wire.abortFailure = new IllegalStateException("abort failed");
        RabbitPublisherLab publisher = new RabbitPublisherLab(wire, 1);
        try {
            var timer = timer(publisher);
            timer.shutdownNow();
            check(timer.awaitTermination(2, java.util.concurrent.TimeUnit.SECONDS));
            Thread.currentThread().interrupt();
            try {
                publisher.close();
                throw new AssertionError("close should preserve abort failure");
            } catch (RuntimeException actual) {
                check(actual == wire.abortFailure);
                check(actual.getSuppressed().length == 0);
                check(Thread.currentThread().isInterrupted());
            }
        } finally {
            Thread.interrupted();
            publisher.close();
        }
    }

    static void stillRunning() throws Exception {
        Wire wire = new Wire();
        wire.abortFailure = new IllegalStateException("abort failed");
        RabbitPublisherLab publisher = new RabbitPublisherLab(wire, 1);
        var started = new java.util.concurrent.CountDownLatch(1);
        var release = new java.util.concurrent.CountDownLatch(1);
        try {
            var timer = timer(publisher);
            timer.execute(() -> {
                started.countDown();
                while (release.getCount() > 0) {
                    try {
                        release.await();
                    } catch (InterruptedException ignored) {
                        // Keep the test worker alive until the outer cleanup releases it.
                    }
                }
            });
            check(started.await(2, java.util.concurrent.TimeUnit.SECONDS));
            Thread.currentThread().interrupt();
            try {
                publisher.close();
                throw new AssertionError("close should preserve abort failure");
            } catch (RuntimeException actual) {
                check(actual == wire.abortFailure);
                check(actual.getSuppressed().length == 1);
                check(actual.getSuppressed()[0].getCause() instanceof InterruptedException);
                check(Thread.currentThread().isInterrupted());
            }
        } finally {
            Thread.interrupted();
            release.countDown();
            publisher.close();
        }
    }

    public static void main(String[] args) throws Exception {
        alreadyTerminated();
        stillRunning();
        RuntimeException same = new IllegalStateException("same");
        try { new RealRabbitWire(connection(same, same)); throw new AssertionError(); }
        catch (RuntimeException actual) { check(actual == same && actual.getSuppressed().length == 0); }
        RuntimeException first = new IllegalStateException("first"), second = new IllegalStateException("second");
        try { new RealRabbitWire(connection(first, second)); throw new AssertionError(); }
        catch (RuntimeException actual) { check(actual == first && actual.getSuppressed()[0] == second); }
        NoSuppression disabled = new NoSuppression();
        try { new RealRabbitWire(connection(disabled, second)); throw new AssertionError(); }
        catch (RuntimeException actual) { check(actual == disabled && actual.getSuppressed().length == 0); }
        Wire invalid = new Wire(); invalid.abortFailure = second;
        try { new RabbitPublisherLab(invalid, 0); throw new AssertionError(); }
        catch (IllegalArgumentException actual) { check(invalid.aborted && actual.getSuppressed()[0] == second); }
        Wire interrupted = new Wire(); interrupted.sendFailure = new InterruptedException("send interrupted"); interrupted.abortFailure = second;
        RabbitPublisherLab publisher = new RabbitPublisherLab(interrupted, 1);
        try {
            var ticket = publisher.publish("work", "e", new byte[]{1}, 1000);
            check(ticket.outcome() == RabbitPublisherLab.Outcome.UNKNOWN);
            check(ticket.failure() == interrupted.sendFailure && ticket.failure().getSuppressed()[0] == second);
            check(Thread.interrupted());
        } finally { publisher.close(); }
        Wire aliased = new Wire(); aliased.sendFailure = same; aliased.abortFailure = same;
        try (var p = new RabbitPublisherLab(aliased, 1)) {
            var ticket = p.publish("work", "e", new byte[]{1}, 1000);
            check(ticket.failure() == same && same.getSuppressed().length == 0);
        }
        UUID generation = UUID.randomUUID();
        var delivery = new RabbitConsumerLab.Delivery(generation, 1, "x", "work",
                new EventEnvelope("e", "x", 0, 10).encode());
        boolean[] acked = {false};
        var result = RabbitConsumerLab.handle(generation, delivery,
                event -> { throw new InterruptedException("adapter interrupted"); },
                (route, id, body) -> { throw new AssertionError("must not hand off"); },
                tag -> acked[0] = true, 1);
        check(result == RabbitConsumerLab.Result.STOP_UNACKED && !acked[0] && Thread.interrupted());
        RabbitCleanup.after(same, () -> { throw same; }); check(same.getSuppressed().length == 0);
        RabbitCleanup.after(disabled, () -> { throw second; }); check(disabled.getSuppressed().length == 0);
        System.out.println("RabbitFailureTests OK: " + checks + "; fault doubles only");
    }
}

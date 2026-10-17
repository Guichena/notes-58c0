import com.rabbitmq.client.*;
import java.util.*;
import java.util.concurrent.*;

/** Local-only, fixed-deadline connection owner. Never use production credentials. */
public final class LabRuntime implements AutoCloseable {
    private final List<Connection> connections = new CopyOnWriteArrayList<>();
    private final ScheduledExecutorService deadline = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "rabbit-lab-wall-deadline"); t.setDaemon(true); return t;
    });
    private volatile boolean closed;
    public LabRuntime() { deadline.schedule(this::abortAll, 20, TimeUnit.SECONDS); }
    public static void requireLocalOptIn(String[] args) {
        if (args.length != 1 || !"--local-lab".equals(args[0]))
            throw new IllegalArgumentException("explicit --local-lab required; local disposable broker only");
    }
    public Connection connect() throws Exception {
        if (closed) throw new IllegalStateException("deadline/closed");
        var f = new ConnectionFactory();
        f.setHost("127.0.0.1"); f.setPort(5672);
        // Client defaults are usable only for a local disposable installation.
        // No credential is printed or persisted by this program.
        f.setAutomaticRecoveryEnabled(false); f.setTopologyRecoveryEnabled(false);
        f.setConnectionTimeout(2000); f.setHandshakeTimeout(2000);
        f.setChannelRpcTimeout(2000); f.setShutdownTimeout(1000);
        f.setRequestedHeartbeat(5); f.setMaxInboundMessageBodySize(EventEnvelope.MAX_WIRE);
        f.setThreadFactory(r -> { Thread t = new Thread(r, "rabbit-lab-client"); t.setDaemon(true); return t; });
        Connection c = f.newConnection("bounded-interview-lab");
        connections.add(c);
        if (closed) {
            var failure = new IllegalStateException("deadline during connection");
            RabbitCleanup.after(failure, () -> c.abort(500));
            throw failure;
        }
        return c;
    }
    private void abortAll() {
        closed = true;
        RuntimeException failure = null;
        for (Connection c : connections) {
            try { c.abort(500); }
            catch (RuntimeException next) {
                if (failure == null) failure = next; else RabbitCleanup.attach(failure, next);
            }
        }
        connections.clear();
        if (failure != null) throw failure;
    }
    @Override public void close() {
        Throwable primary = null;
        try { abortAll(); }
        catch (RuntimeException | Error failure) { primary = failure; throw failure; }
        finally {
            Throwable original = primary;
            RabbitCleanup.after(original, () -> {
                deadline.shutdownNow();
                try { if (!deadline.awaitTermination(2, TimeUnit.SECONDS)) throw new IllegalStateException("timer remains"); }
                catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new IllegalStateException(e); }
            });
        }
    }
}

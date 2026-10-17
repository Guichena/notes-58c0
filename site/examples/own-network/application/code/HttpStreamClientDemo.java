import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/** Java 21 loopback-only HTTP/SSE integration, not a production SDK.
 * Data is plain text in this small declared application protocol, not arbitrary JSON.
 * Request timeout bounds acquisition; a separate total-deadline watchdog closes the body.
 * No automatic retry, real credentials, external HTTP, or TLS configuration is involved.
 */
public final class HttpStreamClientDemo {
    sealed interface Message permits Text, Completed {}
    record Text(String value) implements Message {}
    record Completed(String result) implements Message {}
    record Result(List<Message> messages, int bytes) {}
    static final class StatusFailure extends IOException {
        final int status;
        StatusFailure(int status) { super("HTTP " + status); this.status = status; }
    }
    static final class ProtocolFailure extends RuntimeException {
        ProtocolFailure(String message) { super(message); }
    }

    static Result read(HttpClient client, ScheduledExecutorService timer,
                       URI uri, Duration budget, int maxBytes) throws Exception {
        if (!"http".equals(uri.getScheme()) || !"127.0.0.1".equals(uri.getHost())
                || uri.getUserInfo() != null || maxBytes < 1 || budget.isNegative() || budget.isZero())
            throw new IllegalArgumentException("loopback fixture and positive bounds required");
        var timedOut = new AtomicBoolean();
        var bodyRef = new AtomicReference<InputStream>();
        var watchdog = timer.schedule(() -> {
            timedOut.set(true);
            InputStream body = bodyRef.get();
            if (body != null) try { body.close(); } catch (IOException ignored) { }
        }, budget.toNanos(), TimeUnit.NANOSECONDS);
        try {
            var request = HttpRequest.newBuilder(uri).timeout(budget)
                    .header("Accept", "text/event-stream").GET().build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofInputStream());
            try (InputStream body = response.body()) {
                bodyRef.set(body);
                // Deadline could have won before the handle became available.
                if (timedOut.get()) { body.close(); throw new IOException("total deadline"); }
                if (response.statusCode() != 200) throw new StatusFailure(response.statusCode());
                String type = response.headers().firstValue("Content-Type").orElse("")
                        .split(";", 2)[0].strip().toLowerCase(Locale.ROOT);
                if (!type.equals("text/event-stream")) throw new ProtocolFailure("content type");
                List<Message> messages = new ArrayList<>();
                AtomicBoolean terminal = new AtomicBoolean();
                SseIncremental parser = new SseIncremental(256, 512, event -> {
                    if (terminal.get()) throw new ProtocolFailure("event after terminal");
                    switch (event.type()) {
                        case "delta" -> messages.add(new Text(event.data()));
                        case "done" -> { messages.add(new Completed(event.data())); terminal.set(true); }
                        case "error" -> throw new ProtocolFailure("remote business error: " + event.data());
                        default -> throw new ProtocolFailure("unknown event type");
                    }
                });
                byte[] chunk = new byte[7]; // Deliberately unrelated to event / UTF-8 boundaries.
                int total = 0;
                try {
                    for (int n; !terminal.get() && (n = body.read(chunk)) != -1;) {
                        if (timedOut.get()) throw new IOException("total deadline");
                        if (n > maxBytes - total) throw new ProtocolFailure("body limit");
                        total += n;
                        parser.feed(chunk, 0, n);
                    }
                } finally { parser.end(); }
                if (timedOut.get()) throw new IOException("total deadline");
                if (!terminal.get()) throw new ProtocolFailure("EOF without terminal");
                return new Result(List.copyOf(messages), total);
            }
        } finally {
            bodyRef.set(null);
            watchdog.cancel(false);
        }
    }
    static void serve(HttpExchange exchange) throws IOException {
        try (exchange) {
            String path = exchange.getRequestURI().getPath();
            if (path.equals("/status")) { exchange.sendResponseHeaders(503, -1); return; }
            if (path.equals("/redirect")) {
                exchange.getResponseHeaders().set("Location", "/stream");
                exchange.sendResponseHeaders(302, -1); return;
            }
            exchange.getResponseHeaders().set("Content-Type",
                    path.equals("/type") ? "application/json" : "text/event-stream; charset=utf-8");
            exchange.sendResponseHeaders(200, 0);
            if (path.equals("/hang")) {
                exchange.getResponseBody().write(": open\n\n".getBytes(StandardCharsets.UTF_8));
                exchange.getResponseBody().flush();
                try { Thread.sleep(1200); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                return;
            }
            String payload = switch (path) {
                case "/large" -> "event: delta\ndata: " + "a".repeat(200) + "\n\n";
                case "/incomplete" -> "event: delta\ndata: unfinished\n\n";
                case "/error" -> "event: error\ndata: failed\n\n";
                default -> "event: delta\ndata: 甲🙂\n\nevent: done\ndata: complete\n\n";
            };
            byte[] bytes = payload.getBytes(StandardCharsets.UTF_8);
            for (int i = 0; i < bytes.length; i += 3) {
                exchange.getResponseBody().write(bytes, i, Math.min(3, bytes.length - i));
                exchange.getResponseBody().flush();
            }
        } catch (IOException closedByClient) {
            // Early close from size, status, deadline or terminal is expected in these fixtures.
        }
    }
    interface Checked { void run() throws Exception; }
    static int checks;
    static void check(boolean ok) { if (!ok) throw new AssertionError(); checks++; }
    static void fails(Class<? extends Throwable> type, Checked action) throws Exception {
        try { action.run(); throw new AssertionError("expected " + type); }
        catch (Exception e) { if (!type.isInstance(e)) throw e; checks++; }
    }
    public static void main(String[] args) throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        var workers = Executors.newFixedThreadPool(2);
        var timer = Executors.newSingleThreadScheduledExecutor();
        server.setExecutor(workers); server.createContext("/", HttpStreamClientDemo::serve); server.start();
        URI root = URI.create("http://127.0.0.1:" + server.getAddress().getPort());
        try (HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(1))
                .followRedirects(HttpClient.Redirect.NEVER).version(HttpClient.Version.HTTP_1_1).build()) {
            Duration budget = Duration.ofSeconds(2);
            Result result = read(client, timer, root.resolve("/stream"), budget, 1024);
            check(result.messages().equals(List.of(new Text("甲🙂"), new Completed("complete"))));
            check(result.bytes() > 0 && result.bytes() <= 1024);
            fails(StatusFailure.class, () -> read(client, timer, root.resolve("/status"), budget, 1024));
            fails(StatusFailure.class, () -> read(client, timer, root.resolve("/redirect"), budget, 1024));
            fails(ProtocolFailure.class, () -> read(client, timer, root.resolve("/type"), budget, 1024));
            fails(ProtocolFailure.class, () -> read(client, timer, root.resolve("/large"), budget, 64));
            fails(ProtocolFailure.class, () -> read(client, timer, root.resolve("/incomplete"), budget, 1024));
            fails(ProtocolFailure.class, () -> read(client, timer, root.resolve("/error"), budget, 1024));
            fails(IOException.class, () -> read(client, timer, root.resolve("/hang"), Duration.ofMillis(300), 1024));
            fails(IllegalArgumentException.class, () -> read(client, timer,
                    URI.create("http://example.test/"), budget, 1024));
        } finally {
            server.stop(0); workers.shutdownNow(); timer.shutdownNow();
            workers.awaitTermination(3, TimeUnit.SECONDS); timer.awaitTermination(3, TimeUnit.SECONDS);
        }
        System.out.println("HttpStreamClientDemo: " + checks + " checks passed (loopback HTTP only)");
    }
}

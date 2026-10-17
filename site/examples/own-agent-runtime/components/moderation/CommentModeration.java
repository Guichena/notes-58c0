import java.io.*;
import java.nio.charset.*;
import java.nio.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;

/** A process-local teaching service. No network, model API, database or web authentication. */
public final class CommentModeration {
    public static final String POLICY = "demo-policy-v1";
    public enum State { PENDING, CLASSIFYING, HELD, PUBLISHED, REJECTED }
    public enum Role { AUTHOR, REVIEWER }
    public record Principal(String id, Role role) {
        public Principal { validId(id); Objects.requireNonNull(role); }
    }
    public record Input(String commentId, String authorId, String text) {
        public Input { validId(commentId); validId(authorId); validText(text, 2000); }
    }
    public record Classification(String label, String policyVersion) { }
    @FunctionalInterface public interface Classifier {
        Classification classify(String text) throws Exception;
    }
    public record Event(long version, State from, State to, String reason, String actor) { }
    public record View(String id, State state, long version, boolean visible,
                       String reason, List<Event> events) { }
    public record PublicComment(String id, String text) { }
    private record Review(String id, long expectedVersion, Principal actor, State decision) { }
    private record Receipt(Review request, View result) { }
    private static final class Entry {
        final Input input;
        State state = State.PENDING;
        long version;
        String reason = "SUBMITTED";
        final List<Event> events = new ArrayList<>();
        Entry(Input input) { this.input = input; }
        View view() { return new View(input.commentId(), state, version,
                state == State.PUBLISHED, reason, List.copyOf(events)); }
    }
    public static final class Service implements AutoCloseable {
        private final Map<String, Input> submissions = new HashMap<>();
        private final Map<String, Entry> entries = new TreeMap<>();
        private final Map<String, Receipt> reviews = new HashMap<>();
        private final Classifier classifier;
        private final ThreadPoolExecutor pool;
        private final long timeoutNanos;
        private boolean closed;
        public Service(Classifier classifier, Duration timeout, int workers, int queueCapacity) {
            this.classifier = Objects.requireNonNull(classifier);
            Objects.requireNonNull(timeout);
            if (timeout.isZero() || timeout.isNegative() || timeout.compareTo(Duration.ofSeconds(30)) > 0
                    || workers < 1 || workers > 8 || queueCapacity < 1 || queueCapacity > 100)
                throw new IllegalArgumentException("CONFIG");
            timeoutNanos = timeout.toNanos();
            pool = new ThreadPoolExecutor(workers, workers, 0, TimeUnit.SECONDS,
                    new ArrayBlockingQueue<>(queueCapacity), r -> {
                        Thread t = new Thread(r, "fixture-classifier");
                        t.setDaemon(true); // An uncooperative adapter cannot keep this demo JVM alive.
                        return t;
                    }, new ThreadPoolExecutor.AbortPolicy());
        }
        public synchronized View submit(String requestKey, Principal actor, Input input) {
            open(); validId(requestKey); Objects.requireNonNull(actor); Objects.requireNonNull(input);
            if (!actor.id().equals(input.authorId())) throw new SecurityException("AUTHOR_MISMATCH");
            Input old = submissions.get(requestKey);
            if (old != null) {
                if (!old.equals(input)) throw new IllegalStateException("IDEMPOTENCY_CONFLICT");
                return entries.get(old.commentId()).view();
            }
            if (entries.containsKey(input.commentId())) throw new IllegalStateException("COMMENT_EXISTS");
            if (entries.size() >= 10000) throw new IllegalStateException("CAPACITY");
            Entry entry = new Entry(input);
            entries.put(input.commentId(), entry); submissions.put(requestKey, input);
            return entry.view();
        }
        public View process(String id) {
            final Entry entry; final long claimVersion;
            synchronized (this) {
                open(); entry = require(id);
                if (entry.state != State.PENDING) return entry.view();
                move(entry, State.CLASSIFYING, "CLAIMED", "system"); claimVersion = entry.version;
            }
            State decision = State.HELD; String reason = "MODEL_ERROR";
            Future<Classification> future = null;
            long start = System.nanoTime();
            try {
                if (Thread.currentThread().isInterrupted()) throw new InterruptedException();
                future = pool.submit(() -> classifier.classify(entry.input.text()));
                long remaining = timeoutNanos - (System.nanoTime() - start);
                if (remaining <= 0) throw new TimeoutException();
                Classification result = future.get(remaining, TimeUnit.NANOSECONDS);
                // Deadline is a commit constraint as well as a wait timeout.
                if (System.nanoTime() - start >= timeoutNanos) throw new TimeoutException();
                if (result == null || !POLICY.equals(result.policyVersion())) reason = "INVALID_RESULT";
                else if ("ALLOW".equals(result.label())) { decision = State.PUBLISHED; reason = "MODEL_ALLOW"; }
                else if ("BLOCK".equals(result.label())) { decision = State.REJECTED; reason = "MODEL_BLOCK"; }
                else if ("UNKNOWN".equals(result.label())) reason = "MODEL_UNKNOWN";
                else reason = "INVALID_RESULT";
            } catch (RejectedExecutionException e) { reason = "OVERLOADED"; }
              catch (TimeoutException e) { reason = "TIMEOUT"; }
              catch (InterruptedException e) { reason = "INTERRUPTED"; Thread.currentThread().interrupt(); }
              catch (ExecutionException | CancellationException e) { reason = "MODEL_ERROR"; }
            finally {
                if (future != null && !future.isDone()) {
                    future.cancel(true);
                    if (future instanceof Runnable task) pool.remove(task);
                }
            }
            synchronized (this) {
                if (entry.state == State.CLASSIFYING && entry.version == claimVersion) {
                    if (Thread.currentThread().isInterrupted()) { decision = State.HELD; reason = "INTERRUPTED"; }
                    else if (decision != State.HELD && System.nanoTime() - start >= timeoutNanos) {
                        decision = State.HELD; reason = "TIMEOUT";
                    }
                    move(entry, decision, reason, "system");
                }
                return entry.view();
            }
        }
        public synchronized View review(String reviewKey, String id, long expectedVersion,
                                        Principal actor, State decision) {
            open(); validId(reviewKey); Objects.requireNonNull(actor);
            if (actor.role() != Role.REVIEWER) throw new SecurityException("REVIEWER_REQUIRED");
            if (decision != State.PUBLISHED && decision != State.REJECTED)
                throw new IllegalArgumentException("REVIEW_DECISION");
            Review request = new Review(id, expectedVersion, actor, decision);
            Receipt old = reviews.get(reviewKey);
            if (old != null) {
                if (!old.request().equals(request)) throw new IllegalStateException("IDEMPOTENCY_CONFLICT");
                return old.result();
            }
            Entry e = require(id);
            if (e.state != State.HELD || e.version != expectedVersion)
                throw new IllegalStateException("STATE_OR_VERSION_CONFLICT");
            move(e, decision, "MANUAL_" + decision, actor.id());
            View result = e.view(); reviews.put(reviewKey, new Receipt(request, result));
            return result;
        }
        public int queuedRequests() { return pool.getQueue().size(); }
        public synchronized View get(String id) { return require(id).view(); }
        public synchronized List<PublicComment> publicComments() {
            return entries.values().stream().filter(e -> e.state == State.PUBLISHED)
                    .map(e -> new PublicComment(e.input.commentId(), e.input.text())).toList();
        }
        private Entry require(String id) {
            validId(id); Entry e = entries.get(id);
            if (e == null) throw new IllegalArgumentException("NOT_FOUND"); return e;
        }
        private void open() { if (closed) throw new IllegalStateException("CLOSED"); }
        private void move(Entry e, State to, String reason, String actor) {
            boolean legal = switch (e.state) {
                case PENDING -> to == State.CLASSIFYING;
                case CLASSIFYING -> to == State.PUBLISHED || to == State.REJECTED || to == State.HELD;
                case HELD -> to == State.PUBLISHED || to == State.REJECTED;
                default -> false;
            };
            if (!legal) throw new IllegalStateException("ILLEGAL_TRANSITION");
            Event event = new Event(++e.version, e.state, to, reason, actor);
            e.state = to; e.reason = reason; e.events.add(event);
        }
        @Override public synchronized void close() {
            if (closed) return;
            closed = true;
            for (Entry e : entries.values())
                if (e.state == State.CLASSIFYING) move(e, State.HELD, "SERVICE_CLOSED", "system");
            // Drain queued tasks and wake callers waiting on their futures.
            for (Runnable r : pool.shutdownNow()) if (r instanceof Future<?> f) f.cancel(true);
        }
    }
    public static Classifier fixtureClassifier() {
        // Exact fixtures, NOT keyword moderation or an accuracy evaluation.
        return text -> switch (text) {
            case "fixture-safe" -> new Classification("ALLOW", POLICY);
            case "fixture-violation" -> new Classification("BLOCK", POLICY);
            default -> new Classification("UNKNOWN", POLICY);
        };
    }
    static void validId(String s) {
        if (s == null || !s.matches("[A-Za-z0-9_-]{1,64}")) throw new IllegalArgumentException("ID");
    }
    static void validText(String s, int max) {
        if (s == null || s.isBlank() || s.codePointCount(0, s.length()) > max)
            throw new IllegalArgumentException("TEXT");
        for (int i = 0; i < s.length(); ) {
            int cp = s.codePointAt(i);
            if (Character.isISOControl(cp) || Character.getType(cp) == Character.FORMAT
                    || Character.getType(cp) == Character.LINE_SEPARATOR
                    || Character.getType(cp) == Character.PARAGRAPH_SEPARATOR
                    || cp >= 0xD800 && cp <= 0xDFFF) throw new IllegalArgumentException("TEXT_CONTROL");
            i += Character.charCount(cp);
        }
    }
    static String result(View v) {
        return "RESULT\t" + v.id() + "\t" + v.state() + "\t" + v.version() + "\t" + v.visible() + "\t" + v.reason();
    }
    public static void run(InputStream input, PrintStream out) throws Exception {
        byte[] bytes = input.readNBytes(1_048_577);
        if (bytes.length > 1_048_576) throw new IllegalArgumentException("INPUT_LIMIT");
        String text = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(bytes)).toString();
        List<String> commands = new ArrayList<>();
        for (String rawLine : text.split("\n", -1)) {
            String line = rawLine.endsWith("\r") ? rawLine.substring(0, rawLine.length() - 1) : rawLine;
            if (!line.isEmpty()) commands.add(line);
            if (commands.size() > 20000) throw new IllegalArgumentException("COMMAND_LIMIT");
        }
        try (Service service = new Service(fixtureClassifier(), Duration.ofSeconds(1), 2, 8)) {
            int count = 0;
            for (String line : commands) {
                count++;
                String[] p = line.split("\t", -1);
                try {
                    View v = switch (p[0]) {
                        case "SUBMIT" -> {
                            arity(p, 5); yield service.submit(p[1], new Principal(p[3], Role.AUTHOR), new Input(p[2], p[3], p[4]));
                        }
                        case "PROCESS" -> { arity(p, 2); yield service.process(p[1]); }
                        case "GET" -> { arity(p, 2); yield service.get(p[1]); }
                        case "REVIEW" -> {
                            arity(p, 5); yield service.review(p[1], p[2], Long.parseLong(p[3]),
                                    new Principal("demo-reviewer", Role.REVIEWER), State.valueOf(p[4]));
                        }
                        default -> throw new IllegalArgumentException("COMMAND");
                    };
                    out.println(result(v));
                } catch (IllegalArgumentException | IllegalStateException | SecurityException e) {
                    out.println("ERROR\t" + count + "\t" + e.getClass().getSimpleName());
                }
            }
        }
    }
    static void arity(String[] p, int n) { if (p.length != n) throw new IllegalArgumentException("ARITY"); }
    public static void main(String[] args) {
        if (args.length != 0) { System.err.println("Usage: CommentModeration < commands.tsv"); System.exit(2); }
        try { run(System.in, System.out); }
        catch (Exception e) { System.err.println("ERROR: invalid input or I/O failure"); System.exit(2); }
    }
}

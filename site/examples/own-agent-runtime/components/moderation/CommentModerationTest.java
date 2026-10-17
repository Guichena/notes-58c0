import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import java.util.function.BooleanSupplier;

public final class CommentModerationTest {
    private static int checks;
    static void check(boolean condition, String name) { checks++; if (!condition) throw new AssertionError(name); }
    static void throwsType(Class<? extends Throwable> type, Runnable r) {
        checks++;
        try { r.run(); } catch (Throwable t) { if (type.isInstance(t)) return; throw new AssertionError(t); }
        throw new AssertionError("Expected " + type.getSimpleName());
    }
    static CommentModeration.Principal author() { return new CommentModeration.Principal("alice", CommentModeration.Role.AUTHOR); }
    static CommentModeration.Principal reviewer() { return new CommentModeration.Principal("reviewer", CommentModeration.Role.REVIEWER); }
    static CommentModeration.Input input(String id, String text) { return new CommentModeration.Input(id, "alice", text); }
    static CommentModeration.Service service(CommentModeration.Classifier c, long millis) {
        return new CommentModeration.Service(c, Duration.ofMillis(millis), 1, 1);
    }
    static void await(BooleanSupplier p) throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(3);
        while (!p.getAsBoolean()) {
            if (System.nanoTime() > deadline) throw new AssertionError("wait deadline");
            Thread.sleep(1);
        }
    }
    static void signal(CountDownLatch latch) throws InterruptedException {
        if (!latch.await(3, TimeUnit.SECONDS)) throw new AssertionError("latch deadline");
    }
    static void basic() {
        try (var s = service(CommentModeration.fixtureClassifier(), 1000)) {
            var pending = s.submit("r1", author(), input("c1", "fixture-safe"));
            check(pending.state() == CommentModeration.State.PENDING && !pending.visible(), "submit hidden");
            var allowed = s.process("c1");
            check(allowed.state() == CommentModeration.State.PUBLISHED && allowed.version() == 2 && allowed.visible(), "allow");
            check(s.process("c1").equals(allowed), "process idempotent");
            check(s.submit("r1", author(), input("c1", "fixture-safe")).equals(allowed), "submit returns current view");
            check(!pending.visible() && pending.events().isEmpty(), "snapshot immutable");
            throwsType(UnsupportedOperationException.class, () -> allowed.events().clear());
            throwsType(IllegalStateException.class, () -> s.submit("r1", author(), input("c1", "changed")));
            throwsType(IllegalStateException.class, () -> s.submit("r2", author(), input("c1", "fixture-safe")));
            throwsType(SecurityException.class, () -> s.submit("r2", reviewer(), input("c2", "x")));
            s.submit("r2", author(), input("c2", "fixture-violation"));
            check(s.process("c2").state() == CommentModeration.State.REJECTED, "block");
            s.submit("r3", author(), input("c3", "待人工确认的普通示例"));
            var held = s.process("c3");
            check(held.state() == CommentModeration.State.HELD && !held.visible(), "unknown hold");
            check(s.publicComments().size() == 1 && s.publicComments().getFirst().id().equals("c1"), "public filter");
            throwsType(SecurityException.class, () -> s.review("v1", "c3", 2, author(), CommentModeration.State.PUBLISHED));
            throwsType(IllegalArgumentException.class, () -> s.review("v1", "c3", 2, reviewer(), CommentModeration.State.PENDING));
            throwsType(IllegalStateException.class, () -> s.review("v1", "c3", 1, reviewer(), CommentModeration.State.PUBLISHED));
            var reviewed = s.review("v1", "c3", 2, reviewer(), CommentModeration.State.PUBLISHED);
            check(reviewed.version() == 3 && reviewed.visible(), "manual publish");
            check(s.review("v1", "c3", 2, reviewer(), CommentModeration.State.PUBLISHED).equals(reviewed), "review replay");
            throwsType(SecurityException.class, () -> s.review("v1", "c3", 2, author(), CommentModeration.State.PUBLISHED));
            throwsType(IllegalStateException.class, () -> s.review("v1", "c3", 2, reviewer(), CommentModeration.State.REJECTED));
            throwsType(IllegalStateException.class, () -> s.review("v2", "c3", 3, reviewer(), CommentModeration.State.REJECTED));
            check(reviewed.events().getLast().actor().equals("reviewer"), "audit actor");
            throwsType(IllegalArgumentException.class, () -> input("x", "\u202Ehidden"));
            throwsType(IllegalArgumentException.class, () -> input("x", "\uD800"));
            throwsType(IllegalArgumentException.class, () -> input("x", " "));
            throwsType(IllegalArgumentException.class, () -> input("x", "a".repeat(2001)));
            throwsType(IllegalArgumentException.class, () -> s.get("missing"));
        }
    }
    static void badModels() {
        List<CommentModeration.Classifier> models = List.of(
                t -> null, t -> new CommentModeration.Classification("ALLOW", "wrong-policy"),
                t -> new CommentModeration.Classification("ALLOW_AND_DELETE", CommentModeration.POLICY),
                t -> { throw new IOException("sensitive exception text must not escape"); });
        for (var model : models) try (var s = service(model, 1000)) {
            s.submit("r", author(), input("c", "x")); var v = s.process("c");
            check(v.state() == CommentModeration.State.HELD && !v.visible(), "invalid or failed model holds");
            check(!CommentModeration.result(v).contains("sensitive"), "error sanitized");
            check(s.review("v", "c", v.version(), reviewer(), CommentModeration.State.REJECTED).state()
                    == CommentModeration.State.REJECTED, "manual reject");
        }
    }
    static void concurrency() throws Exception {
        AtomicInteger calls = new AtomicInteger(); CountDownLatch entered = new CountDownLatch(1), release = new CountDownLatch(1);
        try (var s = service(t -> { calls.incrementAndGet(); entered.countDown(); release.await();
                return new CommentModeration.Classification("ALLOW", CommentModeration.POLICY); }, 2000);
             var callers = Executors.newFixedThreadPool(8)) {
            List<Callable<CommentModeration.View>> tasks = new ArrayList<>();
            for (int i = 0; i < 100; i++) tasks.add(() -> s.submit("r", author(), input("c", "x")));
            for (var f : callers.invokeAll(tasks)) check(f.get().id().equals("c"), "concurrent same submission");
            var first = callers.submit(() -> s.process("c")); signal(entered);
            check(s.process("c").state() == CommentModeration.State.CLASSIFYING, "second claim observes in flight");
            release.countDown(); check(first.get().state() == CommentModeration.State.PUBLISHED, "first commits");
            check(calls.get() == 1, "one model invocation");
        } finally { release.countDown(); }
    }
    static void competingReviews() throws Exception {
        try (var s = service(CommentModeration.fixtureClassifier(), 1000);
             var callers = Executors.newFixedThreadPool(2)) {
            s.submit("r", author(), input("c", "unknown")); s.process("c");
            CountDownLatch start = new CountDownLatch(1); AtomicInteger successes = new AtomicInteger();
            List<Future<?>> futures = new ArrayList<>();
            for (int i = 0; i < 2; i++) {
                final int n = i;
                futures.add(callers.submit(() -> {
                    try {
                        start.await();
                        s.review("review" + n, "c", 2, reviewer(), n == 0
                                ? CommentModeration.State.PUBLISHED : CommentModeration.State.REJECTED);
                        successes.incrementAndGet();
                    } catch (IllegalStateException expected) { }
                      catch (InterruptedException e) { throw new AssertionError(e); }
                }));
            }
            start.countDown(); for (var f : futures) f.get(3, TimeUnit.SECONDS);
            check(successes.get() == 1, "only one concurrent reviewer commits");
            check(s.get("c").version() == 3 && s.get("c").events().size() == 3, "one final review event");
        }
    }
    static void timeoutAndLateResult() throws Exception {
        CountDownLatch release = new CountDownLatch(1), done = new CountDownLatch(1);
        try (var s = service(t -> {
            boolean stop = false;
            while (!stop) try { release.await(); stop = true; } catch (InterruptedException ignored) { }
            done.countDown(); return new CommentModeration.Classification("BLOCK", CommentModeration.POLICY);
        }, 40)) {
            s.submit("r", author(), input("c", "x")); var v = s.process("c");
            check(v.state() == CommentModeration.State.HELD && v.reason().equals("TIMEOUT"), "real wait timeout");
            var manual = s.review("v", "c", v.version(), reviewer(), CommentModeration.State.PUBLISHED);
            release.countDown(); signal(done);
            check(s.get("c").equals(manual), "late result cannot overwrite review");
        } finally { release.countDown(); }
    }
    static void overloadAndClose() throws Exception {
        CountDownLatch entered = new CountDownLatch(1), release = new CountDownLatch(1);
        try (var s = service(t -> { entered.countDown(); release.await();
                return new CommentModeration.Classification("ALLOW", CommentModeration.POLICY); }, 2000);
             var callers = Executors.newFixedThreadPool(2)) {
            for (int i = 1; i <= 3; i++) s.submit("r" + i, author(), input("c" + i, "x"));
            var first = callers.submit(() -> s.process("c1")); signal(entered);
            var second = callers.submit(() -> s.process("c2")); await(() -> s.queuedRequests() == 1);
            var overloaded = s.process("c3");
            check(overloaded.state() == CommentModeration.State.HELD && overloaded.reason().equals("OVERLOADED"), "bounded queue overload");
            s.close(); release.countDown(); first.get(3, TimeUnit.SECONDS); second.get(3, TimeUnit.SECONDS);
            check(s.get("c1").reason().equals("SERVICE_CLOSED") && s.get("c2").reason().equals("SERVICE_CLOSED"), "close holds in flight");
            check(s.publicComments().isEmpty(), "close no late publishing");
            throwsType(IllegalStateException.class, () -> s.process("c1"));
        } finally { release.countDown(); }
    }
    static void interruption() throws Exception {
        CountDownLatch entered = new CountDownLatch(1), release = new CountDownLatch(1);
        AtomicReference<CommentModeration.View> result = new AtomicReference<>(); AtomicBoolean interrupted = new AtomicBoolean();
        try (var s = service(t -> { entered.countDown(); release.await();
                return new CommentModeration.Classification("ALLOW", CommentModeration.POLICY); }, 2000)) {
            s.submit("r", author(), input("c", "x"));
            Thread caller = new Thread(() -> { result.set(s.process("c")); interrupted.set(Thread.currentThread().isInterrupted()); });
            caller.start(); signal(entered); caller.interrupt(); caller.join(3000);
            check(!caller.isAlive() && interrupted.get(), "interrupt flag restored");
            check(result.get().state() == CommentModeration.State.HELD && result.get().reason().equals("INTERRUPTED"), "interrupt hold");
        } finally { release.countDown(); }
    }
    static void cli() throws Exception {
        String commands = "SUBMIT\tr1\tc1\talice\tfixture-safe\nPROCESS\tc1\nGET\tc1\nREVIEW\tv1\tc1\t2\tREJECTED\n";
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        CommentModeration.run(new ByteArrayInputStream(commands.getBytes(StandardCharsets.UTF_8)), new PrintStream(bytes, true, StandardCharsets.UTF_8));
        String out = bytes.toString(StandardCharsets.UTF_8);
        check(out.contains("RESULT\tc1\tPENDING\t0\tfalse\tSUBMITTED"), "CLI submit");
        check(out.contains("RESULT\tc1\tPUBLISHED\t2\ttrue\tMODEL_ALLOW"), "CLI process");
        check(out.contains("ERROR\t4\tIllegalStateException"), "CLI illegal terminal review");
    }
    public static void main(String[] args) throws Exception {
        basic(); badModels(); concurrency(); competingReviews(); timeoutAndLateResult(); overloadAndClose(); interruption(); cli();
        System.out.println("PASS CommentModerationTest checks=" + checks);
    }
}

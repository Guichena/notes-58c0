import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.atomic.*;

/** No scanner installation, network access, repository script or hook is needed. */
public final class ValidatorTest {
    static int checks;
    static void check(boolean ok, String name) {
        if (!ok) throw new AssertionError(name);
        checks++;
    }
    static String xml(String body) {
        return "<pmd xmlns=\"" + Validator.NS + "\" version=\"7.28.0\">" + body + "</pmd>";
    }
    static Validator.Exec exec(int code, String body) {
        return new Validator.Exec(code, xml(body).getBytes(StandardCharsets.UTF_8), null);
    }
    static String violation(String file, String rule) {
        return "<file name=\"" + file + "\"><violation beginline=\"2\" rule=\"" + rule
            + "\">message intentionally omitted from public report</violation></file>";
    }
    static Validator.Module module(String id, Validator.State state) {
        return new Validator.Module() {
            public String id() { return id; }
            public Validator.Result check(Validator.Snapshot s, AtomicBoolean c) {
                return new Validator.Result(id, state, "FIXTURE", List.of());
            }
        };
    }
    static List<String> fixture(String mode, String extra) {
        String java = Path.of(System.getProperty("java.home"), "bin", "java").toString();
        String cp = Path.of("build").toAbsolutePath().toString();
        return List.of(java, "-Xmx64m", "-cp", cp, "ValidatorTest$Fixture", mode, extra);
    }
    static void expectBadInput(Path input, Path temp, String name) throws Exception {
        boolean rejected = false;
        try (var ignored = new Validator.Snapshot(input, temp)) { /* should throw */ }
        catch (Exception expected) { rejected = true; }
        check(rejected, name);
    }
    public static void main(String[] args) throws Exception {
        Path temp = Files.createTempDirectory("validator-tests-");
        try {
            Path input = Files.createDirectory(temp.resolve("input"));
            Files.writeString(input.resolve("Good.java"), "class Good {}\n");
            Path home;
            try (var s = new Validator.Snapshot(input, temp)) {
                home = s.home;
                var noCancel = new AtomicBoolean();
                var pass = List.of(module("style", Validator.State.PASS), module("security", Validator.State.PASS));
                var report = Validator.validate(s, pass, noCancel);
                check(report.exitCode() == 0, "all required pass");
                check(report.text().equals(Validator.validate(s, List.of(pass.get(1), pass.get(0)), noCancel).text()), "deterministic module order");
                check(Validator.validate(s, List.of(module("style", Validator.State.FAIL), pass.get(1)), noCancel).exitCode() == 1, "style fail");
                check(Validator.validate(s, List.of(pass.get(0), module("security", Validator.State.FAIL)), noCancel).exitCode() == 1, "security fail");
                check(Validator.validate(s, List.of(module("style", Validator.State.FAIL), module("security", Validator.State.ERROR)), noCancel).exitCode() == 2, "error dominates findings");
                check(Validator.validate(s, List.of(), noCancel).exitCode() == 2, "empty registry");
                check(Validator.validate(s, List.of(pass.get(0), pass.get(0)), noCancel).exitCode() == 2, "duplicate registry");
                check(Validator.validate(s, pass, new AtomicBoolean(true)).exitCode() == 2, "coordinator cancel");
                Validator.Module throwsError = new Validator.Module() {
                    public String id() { return "security"; }
                    public Validator.Result check(Validator.Snapshot ignored, AtomicBoolean c) { throw new IllegalStateException(); }
                };
                check(Validator.validate(s, List.of(throwsError), noCancel).exitCode() == 2, "module exception");
                Validator.Module malformed = new Validator.Module() {
                    public String id() { return "bad"; }
                    public Validator.Result check(Validator.Snapshot ignored, AtomicBoolean c) {
                        return new Validator.Result(id(), null, "BAD", List.of());
                    }
                };
                check(Validator.validate(s, List.of(malformed), noCancel).exitCode() == 2, "null result state");
                Validator.Module lastCancel = new Validator.Module() {
                    public String id() { return "cancel"; }
                    public Validator.Result check(Validator.Snapshot ignored, AtomicBoolean c) {
                        c.set(true); return new Validator.Result(id(), Validator.State.PASS, "LATE", List.of());
                    }
                };
                check(Validator.validate(s, List.of(lastCancel), new AtomicBoolean()).exitCode() == 2, "late cancellation cannot pass");
                for (int badField = 0; badField < 4; badField++) {
                    boolean rejected = false;
                    try {
                        new Validator.Result("test", Validator.State.PASS, badField == 0 ? null : "OK",
                            badField == 1 ? null : badField == 2 ? Arrays.asList((String) null)
                            : badField == 3 ? List.of("injected\nline") : List.of());
                    } catch (RuntimeException expected) { rejected = true; }
                    check(rejected, "malformed result contract");
                }
                check(Validator.parsePmd("style", exec(0, ""), s).state() == Validator.State.PASS, "valid clean PMD report");
                String finding = violation("Good.java", "ControlStatementBraces");
                check(Validator.parsePmd("style", exec(4, finding), s).state() == Validator.State.FAIL, "PMD exit4 finding");
                check(Validator.parsePmd("security", exec(5, ""), s).state() == Validator.State.ERROR, "PMD recoverable error");
                check(Validator.parsePmd("style", exec(4, ""), s).reason().equals("EXIT_REPORT_MISMATCH"), "empty exit4");
                check(Validator.parsePmd("style", exec(0, finding), s).state() == Validator.State.ERROR, "finding exit0 mismatch");
                check(Validator.parsePmd("style", exec(0, "<configerror/>"), s).state() == Validator.State.ERROR, "configuration error");
                check(Validator.parsePmd("style", exec(0, "<error/>"), s).state() == Validator.State.ERROR, "parser error");
                check(Validator.parsePmd("style", exec(0, "<suppressedviolation filename=\"Good.java\"/>"), s).state() == Validator.State.FAIL, "suppression cannot bypass");
                for (String broken : List.of("", "<pmd>", xml("").replace("7.28.0", "7.29.0"),
                        xml("<unknown/>"), xml(finding).replace(Validator.NS, "https://invalid.example"),
                        "<!DOCTYPE pmd [<!ENTITY x SYSTEM 'file:///not-read'>]>" + xml("&x;"))) {
                    check(Validator.parsePmd("style", new Validator.Exec(0, broken.getBytes(StandardCharsets.UTF_8), null), s).state()
                        == Validator.State.ERROR, "invalid/foreign/entity/version report");
                }
                for (String path : List.of("../outside.java", "/outside.java", "Missing.java")) {
                    check(Validator.parsePmd("style", exec(4, violation(path, "Rule")), s).state() == Validator.State.ERROR, "report path isolation");
                }
                Files.writeString(input.resolve("Good.java"), "class Changed {}\n");
                check(s.unchanged(), "input edits cannot alter copied snapshot");
                // Exercise the complete module adapter with a trusted child process producing fixture XML.
                Path rules = temp.resolve("trusted.xml"); Files.writeString(rules, "<ruleset/>\n");
                String payload = Base64.getEncoder().encodeToString(xml(finding).getBytes(StandardCharsets.UTF_8));
                var realRunner = new Validator.ProcessRunner();
                Validator.Module adapter = new Validator.PmdModule("style", fixture("xml4", payload), rules, realRunner);
                var adapterResult = Validator.validate(s, List.of(adapter), noCancel);
                check(adapterResult.exitCode() == 1 && adapterResult.text().contains("policy="), "process to adapter to coordinator");
                Path missing = temp.resolve("missing.xml");
                var missingModule = new Validator.PmdModule("security", fixture("ok", ""), missing, realRunner);
                check(Validator.validate(s, List.of(missingModule), noCancel).exitCode() == 2, "missing required policy");
                Files.writeString(s.source.resolve("Good.java"), "class Tampered {}\n");
                check(Validator.validate(s, pass, noCancel).modules().stream().allMatch(r -> r.reason().equals("SNAPSHOT_CHANGED")), "snapshot tampering");
            }
            check(!Files.exists(home), "snapshot cleaned");
            Path empty = Files.createDirectory(temp.resolve("empty")); expectBadInput(empty, temp, "empty source set");
            Path bad = Files.createDirectory(temp.resolve("bad")); Path badFile = bad.resolve("Bad.java");
            Files.write(badFile, new byte[]{(byte) 0xFF}); expectBadInput(bad, temp, "invalid UTF8");
            Files.write(badFile, new byte[Validator.FILE_LIMIT + 1]); expectBadInput(bad, temp, "large source");
            Files.delete(badFile); Files.createSymbolicLink(badFile, input.resolve("Good.java"));
            expectBadInput(bad, temp, "symlink file"); Files.delete(badFile);
            Files.createSymbolicLink(bad.resolve("linked"), input); expectBadInput(bad, temp, "symlink directory");
            Files.delete(bad.resolve("linked"));
            for (int i = 0; i < 257; i++) Files.writeString(bad.resolve("F" + i + ".java"), "class F" + i + " {}\n");
            expectBadInput(bad, temp, "too many Java files");
            var runner = new Validator.ProcessRunner();
            check(runner.run(fixture("ok", ""), temp, Duration.ofSeconds(3), 4096, new AtomicBoolean()).code() == 0, "clean process exit");
            check(runner.run(List.of(temp.resolve("absent-program").toString()), temp, Duration.ofSeconds(1), 4096, new AtomicBoolean()).error()
                .equals("START_OR_IO_ERROR"), "missing required scanner");
            check(runner.run(fixture("sleep", ""), temp, Duration.ofMillis(200), 4096, new AtomicBoolean()).error().equals("TIMEOUT"), "timeout");
            for (String mode : List.of("flood", "stderr")) {
                check(runner.run(fixture(mode, ""), temp, Duration.ofSeconds(3), 4096, new AtomicBoolean()).error().equals("OUTPUT_LIMIT"), "bounded output " + mode);
            }
            for (boolean interrupt : List.of(false, true)) {
                Path marker = temp.resolve("pid-" + interrupt);
                AtomicBoolean cancel = new AtomicBoolean(), restored = new AtomicBoolean();
                AtomicReference<Validator.Exec> result = new AtomicReference<>();
                Thread worker = new Thread(() -> {
                    result.set(runner.run(fixture("ready", marker.toString()), temp, Duration.ofSeconds(10), 4096, cancel));
                    restored.set(Thread.currentThread().isInterrupted());
                });
                worker.start();
                long deadline = System.nanoTime() + Duration.ofSeconds(5).toNanos();
                while (!Files.exists(marker) && System.nanoTime() < deadline) Thread.sleep(10);
                check(Files.exists(marker), "fixture started");
                // Marker is created with a single short write; wait until its PID is readable.
                String pidText = "";
                while (pidText.isEmpty() && System.nanoTime() < deadline) { pidText = Files.readString(marker); Thread.sleep(5); }
                long pid = Long.parseLong(pidText);
                if (interrupt) worker.interrupt(); else cancel.set(true);
                worker.join(5000);
                check(!worker.isAlive() && result.get().error().equals("CANCELLED"), "cancellation result");
                check(!ProcessHandle.of(pid).map(ProcessHandle::isAlive).orElse(false), "cancelled child reaped");
                check(restored.get() == interrupt, "interrupt flag restored");
            }
            check(Thread.getAllStackTraces().keySet().stream().noneMatch(t -> t.isAlive() && t.getName().startsWith("validator-pump-")), "no pump thread leak");
            System.out.println("PASS " + checks + " checks; fixtures only, PMD not executed");
        } finally { Validator.deleteTree(temp); }
    }
    /** Complete trusted process fixture; not a style/security engine. */
    public static final class Fixture {
        public static void main(String[] args) throws Exception {
            switch (args[0]) {
                case "ok" -> System.out.print("ok");
                case "xml4" -> { System.out.write(Base64.getDecoder().decode(args[1])); System.exit(4); }
                case "sleep" -> Thread.sleep(30_000);
                case "ready" -> {
                    Files.writeString(Path.of(args[1]), Long.toString(ProcessHandle.current().pid()));
                    Thread.sleep(30_000);
                }
                case "flood", "stderr" -> {
                    var out = args[0].equals("stderr") ? System.err : System.out;
                    byte[] bytes = new byte[8192]; Arrays.fill(bytes, (byte) 'x');
                    for (int i = 0; i < 1024; i++) out.write(bytes);
                }
                default -> throw new IllegalArgumentException();
            }
        }
    }
}

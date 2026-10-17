import java.io.*;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.*;
import javax.xml.stream.*;

/** Java 17 language level; no repository code, shell command or build plugin is run. */
public final class Validator {
    static final String PMD_VERSION = "7.28.0";
    static final String NS = "http://pmd.sourceforge.net/report/2.0.0";
    static final int FILE_LIMIT = 1_048_576, TOTAL_LIMIT = 16_777_216;
    enum State { PASS, FAIL, ERROR }
    record Result(String id, State state, String reason, List<String> findings) {
        Result {
            Objects.requireNonNull(state); Objects.requireNonNull(findings);
            if (id == null || !id.matches("[a-z][a-z0-9-]{0,31}") || reason == null
                    || !reason.matches("[A-Za-z0-9_;=.-]{1,256}") || findings.size() > 4096)
                throw new IllegalArgumentException("invalid module result");
            for (String f : findings) {
                if (f == null || f.length() > 4096 || f.chars().anyMatch(c -> c < 32 || c == 127))
                    throw new IllegalArgumentException("invalid finding");
            }
            findings = findings.stream().sorted().toList();
        }
        static Result error(String id, String reason) {
            return new Result(id, State.ERROR, reason, List.of());
        }
    }
    record Report(String snapshot, List<Result> modules) {
        Report { modules = modules.stream().sorted(Comparator.comparing(Result::id)).toList(); }
        int exitCode() {
            if (modules.stream().anyMatch(x -> x.state == State.ERROR)) return 2;
            return modules.stream().anyMatch(x -> x.state == State.FAIL) ? 1 : 0;
        }
        String text() {
            StringBuilder b = new StringBuilder("snapshot=" + snapshot + "\n");
            for (Result r : modules) {
                b.append(r.id).append('\t').append(r.state).append('\t')
                    .append(r.reason).append('\n');
                for (String f : r.findings) b.append("  ").append(f).append('\n');
            }
            return b.append("exit=").append(exitCode()).append('\n').toString();
        }
    }
    interface Module {
        String id();
        Result check(Snapshot snapshot, AtomicBoolean cancel) throws Exception;
    }
    static Report validate(Snapshot snapshot, List<Module> modules, AtomicBoolean cancel) {
        // All registered modules are required. An empty/duplicate registry cannot pass.
        if (modules == null || modules.isEmpty() || modules.size() > 8
                || modules.stream().anyMatch(m -> m == null || m.id() == null || !m.id().matches("[a-z][a-z0-9-]{0,31}"))
                || modules.stream().map(Module::id).distinct().count() != modules.size()) {
            return new Report(snapshot.digest, List.of(Result.error("gate", "BAD_REGISTRY")));
        }
        List<Result> out = new ArrayList<>();
        for (Module m : modules.stream().sorted(Comparator.comparing(Module::id)).toList()) {
            try {
                if (!m.id().matches("[a-z][a-z0-9-]{0,31}")) throw new IOException();
                if (cancel.get() || Thread.currentThread().isInterrupted()) {
                    out.add(Result.error(m.id(), "CANCELLED"));
                } else if (!snapshot.unchanged()) {
                    out.add(Result.error(m.id(), "SNAPSHOT_CHANGED"));
                } else {
                    Result r = m.check(snapshot, cancel);
                    if (r == null || !r.id.equals(m.id())) throw new IOException();
                    if (cancel.get() || Thread.currentThread().isInterrupted()) out.add(Result.error(m.id(), "CANCELLED"));
                    else out.add(snapshot.unchanged() ? r : Result.error(m.id(), "SNAPSHOT_CHANGED"));
                }
            } catch (Exception e) {
                out.add(Result.error(m.id(), "MODULE_ERROR"));
            }
        }
        if (cancel.get() || Thread.currentThread().isInterrupted()) out.add(Result.error("gate", "CANCELLED"));
        return new Report(snapshot.digest, out);
    }
    static byte[] boundedRead(Path p, int max) throws IOException {
        try (InputStream in = Files.newInputStream(p, LinkOption.NOFOLLOW_LINKS)) {
            byte[] bytes = in.readNBytes(max + 1);
            if (bytes.length > max) throw new IOException("size limit");
            return bytes;
        }
    }
    static String hash(Map<String, byte[]> files) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        for (var e : new TreeMap<>(files).entrySet()) {
            byte[] name = e.getKey().getBytes(StandardCharsets.UTF_8);
            md.update(ByteBuffer.allocate(4).putInt(name.length).array()); md.update(name);
            md.update(ByteBuffer.allocate(4).putInt(e.getValue().length).array()); md.update(e.getValue());
        }
        return HexFormat.of().formatHex(md.digest());
    }
    static SortedMap<String, byte[]> readSources(Path root) throws IOException {
        SortedMap<String, byte[]> data = new TreeMap<>();
        int[] entries = {0}, total = {0};
        Files.walkFileTree(root, EnumSet.noneOf(FileVisitOption.class), 40,
                new SimpleFileVisitor<Path>() {
            void count(Path p) throws IOException {
                if (++entries[0] > 4096 || Files.isSymbolicLink(p)) throw new IOException("path limit");
            }
            public FileVisitResult preVisitDirectory(Path p, BasicFileAttributes a) throws IOException {
                count(p); return FileVisitResult.CONTINUE;
            }
            public FileVisitResult visitFile(Path p, BasicFileAttributes a) throws IOException {
                count(p);
                if (!a.isRegularFile()) throw new IOException("non-regular input");
                if (p.toString().endsWith(".java")) {
                    String rel = root.relativize(p).toString().replace(File.separatorChar, '/');
                    // A deliberately narrow portable path contract; reject rather than silently skip.
                    if (!rel.matches("[A-Za-z0-9_./ -]+\\.java") || rel.contains(".."))
                        throw new IOException("unsupported path");
                    byte[] bytes = boundedRead(p, FILE_LIMIT);
                    StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(bytes));
                    total[0] += bytes.length;
                    if (data.size() >= 256 || total[0] > TOTAL_LIMIT) throw new IOException("input limit");
                    data.put(rel, bytes);
                }
                return FileVisitResult.CONTINUE;
            }
        });
        if (data.isEmpty()) throw new IOException("no Java sources");
        return data;
    }
    static final class Snapshot implements AutoCloseable {
        final Path home, source;
        final String digest;
        final Set<String> names;
        Snapshot(Path input, Path tempParent) throws Exception {
            Path normalized = input.toAbsolutePath().normalize();
            if (Files.isSymbolicLink(normalized) || !Files.isDirectory(normalized))
                throw new IOException("invalid root");
            // The caller provides an immutable exported commit, not a concurrently writable checkout.
            SortedMap<String, byte[]> data = readSources(normalized.toRealPath());
            digest = hash(data); names = Set.copyOf(data.keySet());
            home = Files.createTempDirectory(tempParent, "validator-").toAbsolutePath();
            source = home.resolve("source");
            try {
                Files.createDirectory(source);
                for (var e : data.entrySet()) {
                    Path dest = source.resolve(e.getKey());
                    Files.createDirectories(dest.getParent()); Files.write(dest, e.getValue());
                }
            } catch (Exception e) { deleteTree(home); throw e; }
        }
        boolean unchanged() throws Exception { return digest.equals(hash(readSources(source))); }
        public void close() throws IOException { deleteTree(home); }
    }
    static void deleteTree(Path p) throws IOException {
        if (!Files.exists(p, LinkOption.NOFOLLOW_LINKS)) return;
        Files.walkFileTree(p, new SimpleFileVisitor<Path>() {
            public FileVisitResult visitFile(Path f, BasicFileAttributes a) throws IOException {
                Files.delete(f); return FileVisitResult.CONTINUE;
            }
            public FileVisitResult postVisitDirectory(Path d, IOException e) throws IOException {
                if (e != null) throw e;
                Files.delete(d); return FileVisitResult.CONTINUE;
            }
        });
    }
    record Exec(int code, byte[] stdout, String error) {}
    interface Runner {
        Exec run(List<String> argv, Path cwd, Duration limit, int outputLimit, AtomicBoolean cancel);
    }
    /** Bounds wall time and captured bytes. OS-level total memory/PID isolation is still required. */
    static final class ProcessRunner implements Runner {
        public Exec run(List<String> argv, Path cwd, Duration limit, int cap, AtomicBoolean cancel) {
            if (cancel.get() || Thread.currentThread().isInterrupted()) return new Exec(-1, new byte[0], "CANCELLED");
            if (limit.isNegative() || limit.isZero() || limit.compareTo(Duration.ofMinutes(2)) > 0
                    || cap < 1 || cap > 1_048_576) return new Exec(-1, new byte[0], "BAD_LIMIT");
            Process p = null;
            List<Thread> pumps = new ArrayList<>();
            Set<ProcessHandle> children = new HashSet<>();
            ByteArrayOutputStream stdout = new ByteArrayOutputStream();
            AtomicInteger budget = new AtomicInteger(cap);
            AtomicBoolean overflow = new AtomicBoolean(), ioError = new AtomicBoolean();
            String error = null;
            int code = -1;
            boolean interrupted = false;
            long end = System.nanoTime() + limit.toNanos();
            try {
                ProcessBuilder pb = new ProcessBuilder(argv).directory(cwd.toFile());
                pb.environment().clear();
                pb.environment().put("LANG", "C.UTF-8");
                pb.environment().put("HOME", cwd.toString());
                pb.environment().put("TMPDIR", cwd.toString());
                p = pb.start(); p.getOutputStream().close();
                InputStream[] streams = {p.getInputStream(), p.getErrorStream()};
                for (int i = 0; i < streams.length; i++) {
                    InputStream stream = streams[i]; boolean keep = i == 0;
                    Thread t = new Thread(() -> {
                        try (stream) {
                            byte[] b = new byte[4096]; int n;
                            while ((n = stream.read(b)) != -1) {
                                int previous = budget.getAndAdd(-n);
                                int allowed = Math.max(0, Math.min(n, previous));
                                if (keep && allowed > 0) stdout.write(b, 0, allowed);
                                if (n > previous) { overflow.set(true); break; }
                            }
                        } catch (IOException e) { ioError.set(true); }
                    }, "validator-pump-" + i);
                    t.setDaemon(true); pumps.add(t); t.start();
                }
                while (true) {
                    try (var descendants = p.descendants()) { descendants.limit(65).forEach(children::add); }
                    if (children.size() > 64) { error = "PROCESS_LIMIT"; break; }
                    if (cancel.get() || Thread.currentThread().isInterrupted()) { error = "CANCELLED"; break; }
                    if (overflow.get()) { error = "OUTPUT_LIMIT"; break; }
                    if (ioError.get()) { error = "OUTPUT_IO"; break; }
                    if (!p.isAlive() && pumps.stream().noneMatch(Thread::isAlive)) {
                        code = p.exitValue();
                        if (children.stream().anyMatch(ProcessHandle::isAlive)) error = "CHILD_LEAK";
                        break;
                    }
                    if (System.nanoTime() >= end) { error = "TIMEOUT"; break; }
                    Thread.sleep(10);
                }
            } catch (InterruptedException e) { interrupted = true; error = "CANCELLED";
            } catch (IOException | RuntimeException e) { error = "START_OR_IO_ERROR";
            } finally {
                // Clear interrupt only while doing bounded cleanup, then restore it.
                interrupted |= Thread.interrupted();
                if (p != null) {
                    try (var descendants = p.descendants()) { descendants.limit(65).forEach(children::add); }
                    children.forEach(ProcessHandle::destroyForcibly);
                    if (p.isAlive()) p.destroyForcibly();
                    long cleanupEnd = System.nanoTime() + TimeUnit.SECONDS.toNanos(2);
                    try {
                        p.waitFor(1000, TimeUnit.MILLISECONDS);
                        for (Thread t : pumps) {
                            long ms = TimeUnit.NANOSECONDS.toMillis(cleanupEnd - System.nanoTime());
                            if (ms > 0) t.join(ms);
                        }
                    } catch (InterruptedException e) { interrupted = true; }
                    if (p.isAlive() || pumps.stream().anyMatch(Thread::isAlive)
                            || children.stream().anyMatch(ProcessHandle::isAlive)) error = "CLEANUP_ERROR";
                }
                if (interrupted) Thread.currentThread().interrupt();
            }
            return new Exec(code, error == null ? stdout.toByteArray() : new byte[0], error);
        }
    }
    static final class PmdModule implements Module {
        final String id;
        final List<String> launcher;
        final Path rules;
        final Runner runner;
        PmdModule(String id, List<String> trustedLauncher, Path trustedRules, Runner runner) {
            this.id = id; launcher = List.copyOf(trustedLauncher); rules = trustedRules; this.runner = runner;
        }
        public String id() { return id; }
        public Result check(Snapshot s, AtomicBoolean cancel) throws Exception {
            // Policy is copied from the trusted bundle, never read from the scanned tree.
            if (!Files.isRegularFile(rules, LinkOption.NOFOLLOW_LINKS)
                    || rules.toRealPath().startsWith(s.home)) return Result.error(id, "MISSING_POLICY");
            byte[] policy = boundedRead(rules, 65_536);
            Path work = Files.createDirectory(s.home.resolve(id));
            Path config = work.resolve("rules.xml"); Files.write(config, policy);
            List<String> cmd = new ArrayList<>(launcher);
            cmd.add(1, "-Djava.io.tmpdir=" + work);
            cmd.addAll(List.of("check", "--dir", s.source.toString(), "--rulesets", config.toString(),
                "--format", "xml", "--encoding", "UTF-8", "--use-version", "java-17",
                "--threads", "1", "--no-cache", "--no-progress", "--show-suppressed",
                "--fail-on-violation", "--fail-on-error"));
            Exec exec = runner.run(cmd, work, Duration.ofSeconds(15), 262_144, cancel);
            Result r = exec.error != null ? Result.error(id, exec.error) : parsePmd(id, exec, s);
            return new Result(id, r.state, r.reason + ";engine=PMD-" + PMD_VERSION
                + ";policy=" + hash(Map.of("rules.xml", policy)), r.findings);
        }
    }
    static Result parsePmd(String id, Exec exec, Snapshot s) {
        if (exec.code != 0 && exec.code != 4) return Result.error(id, "ENGINE_EXIT_" + exec.code);
        try {
            if (exec.stdout == null || exec.stdout.length > 262_144) throw new IOException("report limit");
            XMLInputFactory factory = XMLInputFactory.newFactory();
            factory.setProperty(XMLInputFactory.SUPPORT_DTD, false);
            factory.setProperty("javax.xml.stream.isSupportingExternalEntities", false);
            factory.setXMLResolver((a, b, c, d) -> { throw new XMLStreamException("external entity"); });
            XMLStreamReader xml = factory.createXMLStreamReader(new ByteArrayInputStream(exec.stdout));
            List<String> findings = new ArrayList<>();
            Deque<String> stack = new ArrayDeque<>();
            String file = null; boolean seenRoot = false, engineError = false; int suppressed = 0;
            try {
                while (xml.hasNext()) {
                    int event = xml.next();
                    if (event == XMLStreamConstants.DTD || event == XMLStreamConstants.ENTITY_REFERENCE)
                        throw new XMLStreamException("DTD/entity");
                    if (event == XMLStreamConstants.START_ELEMENT) {
                        String name = xml.getLocalName(), parent = stack.peek();
                        if (!NS.equals(xml.getNamespaceURI())) throw new XMLStreamException("namespace");
                        if (parent == null) {
                            if (seenRoot || !name.equals("pmd") || !PMD_VERSION.equals(xml.getAttributeValue(null, "version")))
                                throw new XMLStreamException("version/root");
                            seenRoot = true;
                        } else if (parent.equals("pmd")) {
                            switch (name) {
                                case "file" -> file = reportPath(xml.getAttributeValue(null, "name"), s);
                                case "error", "configerror" -> engineError = true;
                                case "suppressedviolation" -> {
                                    reportPath(xml.getAttributeValue(null, "filename"), s); suppressed++;
                                }
                                default -> throw new XMLStreamException("unknown element");
                            }
                        } else if (parent.equals("file") && name.equals("violation")) {
                            int line = Integer.parseInt(xml.getAttributeValue(null, "beginline"));
                            String rule = xml.getAttributeValue(null, "rule");
                            if (line < 1 || rule == null || !rule.matches("[A-Za-z0-9_]{1,100}"))
                                throw new XMLStreamException("bad violation");
                            findings.add(file + ":" + line + ":" + rule);
                        } else throw new XMLStreamException("unexpected nesting");
                        stack.push(name);
                    } else if (event == XMLStreamConstants.END_ELEMENT) { stack.pop();
                    } else if (event == XMLStreamConstants.CHARACTERS && !xml.isWhiteSpace()
                            && (stack.isEmpty() || stack.peek().equals("pmd") || stack.peek().equals("file"))) {
                        throw new XMLStreamException("unexpected text");
                    }
                }
            } finally { xml.close(); }
            if (!seenRoot || !stack.isEmpty()) throw new XMLStreamException("incomplete");
            if (engineError) return Result.error(id, "ENGINE_REPORT_ERROR");
            if ((exec.code == 4) != !findings.isEmpty()) return Result.error(id, "EXIT_REPORT_MISMATCH");
            if (suppressed > 0) findings.add("suppressed-findings=" + suppressed);
            return new Result(id, findings.isEmpty() ? State.PASS : State.FAIL,
                findings.isEmpty() ? "CLEAN" : "RULE_VIOLATION", findings);
        } catch (Exception e) { return Result.error(id, "INVALID_REPORT"); }
    }
    static String reportPath(String value, Snapshot s) throws IOException {
        if (value == null) throw new IOException("missing path");
        Path p = Path.of(value);
        p = (p.isAbsolute() ? p : s.source.resolve(p)).normalize();
        if (!p.startsWith(s.source)) throw new IOException("outside snapshot");
        String rel = s.source.relativize(p).toString().replace(File.separatorChar, '/');
        if (!s.names.contains(rel)) throw new IOException("unknown file");
        return rel;
    }
    public static void main(String[] args) {
        int exit = 2;
        try {
            if (args.length != 1) throw new IOException("expected immutable source directory");
            // Administrator-owned read-only image paths, never CLI/environment-selected commands.
            Path trusted = Path.of("/opt/runtime-validator");
            Path lib = trusted.resolve("pmd-bin-" + PMD_VERSION).resolve("lib");
            if (!Files.isDirectory(lib)) throw new IOException("missing PMD installation");
            String java = Path.of(System.getProperty("java.home"), "bin", "java").toString();
            List<String> launcher = List.of(java, "-Xmx256m", "-XX:MaxMetaspaceSize=128m",
                "-XX:ActiveProcessorCount=1", "-cp", lib + "/*", "net.sourceforge.pmd.cli.PmdCli");
            AtomicBoolean cancel = new AtomicBoolean();
            Report report;
            try (Snapshot s = new Snapshot(Path.of(args[0]), Path.of(System.getProperty("java.io.tmpdir")))) {
                Runner runner = new ProcessRunner();
                report = validate(s, List.of(
                    new PmdModule("style", launcher, trusted.resolve("rules/style.xml"), runner),
                    new PmdModule("security", launcher, trusted.resolve("rules/security.xml"), runner)), cancel);
            }
            System.out.print(report.text()); exit = report.exitCode();
        } catch (Exception e) {
            exit = 2;
            System.out.print("gate\tERROR\tSETUP_OR_CLEANUP_ERROR\nexit=2\n");
        }
        System.exit(exit);
    }
}

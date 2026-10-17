import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;

/** Small fixture batches, not an unbounded streaming protocol. No shell.
 * UTF-8 requests id:number; replies id:OK:square or id:ERR:reason.
 * '?' is reserved: unidentifiable malformed lines can only be matched by position.
 * Input is capped at 256 Ki characters; stdout and stderr each at 64 Ki characters.
 */
public final class ProcessDemo {
    private static final int OUTPUT_LIMIT = 65536, INPUT_LIMIT = 262144;
    private static int assertions;
    private static void check(String name, boolean ok) {
        if (!ok) throw new AssertionError(name);
        assertions++; System.out.println("PASS " + name);
    }
    private static String idFor(String line) {
        int colon = line.indexOf(':');
        // '?' is reserved for malformed lines without an identifiable request id.
        return colon > 0 && !line.substring(0, colon).equals("?") ? line.substring(0, colon) : "?";
    }
    private static List<String> requestIds(String input) throws IOException {
        if (input.length() > INPUT_LIMIT) throw new IllegalArgumentException("input limit exceeded");
        List<String> ids = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        try (BufferedReader reader = new BufferedReader(new StringReader(input))) {
            for (String line; (line = reader.readLine()) != null;) {
                String id = idFor(line);
                if (!id.equals("?") && !seen.add(id)) throw new IllegalArgumentException("duplicate request id");
                ids.add(id);
            }
        }
        return ids;
    }
    private static void validate(List<String> expected, String output) throws IOException {
        Set<String> seen = new HashSet<>();
        int index = 0;
        try (BufferedReader reader = new BufferedReader(new StringReader(output))) {
            for (String line; (line = reader.readLine()) != null; index++) {
                String[] fields = line.split(":", -1);
                if (index >= expected.size() || fields.length != 3 || !fields[0].equals(expected.get(index)))
                    throw new IOException("reply count, id, or format mismatch");
                if (!fields[0].equals("?") && !seen.add(fields[0])) throw new IOException("duplicate reply id");
                if (fields[1].equals("OK")) {
                    try { Long.parseLong(fields[2]); } catch (NumberFormatException ex) { throw new IOException("invalid result", ex); }
                } else if (!fields[1].equals("ERR") || !(fields[2].equals("invalid") || fields[2].equals("overflow")))
                    throw new IOException("invalid reply status");
            }
        }
        if (index != expected.size()) throw new IOException("missing replies");
    }
    private static String readAll(InputStream input) throws IOException {
        try (Reader reader = new InputStreamReader(input, StandardCharsets.UTF_8)) {
            StringBuilder out = new StringBuilder(); char[] buffer = new char[1024];
            for (int n; (n = reader.read(buffer)) != -1;) {
                if (out.length() + n > OUTPUT_LIMIT) throw new IOException("output limit exceeded");
                out.append(buffer, 0, n);
            }
            return out.toString().replace("\r\n", "\n");
        }
    }
    private static long remaining(long deadline) throws TimeoutException {
        long left = deadline - System.nanoTime();
        if (left <= 0) throw new TimeoutException("child deadline expired");
        return left;
    }
    private static <T> T getBefore(Future<T> future, long deadline) throws Exception {
        try { return future.get(remaining(deadline), TimeUnit.NANOSECONDS); }
        catch (ExecutionException ex) {
            if (ex.getCause() instanceof Exception) throw (Exception) ex.getCause();
            throw new AssertionError(ex.getCause());
        }
    }
    private static void stop(Process process) throws InterruptedException {
        if (process.isAlive()) {
            process.destroy();
            if (!process.waitFor(2, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                if (!process.waitFor(2, TimeUnit.SECONDS)) throw new AssertionError("child stuck");
            }
        }
    }
    private static String runChild(String mode, String input, long timeoutMillis) throws Exception {
        List<String> ids = requestIds(input);
        String java = System.getProperty("java.home") + File.separator + "bin" + File.separator
                + (System.getProperty("os.name").startsWith("Windows") ? "java.exe" : "java");
        Process process = new ProcessBuilder(java, "-cp", System.getProperty("java.class.path"),
                ProcessDemo.class.getName(), mode).start();
        ExecutorService io = Executors.newFixedThreadPool(3);
        long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(timeoutMillis);
        try {
            // Concurrent bounded reads and an asynchronous write avoid pipe deadlocks.
            Future<String> out = io.submit(() -> readAll(process.getInputStream()));
            Future<String> err = io.submit(() -> readAll(process.getErrorStream()));
            Future<Void> sent = io.submit(() -> {
                try (Writer writer = new OutputStreamWriter(process.getOutputStream(), StandardCharsets.UTF_8)) {
                    writer.write(input); // Close stdin to send EOF, including for an empty batch.
                }
                return null;
            });
            if (!process.waitFor(remaining(deadline), TimeUnit.NANOSECONDS)) throw new TimeoutException("child timeout");
            String stdout = getBefore(out, deadline), stderr = getBefore(err, deadline);
            if (process.exitValue() != 0) throw new IOException("exit=" + process.exitValue() + ": " + stderr.trim());
            getBefore(sent, deadline); validate(ids, stdout);
            return stdout;
        } finally { // Termination and I/O cleanup have a separate, bounded grace period.
            try { stop(process); }
            finally {
                io.shutdownNow();
                if (!io.awaitTermination(3, TimeUnit.SECONDS)) throw new AssertionError("I/O workers stuck");
            }
        }
    }
    private static void child(String mode) throws Exception {
        if (mode.equals("hang")) { new CountDownLatch(1).await(30, TimeUnit.SECONDS); return; }
        if (mode.equals("exit")) { System.err.println("deliberate child failure"); System.exit(7); }
        if (mode.equals("flood")) { System.out.print(new String(new char[OUTPUT_LIMIT + 1])); return; }
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
             PrintWriter writer = new PrintWriter(new OutputStreamWriter(System.out, StandardCharsets.UTF_8), true)) {
            for (String line; (line = reader.readLine()) != null;) {
                String id = idFor(line); String[] fields = line.split(":", -1);
                try {
                    if (fields.length != 2 || id.equals("?")) throw new IllegalArgumentException();
                    long n = Long.parseLong(fields[1]);
                    writer.println(id + ":OK:" + Math.multiplyExact(n, n));
                } catch (IllegalArgumentException ex) { writer.println(id + ":ERR:invalid"); }
                  catch (ArithmeticException ex) { writer.println(id + ":ERR:overflow"); }
            }
        }
    }
    public static void main(String[] args) throws Exception {
        if (args.length != 0) { child(args[0]); return; }
        check("process preserves ids and UTF-8", runChild("child", "task-1:5\n任务-2:3\n", 3000)
                .equals("task-1:OK:25\n任务-2:OK:9\n"));
        check("empty input reaches EOF", runChild("child", "", 3000).isEmpty());
        check("negative and zero square correctly", runChild("child", "n:-4\nz:0\n", 3000).equals("n:OK:16\nz:OK:0\n"));
        check("duplicate values keep distinct ids", runChild("child", "a:4\nb:4\n", 3000).equals("a:OK:16\nb:OK:16\n"));
        check("invalid input preserves identifiable ids", runChild("child", "bad\nx:nope\n:3\n\n", 3000)
                .equals("?:ERR:invalid\nx:ERR:invalid\n?:ERR:invalid\n?:ERR:invalid\n"));
        check("overflow preserves request id", runChild("child", "huge:9223372036854775807\n", 3000).equals("huge:ERR:overflow\n"));
        boolean timeout = false;
        try { runChild("hang", "", 100); } catch (TimeoutException ex) { timeout = true; }
        check("timeout terminates child", timeout);
        boolean writeTimeout = false;
        try { runChild("hang", new String(new char[128 * 1024]), 100); } catch (TimeoutException ex) { writeTimeout = true; }
        check("timeout also bounds blocked stdin writer", writeTimeout);
        boolean badExit = false;
        try { runChild("exit", "", 3000); }
        catch (IOException ex) { badExit = ex.getMessage().contains("exit=7") && ex.getMessage().contains("deliberate child failure"); }
        check("nonzero exit includes stderr", badExit);
        boolean capped = false;
        try { runChild("flood", "", 3000); } catch (IOException ex) { capped = ex.getMessage().contains("output limit"); }
        check("child output has a hard read cap", capped);
        boolean missing = false, duplicate = false, duplicateInput = false;
        try { validate(Arrays.asList("a", "b"), "a:OK:1\n"); } catch (IOException ex) { missing = true; }
        try { validate(Arrays.asList("a", "b"), "a:OK:1\na:OK:1\n"); } catch (IOException ex) { duplicate = true; }
        try { runChild("child", "a:1\na:2\n", 3000); } catch (IllegalArgumentException ex) { duplicateInput = true; }
        check("missing reply is rejected", missing);
        check("duplicate or mismatched reply id is rejected", duplicate);
        check("duplicate request ids are rejected before launch", duplicateInput);
        boolean oversized = false;
        try { runChild("child", new String(new char[INPUT_LIMIT + 1]), 3000); }
        catch (IllegalArgumentException ex) { oversized = true; }
        check("oversized request is rejected before launch", oversized);
        System.out.println("ASSERTIONS " + assertions);
    }
}

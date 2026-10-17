import java.io.*;
import java.nio.file.*;
import java.util.concurrent.*;

/** An unavoidable monitor deadlock is demonstrated only in an isolated subprocess. */
public final class MonitorDeadlockLab {
    static void child() {
        Object a = new Object(), b = new Object();
        CountDownLatch held = new CountDownLatch(2);
        Runnable left = () -> { synchronized (a) {
            held.countDown();
            try { Checks.await(held); } catch (InterruptedException e) { throw new AssertionError(e); }
            System.out.println("BOTH_HELD"); System.out.flush();
            synchronized (b) { throw new AssertionError("unreachable"); }
        }};
        Runnable right = () -> { synchronized (b) {
            held.countDown();
            try { Checks.await(held); } catch (InterruptedException e) { throw new AssertionError(e); }
            synchronized (a) { throw new AssertionError("unreachable"); }
        }};
        new Thread(left, "left").start(); new Thread(right, "right").start();
    }
    public static void main(String[] args) throws Exception {
        if (args.length == 1 && args[0].equals("child")) { child(); return; }
        String java = Path.of(System.getProperty("java.home"), "bin", "java").toString();
        Process process = new ProcessBuilder(java, "-cp", System.getProperty("java.class.path"),
                MonitorDeadlockLab.class.getName(), "child").redirectErrorStream(true).start();
        ExecutorService reader = Executors.newSingleThreadExecutor();
        try {
            Future<String> line = reader.submit(() -> new BufferedReader(new InputStreamReader(process.getInputStream())).readLine());
            Checks.that("BOTH_HELD".equals(Checks.get(line)), "both first locks held");
            Checks.that(!process.waitFor(100, TimeUnit.MILLISECONDS), "child remains deadlocked");
        } finally {
            process.destroyForcibly();
            Checks.that(process.waitFor(5, TimeUnit.SECONDS), "child reaped");
            Checks.stop(reader);
        }
        System.out.println("MonitorDeadlockLab OK");
    }
}

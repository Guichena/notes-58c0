import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

public final class ContextBindingsLab {
    public static void main(String[] args) throws Exception {
        ThreadLocal<String> local = new ThreadLocal<>();
        InheritableThreadLocal<String> inherited = new InheritableThreadLocal<>();
        local.set("parent-only"); inherited.set("creation-time");
        AtomicReference<String> childValue = new AtomicReference<>();
        AtomicReference<Throwable> failures = new AtomicReference<>();
        Thread child = Checks.thread("inheritance", failures, () -> {
            Checks.that(local.get() == null, "ordinary local not inherited");
            childValue.set(inherited.get());
        });
        inherited.set("start-time"); child.start(); Checks.join(child); Checks.rethrow(failures);
        Checks.that(childValue.get().equals("creation-time"), "inheritance at creation, not start");
        inherited.set("worker-creation"); ExecutorService pool = Executors.newSingleThreadExecutor();
        try {
            Checks.that(Checks.get(pool.submit(inherited::get)).equals("worker-creation"), "first worker inherits");
            inherited.set("new-request");
            Checks.that(Checks.get(pool.submit(inherited::get)).equals("worker-creation"), "existing worker does not inherit each submission");
            Checks.get(pool.submit(() -> { local.set("leaked-request"); return null; }));
            Checks.that(Checks.get(pool.submit(local::get)).equals("leaked-request"), "pool contamination demonstrated");
            Checks.get(pool.submit(() -> {
                try { local.set("request"); throw new IllegalStateException("business"); }
                catch (IllegalStateException expected) { return null; }
                finally { local.remove(); inherited.remove(); }
            }));
            Checks.that(Checks.get(pool.submit(local::get)) == null, "ordinary failure unwinds finally cleanup");
        } finally { local.remove(); inherited.remove(); Checks.stop(pool); }
        AtomicReference<Thread> ranOn = new AtomicReference<>();
        Thread platform = new Thread(() -> ranOn.set(Thread.currentThread()));
        platform.run(); Checks.that(ranOn.get() == Thread.currentThread(), "direct platform run");
        AtomicBoolean virtualRan = new AtomicBoolean();
        Thread virtual = Thread.ofVirtual().unstarted(() -> virtualRan.set(true));
        virtual.run(); Checks.that(!virtualRan.get(), "direct virtual run does nothing");
        virtual.start(); Checks.join(virtual); Checks.that(virtualRan.get(), "virtual start executes task");
        System.out.println("ContextBindingsLab OK");
    }
}

import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;

public final class InclusiveAlternatorTest {
    private static int checks;
    private static void check(boolean value) {
        checks++;
        if (!value) throw new AssertionError("check " + checks);
    }
    @FunctionalInterface private interface Role { void run() throws InterruptedException; }
    private record Worker(Thread thread, AtomicReference<Throwable> error) {}
    private static Worker worker(String name, Role role, CountDownLatch entered) {
        AtomicReference<Throwable> error = new AtomicReference<>();
        Thread t = new Thread(() -> {
            entered.countDown();
            try { role.run(); }
            catch (InterruptedException ex) { error.set(ex); Thread.currentThread().interrupt(); }
            catch (RuntimeException | Error ex) { error.set(ex); }
        }, name);
        return new Worker(t, error);
    }
    // One deadline covers both joins. Test callbacks are bounded; this cannot stop arbitrary hung I/O.
    private static void join(InclusiveAlternator task, Worker a, Worker b) throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        for (Worker w : List.of(a, b)) {
            long left = deadline - System.nanoTime();
            if (left > 0) TimeUnit.NANOSECONDS.timedJoin(w.thread(), left);
        }
        if (a.thread().isAlive() || b.thread().isAlive()) {
            a.thread().interrupt(); b.thread().interrupt(); task.cancel();
            a.thread().join(1000); b.thread().join(1000);
            throw new AssertionError("role failed to terminate");
        }
        check(!a.thread().isAlive() && !b.thread().isAlive());
    }
    private static void normal(boolean oddFirst, boolean print) throws InterruptedException {
        List<Integer> values = new ArrayList<>(); List<String> owners = new ArrayList<>();
        InclusiveAlternator task = new InclusiveAlternator(value -> {
            values.add(value); owners.add(Thread.currentThread().getName());
            if (print) System.out.println(value);
        });
        CountDownLatch entered = new CountDownLatch(2);
        Worker even = worker("even", task::even, entered), odd = worker("odd", task::odd, entered);
        if (oddFirst) { odd.thread().start(); even.thread().start(); }
        else { even.thread().start(); odd.thread().start(); }
        join(task, even, odd);
        check(even.error().get() == null && odd.error().get() == null);
        check(values.size() == 101 && values.get(100) == 100);
        int evenCount = 0, oddCount = 0;
        for (int i = 0; i <= 100; i++) {
            check(values.get(i) == i);
            check(owners.get(i).equals((i & 1) == 0 ? "even" : "odd"));
            if ((i & 1) == 0) evenCount++; else oddCount++;
        }
        check(evenCount == 51 && oddCount == 50);
    }
    public static void main(String[] args) throws InterruptedException {
        if (args.length == 1 && args[0].equals("--demo")) { normal(true, true); return; }
        for (int i = 0; i < 100; i++) normal((i & 1) == 0, false);
        try { new InclusiveAlternator(null); throw new AssertionError("null accepted"); }
        catch (NullPointerException expected) { checks++; }
        InclusiveAlternator cancelled = new InclusiveAlternator(v -> { throw new AssertionError("must not output"); });
        cancelled.cancel();
        Worker ce = worker("even", cancelled::even, new CountDownLatch(0));
        Worker co = worker("odd", cancelled::odd, new CountDownLatch(0));
        co.thread().start(); ce.thread().start(); join(cancelled, ce, co);
        check(ce.error().get() instanceof CancellationException && co.error().get() instanceof CancellationException);
        InclusiveAlternator activeCancel = new InclusiveAlternator(v -> { throw new AssertionError("must not output"); });
        Worker ao = worker("odd", activeCancel::odd, new CountDownLatch(0));
        ao.thread().start();
        long waitDeadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (ao.thread().getState() != Thread.State.WAITING && System.nanoTime() < waitDeadline) Thread.sleep(1);
        check(ao.thread().getState() == Thread.State.WAITING);
        activeCancel.cancel();
        Worker ae = worker("even", activeCancel::even, new CountDownLatch(0));
        ae.thread().start(); join(activeCancel, ae, ao);
        check(ae.error().get() instanceof CancellationException && ao.error().get() instanceof CancellationException);
        // Odd starts without an even worker, then is interrupted before it could output.
        InclusiveAlternator interrupted = new InclusiveAlternator(v -> { throw new AssertionError("must not output"); });
        CountDownLatch entered = new CountDownLatch(1);
        Worker io = worker("odd", interrupted::odd, entered);
        io.thread().start(); check(entered.await(5, TimeUnit.SECONDS)); io.thread().interrupt();
        io.thread().join(5000); check(!io.thread().isAlive());
        Worker ie = worker("even", interrupted::even, new CountDownLatch(0));
        ie.thread().start(); join(interrupted, ie, io);
        check(io.error().get() instanceof InterruptedException);
        check(ie.error().get() instanceof CancellationException);
        List<Integer> prefix = new ArrayList<>();
        InclusiveAlternator failed = new InclusiveAlternator(v -> {
            if (v == 17) throw new IllegalStateException("injected callback failure");
            prefix.add(v);
        });
        Worker fe = worker("even", failed::even, new CountDownLatch(0));
        Worker fo = worker("odd", failed::odd, new CountDownLatch(0));
        fo.thread().start(); fe.thread().start(); join(failed, fe, fo);
        check(fo.error().get() instanceof IllegalStateException);
        check(fe.error().get() instanceof CancellationException);
        check(prefix.size() == 17);
        for (int i = 0; i < 17; i++) check(prefix.get(i) == i);
        System.out.println("PASS " + checks + " checks; 100 schedules, inclusive 0..100, role ownership, pre-cancel, active cancellation, interruption and callback failure.");
    }
}

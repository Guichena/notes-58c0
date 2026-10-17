import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

public final class OrderingLab {
    @FunctionalInterface interface Action { void run() throws Exception; }
    static void together(Action... actions) throws Exception {
        ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
        try {
            List<Future<?>> futures = new ArrayList<>();
            for (Action action : actions) futures.add(executor.submit(() -> { action.run(); return null; }));
            for (Future<?> future : futures) Checks.get(future);
        } finally { Checks.stop(executor); }
    }
    static void semaphoreAbc(StringBuffer output) throws Exception {
        Semaphore[] turns = {new Semaphore(1), new Semaphore(0), new Semaphore(0)};
        AtomicBoolean cancelled = new AtomicBoolean();
        Action[] actions = new Action[3];
        for (int role = 0; role < 3; role++) {
            int id = role;
            actions[id] = () -> {
                try {
                    for (int n = 0; n < 100; n++) {
                        turns[id].acquire();
                        if (cancelled.get()) throw new CancellationException();
                        output.append((char) ('A' + id));
                        turns[(id + 1) % 3].release();
                    }
                } catch (Exception | Error failure) {
                    cancelled.set(true);
                    for (Semaphore semaphore : turns) semaphore.release();
                    throw failure;
                }
            };
        }
        together(actions);
    }
    public static void main(String[] args) throws Exception {
        StringBuffer abc = new StringBuffer(); TurnGate gate = new TurnGate(0);
        Action[] actions = new Action[3];
        for (int role = 0; role < 3; role++) {
            int id = role;
            actions[id] = () -> { for (int n = 0; n < 100; n++) gate.step(id, (id + 1) % 3,
                    () -> abc.append((char) ('A' + id))); };
        }
        together(actions); Checks.that(abc.toString().equals("ABC".repeat(100)), "100 ABC cycles");
        StringBuffer sem = new StringBuffer(); semaphoreAbc(sem);
        Checks.that(sem.toString().equals(abc.toString()), "semaphore alternative");
        Foo foo = new Foo(); StringBuffer sequence = new StringBuffer();
        together(() -> foo.third(() -> sequence.append('3')), () -> foo.second(() -> sequence.append('2')),
                () -> foo.first(() -> sequence.append('1')));
        Checks.that(sequence.toString().equals("123"), "first/second/third");
        FooLatch latch = new FooLatch(); StringBuffer latchOutput = new StringBuffer();
        together(() -> latch.third(() -> latchOutput.append('3')), () -> latch.first(() -> latchOutput.append('1')),
                () -> latch.second(() -> latchOutput.append('2')));
        Checks.that(latchOutput.toString().equals("123"), "latch baseline");
        FooBar fooBar = new FooBar(20); StringBuffer fb = new StringBuffer();
        together(() -> fooBar.foo(() -> fb.append("foo")), () -> fooBar.bar(() -> fb.append("bar")));
        Checks.that(fb.toString().equals("foobar".repeat(20)), "FooBar");
        ZeroEvenOdd zeo = new ZeroEvenOdd(10); StringBuffer numbers = new StringBuffer();
        together(() -> zeo.even(numbers::append), () -> zeo.odd(numbers::append), () -> zeo.zero(numbers::append));
        StringBuilder expected = new StringBuilder();
        for (int n = 1; n <= 10; n++) expected.append(0).append(n);
        Checks.that(numbers.toString().equals(expected.toString()), "zero/odd/even");
        H2O water = new H2O(); StringBuffer molecules = new StringBuffer(); Action[] atoms = new Action[30];
        for (int i = 0; i < atoms.length; i++) atoms[i] = i < 10
                ? () -> water.oxygen(() -> molecules.append('O'))
                : () -> water.hydrogen(() -> molecules.append('H'));
        together(atoms);
        Checks.that(molecules.length() == 30, "all atoms output");
        for (int i = 0; i < molecules.length(); i += 3) {
            String group = molecules.substring(i, i + 3);
            Checks.that(group.chars().filter(c -> c == 'H').count() == 2, "each group has two H");
        }
        TurnGate infinite = new TurnGate(0); StringBuffer prefix = new StringBuffer();
        CountDownLatch enough = new CountDownLatch(1);
        ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
        try {
            List<Future<?>> loops = new ArrayList<>();
            for (int role = 0; role < 3; role++) {
                int id = role;
                loops.add(executor.submit(() -> {
                    try { for (;;) infinite.step(id, (id + 1) % 3, () -> {
                        prefix.append((char) ('1' + id)); if (prefix.length() >= 300) enough.countDown();
                    }); }
                    catch (CancellationException expectedCancellation) { }
                    catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                }));
            }
            Checks.await(enough); infinite.cancel();
            for (Future<?> f : loops) Checks.get(f);
            for (int i = 0; i < prefix.length(); i++) Checks.that(prefix.charAt(i) == '1' + i % 3, "infinite prefix order");
            TurnGate failing = new TurnGate(0);
            Future<?> waiter = executor.submit(() -> {
                try { failing.step(1, 0, () -> { throw new AssertionError("must not print"); }); }
                catch (CancellationException expectedCancellation) { return; }
                catch (InterruptedException e) { throw new AssertionError(e); }
                throw new AssertionError("expected cancellation");
            });
            try { failing.step(0, 1, () -> { throw new IllegalStateException("output failed"); }); }
            catch (IllegalStateException expectedFailure) { }
            Checks.get(waiter);
            TurnGate interrupted = new TurnGate(0); AtomicReference<Throwable> error = new AtomicReference<>();
            Thread blocked = Checks.thread("turn-waiter", error, () -> {
                try { interrupted.step(1, 0, () -> {}); throw new AssertionError("unexpected success"); }
                catch (InterruptedException expectedInterruption) { }
            });
            blocked.start(); blocked.interrupt(); Checks.join(blocked); Checks.rethrow(error);
            try { interrupted.step(0, 1, () -> {}); throw new AssertionError("group still active"); }
            catch (CancellationException expectedCancellation) { }
            H2O cancelledWater = new H2O(); cancelledWater.cancel();
            try { cancelledWater.hydrogen(() -> {}); throw new AssertionError("cancelled water active"); }
            catch (CancellationException expectedCancellation) { }
        } finally { infinite.cancel(); Checks.stop(executor); }
        Checks.that(DeadlockExamples.demonstrateAndRecover(), "controlled recoverable deadlock");
        System.out.println("OrderingLab OK");
    }
}

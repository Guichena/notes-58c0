import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/** Local cooperative state machine; NOT a provider cancellation API. */
public final class CancelGeneration {
    enum State { RUNNING, CANCEL_REQUESTED, CANCELLED, COMPLETED, FAILED }
    private State state = State.RUNNING;
    private Runnable upstream;
    private boolean hookClaimed;
    private final List<String> tokens = new ArrayList<>();
    private Runnable claimHook() {
        if ((state != State.CANCEL_REQUESTED && state != State.CANCELLED) || upstream == null || hookClaimed) return null;
        hookClaimed = true;
        return upstream;
    }
    // Hook execution is outside the monitor. A thrown hook leaves cancellation pending.
    public void attach(Runnable hook) {
        if (hook == null) throw new IllegalArgumentException("null hook");
        Runnable action;
        synchronized (this) {
            if (upstream != null) throw new IllegalStateException("already attached");
            upstream = hook;
            action = claimHook();
        }
        if (action != null) action.run();
    }
    public boolean requestCancel() {
        Runnable action;
        synchronized (this) {
            if (state != State.RUNNING) return false;
            state = State.CANCEL_REQUESTED;
            action = claimHook();
        }
        if (action != null) action.run();
        return true;
    }
    public synchronized boolean emit(String token) {
        if (token == null || token.length() > 32) throw new IllegalArgumentException("token");
        if (state != State.RUNNING) return false;
        if (tokens.size() == 32) { state = State.FAILED; return false; }
        tokens.add(token);
        return true;
    }
    public synchronized void acknowledgeStopped() {
        if (state == State.CANCEL_REQUESTED) state = State.CANCELLED;
    }
    public synchronized void complete() {
        if (state == State.RUNNING) state = State.COMPLETED;
        // A completion callback alone is not proof that a requested cancellation stopped work.
    }
    public synchronized State state() { return state; }
    public synchronized List<String> snapshot() { return List.copyOf(tokens); }
    private static int checks;
    private static void check(boolean v) { if (!v) throw new AssertionError(); checks++; }
    private static void await(CountDownLatch l) throws InterruptedException {
        if (!l.await(2, TimeUnit.SECONDS)) throw new AssertionError("latch timeout");
    }
    private static void join(Thread t) throws InterruptedException {
        t.join(2000); if (t.isAlive()) { t.interrupt(); throw new AssertionError("thread leak"); }
    }
    public static void main(String[] args) throws Exception {
        CancelGeneration late = new CancelGeneration(); AtomicInteger calls = new AtomicInteger();
        check(late.requestCancel()); check(late.state() == State.CANCEL_REQUESTED);
        check(!late.emit("late")); late.attach(calls::incrementAndGet);
        check(calls.get() == 1); check(!late.requestCancel());
        late.complete(); check(late.state() == State.CANCEL_REQUESTED);
        late.acknowledgeStopped(); check(late.state() == State.CANCELLED);
        CancelGeneration afterStop = new CancelGeneration(); afterStop.requestCancel(); afterStop.acknowledgeStopped();
        AtomicInteger lateHooks = new AtomicInteger(); afterStop.attach(lateHooks::incrementAndGet); check(lateHooks.get() == 1);
        CancelGeneration done = new CancelGeneration(); done.complete();
        check(!done.requestCancel()); check(done.state() == State.COMPLETED);
        CancelGeneration broken = new CancelGeneration();
        broken.attach(() -> { throw new IllegalStateException("transport failure"); });
        try { broken.requestCancel(); throw new AssertionError(); }
        catch (IllegalStateException expected) { check(broken.state() == State.CANCEL_REQUESTED); }
        CancelGeneration live = new CancelGeneration(); CountDownLatch started = new CountDownLatch(1);
        Thread worker = new Thread(() -> {
            try { live.emit("first"); started.countDown(); Thread.sleep(10000); live.emit("unwanted"); }
            catch (InterruptedException expected) { Thread.currentThread().interrupt(); }
            finally { live.acknowledgeStopped(); }
        });
        AtomicInteger interrupts = new AtomicInteger();
        live.attach(() -> { interrupts.incrementAndGet(); worker.interrupt(); });
        worker.start(); await(started); check(live.requestCancel()); join(worker);
        check(interrupts.get() == 1); check(live.state() == State.CANCELLED);
        check(live.snapshot().equals(List.of("first"))); check(!live.emit("after"));
        for (int i = 0; i < 300; i++) {
            CancelGeneration race = new CancelGeneration(); AtomicInteger hooks = new AtomicInteger();
            CountDownLatch go = new CountDownLatch(1);
            Thread a = new Thread(() -> { try { await(go); race.requestCancel(); } catch (InterruptedException e) { throw new AssertionError(e); } });
            Thread b = new Thread(() -> { try { await(go); race.attach(hooks::incrementAndGet); } catch (InterruptedException e) { throw new AssertionError(e); } });
            a.start(); b.start(); go.countDown(); join(a); join(b);
            check(hooks.get() == 1); check(race.state() == State.CANCEL_REQUESTED);
            check(!race.requestCancel()); race.acknowledgeStopped(); check(race.state() == State.CANCELLED);
        }
        for (int i = 0; i < 300; i++) {
            CancelGeneration race = new CancelGeneration(); AtomicInteger hooks = new AtomicInteger(); race.attach(hooks::incrementAndGet);
            CountDownLatch go = new CountDownLatch(1);
            Thread a = new Thread(() -> { try { await(go); race.requestCancel(); } catch (InterruptedException e) { throw new AssertionError(e); } });
            Thread b = new Thread(() -> { try { await(go); race.complete(); } catch (InterruptedException e) { throw new AssertionError(e); } });
            a.start(); b.start(); go.countDown(); join(a); join(b);
            State s = race.state(); check(s == State.COMPLETED || s == State.CANCEL_REQUESTED);
            check(hooks.get() == (s == State.CANCEL_REQUESTED ? 1 : 0)); check(!race.emit("post terminal"));
        }
        CancelGeneration full = new CancelGeneration(); for (int i = 0; i < 32; i++) check(full.emit("x"));
        check(!full.emit("overflow")); check(full.state() == State.FAILED); check(full.snapshot().size() == 32);
        System.out.println("PASS " + checks + "; local state and real cooperative threads only");
    }
}

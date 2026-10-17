import java.util.concurrent.CancellationException;
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.ReentrantLock;

/** A small, fail-stop coordinator; callbacks must be short and non-reentrant. */
public final class TurnGate {
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition changed = lock.newCondition();
    private int turn;
    private boolean cancelled;

    public TurnGate(int firstTurn) { turn = firstTurn; }

    public void cancel() {
        lock.lock();
        try { cancelled = true; changed.signalAll(); }
        finally { lock.unlock(); }
    }

    public void step(int expected, int next, Runnable action)
            throws InterruptedException {
        try { lock.lockInterruptibly(); }
        catch (InterruptedException ex) { cancel(); throw ex; }
        try {
            // A notification is only a hint. Always recheck the predicate.
            while (!cancelled && turn != expected) changed.await();
            if (cancelled) throw new CancellationException("coordinator cancelled");
            action.run();              // Finish this output before publishing next turn.
            turn = next;
            changed.signalAll();       // Several roles share the same condition.
        } catch (InterruptedException ex) {
            cancelled = true;
            throw ex;                 // The method propagates interruption to its owner.
        } catch (RuntimeException | Error ex) {
            cancelled = true;
            throw ex;
        } finally {
            if (cancelled) changed.signalAll();
            lock.unlock();
        }
    }
}

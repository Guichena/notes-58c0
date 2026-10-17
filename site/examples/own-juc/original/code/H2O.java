import java.util.concurrent.CancellationException;
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.ReentrantLock;

/** One generation admits exactly 2 H and 1 O, then completes all three outputs. */
public final class H2O {
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition changed = lock.newCondition();
    private int hydrogens, oxygens, completed;
    private boolean formed, cancelled;

    public void hydrogen(Runnable releaseH) throws InterruptedException {
        atom(true, releaseH);
    }
    public void oxygen(Runnable releaseO) throws InterruptedException {
        atom(false, releaseO);
    }
    public void cancel() {
        lock.lock();
        try { cancelled = true; changed.signalAll(); }
        finally { lock.unlock(); }
    }
    private void atom(boolean hydrogen, Runnable out) throws InterruptedException {
        try { lock.lockInterruptibly(); }
        catch (InterruptedException ex) { cancel(); throw ex; }
        try {
            // No next-generation admission while this generation is printing.
            while (!cancelled && (formed || (hydrogen ? hydrogens == 2 : oxygens == 1)))
                changed.await();
            checkActive();
            if (hydrogen) hydrogens++; else oxygens++;
            if (hydrogens == 2 && oxygens == 1) {
                formed = true;
                changed.signalAll();
            }
            // Admitted atoms wait for the remaining partners.
            while (!cancelled && !formed) changed.await();
            checkActive();
            out.run();                 // Short callback, serialized for an atomic log entry.
            completed++;
            if (completed == 3) {
                hydrogens = oxygens = completed = 0;
                formed = false;        // Only the last output opens the next generation.
                changed.signalAll();
            }
        } catch (InterruptedException ex) {
            cancelled = true;
            throw ex;
        } catch (RuntimeException | Error ex) {
            cancelled = true;
            throw ex;
        } finally {
            if (cancelled) changed.signalAll();
            lock.unlock();
        }
    }
    private void checkActive() {
        if (cancelled) throw new CancellationException("molecule coordinator cancelled");
    }
}

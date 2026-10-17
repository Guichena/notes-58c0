import java.lang.ref.PhantomReference;
import java.lang.ref.Reference;
import java.lang.ref.ReferenceQueue;
import java.lang.ref.SoftReference;
import java.lang.ref.WeakReference;

public final class ReferenceSemantics {
    private static void check(boolean condition, String message) {
        if (!condition) {
            throw new AssertionError(message);
        }
    }

    private static void verifyOnce() {
        Object value = new Object();
        ReferenceQueue<Object> queue = new ReferenceQueue<>();
        SoftReference<Object> soft = new SoftReference<>(value);
        WeakReference<Object> weak = new WeakReference<>(value, queue);
        PhantomReference<Object> phantom = new PhantomReference<>(value, queue);
        try {
            check(soft.get() == value, "strong path preserves soft referent");
            Object snapshot = weak.get(); // Read once, then use this strong reference.
            check(snapshot == value, "strong path preserves weak referent");
            check(phantom.get() == null, "phantom get is always null");
            check(phantom.refersTo(value), "null get does not mean cleared");

            weak.clear();
            check(weak.get() == null, "clear removes referent");
            check(snapshot == value, "clear does not erase another strong reference");
            check(queue.poll() == null, "clear alone does not enqueue");
            check(weak.enqueue(), "explicit enqueue succeeds once");
            check(queue.poll() == weak, "queue contains the Reference object");
            check(queue.poll() == null, "queue drained");
            check(!weak.enqueue(), "removed reference cannot be enqueued again");

            WeakReference<Object> direct = new WeakReference<>(value, queue);
            check(direct.enqueue(), "enqueue without prior clear succeeds");
            check(direct.refersTo(null), "JDK 21 enqueue also clears");
            check(queue.poll() == direct, "explicit notification while value is live");

            check(phantom.enqueue(), "explicit phantom enqueue succeeds");
            check(queue.poll() == phantom, "phantom reference in queue");
            check(phantom.get() == null && phantom.refersTo(null), "phantom cleared");
            soft.clear();
            check(soft.get() == null, "soft clear removes referent");
            check(queue.poll() == null, "no remaining notifications");
        } finally {
            Reference.reachabilityFence(value);
        }
    }

    public static void main(String[] args) {
        for (int i = 0; i < 10_000; i++) {
            verifyOnce();
        }
        System.out.println("PASS: 10000 explicit reference API checks; no GC timing assertion");
    }
}

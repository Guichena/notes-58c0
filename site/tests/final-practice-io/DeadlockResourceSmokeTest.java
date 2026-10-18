import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.locks.ReentrantLock;

public final class DeadlockResourceSmokeTest {
    public static void main(String[] args) throws Exception {
        if (!DeadlockExamples.demonstrateAndRecover()) throw new AssertionError("deadlock cycle not detected/recovered");
        ReentrantLock a = new ReentrantLock(), b = new ReentrantLock();
        AtomicInteger calls = new AtomicInteger();
        if (!DeadlockExamples.withBoth(a, b, 1, TimeUnit.SECONDS, calls::incrementAndGet))
            throw new AssertionError("uncontended withBoth");
        if (calls.get() != 1 || a.isLocked() || b.isLocked()) throw new AssertionError("action/lock cleanup");
        try {
            DeadlockExamples.withBoth(a, b, 1, TimeUnit.SECONDS, () -> { throw new IllegalStateException("test"); });
            throw new AssertionError("missing action failure");
        } catch (IllegalStateException expected) {
            if (!expected.getMessage().equals("test")) throw expected;
        }
        if (a.isLocked() || b.isLocked()) throw new AssertionError("exception lock leak");
        System.out.println("DeadlockResourceSmokeTest PASS: detected/recovered two-thread lock cycle; withBoth action and exception lock release. Local bounded smoke only.");
    }
}

import java.util.*;
import java.util.concurrent.CancellationException;

public class ResourceFailureLab {
    interface Action { void run() throws Throwable; }
    interface Resource { void begin() throws Throwable; void commit() throws Throwable;
        void rollback() throws Throwable; void close() throws Throwable; }
    // Teaching contract: a commit error means UNKNOWN, so never replay automatically.
    static void execute(Resource r, Action work) throws Throwable {
        Throwable primary = null;
        boolean begun = false, commitAttempted = false;
        try {
            r.begin(); begun = true;
            work.run();
            commitAttempted = true; r.commit();
        } catch (Throwable failure) {
            primary = failure;
            if (begun && !commitAttempted) {
                try { r.rollback(); } catch (Throwable cleanup) { suppress(primary, cleanup); }
            }
        } finally {
            try { r.close(); }
            catch (Throwable cleanup) {
                if (primary == null) primary = cleanup;
                else suppress(primary, cleanup);
            }
        }
        if (primary != null) throw primary;
    }
    static void suppress(Throwable primary, Throwable secondary) {
        if (primary != secondary) primary.addSuppressed(secondary);
    }
    static final class Fake implements Resource {
        final List<String> calls = new ArrayList<>();
        final Map<String, Throwable> errors = new HashMap<>();
        void step(String name) throws Throwable { calls.add(name); if(errors.containsKey(name)) throw errors.get(name); }
        public void begin() throws Throwable { step("begin"); }
        public void commit() throws Throwable { step("commit"); }
        public void rollback() throws Throwable { step("rollback"); }
        public void close() throws Throwable { step("close"); }
    }
    static Throwable failure(Fake f, Action work) {
        try { execute(f, work); throw new AssertionError("expected failure"); }
        catch (Throwable t) { return t; }
    }
    static void check(boolean b) { if (!b) throw new AssertionError(); }
    public static void main(String[] args) throws Throwable {
        Fake success = new Fake(); execute(success, () -> {});
        check(success.calls.equals(List.of("begin","commit","close")));
        Fake failed = new Fake(); Throwable business = new Exception("business");
        Throwable rollback = new Exception("rollback"), close = new Exception("close");
        failed.errors.put("rollback", rollback); failed.errors.put("close", close);
        check(failure(failed, () -> {throw business;}) == business);
        check(Arrays.equals(business.getSuppressed(), new Throwable[]{rollback,close}));
        Fake same = new Fake(); Throwable shared = new Exception("same instance");
        same.errors.put("rollback", shared); same.errors.put("close", shared);
        check(failure(same, () -> {throw shared;}) == shared);
        check(shared.getSuppressed().length == 0);
        Fake begin = new Fake(); Throwable unavailable = new Exception("begin");
        begin.errors.put("begin", unavailable); check(failure(begin, () -> {}) == unavailable);
        check(begin.calls.equals(List.of("begin","close")));
        Fake commit = new Fake(); Throwable unknown = new Exception("commit outcome unknown");
        commit.errors.put("commit", unknown); check(failure(commit, () -> {}) == unknown);
        check(commit.calls.equals(List.of("begin","commit","close")));
        Fake cancel = new Fake(); Throwable cancellation = new CancellationException("cancelled");
        check(failure(cancel, () -> {throw cancellation;}) == cancellation);
        check(cancel.calls.equals(List.of("begin","rollback","close")));
        Fake closeOnly = new Fake(); Throwable closeFailure = new Exception("close only");
        closeOnly.errors.put("close", closeFailure);
        check(failure(closeOnly, () -> {}) == closeFailure);
        System.out.println("PASS 7 resource-failure scenarios");
    }
}

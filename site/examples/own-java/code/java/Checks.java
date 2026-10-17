import java.util.Objects;

final class Checks {
    private static int count;
    private Checks() {}
    @FunctionalInterface interface Action { void run() throws Throwable; }
    static void check(boolean value, String label) {
        count++;
        if (!value) throw new AssertionError(label);
    }
    static void equal(Object actual, Object expected, String label) {
        check(Objects.equals(actual, expected),
                label + ": expected=" + expected + ", actual=" + actual);
    }
    static <T extends Throwable> T expect(Class<T> type, Action action, String label) {
        count++;
        try { action.run(); }
        catch (Throwable failure) {
            if (type.isInstance(failure)) return type.cast(failure);
            throw new AssertionError(label + ": unexpected exception", failure);
        }
        throw new AssertionError(label + ": no exception");
    }
    static void done(String suite) {
        System.out.println("PASS " + suite + " checks=" + count);
    }
}

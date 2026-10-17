public final class FailureTools {
    @FunctionalInterface public interface Action { void run() throws Exception; }
    private FailureTools() {}
    public static void attach(Throwable primary, Throwable secondary) {
        if (secondary instanceof InterruptedException) Thread.currentThread().interrupt();
        // addSuppressed forbids self-suppression; disabled suppression is allowed.
        if (secondary != null && primary != secondary) primary.addSuppressed(secondary);
    }
    public static void cleanup(Throwable primary, Action action) throws Exception {
        try { action.run(); }
        catch (Exception | Error secondary) {
            if (secondary instanceof InterruptedException) Thread.currentThread().interrupt();
            if (primary == null) throw secondary;
            attach(primary, secondary);
        }
    }
    private static final class NoSuppression extends Exception {
        private static final long serialVersionUID = 1L;
        NoSuppression() { super("primary", null, false, true); }
    }
    static void require(boolean ok) { if (!ok) throw new AssertionError(); }
    public static void main(String[] args) throws Exception {
        Exception primary = new Exception("primary");
        cleanup(primary, () -> { throw primary; });
        require(primary.getSuppressed().length == 0);
        Exception secondary = new Exception("secondary");
        cleanup(primary, () -> { throw secondary; });
        require(primary.getSuppressed()[0] == secondary);
        NoSuppression disabled = new NoSuppression();
        cleanup(disabled, () -> { throw secondary; });
        require(disabled.getSuppressed().length == 0);
        Thread.interrupted();
        cleanup(primary, () -> { throw new InterruptedException("cleanup interrupted"); });
        require(Thread.currentThread().isInterrupted());
        Thread.interrupted();
        try {
            cleanup(null, () -> { throw secondary; });
            throw new AssertionError();
        } catch (Exception actual) { require(actual == secondary); }
        System.out.println("FailureTools OK");
    }
}

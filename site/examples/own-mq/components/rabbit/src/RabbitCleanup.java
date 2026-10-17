/** Narrow synchronous cleanup helper; actions must provide their own time bounds. */
public final class RabbitCleanup {
    private RabbitCleanup() { }
    public static void preserveInterrupt(Throwable failure) {
        if (failure instanceof InterruptedException) Thread.currentThread().interrupt();
    }
    public static void attach(Throwable primary, Throwable secondary) {
        preserveInterrupt(secondary);
        if (primary != secondary) primary.addSuppressed(secondary);
    }
    public static void after(Throwable primary, Runnable cleanup) {
        try { cleanup.run(); }
        catch (RuntimeException | Error secondary) {
            if (primary == null) throw secondary;
            attach(primary, secondary);
        }
    }
}

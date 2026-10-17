/** Accumulates failures while attempting every bounded cleanup step. */
public final class LabCleanup {
    private Throwable failure;
    public void record(Throwable next) {
        if (next == null) return;
        if (next instanceof InterruptedException) Thread.currentThread().interrupt();
        if (failure == null) failure = next;
        else if (failure != next) failure.addSuppressed(next);
    }
    public void attempt(Runnable step) {
        try { step.run(); } catch (Throwable next) { record(next); }
    }
    public void rethrow() throws Exception {
        if (failure instanceof Error error) throw error;
        if (failure instanceof Exception exception) throw exception;
        if (failure != null) throw new AssertionError(failure);
    }
}

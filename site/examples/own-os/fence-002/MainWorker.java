/** The main method's return does not terminate a started non-daemon worker. */
public final class MainWorker {
    private MainWorker() {}
    public static void main(String[] args) {
        Thread main = Thread.currentThread();
        Thread worker = new Thread(() -> {
            try {
                main.join(); // No sleep-based guess about whether main has exited.
                System.out.println("WORKER_AFTER_MAIN");
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException(e);
            }
        }, "owned-worker");
        worker.setDaemon(false);
        worker.start();
        System.out.println("MAIN_RETURNS");
        // Normally the owner joins workers. This deliberate fixture instead
        // shows the VM lifetime rule; joining here would create a wait cycle.
    }
}


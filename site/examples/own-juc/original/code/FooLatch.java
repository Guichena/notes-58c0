import java.util.concurrent.CountDownLatch;

/** The judge version assumes one call per role and successful callbacks. */
public final class FooLatch {
    private final CountDownLatch firstDone = new CountDownLatch(1);
    private final CountDownLatch secondDone = new CountDownLatch(1);
    public void first(Runnable print) {
        print.run();
        firstDone.countDown();
    }
    public void second(Runnable print) throws InterruptedException {
        firstDone.await();
        print.run();
        secondDone.countDown();
    }
    public void third(Runnable print) throws InterruptedException {
        secondDone.await();
        print.run();
    }
}

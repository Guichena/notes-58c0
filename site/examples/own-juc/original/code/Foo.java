public final class Foo {
    private final TurnGate gate = new TurnGate(1);
    public void first(Runnable printFirst) throws InterruptedException {
        gate.step(1, 2, printFirst);
    }
    public void second(Runnable printSecond) throws InterruptedException {
        gate.step(2, 3, printSecond);
    }
    public void third(Runnable printThird) throws InterruptedException {
        gate.step(3, 4, printThird);
    }
    public void cancel() { gate.cancel(); }
}

public final class FooBar {
    private final int n;
    private final TurnGate gate = new TurnGate(0);
    public FooBar(int n) {
        if (n < 0) throw new IllegalArgumentException("n must be nonnegative");
        this.n = n;
    }
    public void foo(Runnable printFoo) throws InterruptedException {
        for (int i = 0; i < n; i++) gate.step(0, 1, printFoo);
    }
    public void bar(Runnable printBar) throws InterruptedException {
        for (int i = 0; i < n; i++) gate.step(1, 0, printBar);
    }
    public void cancel() { gate.cancel(); }
}

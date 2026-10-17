import java.util.function.IntConsumer;

public final class ZeroEvenOdd {
    private final int n;
    private final TurnGate gate = new TurnGate(0);
    public ZeroEvenOdd(int n) {
        // This teaching implementation avoids int loop-counter overflow.
        if (n < 0 || n == Integer.MAX_VALUE)
            throw new IllegalArgumentException("0 <= n < Integer.MAX_VALUE");
        this.n = n;
    }
    public void zero(IntConsumer out) throws InterruptedException {
        for (int i = 1; i <= n; i++) {
            gate.step(0, (i & 1) == 1 ? 1 : 2, () -> out.accept(0));
        }
    }
    public void odd(IntConsumer out) throws InterruptedException {
        for (long i = 1; i <= n; i += 2) {
            final int value = (int) i;
            gate.step(1, 0, () -> out.accept(value));
        }
    }
    public void even(IntConsumer out) throws InterruptedException {
        for (long i = 2; i <= n; i += 2) {
            final int value = (int) i;
            gate.step(2, 0, () -> out.accept(value));
        }
    }
    public void cancel() { gate.cancel(); }
}

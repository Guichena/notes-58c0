import java.util.Objects;
import java.util.function.IntConsumer;

/** One call to even() and one to odd(); callbacks must be short, nonblocking, non-reentrant. */
public final class InclusiveAlternator {
    private final TurnGate gate = new TurnGate(0);
    private final IntConsumer out;
    public InclusiveAlternator(IntConsumer out) { this.out = Objects.requireNonNull(out); }
    public void even() throws InterruptedException {
        for (int i = 0; i <= 100; i += 2) {
            final int value = i;
            gate.step(0, value == 100 ? 2 : 1, () -> out.accept(value));
        }
    }
    public void odd() throws InterruptedException {
        for (int i = 1; i < 100; i += 2) {
            final int value = i;
            gate.step(1, 0, () -> out.accept(value));
        }
    }
    public void cancel() { gate.cancel(); }
}

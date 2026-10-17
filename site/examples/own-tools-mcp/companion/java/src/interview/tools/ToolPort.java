package interview.tools;

import java.time.Duration;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

/** Tool-level boundary. Not an agent scheduler, durable journal, authentication service or MCP transport. */
public interface ToolPort extends AutoCloseable {
    enum Status { OK, EMPTY_VALID, UNKNOWN_TOOL, DENIED, INVALID_ARGUMENT, CONFLICT,
        OVERLOADED, DEADLINE_EXCEEDED, CANCELLED, BUDGET_EXHAUSTED, RETRYABLE_FAILURE,
        INVALID_OUTPUT, FAILED, UNKNOWN }
    record Context(String tenant, String user, String resourceScope, Set<String> capabilities) {
        public Context {
            requireId(tenant); requireId(user); requireId(resourceScope);
            capabilities = Set.copyOf(capabilities);
        }
    }
    record Call(String callId, String operationId, String name, String argumentsJson) {
        public Call {
            requireId(callId); requireId(name); Objects.requireNonNull(operationId);
            if (operationId.length() > 128) throw new IllegalArgumentException("operation ID too long");
            Objects.requireNonNull(argumentsJson);
        }
    }
    record Reply(String callId, String operationId, Status status, String data, boolean effectUncertain) {
        public Reply {
            requireId(callId); Objects.requireNonNull(operationId); Objects.requireNonNull(status);
            Objects.requireNonNull(data);
            if (effectUncertain != (status == Status.UNKNOWN)) throw new IllegalArgumentException("uncertainty mismatch");
            if (effectUncertain && operationId.isBlank()) throw new IllegalArgumentException("unknown needs operation ID");
        }
    }
    final class Cancellation {
        private final AtomicBoolean cancelled = new AtomicBoolean();
        public boolean cancel() { return cancelled.compareAndSet(false, true); }
        public boolean isCancelled() { return cancelled.get(); }
    }
    final class Budget {
        private final long deadlineNanos;
        private final AtomicInteger remaining;
        private final Cancellation cancellation;
        /** Absolute System.nanoTime deadline, valid only inside this JVM. Never persist or transmit this number. */
        public Budget(long deadlineNanos, int attemptsRemaining, Cancellation cancellation) {
            long delta = deadlineNanos - System.nanoTime();
            long day = Duration.ofDays(1).toNanos();
            if (delta < -day || delta > day) throw new IllegalArgumentException("deadline outside local one-day horizon");
            if (attemptsRemaining < 0) throw new IllegalArgumentException("negative attempts");
            this.deadlineNanos = deadlineNanos; this.remaining = new AtomicInteger(attemptsRemaining);
            this.cancellation = Objects.requireNonNull(cancellation);
        }
        public static Budget after(Duration duration, int attempts, Cancellation cancellation) {
            long nanos = duration.toNanos();
            if (nanos <= 0 || nanos > Duration.ofDays(1).toNanos()) throw new IllegalArgumentException("duration outside bound");
            return new Budget(System.nanoTime() + nanos, attempts, cancellation);
        }
        public long remainingNanos() { return Math.max(0L, deadlineNanos - System.nanoTime()); }
        public int attemptsRemaining() { return remaining.get(); }
        public Cancellation cancellation() { return cancellation; }
        /** All loop iterations and internal retries share this one object. A reservation cannot underflow. */
        public boolean reserveAttempt() {
            for (;;) { int n = remaining.get(); if (n == 0) return false;
                if (remaining.compareAndSet(n, n - 1)) return true; }
        }
    }
    /**
     * Fresh authorization precedes any saved-result replay. An invocation never retries a mutation.
     * Interrupted waiting returns UNKNOWN if a mutation started, otherwise CANCELLED; restores interrupt flag.
     * UNKNOWN is not safe-to-retry. Query the original operation's authoritative outcome before any further write.
     * Cancellation/timeout bounds waiting for submitted work, not remote effects or non-cooperative worker lifetime.
     * The bundled executor runs trusted Validator and preflight/replay Authorizer callbacks synchronously on the caller.
     * Integration requires these callbacks to be local, bounded and nonblocking; deadline/cancellation does not preempt them.
     * An uncooperative callback can delay invoke beyond its deadline. This precondition is not runtime enforcement.
     */
    Reply invoke(Context context, Call call, Budget budget);
    @Override void close();
    private static void requireId(String s) {
        if (s == null || s.isBlank() || s.length() > 128) throw new IllegalArgumentException("invalid identifier");
    }
}

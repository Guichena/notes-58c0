import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/** One SKU, one JVM, retry allowed after cancellation. No database/Redis/MQ durability. */
public final class CancellationLedger {
    public enum State { HELD, PAID, CANCELLED }
    public record Order(String request, String user, long quantity, long generation,
                        long version, State state) { }
    public record Event(String request, long generation, long version, State state) { }
    private final long capacity;
    private long available;
    private final Map<String, Order> orders = new HashMap<>();
    private final Map<String, String> activeByUser = new HashMap<>();
    private final Map<String, Long> generations = new HashMap<>();
    private final List<Event> events = new ArrayList<>();
    public CancellationLedger(long capacity) {
        if (capacity < 0) throw new IllegalArgumentException("negative capacity");
        this.capacity = capacity; available = capacity;
    }
    public synchronized Order reserve(String request, String user, long quantity) {
        nonblank(request); nonblank(user);
        if (quantity <= 0) throw new IllegalArgumentException("positive quantity required");
        Order old = orders.get(request);
        if (old != null) {
            if (!old.user().equals(user) || old.quantity() != quantity)
                throw new IllegalArgumentException("request payload conflict");
            return old; // A cancelled request stays cancelled; a new purchase needs a new ID.
        }
        if (activeByUser.containsKey(user)) throw new IllegalStateException("already active");
        if (quantity > available) throw new IllegalStateException("sold out");
        long generation = Math.addExact(generations.getOrDefault(user, 0L), 1L);
        Order order = new Order(request, user, quantity, generation, 1, State.HELD);
        available -= quantity;
        orders.put(request, order); activeByUser.put(user, request); generations.put(user, generation);
        events.add(new Event(request, generation, 1, State.HELD));
        return order;
    }
    /** True only for the first successful HELD -> target transition; replays return false. */
    public synchronized boolean finish(String request, State target) {
        nonblank(request); Objects.requireNonNull(target);
        if (target == State.HELD) throw new IllegalArgumentException("terminal target required");
        Order old = orders.get(request);
        if (old == null) throw new IllegalArgumentException("unknown request");
        if (old.state() != State.HELD) return false;
        long nextAvailable = target == State.CANCELLED
                ? Math.addExact(available, old.quantity()) : available;
        Order next = new Order(request, old.user(), old.quantity(), old.generation(),
                old.version() + 1, target);
        available = nextAvailable; orders.put(request, next);
        if (target == State.CANCELLED) activeByUser.remove(old.user(), request);
        events.add(new Event(request, next.generation(), next.version(), target));
        return true;
    }
    public synchronized Order order(String request) { return orders.get(request); }
    public synchronized String activeRequest(String user) { return activeByUser.get(user); }
    public synchronized long available() { return available; }
    public synchronized List<Event> events() { return List.copyOf(events); }
    public synchronized void checkConservation() {
        long accounted = available;
        for (Order order : orders.values()) {
            if (order.state() != State.CANCELLED) {
                accounted = Math.addExact(accounted, order.quantity());
                if (!order.request().equals(activeByUser.get(order.user())))
                    throw new AssertionError("active marker mismatch");
            }
        }
        if (available < 0 || accounted != capacity) throw new AssertionError("inventory mismatch");
    }
    private static void nonblank(String value) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException("identifier required");
    }
}

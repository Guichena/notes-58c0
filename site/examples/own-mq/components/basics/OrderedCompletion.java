import java.util.*;

/** One partition, one owner thread. Not a Kafka client. */
public final class OrderedCompletion {
    public record Ticket(long epoch, long offset) {}
    private static final class Entry {
        final long offset, resume;
        boolean done;
        Entry(long offset, long resume) { this.offset = offset; this.resume = resume; }
    }
    private final Thread owner = Thread.currentThread();
    private final ArrayDeque<Entry> queue = new ArrayDeque<>();
    private final Map<Long, Entry> byOffset = new HashMap<>();
    private long epoch, safe, appendedResume;
    private void checkOwner() {
        if (Thread.currentThread() != owner) throw new IllegalStateException("wrong owner");
    }
    public void assign(long start) {
        checkOwner();
        if (start < 0) throw new IllegalArgumentException();
        epoch = Math.incrementExact(epoch);
        safe = appendedResume = start;
        queue.clear(); byOffset.clear();
    }
    // Actual delivered order and authoritative end position from this poll batch.
    public List<Ticket> register(List<Long> offsets, long nextPosition) {
        checkOwner();
        if (offsets.isEmpty()) throw new IllegalArgumentException("empty batch needs separate client handling");
        long prev = -1;
        for (long offset : offsets) {
            if (offset < appendedResume || offset <= prev || offset == Long.MAX_VALUE)
                throw new IllegalArgumentException("invalid delivery order");
            prev = offset;
        }
        if (nextPosition <= prev) throw new IllegalArgumentException("invalid successor");
        List<Ticket> result = new ArrayList<>();
        for (int i = 0; i < offsets.size(); i++) {
            long offset = offsets.get(i);
            long resume = i + 1 < offsets.size() ? offsets.get(i + 1) : nextPosition;
            Entry e = new Entry(offset, resume);
            queue.addLast(e); byOffset.put(offset, e);
            result.add(new Ticket(epoch, offset));
        }
        appendedResume = nextPosition;
        return List.copyOf(result);
    }
    public long complete(Ticket ticket) {
        checkOwner();
        if (ticket.epoch() != epoch) return safe;
        Entry e = byOffset.get(ticket.offset());
        if (e == null) return safe; // repeated completion or already removed
        e.done = true;
        while (!queue.isEmpty() && queue.peekFirst().done) {
            Entry head = queue.removeFirst();
            byOffset.remove(head.offset);
            safe = head.resume;
        }
        return safe;
    }
    public long safeOffset() { checkOwner(); return safe; }
    static void require(boolean ok) { if (!ok) throw new AssertionError(); }
    public static void main(String[] args) {
        OrderedCompletion tracker = new OrderedCompletion();
        tracker.assign(40);
        List<Ticket> tickets = tracker.register(List.of(40L, 42L, 47L), 50);
        require(tracker.complete(tickets.get(2)) == 40);
        require(tracker.complete(tickets.get(0)) == 42);
        require(tracker.complete(tickets.get(1)) == 50);
        require(tracker.complete(tickets.get(1)) == 50);
        Ticket old = tracker.register(List.of(50L), 51).get(0);
        tracker.assign(50);
        require(tracker.complete(old) == 50);
        Ticket current = tracker.register(List.of(50L), 51).get(0);
        require(tracker.complete(current) == 51);
        System.out.println("OrderedCompletion OK");
    }
}

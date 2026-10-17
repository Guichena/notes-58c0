import java.util.*;

/** Single-owner-thread algorithm. No Kafka, database or remote side effects. */
public final class SafeOffsetProgress {
    public record Cursor(long offset, Optional<Integer> leaderEpoch) {
        public Cursor {
            Objects.requireNonNull(leaderEpoch);
            if (offset < 0) throw new IllegalArgumentException("negative offset");
        }
        public static Cursor at(long offset) { return new Cursor(offset, Optional.empty()); }
    }
    public record Delivery(long offset, Optional<Integer> leaderEpoch) {
        public Delivery { Objects.requireNonNull(leaderEpoch); }
    }
    private static final class Slot {
        final long offset;
        Cursor resume;
        boolean done;
        Slot(long offset, Cursor resume) { this.offset = offset; this.resume = resume; }
    }
    private final int capacity;
    private final ArrayDeque<Slot> queue = new ArrayDeque<>();
    private final Map<Long, Slot> byOffset = new HashMap<>();
    private long epoch;
    private Cursor safe;
    private Cursor scanned;
    private boolean owned = true;
    public SafeOffsetProgress(long epoch, Cursor start, int capacity) {
        if (epoch < 0 || capacity <= 0) throw new IllegalArgumentException();
        this.epoch = epoch; this.safe = this.scanned = start; this.capacity = capacity;
    }
    public long epoch() { return epoch; }
    public Cursor safe() { return safe; }
    public Cursor scanned() { return scanned; }
    public int pending() { return queue.size(); }
    public boolean owned() { return owned; }
    /** Register a whole poll before dispatching any of it; next is that poll's next offset. */
    public void observe(List<Delivery> records, Cursor next) {
        if (!owned) throw new IllegalStateException("not owner");
        if (next.offset() < scanned.offset() || queue.size() + records.size() > capacity)
            throw new IllegalArgumentException("reset required or capacity exceeded");
        long previous = scanned.offset() - 1;
        for (Delivery d : records) {
            if (d.offset() <= previous || d.offset() < scanned.offset() || d.offset() >= next.offset())
                throw new IllegalArgumentException("delivery order/boundary");
            previous = d.offset();
        }
        Cursor first = records.isEmpty() ? next
                : new Cursor(records.get(0).offset(), scanned.leaderEpoch());
        // The scanned gap before this poll contains no newly delivered application records.
        // Commit metadata describes the PREVIOUS record, not the still-unprocessed successor.
        if (queue.isEmpty()) safe = first;
        else queue.peekLast().resume = first;
        for (int i = 0; i < records.size(); i++) {
            Delivery d = records.get(i);
            Cursor resume = i + 1 == records.size() ? next
                    : new Cursor(records.get(i + 1).offset(), d.leaderEpoch());
            Slot slot = new Slot(d.offset(), resume);
            queue.addLast(slot); byOffset.put(d.offset(), slot);
        }
        scanned = next;
    }
    /** Call only after the declared effect or durable responsibility transfer succeeds. */
    public boolean complete(long taskEpoch, long offset) {
        if (!owned || taskEpoch != epoch) return false;
        Slot slot = byOffset.get(offset);
        if (slot == null || slot.done) return false;
        slot.done = true;
        while (!queue.isEmpty() && queue.peekFirst().done) {
            Slot head = queue.removeFirst();
            safe = head.resume; byOffset.remove(head.offset);
        }
        return true;
    }
    public void invalidate() { owned = false; queue.clear(); byOffset.clear(); }
    /** Seek/reset/truncation is an explicit generation change, never a backwards observe(). */
    public void reset(long newEpoch, Cursor restart) {
        if (newEpoch <= epoch) throw new IllegalArgumentException("epoch must increase");
        queue.clear(); byOffset.clear(); epoch = newEpoch;
        safe = scanned = restart; owned = true;
    }
    private static List<Delivery> ds(long... xs) {
        return Arrays.stream(xs).mapToObj(x -> new Delivery(x, Optional.of(7))).toList();
    }
    private static int checks;
    private static void check(boolean b) { checks++; if (!b) throw new AssertionError(); }
    private static void invalid(Runnable r) {
        try { r.run(); throw new AssertionError(); }
        catch (IllegalArgumentException expected) { checks++; }
    }
    public static void main(String[] args) {
        int[][] orders = {{0,1,2},{0,2,1},{1,0,2},{1,2,0},{2,0,1},{2,1,0}};
        long[] offsets = {40,42,47};
        long[] successors = {42,47,50};
        for (int[] order : orders) {
            SafeOffsetProgress p = new SafeOffsetProgress(1, Cursor.at(40), 8);
            p.observe(ds(offsets), new Cursor(50, Optional.of(7)));
            boolean[] done = new boolean[3];
            for (int at : order) {
                p.complete(1, offsets[at]); done[at] = true;
                long expected = 40;
                for (int i = 0; i < 3 && done[i]; i++) expected = successors[i];
                check(p.safe().offset() == expected);
            }
            check(p.pending() == 0 && p.safe().leaderEpoch().orElseThrow() == 7);
        }
        SafeOffsetProgress p = new SafeOffsetProgress(1, Cursor.at(40), 8);
        p.observe(ds(40,42,47), Cursor.at(50));
        p.complete(1,47); check(p.safe().offset() == 40);
        p.observe(List.of(), new Cursor(55, Optional.of(8)));
        check(p.safe().offset() == 40 && p.scanned().offset() == 55);
        p.complete(1,40); check(p.safe().offset() == 42);
        p.complete(1,42); check(p.safe().offset() == 55);
        check(p.safe().leaderEpoch().orElseThrow() == 8);
        check(!p.complete(1,42));
        p.observe(List.of(), Cursor.at(60)); check(p.safe().offset() == 60);
        p.reset(2, Cursor.at(42)); p.observe(ds(42,47), Cursor.at(50));
        check(!p.complete(1,42) && p.safe().offset() == 42);
        p.complete(2,42); check(p.safe().offset() == 47);
        p.invalidate(); check(!p.complete(2,47));
        p.reset(3, Cursor.at(10));
        invalid(() -> p.observe(ds(10,10), Cursor.at(12)));
        check(p.pending() == 0 && p.safe().offset() == 10);
        invalid(() -> p.observe(ds(9), Cursor.at(12)));
        invalid(() -> p.observe(ds(10), Cursor.at(10)));
        p.observe(ds(12), Cursor.at(15)); check(p.safe().offset() == 12);
        p.observe(ds(17), Cursor.at(20));
        p.complete(3,12); check(p.safe().offset() == 17);
        p.complete(3,17); check(p.safe().offset() == 20);
        invalid(() -> p.observe(List.of(), Cursor.at(19)));
        invalid(() -> p.reset(3, Cursor.at(0)));
        SafeOffsetProgress small = new SafeOffsetProgress(1, Cursor.at(0), 1);
        invalid(() -> small.observe(ds(0,1), Cursor.at(2)));
        check(small.pending() == 0);
        SafeOffsetProgress epochs = new SafeOffsetProgress(1, Cursor.at(40), 8);
        epochs.observe(List.of(new Delivery(40, Optional.of(7)),
                new Delivery(42, Optional.of(8)), new Delivery(47, Optional.of(9))),
                new Cursor(50, Optional.of(9)));
        check(epochs.safe().leaderEpoch().isEmpty());
        epochs.complete(1,40); check(epochs.safe().offset() == 42
                && epochs.safe().leaderEpoch().orElseThrow() == 7);
        epochs.complete(1,42); check(epochs.safe().offset() == 47
                && epochs.safe().leaderEpoch().orElseThrow() == 8);
        epochs.complete(1,47); check(epochs.safe().offset() == 50
                && epochs.safe().leaderEpoch().orElseThrow() == 9);
        System.out.println("PASS SafeOffsetProgress checks=" + checks
                + "; six completion orders, sparse/empty/reset/lost/assignment-epoch/leader-epoch/capacity; model only");
    }
}

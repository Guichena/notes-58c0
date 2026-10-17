import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// Single-owner logical-time model: no timer thread, real clock, or callbacks.
// All times are nonnegative relative units; advanceTo is monotonic.
public final class TickWheel {
    public record Fired(long id, long dueTick) {}
    private final long quantum;
    private final List<LinkedHashMap<Long, Fired>> buckets;
    private final Map<Long, Integer> locations = new HashMap<>();
    private long now, tick, lastId;
    private final int maxPending;
    public TickWheel(long quantum, int slots, int maxPending) {
        if (quantum <= 0 || slots <= 0 || slots > 100_000 || maxPending < 0) {
            throw new IllegalArgumentException("bounds");
        }
        this.quantum = quantum;
        this.maxPending = maxPending;
        buckets = new ArrayList<>(slots);
        for (int i = 0; i < slots; i++) buckets.add(new LinkedHashMap<>());
    }
    // Delay zero deliberately means no earlier than the next tick.
    public long schedule(long delay) {
        if (delay < 0) throw new IllegalArgumentException("negative delay");
        if (locations.size() >= maxPending) throw new IllegalStateException("full");
        long deadline = Math.addExact(now, delay);
        long due = deadline / quantum;
        if (deadline % quantum != 0) due = Math.addExact(due, 1);
        if (due <= tick) due = Math.addExact(tick, 1);
        Math.multiplyExact(due, quantum); // Deadline must be representable by advanceTo.
        long id = Math.addExact(lastId, 1);
        int slot = (int) (due % buckets.size());
        Fired entry = new Fired(id, due);
        buckets.get(slot).put(id, entry);
        locations.put(id, slot);
        lastId = id;
        return id;
    }
    public boolean cancel(long id) {
        Integer slot = locations.remove(id);
        if (slot == null) return false;
        return buckets.get(slot).remove(id) != null;
    }
    public List<Fired> advanceTo(long time) {
        if (time < now) throw new IllegalArgumentException("backward time");
        long target = time / quantum;
        long steps = Math.min(target - tick, buckets.size());
        List<Fired> fired = new ArrayList<>();
        for (long i = 1; i <= steps; i++) {
            int slot = (int) ((tick % buckets.size() + i) % buckets.size());
            Iterator<Fired> it = buckets.get(slot).values().iterator();
            while (it.hasNext()) {
                Fired entry = it.next();
                if (entry.dueTick() <= target) {
                    fired.add(entry);
                    locations.remove(entry.id());
                    it.remove();
                }
            }
        }
        now = time;
        tick = target;
        return fired; // No ordering among different buckets is promised.
    }
    public int pending() { return locations.size(); }
}


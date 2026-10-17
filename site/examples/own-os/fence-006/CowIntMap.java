import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

/** Immutable String/Integer snapshots; writers serialize, readers do not lock. */
public final class CowIntMap {
    public record Snapshot(long version, Map<String, Integer> values) {
        public Snapshot { values = Map.copyOf(values); }
    }
    private final int maxEntries;
    private volatile Snapshot current = new Snapshot(0, Map.of());
    public CowIntMap(int maxEntries) {
        if (maxEntries < 1 || maxEntries > 10_000)
            throw new IllegalArgumentException("capacity");
        this.maxEntries = maxEntries;
    }
    public Snapshot snapshot() { return current; }
    /** Caller must not concurrently mutate updates during the input snapshot. */
    public synchronized long putAll(Map<String, Integer> updates) {
        Map<String, Integer> delta = Map.copyOf(Objects.requireNonNull(updates));
        Snapshot before = current;
        Map<String, Integer> next = new HashMap<>(before.values());
        next.putAll(delta);
        if (next.size() > maxEntries) throw new IllegalStateException("capacity");
        long version = Math.incrementExact(before.version());
        current = new Snapshot(version, next); // volatile publication/linearization
        return version;
    }
    public synchronized boolean remove(String key) {
        Objects.requireNonNull(key);
        Snapshot before = current;
        if (!before.values().containsKey(key)) return false;
        Map<String, Integer> next = new HashMap<>(before.values());
        next.remove(key);
        current = new Snapshot(Math.incrementExact(before.version()), next);
        return true;
    }
}


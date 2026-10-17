import java.nio.charset.StandardCharsets;
import java.util.*;

/** Bounded in-memory teaching model; not Kafka's file format or durability. */
public final class PartitionLogModel {
    public record Entry(long offset, String key, String value, int position) {}
    private static final class Segment {
        final long base;
        final List<Entry> entries = new ArrayList<>();
        final NavigableMap<Long, Integer> index = new TreeMap<>();
        Segment(long base) { this.base = base; }
        void rebuild() {
            index.clear();
            int pos = 0;
            for (int i = 0; i < entries.size(); i++) {
                Entry old = entries.get(i);
                Entry now = new Entry(old.offset(), old.key(), old.value(), pos);
                entries.set(i, now);
                if (i % 2 == 0) index.put(now.offset() - base, i);
                pos = Math.addExact(pos, 16 + now.key().getBytes(StandardCharsets.UTF_8).length
                        + (now.value() == null ? 0 : now.value().getBytes(StandardCharsets.UTF_8).length));
            }
        }
    }
    private final NavigableMap<Long, Segment> segments = new TreeMap<>();
    private long next;
    private long start;
    private int appended;
    public PartitionLogModel(long initial) {
        if (initial < 0) throw new IllegalArgumentException("negative start");
        next = start = initial;
    }
    public void append(long offset, String key, String value) {
        if (offset < next || offset == Long.MAX_VALUE || key == null || key.length() > 80
                || (value != null && value.length() > 1024) || appended >= 64)
            throw new IllegalArgumentException("bounded append/order");
        Segment s = segments.isEmpty() ? null : segments.lastEntry().getValue();
        if (s == null || s.entries.size() >= 4) {
            s = new Segment(offset);
            segments.put(offset, s);
        }
        s.entries.add(new Entry(offset, key, value, 0));
        s.rebuild();
        next = offset + 1;
        appended++;
    }
    /** Returns the first retained record at or after target, not an exact-ID lookup. */
    public Optional<Entry> findCeiling(long target) {
        if (target < start) throw new IllegalArgumentException("target before retained start");
        if (target >= next || segments.isEmpty()) return Optional.empty();
        Map.Entry<Long, Segment> floor = segments.floorEntry(target);
        long base = floor == null ? segments.firstKey() : floor.getKey();
        for (Segment s : segments.tailMap(base, true).values()) {
            Map.Entry<Long, Integer> near = s.index.floorEntry(target - s.base);
            int at = near == null ? 0 : near.getValue();
            for (int i = at; i < s.entries.size(); i++)
                if (s.entries.get(i).offset() >= target) return Optional.of(s.entries.get(i));
        }
        return Optional.empty();
    }
    /** Models removal of old key versions; keeps latest tombstone as a record. */
    public void compact() {
        Map<String, Long> latest = new HashMap<>();
        for (Segment s : segments.values())
            for (Entry e : s.entries) latest.put(e.key(), e.offset());
        for (Segment s : segments.values()) {
            s.entries.removeIf(e -> latest.get(e.key()) != e.offset());
            s.rebuild();
        }
    }
    /** Segment-granular retention, deliberately never removes the active segment. */
    public void deleteSegmentsEndingBefore(long boundary) {
        while (segments.size() > 1) {
            long first = segments.firstKey();
            long following = segments.higherKey(first);
            if (following > boundary) break;
            segments.remove(first);
            start = following;
        }
    }
    public void rebuildIndexes() { segments.values().forEach(Segment::rebuild); }
    private static int checks;
    private static void check(boolean b) { checks++; if (!b) throw new AssertionError(); }
    public static void main(String[] args) {
        PartitionLogModel log = new PartitionLogModel(1000);
        log.append(1000, "a", "v1"); log.append(1100, "b", "v1");
        log.append(1150, "a", "v2"); log.append(1200, "c", "v1");
        log.append(1300, "d", "v1"); log.append(1400, "b", null);
        check(log.findCeiling(1150).orElseThrow().offset() == 1150);
        check(log.findCeiling(1151).orElseThrow().offset() == 1200);
        check(log.findCeiling(1250).orElseThrow().offset() == 1300);
        check(log.findCeiling(1401).isEmpty());
        check(log.findCeiling(1150).orElseThrow().position() != 1150);
        log.compact();
        check(log.findCeiling(1000).orElseThrow().offset() == 1150);
        check(log.findCeiling(1400).orElseThrow().value() == null);
        log.rebuildIndexes();
        check(log.findCeiling(1100).orElseThrow().offset() == 1150);
        log.deleteSegmentsEndingBefore(1300);
        try { log.findCeiling(1200); throw new AssertionError(); }
        catch (IllegalArgumentException expected) { checks++; }
        log.rebuildIndexes();
        check(log.findCeiling(1300).orElseThrow().offset() == 1300);
        try { log.append(1300, "x", "bad"); throw new AssertionError(); }
        catch (IllegalArgumentException expected) { checks++; }
        check(new PartitionLogModel(0).findCeiling(0).isEmpty());
        System.out.println("PASS PartitionLogModel checks=" + checks + "; in-memory model only");
    }
}

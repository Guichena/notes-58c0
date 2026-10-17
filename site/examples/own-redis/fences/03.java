import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeSet;

/** Exact receipt-time window in one JVM. No Redis, durability, or event-time watermark. */
public final class WindowLeaderboard {
    public record Entry(String userId, String name, long score) { }
    private record Event(String id, String user, long time) { }
    private record Rank(String user, long score) { }
    private final long windowMillis;
    private final int maxEvents;
    private long lastTime;
    private final ArrayDeque<Event> events = new ArrayDeque<>();
    private final Map<String, Event> activeIds = new HashMap<>();
    private final Map<String, Long> counts = new HashMap<>();
    // ASCII IDs only: reverse lexical tie order matches Redis ZRANGE ... REV.
    private final TreeSet<Rank> ranks = new TreeSet<>(
            Comparator.comparingLong(Rank::score).reversed()
                    .thenComparing(Rank::user, Comparator.reverseOrder()));

    public WindowLeaderboard(long windowMillis, int maxEvents) {
        if (windowMillis <= 0 || maxEvents <= 0)
            throw new IllegalArgumentException("positive window and capacity required");
        this.windowMillis = windowMillis;
        this.maxEvents = maxEvents;
    }

    /** Same ID/same user while still in the window is a retry, not another click. */
    public synchronized boolean click(String eventId, String userId, long now) {
        identifier(eventId); identifier(userId);
        expire(now);
        Event old = activeIds.get(eventId);
        if (old != null) {
            if (!old.user().equals(userId))
                throw new IllegalArgumentException("event ID reused by a different user");
            return false;
        }
        if (events.size() == maxEvents)
            throw new IllegalStateException("window event capacity exceeded");
        Event event = new Event(eventId, userId, now);
        change(userId, 1);
        events.addLast(event);
        activeIds.put(eventId, event);
        return true;
    }

    /** Names must be an already-loaded, immutable snapshot; no network lookup under this lock. */
    public synchronized List<Entry> top(int k, long now, Map<String, String> names) {
        if (k < 0 || k > 100) throw new IllegalArgumentException("k must be 0..100");
        Objects.requireNonNull(names);
        expire(now);
        List<Entry> result = new ArrayList<>(k);
        for (Rank rank : ranks) {
            if (result.size() == k) break;
            result.add(new Entry(rank.user(), names.getOrDefault(rank.user(), rank.user()), rank.score()));
        }
        return List.copyOf(result);
    }

    private void expire(long now) {
        if (now < 0 || now < lastTime)
            throw new IllegalArgumentException("nonnegative nondecreasing receipt clock required");
        lastTime = now;
        // Nonnegative timestamps: subtraction cannot overflow. Window is (now-W, now].
        while (!events.isEmpty() && now - events.peekFirst().time() >= windowMillis) {
            Event event = events.removeFirst();
            activeIds.remove(event.id());
            change(event.user(), -1);
        }
    }

    private void change(String user, long delta) {
        long old = counts.getOrDefault(user, 0L);
        if (old != 0) ranks.remove(new Rank(user, old));
        long next = old + delta; // Bounded by maxEvents, an int.
        if (next == 0) counts.remove(user);
        else {
            counts.put(user, next);
            ranks.add(new Rank(user, next));
        }
    }

    private static void identifier(String text) {
        if (text == null || text.isEmpty() || text.length() > 128)
            throw new IllegalArgumentException("identifier length must be 1..128");
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (!(c >= 'a' && c <= 'z') && !(c >= 'A' && c <= 'Z')
                    && !(c >= '0' && c <= '9') && c != '_' && c != '-')
                throw new IllegalArgumentException("ASCII letters, digits, underscore or hyphen required");
        }
    }
}

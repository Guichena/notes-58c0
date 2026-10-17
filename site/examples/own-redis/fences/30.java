import java.util.*;

/** Java 21 executable specification. No Redis client, database, broker or durable storage. */
public final class ActivityMetrics {
    private ActivityMetrics() {}
    public record Interval(long startMs, long endMs) {
        public Interval {
            if (startMs < 0 || endMs < startMs) throw new IllegalArgumentException("interval");
        }
    }
    /** Half-open intervals, clipped first, then unioned. O(n log n), O(n) extra space. */
    public static long unionMillis(List<Interval> intervals, long fromMs, long toMs) {
        new Interval(fromMs, toMs);
        List<Interval> clipped = new ArrayList<>();
        for (Interval i : intervals) {
            long a = Math.max(i.startMs(), fromMs), b = Math.min(i.endMs(), toMs);
            if (a < b) clipped.add(new Interval(a, b));
        }
        clipped.sort(Comparator.comparingLong(Interval::startMs));
        long total = 0, start = 0, end = 0;
        boolean pending = false;
        for (Interval i : clipped) {
            if (!pending) { start = i.startMs(); end = i.endMs(); pending = true; }
            else if (i.startMs() <= end) end = Math.max(end, i.endMs());
            else { total = Math.addExact(total, end - start); start = i.startMs(); end = i.endMs(); }
        }
        return pending ? Math.addExact(total, end - start) : 0;
    }
    /** Window start -> union milliseconds. Explicit finite range; no per-report rounding. */
    public static Map<Long, Long> windows(List<Interval> intervals, long fromMs, long toMs, long widthMs) {
        new Interval(fromMs, toMs);
        if (widthMs <= 0) throw new IllegalArgumentException("width");
        Map<Long, Long> out = new LinkedHashMap<>();
        if (fromMs == toMs) return out;
        long base = (fromMs / widthMs) * widthMs;
        while (base < toMs) {
            long end = widthMs > Long.MAX_VALUE - base ? Long.MAX_VALUE : base + widthMs;
            out.put(base, unionMillis(intervals, Math.max(base, fromMs), Math.min(end, toMs)));
            if (end == Long.MAX_VALUE) break;
            base = end;
        }
        return out;
    }
    public record Session(String tenant, String user, String article, String session, long generation) {
        public Session {
            Objects.requireNonNull(tenant); Objects.requireNonNull(user);
            Objects.requireNonNull(article); Objects.requireNonNull(session);
            if (generation < 0) throw new IllegalArgumentException("generation");
        }
    }
    public record Sample(Session session, String eventId, long sequence, long cumulativeMs) {
        public Sample {
            Objects.requireNonNull(session); Objects.requireNonNull(eventId);
            if (sequence < 0 || cumulativeMs < 0) throw new IllegalArgumentException("sample");
        }
    }
    private record EventKey(Session session, String eventId) {}
    /** Session totals only; returned deltas depend on arrival order.
     * No atomic durable handoff to AtomicLedger and no event-time window reconstruction. */
    public static final class Cumulative {
        private final long maximumSessionMs;
        private final Map<EventKey, Sample> seen = new HashMap<>();
        private final Map<Session, NavigableMap<Long, Long>> samples = new HashMap<>();
        private long total;
        public Cumulative(long maximumSessionMs) {
            if (maximumSessionMs < 0) throw new IllegalArgumentException("maximum");
            this.maximumSessionMs = maximumSessionMs;
        }
        public synchronized long accept(Sample s) {
            if (s.cumulativeMs() > maximumSessionMs) throw new IllegalArgumentException("cap");
            EventKey key = new EventKey(s.session(), s.eventId());
            Sample old = seen.get(key);
            if (old != null) {
                if (!old.equals(s)) throw new IllegalArgumentException("event identity conflict");
                return 0;
            }
            NavigableMap<Long, Long> existing = samples.get(s.session());
            NavigableMap<Long, Long> next = existing == null ? new TreeMap<>() : new TreeMap<>(existing);
            Long same = next.get(s.sequence());
            if (same != null && same != s.cumulativeMs()) throw new IllegalArgumentException("sequence conflict");
            var lower = next.lowerEntry(s.sequence());
            var higher = next.higherEntry(s.sequence());
            if (lower != null && lower.getValue() > s.cumulativeMs()
                    || higher != null && higher.getValue() < s.cumulativeMs())
                throw new IllegalArgumentException("non-monotone cumulative sequence");
            long previous = next.isEmpty() ? 0 : next.lastEntry().getValue();
            next.put(s.sequence(), s.cumulativeMs());
            long delta = next.lastEntry().getValue() - previous;
            long newTotal = Math.addExact(total, delta); // validate before any mutation
            samples.put(s.session(), next); seen.put(key, s); total = newTotal;
            return delta;
        }
        public synchronized long total() { return total; }
    }
    public record Route(int version, int bucket) {
        public Route { if (version < 0 || bucket < 0) throw new IllegalArgumentException("route"); }
    }
    /** The returned route must be persisted with the canonical event, never recomputed on retry. */
    public static Route assignRoute(String aggregationIdentity, int version, int bucketCount) {
        Objects.requireNonNull(aggregationIdentity);
        if (bucketCount <= 0) throw new IllegalArgumentException("bucket count");
        return new Route(version, Math.floorMod(aggregationIdentity.hashCode(), bucketCount));
    }
    public record Contribution(String eventId, String counter, Route route, long deltaMs) {
        public Contribution {
            Objects.requireNonNull(eventId); Objects.requireNonNull(counter); Objects.requireNonNull(route);
            if (deltaMs < 0) throw new IllegalArgumentException("delta");
        }
    }
    public record Counter(String name, Route route) {}
    /** Models a single atomic commit with global event identity. It is NOT a persistent DB transaction. */
    public static final class AtomicLedger {
        private Map<String, Contribution> events = new HashMap<>();
        private Map<String, List<Contribution>> batches = new HashMap<>();
        private Map<Counter, Long> totals = new HashMap<>();
        public synchronized void apply(String batchId, List<Contribution> input, boolean failBeforeCommit) {
            Objects.requireNonNull(batchId);
            List<Contribution> batch = List.copyOf(input);
            List<Contribution> prior = batches.get(batchId);
            if (prior != null) {
                if (!prior.equals(batch)) throw new IllegalArgumentException("batch identity conflict");
                return;
            }
            Map<String, Contribution> e = new HashMap<>(events);
            Map<Counter, Long> t = new HashMap<>(totals);
            for (Contribution c : batch) {
                Contribution old = e.putIfAbsent(c.eventId(), c);
                if (old != null) {
                    if (!old.equals(c)) throw new IllegalArgumentException("event identity conflict");
                    continue;
                }
                Counter k = new Counter(c.counter(), c.route());
                t.put(k, Math.addExact(t.getOrDefault(k, 0L), c.deltaMs()));
            }
            if (failBeforeCommit) throw new IllegalStateException("simulated pre-commit failure");
            Map<String, List<Contribution>> b = new HashMap<>(batches); b.put(batchId, batch);
            events = e; totals = t; batches = b;
        }
        public synchronized Map<Counter, Long> snapshot() { return Map.copyOf(totals); }
        public synchronized int eventCount() { return events.size(); }
    }
    private record Connection(String user, String session) {}
    private record Lease(long generation, boolean open, long lastSeenMs) {}
    /** Recent activity and open connections are intentionally distinct views. */
    public static final class Presence {
        private final Map<Connection, Lease> leases = new HashMap<>();
        private final Map<String, Long> userLastSeen = new HashMap<>();
        private long clock;
        private void now(long nowMs) {
            if (nowMs < clock) throw new IllegalArgumentException("trusted clock regressed");
            clock = nowMs;
        }
        public synchronized void open(String user, String session, long generation) {
            Objects.requireNonNull(user); Objects.requireNonNull(session);
            if (generation < 0) throw new IllegalArgumentException("generation");
            Connection k = new Connection(user, session); Lease old = leases.get(k);
            if (old != null && generation <= old.generation()) throw new IllegalArgumentException("old generation");
            leases.put(k, new Lease(generation, true, -1));
        }
        /** seenMs is trusted receipt time, not arbitrary client time. nowMs is processing time. */
        public synchronized boolean heartbeat(String user, String session, long generation,
                                               long seenMs, long nowMs) {
            if (seenMs < 0 || seenMs > nowMs) throw new IllegalArgumentException("future/invalid receipt");
            now(nowMs);
            Connection k = new Connection(user, session); Lease old = leases.get(k);
            if (old == null || !old.open() || old.generation() != generation) return false;
            leases.put(k, new Lease(generation, true, Math.max(old.lastSeenMs(), seenMs)));
            userLastSeen.merge(user, seenMs, Math::max);
            return true;
        }
        public synchronized boolean close(String user, String session, long generation) {
            Connection k = new Connection(user, session); Lease old = leases.get(k);
            if (old == null || !old.open() || old.generation() != generation) return false;
            leases.put(k, new Lease(generation, false, old.lastSeenMs()));
            return true; // tombstone remains; recent activity remains
        }
        private long cutoff(long nowMs, long windowMs) {
            if (windowMs < 0) throw new IllegalArgumentException("window");
            now(nowMs); return windowMs > nowMs ? 0 : nowMs - windowMs;
        }
        public synchronized long recentUsers(long nowMs, long windowMs) {
            long c = cutoff(nowMs, windowMs);
            return userLastSeen.values().stream().filter(t -> t >= c && t <= nowMs).count();
        }
        public synchronized long activeConnections(long nowMs, long windowMs) {
            long c = cutoff(nowMs, windowMs);
            return leases.values().stream().filter(l -> l.open() && l.lastSeenMs() >= c
                    && l.lastSeenMs() <= nowMs).count();
        }
        public synchronized long connectedUsers(long nowMs, long windowMs) {
            long c = cutoff(nowMs, windowMs); Set<String> users = new HashSet<>();
            leases.forEach((k,l) -> { if (l.open() && l.lastSeenMs() >= c && l.lastSeenMs() <= nowMs) users.add(k.user()); });
            return users.size();
        }
        /** Fixed configured retention must be >= every supported query window. */
        public synchronized void cleanupRecent(long nowMs, long retentionMs) {
            long c = cutoff(nowMs, retentionMs);
            userLastSeen.entrySet().removeIf(e -> e.getValue() < c); // exclusive old boundary
        }
    }

}

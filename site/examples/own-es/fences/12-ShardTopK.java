import java.util.*;

/** Exact teaching model. Inputs are a stable snapshot with globally comparable scores. */
public final class ShardTopK {
    public static final int MAX_WINDOW = 100_000;
    public record Hit(long id, double score) {
        public Hit {
            if (!Double.isFinite(score)) throw new IllegalArgumentException("finite score required");
            if (score == 0.0) score = 0.0; // Treat -0.0 and +0.0 as the same score.
        }
    }
    public record Shard(String name, boolean successful, List<Hit> hits) {
        public Shard {
            Objects.requireNonNull(name, "shard name");
            if (name.isBlank()) throw new IllegalArgumentException("blank shard name");
            hits = List.copyOf(Objects.requireNonNull(hits, "hits"));
            if (!successful && !hits.isEmpty())
                throw new IllegalArgumentException("failed shard cannot contribute partial hits");
        }
    }
    public static final class IncompleteSearch extends IllegalStateException {
        public IncompleteSearch(String message) { super(message); }
    }
    public static final Comparator<Hit> BEST =
            Comparator.comparingDouble(Hit::score).reversed().thenComparingLong(Hit::id);
    private ShardTopK() {}
    private static int window(int from, int size) {
        if (from < 0 || size < 0) throw new IllegalArgumentException("negative from/size");
        long window = (long) from + size;
        if (window > MAX_WINDOW) throw new IllegalArgumentException("teaching window limit");
        return (int) window;
    }
    private static List<Hit> select(Iterable<Hit> input, int k) {
        if (k == 0) return List.of();
        PriorityQueue<Hit> heap = new PriorityQueue<>(BEST.reversed());
        for (Hit hit : input) {
            if (heap.size() < k) heap.add(hit);
            else if (BEST.compare(hit, heap.peek()) < 0) {
                heap.remove();
                heap.add(hit);
            }
        }
        List<Hit> result = new ArrayList<>(heap);
        result.sort(BEST);
        return List.copyOf(result);
    }
    public static List<Hit> top(List<Hit> input, int k) {
        window(0, k);
        List<Hit> copy = List.copyOf(Objects.requireNonNull(input, "input"));
        Set<Long> ids = new HashSet<>();
        for (Hit hit : copy) if (!ids.add(hit.id()))
            throw new IllegalArgumentException("duplicate document ID");
        return select(copy, k);
    }
    /** All expected logical shards must be represented exactly once, even for size=0. */
    public static List<Hit> page(Set<String> expectedShards, List<Shard> shards,
                                 int from, int size) {
        int k = window(from, size);
        Set<String> expected = Set.copyOf(Objects.requireNonNull(expectedShards));
        for (String name : expected) if (name.isBlank())
            throw new IllegalArgumentException("blank expected shard");
        List<Shard> copy = List.copyOf(Objects.requireNonNull(shards));
        Set<String> seen = new HashSet<>();
        Set<Long> ids = new HashSet<>();
        for (Shard shard : copy) {
            if (!expected.contains(shard.name()) || !seen.add(shard.name()))
                throw new IllegalArgumentException("unexpected or duplicate shard");
            if (!shard.successful()) throw new IncompleteSearch("failed shard: " + shard.name());
            for (Hit hit : shard.hits()) if (!ids.add(hit.id()))
                throw new IllegalArgumentException("IDs must be globally unique");
        }
        if (!seen.equals(expected)) throw new IncompleteSearch("missing logical shard");
        if (size == 0) return List.of();
        List<Hit> candidates = new ArrayList<>();
        for (Shard shard : copy) candidates.addAll(select(shard.hits(), k));
        List<Hit> prefix = select(candidates, k);
        return List.copyOf(prefix.subList(Math.min(from, prefix.size()), prefix.size()));
    }
}

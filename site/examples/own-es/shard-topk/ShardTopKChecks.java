import java.util.*;

public final class ShardTopKChecks {
    private static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }
    private static void rejects(Class<? extends Throwable> type, Runnable action) {
        try { action.run(); }
        catch (Throwable error) {
            if (type.isInstance(error)) return;
            throw new AssertionError("wrong exception", error);
        }
        throw new AssertionError("expected " + type.getSimpleName());
    }
    private static ShardTopK.Hit h(long id, double score) { return new ShardTopK.Hit(id, score); }
    private static ShardTopK.Shard s(String name, ShardTopK.Hit... hits) {
        return new ShardTopK.Shard(name, true, List.of(hits));
    }
    // Independent selection-sort oracle: does not call the implementation comparator.
    private static List<ShardTopK.Hit> oracle(List<ShardTopK.Hit> input, int from, int size) {
        List<ShardTopK.Hit> sorted = new ArrayList<>(input);
        for (int i = 0; i < sorted.size(); i++) {
            int best = i;
            for (int j = i + 1; j < sorted.size(); j++) {
                var a = sorted.get(j); var b = sorted.get(best);
                if (a.score() > b.score() || (a.score() == b.score() && a.id() < b.id())) best = j;
            }
            Collections.swap(sorted, i, best);
        }
        int lo = Math.min(from, sorted.size());
        int hi = Math.min(from + size, sorted.size());
        return List.copyOf(sorted.subList(lo, hi));
    }
    public static void main(String[] args) {
        Set<String> names = Set.of("a", "b", "c");
        List<ShardTopK.Shard> shards = List.of(s("a", h(3, 9), h(1, 9)),
                s("b", h(4, -2), h(2, 9)), s("c"));
        check(ShardTopK.page(names, shards, 1, 2).equals(List.of(h(2, 9), h(3, 9))), "offset and tie");
        check(ShardTopK.page(names, shards, 9, 3).isEmpty(), "from past end");
        check(ShardTopK.page(names, shards, 0, 0).isEmpty(), "zero size");
        check(ShardTopK.page(Set.of(), List.of(), 0, 4).isEmpty(), "empty corpus");
        check(ShardTopK.top(List.of(h(Long.MAX_VALUE, 0.0), h(Long.MIN_VALUE, -0.0)), 9)
                .equals(List.of(h(Long.MIN_VALUE, 0), h(Long.MAX_VALUE, 0))), "long IDs and signed zero");
        rejects(IllegalArgumentException.class, () -> h(1, Double.NaN));
        rejects(IllegalArgumentException.class, () -> h(1, Double.POSITIVE_INFINITY));
        rejects(IllegalArgumentException.class, () -> h(1, Double.NEGATIVE_INFINITY));
        rejects(IllegalArgumentException.class, () -> ShardTopK.top(List.of(h(1, 1), h(1, 0)), 0));
        rejects(IllegalArgumentException.class, () -> ShardTopK.page(Set.of("a", "b"),
                List.of(s("a", h(1, 9)), s("b", h(1, 2))), 0, 1));
        rejects(IllegalArgumentException.class, () -> ShardTopK.page(names, shards, -1, 1));
        rejects(IllegalArgumentException.class, () -> ShardTopK.page(names, shards, 0, -1));
        rejects(IllegalArgumentException.class, () -> ShardTopK.page(names, shards, Integer.MAX_VALUE, 2));
        rejects(IllegalArgumentException.class, () -> ShardTopK.page(Set.of("a"), List.of(s("x")), 0, 1));
        rejects(IllegalArgumentException.class, () -> ShardTopK.page(Set.of("a"), List.of(s("a"), s("a")), 0, 1));
        rejects(NullPointerException.class, () -> ShardTopK.top(null, 0));
        rejects(NullPointerException.class, () -> ShardTopK.top(Arrays.asList(h(1, 2), null), 0));
        rejects(ShardTopK.IncompleteSearch.class, () -> ShardTopK.page(names, List.of(s("a")), 0, 0));
        rejects(ShardTopK.IncompleteSearch.class, () -> ShardTopK.page(Set.of("a"),
                List.of(new ShardTopK.Shard("a", false, List.of())), 0, 0));
        List<ShardTopK.Hit> mutable = new ArrayList<>(List.of(h(1, 4)));
        var copied = new ShardTopK.Shard("a", true, mutable);
        mutable.clear();
        check(copied.hits().size() == 1, "defensive copy");
        rejects(UnsupportedOperationException.class, () -> copied.hits().clear());
        Random random = new Random(153);
        for (int trial = 0; trial < 2000; trial++) {
            int count = 1 + random.nextInt(8), n = random.nextInt(90);
            List<List<ShardTopK.Hit>> data = new ArrayList<>();
            for (int i = 0; i < count; i++) data.add(new ArrayList<>());
            List<ShardTopK.Hit> all = new ArrayList<>();
            for (int id = 0; id < n; id++) {
                var hit = h(id - 50L, random.nextInt(9) - 4);
                all.add(hit); data.get(random.nextInt(count)).add(hit);
            }
            List<ShardTopK.Shard> parts = new ArrayList<>(); Set<String> expected = new HashSet<>();
            for (int i = 0; i < count; i++) {
                expected.add("s" + i); parts.add(new ShardTopK.Shard("s" + i, true, data.get(i)));
            }
            int from = random.nextInt(110), size = random.nextInt(110);
            var result = ShardTopK.page(expected, parts, from, size);
            check(result.equals(oracle(all, from, size)), "oracle " + trial);
            Collections.shuffle(parts, random);
            check(result.equals(ShardTopK.page(expected, parts, from, size)), "shard order " + trial);
        }
        System.out.println("PASS fixed contracts and 2000 independent distributed-page oracle cases");
    }
}

import java.util.ArrayList;
import java.util.BitSet;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;

public final class AdIndexChecks {
    private static BitSet bits(int... ids) {
        BitSet result = new BitSet();
        for (int id : ids) result.set(id);
        return result;
    }
    private static void check(boolean ok, String message) {
        if (!ok) throw new AssertionError(message);
    }
    private static void expectNull(Runnable action) {
        try {
            action.run();
        } catch (NullPointerException expected) {
            return;
        }
        throw new AssertionError("null must be rejected");
    }
    private static List<BitSet> snapshots(List<BitSet> input) {
        List<BitSet> copy = new ArrayList<>();
        for (BitSet value : input) copy.add((BitSet) value.clone());
        return copy;
    }
    private static boolean member(List<BitSet> lists, int id) {
        for (BitSet list : lists) if (list.get(id)) return true;
        return false;
    }
    private static void fixedCases() {
        BitSet universe = bits(0, 1, 2, 3);
        BitSet d = bits(0, 2), e = bits(1, 2, 99), forbidden = bits(1, 3);
        check(AdRecall.recall(universe, List.of(d, e), List.of(forbidden))
                .equals(bits(0, 2)), "advertisement example");
        check(AdRecall.recall(universe, List.of(), List.of()).isEmpty(), "empty allowed");
        check(AdRecall.recall(universe, List.of(d, d), List.of(d)).isEmpty(), "all denied");
        check(AdRecall.recall(bits(), List.of(d), List.of()).isEmpty(), "empty universe");
        List<Set<String>> docs = List.of(Set.of("region=US", "kind=d"),
                Set.of("category=US", "kind=e"), Set.of());
        AdInvertedIndex index = new AdInvertedIndex(docs);
        check(index.query(bits(0, 1, 2, 99), List.of(), Set.of()).equals(bits(0, 1, 2)),
                "unconstrained inside live universe");
        check(index.query(universe, List.of(Set.of()), Set.of()).isEmpty(), "empty OR group");
        check(index.query(universe, List.of(Set.of("region=US")), Set.of()).equals(bits(0)),
                "field/value identity");
        check(index.query(universe, List.of(), Set.of("unknown")).equals(bits(0, 1, 2)),
                "unknown negative term");
        check(index.query(bits(1), List.of(Set.of("region=US")), Set.of()).isEmpty(),
                "unauthorized match");
        check(new AdInvertedIndex(List.of()).query(universe, List.of(), Set.of()).isEmpty(),
                "empty index");
        expectNull(() -> AdRecall.recall(null, List.of(), List.of()));
        expectNull(() -> AdRecall.recall(universe, Collections.singletonList(null), List.of()));
        expectNull(() -> new AdInvertedIndex(Collections.singletonList(null)));
        expectNull(() -> index.query(universe, Collections.singletonList(null), Set.of()));
        expectNull(() -> index.query(universe, List.of(), Collections.singleton(null)));
    }
    private static void randomIndex() {
        Random random = new Random(163);
        String[] terms = {"a", "b", "c", "d", "e"};
        for (int trial = 0; trial < 3000; trial++) {
            List<Set<String>> docs = new ArrayList<>();
            int n = random.nextInt(60);
            for (int id = 0; id < n; id++) {
                Set<String> doc = new HashSet<>();
                for (String term : terms) if (random.nextBoolean()) doc.add(term);
                docs.add(doc);
            }
            AdInvertedIndex index = new AdInvertedIndex(docs);
            BitSet authorized = new BitSet();
            for (int id = 0; id < n + 5; id++) if (random.nextBoolean()) authorized.set(id);
            List<Set<String>> groups = new ArrayList<>();
            for (int i = 0, count = random.nextInt(4); i < count; i++) {
                Set<String> group = new HashSet<>();
                for (String term : terms) if (random.nextBoolean()) group.add(term);
                groups.add(group);
            }
            Set<String> excluded = new HashSet<>();
            for (String term : terms) if (random.nextInt(4) == 0) excluded.add(term);
            BitSet expected = new BitSet();
            for (int id = 0; id < n; id++) {
                boolean ok = authorized.get(id) && Collections.disjoint(docs.get(id), excluded);
                for (Set<String> group : groups) ok &= !Collections.disjoint(docs.get(id), group);
                if (ok) expected.set(id);
            }
            BitSet before = (BitSet) authorized.clone();
            BitSet actual = index.query(authorized, groups, excluded);
            check(actual.equals(expected), "index oracle " + trial);
            check(authorized.equals(before), "authorized input mutated");
            actual.flip(0, n + 10);
            check(index.query(authorized, groups, excluded).equals(expected), "index state leaked");
        }
    }
    private static void randomRecall() {
        Random random = new Random(171);
        for (int trial = 0; trial < 3000; trial++) {
            int n = random.nextInt(80);
            BitSet universe = new BitSet();
            for (int id = 0; id < n; id++) if (random.nextBoolean()) universe.set(id);
            List<BitSet> allowed = new ArrayList<>(), denied = new ArrayList<>();
            for (List<BitSet> list : List.of(allowed, denied)) {
                for (int i = 0, count = random.nextInt(5); i < count; i++) {
                    BitSet posting = new BitSet();
                    for (int id = 0; id < n + 5; id++) if (random.nextBoolean()) posting.set(id);
                    list.add(posting);
                }
            }
            BitSet expected = new BitSet();
            for (int id = 0; id < n; id++) {
                if (universe.get(id) && member(allowed, id) && !member(denied, id)) expected.set(id);
            }
            BitSet before = (BitSet) universe.clone();
            List<BitSet> beforeAllowed = snapshots(allowed), beforeDenied = snapshots(denied);
            BitSet actual = AdRecall.recall(universe, allowed, denied);
            check(actual.equals(expected), "recall oracle " + trial);
            check(universe.equals(before) && allowed.equals(beforeAllowed)
                    && denied.equals(beforeDenied), "recall input mutated");
            actual.flip(0, n + 10);
            check(AdRecall.recall(universe, allowed, denied).equals(expected), "recall state leaked");
        }
    }
    public static void main(String[] args) {
        fixedCases();
        randomIndex();
        randomRecall();
        System.out.println("PASS fixed boundary cases; 3000 index + 3000 recall oracle cases");
    }
}

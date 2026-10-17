import java.util.BitSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class AdInvertedIndex {
    private final Map<String, BitSet> postings = new HashMap<>();
    private final BitSet live = new BitSet();

    public AdInvertedIndex(List<Set<String>> documents) {
        Objects.requireNonNull(documents, "documents");
        for (int id = 0; id < documents.size(); id++) {
            live.set(id);
            for (String token : Objects.requireNonNull(documents.get(id), "document")) {
                postings.computeIfAbsent(Objects.requireNonNull(token, "token"),
                        ignored -> new BitSet()).set(id);
            }
        }
    }

    // AND of OR groups, excluding ANY forbidden term, inside authorized live IDs.
    // No groups: no positive restriction. One empty group: no matches.
    public BitSet query(BitSet authorized, List<Set<String>> anyGroups,
                        Set<String> excluded) {
        Objects.requireNonNull(anyGroups, "groups");
        Objects.requireNonNull(excluded, "excluded");
        BitSet result = (BitSet) Objects.requireNonNull(authorized, "authorized").clone();
        result.and(live);
        for (Set<String> group : anyGroups) {
            BitSet union = new BitSet();
            for (String term : Objects.requireNonNull(group, "group")) {
                BitSet posting = postings.get(Objects.requireNonNull(term, "term"));
                if (posting != null) union.or(posting);
            }
            result.and(union);
        }
        for (String term : excluded) {
            BitSet posting = postings.get(Objects.requireNonNull(term, "term"));
            if (posting != null) result.andNot(posting);
        }
        return result;
    }
}

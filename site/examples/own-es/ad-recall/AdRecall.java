import java.util.BitSet;
import java.util.List;
import java.util.Objects;

public final class AdRecall {
    private AdRecall() {}

    // (OR allowed) AND NOT (OR denied) AND liveAndAuthorized.
    // An empty allowed list means no positive match.
    // All inputs must be stable for the duration of this call.
    public static BitSet recall(BitSet liveAndAuthorized,
                                List<BitSet> allowed,
                                List<BitSet> denied) {
        Objects.requireNonNull(liveAndAuthorized, "universe");
        Objects.requireNonNull(allowed, "allowed");
        Objects.requireNonNull(denied, "denied");
        BitSet result = new BitSet();
        for (BitSet posting : allowed) {
            result.or(Objects.requireNonNull(posting, "allowed posting"));
        }
        for (BitSet posting : denied) {
            result.andNot(Objects.requireNonNull(posting, "denied posting"));
        }
        result.and(liveAndAuthorized);
        return result;
    }
}

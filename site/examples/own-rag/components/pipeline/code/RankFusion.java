import java.util.*;

public final class RankFusion {
    private RankFusion() {}
    public record Hit(String id, double score) {}
    // Ranks use the original first occurrence's 1-based position in each list.
    public static List<Hit> rrf(List<List<String>> rankings,
                               double[] weights, double c, int topK) {
        Objects.requireNonNull(rankings);
        Objects.requireNonNull(weights);
        if (weights.length != rankings.size() || !Double.isFinite(c)
                || c <= 0 || topK < 0) throw new IllegalArgumentException();
        Map<String, Double> scores = new HashMap<>();
        for (int channel = 0; channel < rankings.size(); channel++) {
            double w = weights[channel];
            if (!Double.isFinite(w) || w < 0) throw new IllegalArgumentException();
            List<String> list = Objects.requireNonNull(rankings.get(channel));
            Set<String> seen = new HashSet<>();
            for (int i = 0; i < list.size(); i++) {
                String id = Objects.requireNonNull(list.get(i));
                if (id.isEmpty()) throw new IllegalArgumentException("empty id");
                if (!seen.add(id)) continue;
                double score = scores.getOrDefault(id, 0.0) + w / (c + i + 1.0);
                if (!Double.isFinite(score)) throw new IllegalArgumentException("overflow");
                scores.put(id, score);
            }
        }
        List<Hit> out = new ArrayList<>();
        scores.forEach((id, score) -> out.add(new Hit(id, score)));
        out.sort(Comparator.comparingDouble(Hit::score).reversed().thenComparing(Hit::id));
        return new ArrayList<>(out.subList(0, Math.min(topK, out.size())));
    }
}

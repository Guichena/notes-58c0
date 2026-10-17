import java.util.Objects;

/** 每个数组项对应一个不同查询词；不实现分词、倒排或多字段融合。 */
public final class Bm25 {
    private Bm25() {}
    public static double score(long documentCount, long[] documentFrequency,
                               int[] termFrequency, int documentLength,
                               double averageLength, double k1, double b) {
        Objects.requireNonNull(documentFrequency, "documentFrequency");
        Objects.requireNonNull(termFrequency, "termFrequency");
        if (documentCount < 1 || documentLength < 0
                || documentFrequency.length != termFrequency.length
                || !Double.isFinite(averageLength) || averageLength <= 0
                || !Double.isFinite(k1) || k1 < 0 || k1 > 1000
                || !Double.isFinite(b) || b < 0 || b > 1) {
            throw new IllegalArgumentException("invalid corpus or parameters");
        }
        double ratio = documentLength / averageLength;
        if (!Double.isFinite(ratio))
            throw new IllegalArgumentException("length ratio overflow");
        double norm = (1 - b) + b * ratio;
        double result = 0;
        for (int i = 0; i < termFrequency.length; i++) {
            long df = documentFrequency[i];
            int tf = termFrequency[i];
            if (df < 0 || df > documentCount || tf < 0 || tf > documentLength
                    || (tf > 0 && df == 0))
                throw new IllegalArgumentException("inconsistent term statistics");
            if (tf == 0) continue;
            // 先做 long 减法，避免大 N 与 df 转 double 后相减丢失差值。
            double idf = Math.log1p(((documentCount - df) + .5) / (df + .5));
            double saturation;
            if (k1 == 0) {
                saturation = 1;
            } else if (norm >= 1) {
                // 分子分母同除 norm，避免有限的 k1 和 norm 相乘溢出。
                saturation = ((k1 + 1) * tf / norm) / (tf / norm + k1);
            } else {
                saturation = ((k1 + 1) * tf) / (tf + k1 * norm);
            }
            result += idf * saturation;
            if (!Double.isFinite(result))
                throw new IllegalArgumentException("score overflow");
        }
        return result;
    }
}

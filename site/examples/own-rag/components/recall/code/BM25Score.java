/** 单词项教学评分；长度按实际 token 数，不含 Lucene norm 编码。 */
public final class BM25Score {
    private BM25Score() {}
    public static double term(int tf, int documentLength, int documents,
                              int documentFrequency, double averageLength,
                              double k1, double b) {
        if (tf < 0 || documentLength < tf || documents <= 0
                || documentFrequency < 0 || documentFrequency > documents
                || (tf > 0 && documentFrequency == 0)
                || !Double.isFinite(averageLength) || averageLength < 1
                || !Double.isFinite(k1) || k1 < 0 || k1 > 10
                || !Double.isFinite(b) || b < 0 || b > 1) {
            throw new IllegalArgumentException("invalid statistics or parameters");
        }
        if (tf == 0) return 0;
        double idf = Math.log1p((documents - documentFrequency + .5)
                / (documentFrequency + .5));
        double norm = (1 - b) + b * documentLength / averageLength;
        return idf * (tf * (k1 + 1)) / (tf + k1 * norm);
    }
}

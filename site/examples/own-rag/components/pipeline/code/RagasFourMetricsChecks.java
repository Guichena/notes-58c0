import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

/** Deterministic fixtures only: no network, LLM, downloaded model or semantic benchmark. */
public final class RagasFourMetricsChecks {
    private static int checks;
    private static final String Q = "设备P7的额定压力和投产年份是什么？";
    private static final String A = "设备P7额定压力为8MPa，2019年投产。";
    private static final String C1 = "设备P7的额定压力为8MPa。";
    private static final String C2 = "食堂每周五更新菜单。";
    private static final String C3 = "设备P7于2020年投产。";
    private static final String REF = "设备P7额定压力为8MPa。设备P7于2020年投产。";
    private static final List<String> CLAIMS = List.of("设备P7额定压力为8MPa。", "设备P7于2019年投产。");

    private static void check(boolean yes, String name) {
        if (!yes) throw new AssertionError(name); checks++;
    }
    private static void close(double actual, double expected, String name) {
        check(Double.isFinite(actual) && Math.abs(actual - expected) <= 2e-12, name + ": " + actual + " != " + expected);
    }
    private static double value(RagasFourMetrics.Score s) { return s.value().orElseThrow(); }
    private static void invalid(Runnable r, String name) {
        try { r.run(); } catch (IllegalArgumentException | NullPointerException e) { checks++; return; }
        throw new AssertionError("expected validation failure: " + name);
    }
    private static RagasFourMetrics.Sample sample(List<String> c) {
        return new RagasFourMetrics.Sample(Q, A, c, REF);
    }
    private static RagasFourMetrics.Embeddings embeddings(double[] query, double[][] generated) {
        return new RagasFourMetrics.Embeddings() {
            public double[] embedQuery(String q) { check(q.equals(Q), "only original question encoded as query"); return query; }
            public double[][] embedDocuments(List<String> q) { return generated; }
        };
    }
    private static RagasFourMetrics.Decision decision(int index, int verdict) {
        return new RagasFourMetrics.Decision(index, CLAIMS.get(index), verdict, "固定测试判定");
    }
    private static RagasFourMetrics.ReverseQuestion reverse(String q, int nc) {
        return new RagasFourMetrics.ReverseQuestion(q, nc);
    }

    private static void pipelineFixture() {
        var s = sample(List.of(C1, C2, C3));
        var queries = List.of("P7压力及投产年份？", "P7额定压力是多少？", "P7何时开始使用？");
        AtomicInteger generated = new AtomicInteger();
        var result = RagasFourMetrics.evaluate(s,
            (q, a) -> { check(q.equals(Q) && a.equals(A), "extractor contract"); return CLAIMS; },
            (context, statements) -> {
                check(context.equals(C1 + "\n" + C2 + "\n" + C3), "faithfulness joined contexts");
                check(statements.equals(CLAIMS), "faithfulness input claims");
                return List.of(decision(1, 0), decision(0, 1)); // Deliberately returned out of order.
            },
            a -> { check(a.equals(A), "reverse generation sees answer"); return reverse(queries.get(generated.getAndIncrement()), 0); },
            new RagasFourMetrics.Embeddings() {
                public double[] embedQuery(String q) { check(q.equals(Q), "embedding original input"); return new double[]{1, 0}; }
                public double[][] embedDocuments(List<String> q) {
                    check(q.equals(queries), "embedding all reverse questions in order");
                    return new double[][]{{1, 0}, {0.8, 0.6}, {0, 1}};
                }
            },
            (q, context, reference) -> {
                check(q.equals(Q) && reference.equals(REF), "precision uses reference, not answer");
                return new RagasFourMetrics.Useful(context.equals(C2) ? 0 : 1, "固定测试判定");
            },
            (q, context, reference) -> {
                check(q.equals(Q) && reference.equals(REF) && context.equals(s.joinedContext()), "recall contract");
                return List.of(new RagasFourMetrics.Attribution(C1, 1, "第一块支持"),
                               new RagasFourMetrics.Attribution(C3, 1, "第三块支持"));
            });
        close(value(result.faithfulness().score()), 0.5, "faithfulness 1/2");
        close(value(result.relevancy().score()), 0.6, "relevancy (1+0.8+0)/3");
        close(value(result.precision().score()), (1.0 + 2.0/3) / (2 + 1e-10), "precision ranked AP");
        close(value(result.recall().score()), 1.0, "recall 2/2 despite incorrect generated year");
        check(result.faithfulness().decisions().get(0).index() == 0, "faithfulness ID reordering");
        check(generated.get() == 3, "default strictness exactly 3");
    }

    private static void fractionAndFaithfulness() {
        close(value(RagasFourMetrics.binaryFraction(new int[]{1, 0, 1}, "empty")), 2.0/3, "binary fraction");
        check(RagasFourMetrics.binaryFraction(new int[0], "empty").value().isEmpty(), "undefined empty denominator");
        invalid(() -> RagasFourMetrics.binaryFraction(new int[]{2}, "empty"), "nonbinary fraction");
        var summary = RagasFourMetrics.summarize(List.of(
            RagasFourMetrics.binaryFraction(new int[]{1, 0}, "empty"),
            RagasFourMetrics.binaryFraction(new int[]{1}, "empty"),
            RagasFourMetrics.binaryFraction(new int[0], "empty")));
        close(summary.mean().orElseThrow(), 0.75, "macro mean of defined samples");
        check(summary.defined()==2 && summary.undefined()==1, "aggregation exposes coverage");
        check(RagasFourMetrics.summarize(List.of()).mean().isEmpty(), "empty aggregation undefined");
        check(RagasFourMetrics.summarize(List.of(RagasFourMetrics.binaryFraction(new int[0], "empty"))).mean().isEmpty(), "all undefined aggregation");
        invalid(() -> new RagasFourMetrics.Score(OptionalDouble.of(Double.NaN), "bad"), "NaN score");
        invalid(() -> new RagasFourMetrics.Score(OptionalDouble.of(2), "bad"), "out-of-range score");
        invalid(() -> new RagasFourMetrics.Decision(0, "s", -1, "r"), "nonbinary judgment");
        invalid(() -> new RagasFourMetrics.Decision(-1, "s", 1, "r"), "negative ID");
        var s = sample(List.of(C1));
        var emptyAnswer = new RagasFourMetrics.Sample(Q, "", List.of(), null);
        check(RagasFourMetrics.faithfulness(emptyAnswer, (q, a) -> { check(a.isEmpty(), "empty answer forwarded"); return List.of(); },
            (c, cl) -> { throw new AssertionError("no empty-answer claims"); }).score().value().isEmpty(), "empty answer without claims undefined");
        var empty = RagasFourMetrics.faithfulness(s, (q, a) -> List.of(),
            (c, claims) -> { throw new AssertionError("must not judge empty claims"); });
        check(empty.score().value().isEmpty(), "faithfulness no claims undefined");
        close(value(RagasFourMetrics.faithfulness(sample(List.of()), (q, a) -> CLAIMS,
            (c, claims) -> { check(c.isEmpty(), "empty retrieved context passed"); return List.of(decision(0, 0), decision(1, 0)); }).score()), 0, "claims with no evidence");
        invalid(() -> RagasFourMetrics.faithfulness(s, (q, a) -> CLAIMS, (c, cl) -> List.of(decision(0, 1))), "missing judgment");
        invalid(() -> RagasFourMetrics.faithfulness(s, (q, a) -> CLAIMS,
            (c, cl) -> List.of(decision(0, 1), decision(0, 0))), "duplicate index");
        invalid(() -> RagasFourMetrics.faithfulness(s, (q, a) -> CLAIMS,
            (c, cl) -> List.of(decision(0, 1), new RagasFourMetrics.Decision(7, CLAIMS.get(1), 1, "r"))), "unknown index");
        invalid(() -> RagasFourMetrics.faithfulness(s, (q, a) -> CLAIMS,
            (c, cl) -> List.of(decision(0, 1), new RagasFourMetrics.Decision(1, "changed", 1, "r"))), "changed claim");
        invalid(() -> RagasFourMetrics.faithfulness(s, (q, a) -> List.of(" "), (c, cl) -> List.of()), "blank extracted statement");
        invalid(() -> RagasFourMetrics.faithfulness(s, (q, a) -> null, (c, cl) -> List.of()), "null extraction");
        invalid(() -> RagasFourMetrics.faithfulness(s, (q, a) -> CLAIMS, (c, cl) -> null), "null judgments");
    }

    private static void rankingsAndRecall() {
        close(RagasFourMetrics.averagePrecision(new int[0]), 0, "empty AP matches epsilon contract");
        close(RagasFourMetrics.averagePrecision(new int[]{0, 0}), 0, "all irrelevant AP");
        close(RagasFourMetrics.averagePrecision(new int[]{1}), 1.0/(1+1e-10), "AP retains epsilon");
        close(RagasFourMetrics.averagePrecision(new int[]{0, 1, 1}), (0.5+2.0/3)/(2+1e-10), "late relevant AP");
        close(RagasFourMetrics.averagePrecision(new int[]{1, 0, 0}), 1.0/(1+1e-10), "irrelevant trailing chunks not penalized by this AP");
        invalid(() -> RagasFourMetrics.averagePrecision(new int[]{1, 3}), "nonbinary AP");
        // Independent O(n^2) calculation over positive rank positions, for every binary ranking up to 12.
        for (int n = 0; n <= 12; n++) {
            for (int bits = 0; bits < (1 << n); bits++) {
                int[] flags = new int[n]; List<Integer> ranks = new ArrayList<>();
                for (int i = 0; i < n; i++) { flags[i] = (bits >>> i) & 1; if (flags[i] == 1) ranks.add(i+1); }
                double reference = 0;
                for (int rank : ranks) {
                    long earlier = ranks.stream().filter(r -> r <= rank).count();
                    reference += (double) earlier / rank;
                }
                reference /= (ranks.size() + 1e-10);
                close(RagasFourMetrics.averagePrecision(flags), reference, "exhaustive rank reference");
                for (int i = 1; i < n; i++) if (flags[i] == 1 && flags[i-1] == 0) {
                    int[] swapped = flags.clone(); swapped[i-1] = 1; swapped[i] = 0;
                    check(RagasFourMetrics.averagePrecision(swapped) >= RagasFourMetrics.averagePrecision(flags), "moving useful chunk earlier cannot lower AP");
                }
            }
        }
        var s = sample(List.of(C1, C2));
        close(value(RagasFourMetrics.precisionWithoutReference(s, (q, c, target) -> {
            check(target.equals(A), "reference-free precision uses answer");
            return new RagasFourMetrics.Useful(c.equals(C1) ? 1 : 0, "fixture");
        }).score()), 1.0/(1+1e-10), "reference-free AP");
        close(value(RagasFourMetrics.precisionWithReference(sample(List.of()),
            (q, c, a) -> { throw new AssertionError("no chunks to judge"); }).score()), 0, "empty contexts precision");
        close(value(RagasFourMetrics.recall(s, (q, c, r) -> List.of(
            new RagasFourMetrics.Attribution(C1, 1, "yes"), new RagasFourMetrics.Attribution(C3, 0, "absent"))).score()), 0.5, "recall denominator is reference units");
        close(value(RagasFourMetrics.recall(sample(List.of()), (q, c, r) -> List.of(
            new RagasFourMetrics.Attribution(C1, 0, "absent"), new RagasFourMetrics.Attribution(C3, 0, "absent"))).score()), 0, "recall no evidence");
        check(RagasFourMetrics.recall(s, (q, c, r) -> List.of()).score().value().isEmpty(), "empty recall classifications undefined");
        var noReference = new RagasFourMetrics.Sample(Q, A, List.of(C1), null);
        close(value(RagasFourMetrics.precisionWithoutReference(noReference, (q, c, a) -> new RagasFourMetrics.Useful(1, "fixture")).score()),
            1.0/(1+1e-10), "reference-free metric really permits absent reference");
        invalid(() -> RagasFourMetrics.precisionWithReference(noReference, (q, c, a) -> new RagasFourMetrics.Useful(1, "r")), "precision missing reference");
        invalid(() -> RagasFourMetrics.recall(noReference, (q, c, r) -> List.of()), "recall missing reference");
        invalid(() -> RagasFourMetrics.recall(s, (q, c, r) -> null), "null recall classifications");
        invalid(() -> new RagasFourMetrics.Attribution("s", 2, "r"), "nonbinary recall");
    }

    private static void relevancyAndVectors() {
        var one = List.of(reverse("q1", 0));
        var two = List.of(reverse("q1", 0), reverse("q2", 1));
        var base = embeddings(new double[]{1, 0}, new double[][]{{1, 0}});
        close(value(RagasFourMetrics.relevancyFromGenerations(Q, one, base).score()), 1, "relevancy identical");
        close(value(RagasFourMetrics.relevancyFromGenerations(Q, one,
            embeddings(new double[]{1, 0}, new double[][]{{-1, 0}})).score()), -1, "negative relevancy retained");
        close(value(RagasFourMetrics.relevancyFromGenerations(Q, two,
            embeddings(new double[]{1, 0}, new double[][]{{1, 0}, {1, 0}})).score()), 0, "any noncommittal gates all");
        check(RagasFourMetrics.relevancyFromGenerations(Q, List.of(reverse("", 0)), base).score().value().isEmpty(), "all-empty generated questions");
        check(RagasFourMetrics.relevancyFromGenerations(Q, List.of(), base).score().value().isEmpty(), "zero returned generations");
        invalid(() -> RagasFourMetrics.relevancyFromGenerations(Q, List.of(reverse("q", 0), reverse("", 0)), base), "partially empty generation");
        invalid(() -> RagasFourMetrics.relevancy(sample(List.of()), 0, a -> reverse("q", 0), base), "strictness zero");
        invalid(() -> RagasFourMetrics.relevancy(sample(List.of()), -1, a -> reverse("q", 0), base), "strictness negative");
        invalid(() -> reverse("q", 2), "invalid noncommittal flag");
        invalid(() -> RagasFourMetrics.relevancyFromGenerations(Q, two, base), "embedding count mismatch");
        invalid(() -> RagasFourMetrics.relevancyFromGenerations(Q, List.of(reverse("q", 1)),
            embeddings(new double[]{0, 0}, new double[][]{{1, 0}})), "invalid embedding not hidden by gate");
        close(RagasFourMetrics.cosine(new double[]{1, 0}, new double[]{0, 1}), 0, "orthogonal cosine");
        close(RagasFourMetrics.cosine(new double[]{3, 4}, new double[]{6, 8}), 1, "scale invariance");
        close(RagasFourMetrics.cosine(new double[]{Double.MAX_VALUE, Double.MAX_VALUE},
            new double[]{Double.MIN_VALUE, Double.MIN_VALUE}), 1, "extreme finite magnitudes");
        invalid(() -> RagasFourMetrics.cosine(new double[0], new double[0]), "empty vectors");
        invalid(() -> RagasFourMetrics.cosine(new double[]{1}, new double[]{1, 2}), "dimension mismatch");
        invalid(() -> RagasFourMetrics.cosine(new double[]{0}, new double[]{1}), "zero norm");
        invalid(() -> RagasFourMetrics.cosine(new double[]{Double.NaN}, new double[]{1}), "NaN vector");
        invalid(() -> RagasFourMetrics.cosine(new double[]{1}, new double[]{Double.POSITIVE_INFINITY}), "infinite vector");
        Random random = new Random(20261012L);
        for (int t = 0; t < 1000; t++) {
            double[] x = new double[7], y = new double[7]; double dot=0, xx=0, yy=0;
            for (int i=0; i<x.length; i++) { x[i]=random.nextDouble()*2-1; y[i]=random.nextDouble()*2-1; dot+=x[i]*y[i]; xx+=x[i]*x[i]; yy+=y[i]*y[i]; }
            close(RagasFourMetrics.cosine(x, y), dot/Math.sqrt(xx*yy), "independent moderate-vector cosine");
        }
    }

    private static void inputOwnership() {
        ArrayList<String> contexts = new ArrayList<>(List.of(C1));
        var s = sample(contexts); contexts.add(C2);
        check(s.contexts().equals(List.of(C1)), "defensive input copy");
        try { s.contexts().add(C3); throw new AssertionError("mutable contexts"); }
        catch (UnsupportedOperationException expected) { checks++; }
        invalid(() -> new RagasFourMetrics.Sample(" ", A, List.of(), REF), "blank question");
        invalid(() -> new RagasFourMetrics.Sample(Q, null, List.of(), REF), "null answer");
        invalid(() -> new RagasFourMetrics.Sample(Q, A, null, REF), "null contexts");
        invalid(() -> new RagasFourMetrics.Sample(Q, A, Arrays.asList((String)null), REF), "null context entry");
        var duplicate = sample(List.of(C1, C1)); AtomicInteger count = new AtomicInteger();
        close(value(RagasFourMetrics.precisionWithReference(duplicate, (q, c, r) -> {
            count.incrementAndGet(); return new RagasFourMetrics.Useful(1, "fixture");
        }).score()), 2.0/(2+1e-10), "duplicates retained in supplied ranking");
        check(count.get()==2, "judge sees duplicate chunks separately");
    }
    public static void main(String[] args) {
        pipelineFixture(); fractionAndFaithfulness(); rankingsAndRecall(); relevancyAndVectors(); inputOwnership();
        System.out.println("PASS " + checks + " deterministic checks. No LLM, embedding model, network or RAGAS runtime executed.");
    }
}

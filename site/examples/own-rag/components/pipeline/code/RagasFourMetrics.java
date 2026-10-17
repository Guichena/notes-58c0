import java.util.*;

/** Java 17+ teaching implementation. Judges and embeddings are injected, never invented. */
public final class RagasFourMetrics {
    private RagasFourMetrics() {}
    public static final double AP_EPSILON = 1e-10;

    public record Sample(String question, String answer, List<String> contexts, String reference) {
        public Sample {
            nonBlank(question, "question");
            Objects.requireNonNull(answer, "answer");
            contexts = textList(contexts, false, "contexts");
            // reference may be absent for faithfulness, relevancy and reference-free precision.
        }
        String requireReference() {
            nonBlank(reference, "reference");
            return reference;
        }
        String joinedContext() { return String.join("\n", contexts); }
    }

    public record Score(OptionalDouble value, String note) {
        public Score {
            Objects.requireNonNull(value, "value");
            nonBlank(note, "note");
            if (value.isPresent() && (!Double.isFinite(value.getAsDouble())
                    || value.getAsDouble() < -1 || value.getAsDouble() > 1))
                throw new IllegalArgumentException("score must be finite and within [-1,1]");
        }
        static Score defined(double x, String note) { return new Score(OptionalDouble.of(x), note); }
        static Score undefined(String note) { return new Score(OptionalDouble.empty(), note); }
    }
    public record Decision(int index, String statement, int verdict, String reason) {
        public Decision {
            if (index < 0) throw new IllegalArgumentException("negative statement index");
            nonBlank(statement, "statement"); binary(verdict); nonBlank(reason, "reason");
        }
    }
    public record ReverseQuestion(String question, int noncommittal) {
        public ReverseQuestion { Objects.requireNonNull(question, "generated question"); binary(noncommittal); }
    }
    public record Useful(int verdict, String reason) {
        public Useful { binary(verdict); nonBlank(reason, "reason"); }
    }
    public record Attribution(String statement, int attributed, String reason) {
        public Attribution { nonBlank(statement, "reference statement"); binary(attributed); nonBlank(reason, "reason"); }
    }

    @FunctionalInterface public interface StatementExtractor {
        List<String> extract(String question, String answer);
    }
    @FunctionalInterface public interface FaithfulnessJudge {
        List<Decision> judge(String joinedContext, List<String> statements);
    }
    @FunctionalInterface public interface ReverseQuestionJudge {
        ReverseQuestion generate(String answer); // Intentionally receives no original question.
    }
    public interface Embeddings {
        double[] embedQuery(String originalQuestion);
        double[][] embedDocuments(List<String> generatedQuestions);
    }
    @FunctionalInterface public interface PrecisionJudge {
        Useful judge(String question, String oneContext, String targetAnswer);
    }
    @FunctionalInterface public interface RecallJudge {
        List<Attribution> classify(String question, String joinedContext, String reference);
    }

    public record FaithfulnessResult(Score score, List<String> statements, List<Decision> decisions) {}
    public record RelevancyResult(Score score, List<ReverseQuestion> generations, List<Double> cosines) {}
    public record PrecisionResult(Score score, List<Useful> judgments) {}
    public record RecallResult(Score score, List<Attribution> judgments) {}
    public record Evaluation(FaithfulnessResult faithfulness, RelevancyResult relevancy,
                             PrecisionResult precision, RecallResult recall) {}

    public static FaithfulnessResult faithfulness(Sample sample, StatementExtractor extractor,
                                                  FaithfulnessJudge judge) {
        Objects.requireNonNull(sample); Objects.requireNonNull(extractor); Objects.requireNonNull(judge);
        List<String> statements = textList(extractor.extract(sample.question(), sample.answer()), true, "statements");
        if (statements.isEmpty())
            return new FaithfulnessResult(Score.undefined("no answer statements"), statements, List.of());
        List<Decision> raw = immutable(judge.judge(sample.joinedContext(), statements), "faithfulness judgments");
        if (raw.size() != statements.size()) throw new IllegalArgumentException("missing or extra judgments");
        Decision[] ordered = new Decision[statements.size()];
        for (Decision d : raw) {
            if (d.index() >= ordered.length || ordered[d.index()] != null)
                throw new IllegalArgumentException("unknown or duplicate judgment index");
            if (!d.statement().equals(statements.get(d.index())))
                throw new IllegalArgumentException("judgment changed statement text");
            ordered[d.index()] = d;
        }
        int[] flags = new int[ordered.length];
        for (int i = 0; i < flags.length; i++) flags[i] = ordered[i].verdict();
        return new FaithfulnessResult(binaryFraction(flags, "no answer statements"), statements, List.of(ordered));
    }

    public static RelevancyResult relevancy(Sample sample, int strictness, ReverseQuestionJudge judge,
                                            Embeddings embeddings) {
        Objects.requireNonNull(sample); Objects.requireNonNull(judge); Objects.requireNonNull(embeddings);
        if (strictness <= 0) throw new IllegalArgumentException("strictness must be positive");
        List<ReverseQuestion> results = new ArrayList<>();
        for (int i = 0; i < strictness; i++) results.add(Objects.requireNonNull(judge.generate(sample.answer())));
        return relevancyFromGenerations(sample.question(), results, embeddings);
    }

    public static RelevancyResult relevancyFromGenerations(String originalQuestion,
            List<ReverseQuestion> generations, Embeddings embeddings) {
        nonBlank(originalQuestion, "question"); Objects.requireNonNull(embeddings);
        List<ReverseQuestion> rows = immutable(generations, "generations");
        if (rows.isEmpty() || rows.stream().allMatch(r -> r.question().isBlank()))
            return new RelevancyResult(Score.undefined("no generated questions"), rows, List.of());
        // Deliberate validation improvement: do not silently embed a partially empty result.
        List<String> questions = new ArrayList<>();
        boolean noncommittal = false;
        for (ReverseQuestion row : rows) {
            nonBlank(row.question(), "partially empty generated question");
            questions.add(row.question()); noncommittal |= row.noncommittal() == 1;
        }
        double[] original = Objects.requireNonNull(embeddings.embedQuery(originalQuestion));
        double[][] generated = Objects.requireNonNull(embeddings.embedDocuments(List.copyOf(questions)));
        if (generated.length != rows.size()) throw new IllegalArgumentException("embedding count mismatch");
        List<Double> cosines = new ArrayList<>();
        double sum = 0;
        for (double[] vector : generated) { double c = cosine(original, vector); cosines.add(c); sum += c; }
        // Validate embeddings before applying the gate; an invalid vector is not a valid zero score.
        double score = noncommittal ? 0.0 : sum / rows.size();
        return new RelevancyResult(Score.defined(score, noncommittal ? "noncommittal gate" : "mean cosine"),
                rows, List.copyOf(cosines));
    }

    public static PrecisionResult precisionWithReference(Sample sample, PrecisionJudge judge) {
        Objects.requireNonNull(sample);
        return precision(sample, sample.requireReference(), judge);
    }
    public static PrecisionResult precisionWithoutReference(Sample sample, PrecisionJudge judge) {
        Objects.requireNonNull(sample);
        return precision(sample, sample.answer(), judge);
    }
    private static PrecisionResult precision(Sample sample, String target, PrecisionJudge judge) {
        Objects.requireNonNull(judge);
        List<Useful> judgments = new ArrayList<>();
        for (String context : sample.contexts())
            judgments.add(Objects.requireNonNull(judge.judge(sample.question(), context, target)));
        int[] flags = judgments.stream().mapToInt(Useful::verdict).toArray();
        return new PrecisionResult(Score.defined(averagePrecision(flags), "rank-sensitive AP, epsilon=1e-10"),
                List.copyOf(judgments));
    }

    public static RecallResult recall(Sample sample, RecallJudge judge) {
        Objects.requireNonNull(sample); Objects.requireNonNull(judge);
        List<Attribution> judgments = immutable(judge.classify(sample.question(), sample.joinedContext(),
                sample.requireReference()), "recall classifications");
        int[] flags = judgments.stream().mapToInt(Attribution::attributed).toArray();
        return new RecallResult(binaryFraction(flags, "no reference classifications"), judgments);
    }

    public static Evaluation evaluate(Sample sample, StatementExtractor extractor, FaithfulnessJudge faithful,
            ReverseQuestionJudge reverse, Embeddings embeddings, PrecisionJudge precision, RecallJudge recall) {
        return new Evaluation(faithfulness(sample, extractor, faithful), relevancy(sample, 3, reverse, embeddings),
                precisionWithReference(sample, precision), recall(sample, recall));
    }

    public record Summary(OptionalDouble mean, int defined, int undefined) {}
    public static Summary summarize(List<Score> scores) {
        List<Score> rows = immutable(scores, "scores");
        double mean = 0; int count = 0;
        for (Score score : rows) if (score.value().isPresent()) {
            count++;
            mean += (score.value().getAsDouble() - mean) / count;
        }
        return new Summary(count == 0 ? OptionalDouble.empty() : OptionalDouble.of(mean), count, rows.size() - count);
    }

    public static Score binaryFraction(int[] flags, String emptyReason) {
        Objects.requireNonNull(flags); nonBlank(emptyReason, "empty reason");
        long positive = 0;
        for (int flag : flags) { binary(flag); positive += flag; }
        return flags.length == 0 ? Score.undefined(emptyReason)
                : Score.defined((double) positive / flags.length, "supported / classified units");
    }
    public static double averagePrecision(int[] flags) {
        Objects.requireNonNull(flags);
        long relevant = 0; double numerator = 0;
        for (int i = 0; i < flags.length; i++) {
            binary(flags[i]); relevant += flags[i];
            if (flags[i] == 1) numerator += (double) relevant / (i + 1L);
        }
        return numerator / (relevant + AP_EPSILON);
    }
    public static double cosine(double[] left, double[] right) {
        Objects.requireNonNull(left); Objects.requireNonNull(right);
        if (left.length == 0 || left.length != right.length)
            throw new IllegalArgumentException("empty vector or dimension mismatch");
        double[] a = unit(left), b = unit(right);
        double dot = 0, correction = 0;
        for (int i = 0; i < a.length; i++) {
            double adjusted = a[i] * b[i] - correction;
            double next = dot + adjusted;
            correction = (next - dot) - adjusted; dot = next;
        }
        // Only roundoff can exceed these limits for validated unit vectors.
        return Math.max(-1.0, Math.min(1.0, dot));
    }
    private static double[] unit(double[] vector) {
        double scale = 0;
        for (double x : vector) {
            if (!Double.isFinite(x)) throw new IllegalArgumentException("non-finite embedding");
            scale = Math.max(scale, Math.abs(x));
        }
        if (scale == 0) throw new IllegalArgumentException("zero embedding norm");
        double sum = 0;
        for (double x : vector) { double scaled = x / scale; sum += scaled * scaled; }
        double norm = Math.sqrt(sum);
        double[] result = new double[vector.length];
        for (int i = 0; i < result.length; i++) result[i] = (vector[i] / scale) / norm;
        return result;
    }
    private static void binary(int n) {
        if (n != 0 && n != 1) throw new IllegalArgumentException("expected 0 or 1");
    }
    private static void nonBlank(String text, String name) {
        if (text == null || text.isBlank()) throw new IllegalArgumentException(name + " must be nonblank");
    }
    private static <T> List<T> immutable(List<T> list, String name) {
        if (list == null) throw new IllegalArgumentException(name + " is null");
        for (T value : list) if (value == null) throw new IllegalArgumentException(name + " contains null");
        return List.copyOf(list);
    }
    private static List<String> textList(List<String> list, boolean requireNonblank, String name) {
        List<String> result = immutable(list, name);
        if (requireNonblank) for (String text : result) nonBlank(text, name);
        return result;
    }
}

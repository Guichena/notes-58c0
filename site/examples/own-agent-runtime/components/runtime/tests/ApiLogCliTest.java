import java.io.*;
import java.math.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.*;
import java.util.*;

public final class ApiLogCliTest {
    static int checks;
    static void check(boolean condition, String name) {
        if (!condition) throw new AssertionError(name);
        checks++;
    }
    interface Action { void run() throws Exception; }
    static void rejects(Action action, String name) throws Exception {
        try { action.run(); } catch (IOException | IllegalArgumentException | ArithmeticException expected) {
            checks++; return;
        }
        throw new AssertionError(name);
    }
    static String[] args(Path in, Path out, String threshold) {
        return new String[]{"--input",in.toString(),"--output",out.toString(),"--from","2026-10-11T00:00:00Z",
                "--to","2026-10-11T00:02:00Z","--window-seconds","60","--error-threshold",threshold};
    }
    static String[] append(String[] original, String... tail) {
        String[] both = Arrays.copyOf(original, original.length + tail.length);
        System.arraycopy(tail,0,both,original.length,tail.length); return both;
    }
    static String[] option(String[] original, String key, String value) {
        String[] copy = original.clone();
        for (int i = 0; i < copy.length; i += 2) if (copy[i].equals(key)) copy[i+1] = value;
        return copy;
    }
    static int run(String[] args) {
        ByteArrayOutputStream captured = new ByteArrayOutputStream();
        return ApiLogCli.run(args, new PrintStream(captured, true, StandardCharsets.UTF_8));
    }
    static final String HEADER = "timestamp,model,tokens,latency_ms,status\n";
    public static void main(String[] unused) throws Exception {
        Path dir = Files.createTempDirectory("api-log-author-tests-");
        try {
            Path in = dir.resolve("requests.csv"), out = dir.resolve("report.csv");
            String fixture = HEADER + "2026-10-11T00:00:00Z,\"model,a\",10,10,OK\n"
                    + "2026-10-11T01:00:30+01:00,\"model,a\",,30,ERROR\n"
                    + "2026-10-11T00:01:00Z,b,0,5,OK\n"
                    + "2026-10-11T00:02:00Z,b,999,1000,ERROR\n";
            Files.writeString(in, fixture);
            String[] args = args(in,out,"0.5");
            var groups = ApiLogCli.analyze(ApiLogCli.parse(args));
            var all = groups.get(ApiLogCli.ALL);
            check(all.requests == 3 && all.successes == 2 && all.errors() == 1, "half-open range denominator");
            check(all.knownTokenRows == 2 && all.tokens == 10, "unknown tokens distinct from zero");
            check(all.latency.compareTo(new BigDecimal("45")) == 0, "all selected latency sum");
            check(groups.size() == 5, "total, model, UTC window-model groups");
            check(groups.get(new ApiLogCli.Key("WINDOW_MODEL", Instant.parse("2026-10-11T00:00:00Z"),"model,a")).requests == 2,
                    "offset equivalence and UTC window boundary");
            check(run(args) == 2, "threshold equality fails CI");
            String report = Files.readString(out);
            check(report.contains("\"15.000000\",\"2\",\"1\",\"10\""), "mean and usage in report");
            check(report.contains("\"model,a\""), "comma model quoted");
            check(run(args) == 2 && Files.readString(out).equals(report), "deterministic bytes and replacement");
            check(run(option(args,"--error-threshold","0.500000001")) == 0, "threshold compared before rounding");
            check(run(append(args,"--model","b")) == 0, "model filter");
            check(run(append(args,"--model","missing")) == 3, "empty selection separate CI status");
            check(Files.readString(out).contains("\"N/A\",\"N/A\",\"N/A\""), "empty rates are N/A");
            for (String value : List.of("0","-0.1","1.1","NaN","1e-1","","0.1234567890"))
                check(run(option(args,"--error-threshold",value)) == 1, "bad threshold " + value);
            check(run(option(args,"--from","2026-10-11T00:00:00")) == 1, "timezone required");
            check(run(option(args,"--from","2026-10-11T00:02:00Z")) == 1, "empty filter interval rejected");
            check(run(append(args,"--input",in.toString())) == 1, "duplicate option");
            check(run(append(args,"--unknown","x")) == 1, "unknown option");
            check(run(append(args,"--max-groups","3")) == 1, "group cap stops unbounded cardinality");
            Files.writeString(out, "preserve-before-input-error");
            Files.writeString(in, fixture + "2026-10-11T00:03:00Z,b,0,1,TYPO\n");
            check(run(args) == 1 && Files.readString(out).equals("preserve-before-input-error"), "invalid excluded row still fails without report overwrite");
            for (String row : List.of(
                    "2026-10-11T00:00:00Z,m,-1,1,OK",
                    "2026-10-11T00:00:00Z,m,9223372036854775808,1,OK",
                    "2026-10-11T00:00:00Z,m,1,-1,OK",
                    "2026-10-11T00:00:00Z,m,1,NaN,OK",
                    "2026-10-11T00:00:00Z,m,1,Infinity,OK",
                    "2026-10-11T00:00:00Z,m,1,1e3,OK",
                    "2026-10-11T00:00:00Z,m,1,1,ok",
                    "2026-10-11T00:00:00Z,,1,1,OK",
                    "2026-10-11T00:00:00Z,\"multi\nline\",1,1,OK",
                    "2026-10-11T00:00:00Z,m,1,1,OK,extra")) {
                Files.writeString(in,HEADER+row+"\n"); check(run(args) == 1,"invalid request contract");
            }
            Files.writeString(in, HEADER + "2026-10-11T00:00:00Z,m,9223372036854775807,1,OK\n"
                    + "2026-10-11T00:00:01Z,m,1,1,OK\n");
            check(run(args) == 1, "aggregate token overflow rejected");
            Files.writeString(in,HEADER+"2026-10-11T00:00:00Z,\"=SUM(1,2)\",,1,OK\n");
            check(run(args) == 0 && Files.readString(out).contains("\"'=SUM(1,2)\""), "spreadsheet formula prefix");
            check(ApiLogCli.modelDisplay("   +danger").equals("'   +danger"), "leading whitespace formula prefix");
            check(ApiLogCli.cell("a\"b").equals("\"a\"\"b\""), "quote escaping");
            try (var csv = new ApiLogCli.Csv(new StringReader("\uFEFF\"a,b\",\"x\"\"y\",\"multi\nline\"\r\n"))) {
                check(csv.next().equals(List.of("a,b","x\"y","multi\nline")) && csv.next() == null,"CSV syntax multiline and BOM");
            }
            for (String bad : List.of("\"unclosed", "a\"b,c", "\"a\"tail", "a\rb", "a".repeat(ApiLogCli.MAX_FIELD+1)))
                rejects(() -> { try (var csv = new ApiLogCli.Csv(new StringReader(bad))) { csv.next(); } },"bad CSV");
            try (var csv = new ApiLogCli.Csv(new StringReader("a,b,"))) {
                check(csv.next().equals(List.of("a","b","")) && csv.next() == null,"trailing empty field at EOF");
            }
            Files.writeString(in,HEADER);
            check(run(args) == 3,"header-only input");
            Files.writeString(in,fixture);
            check(run(option(args,"--output",in.toString())) == 1 && Files.readString(in).equals(fixture),"same file protected");
            Path hard = dir.resolve("same-hardlink.csv"); Files.createLink(hard,in);
            check(run(option(args,"--output",hard.toString())) == 1 && Files.readString(in).equals(fixture),"hard-linked input protected");
            Files.write(in,new byte[]{(byte)0xC3,(byte)0x28});
            check(run(args) == 1,"invalid UTF8 rejected");
            ApiLogCli.Stats overflow = new ApiLogCli.Stats(); overflow.requests = Long.MAX_VALUE;
            rejects(() -> overflow.add(new ApiLogCli.Event(Instant.EPOCH,"m",null,BigDecimal.ZERO,true)),"request overflow");
            System.out.println("PASS " + checks + " author checks");
        } finally {
            try (var files = Files.walk(dir)) {
                for (Path path : files.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(path);
            }
        }
    }
}

import java.io.*;
import java.math.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.*;
import java.util.*;

/** Offline request-log analysis. Never sends an external alert or invokes an API. */
public final class ApiLogCli {
    static final List<String> HEADER = List.of("timestamp", "model", "tokens", "latency_ms", "status");
    static final int MAX_FIELD = 65_536, MAX_RECORD = 1_048_576;
    record Config(Path input, Path output, Instant from, Instant to, long windowSeconds,
                  BigDecimal errorThreshold, int maxGroups, String model) {}
    record Event(Instant time, String model, Long tokens, BigDecimal latency, boolean ok) {}
    record Key(String scope, Instant window, String model) {}
    static final Key ALL = new Key("ALL", null, "");
    static final Comparator<Key> ORDER = Comparator.comparing(Key::scope)
            .thenComparing(Key::window, Comparator.nullsFirst(Comparator.naturalOrder()))
            .thenComparing(Key::model);
    static final class Stats {
        long requests, successes, knownTokenRows, tokens;
        BigDecimal latency = BigDecimal.ZERO;
        void add(Event e) {
            requests = Math.incrementExact(requests);
            if (e.ok) successes = Math.incrementExact(successes);
            if (e.tokens != null) {
                knownTokenRows = Math.incrementExact(knownTokenRows);
                tokens = Math.addExact(tokens, e.tokens);
            }
            latency = latency.add(e.latency);
        }
        long errors() { return requests - successes; }
        boolean breaches(BigDecimal threshold) {
            // Do not compare a rounded display percentage with the threshold.
            return requests != 0 && BigDecimal.valueOf(errors())
                    .compareTo(threshold.multiply(BigDecimal.valueOf(requests))) >= 0;
        }
    }

    /** Strict bounded CSV, accepting LF/CRLF and quoted commas/quotes/newlines. */
    static final class Csv implements AutoCloseable {
        private final PushbackReader in;
        private boolean first = true;
        Csv(Reader reader) { in = new PushbackReader(reader, 1); }
        List<String> next() throws IOException {
            List<String> row = new ArrayList<>();
            StringBuilder field = new StringBuilder();
            int state = 0, chars = 0; // 0=start, 1=plain, 2=quoted, 3=after quote
            boolean any = false;
            while (true) {
                int c = in.read();
                if (first) { first = false; if (c == '\uFEFF') c = in.read(); }
                if (c == -1) {
                    if (state == 2) throw new IOException("Unclosed CSV quote");
                    if (!any) return null;
                    addField(row, field); return row;
                }
                any = true;
                if (++chars > MAX_RECORD) throw new IOException("CSV record too long");
                if (state == 2) {
                    if (c == '"') state = 3;
                    else append(field, c);
                    continue;
                }
                if (state == 3 && c == '"') { append(field, c); state = 2; continue; }
                if (c == ',') { addField(row, field); state = 0; continue; }
                if (c == '\n' || c == '\r') {
                    if (c == '\r' && in.read() != '\n') throw new IOException("Bare CR record separator");
                    addField(row, field); return row;
                }
                if (state == 3) throw new IOException("Characters after closing CSV quote");
                if (c == '"') {
                    if (state != 0) throw new IOException("Quote in unquoted CSV field");
                    state = 2;
                } else { append(field, c); state = 1; }
            }
        }
        private static void append(StringBuilder field, int c) throws IOException {
            if (field.length() >= MAX_FIELD) throw new IOException("CSV field too long");
            field.append((char)c);
        }
        private static void addField(List<String> row, StringBuilder field) throws IOException {
            if (row.size() >= HEADER.size()) throw new IOException("Too many CSV columns");
            row.add(field.toString()); field.setLength(0);
        }
        public void close() throws IOException { in.close(); }
    }

    static Instant instant(String value) { return OffsetDateTime.parse(value).toInstant(); }
    static long nonnegativeLong(String value) {
        if (!value.matches("[0-9]{1,19}")) throw new IllegalArgumentException("Invalid integer");
        return Long.parseLong(value);
    }
    static Event event(List<String> row) {
        if (row.size() != HEADER.size()) throw new IllegalArgumentException("Expected five columns");
        String model = row.get(1);
        if (model.isBlank() || model.length() > 256 || model.codePoints().anyMatch(Character::isISOControl))
            throw new IllegalArgumentException("Invalid model identifier");
        // Blank means unknown usage; numeric zero is known zero, not missing usage.
        Long tokens = row.get(2).isEmpty() ? null : nonnegativeLong(row.get(2));
        if (!row.get(3).matches("[0-9]{1,18}(\\.[0-9]{1,6})?"))
            throw new IllegalArgumentException("Invalid latency");
        String status = row.get(4);
        if (!status.equals("OK") && !status.equals("ERROR"))
            throw new IllegalArgumentException("Status must be OK or ERROR");
        return new Event(instant(row.get(0)), model, tokens, new BigDecimal(row.get(3)), status.equals("OK"));
    }

    static Config parse(String[] args) {
        Map<String, String> options = new HashMap<>();
        Set<String> allowed = Set.of("--input", "--output", "--from", "--to", "--window-seconds",
                "--error-threshold", "--max-groups", "--model");
        if (args.length % 2 != 0) throw new IllegalArgumentException("Options require values");
        for (int i = 0; i < args.length; i += 2)
            if (!allowed.contains(args[i]) || options.putIfAbsent(args[i], args[i + 1]) != null)
                throw new IllegalArgumentException("Unknown or repeated option");
        for (String required : List.of("--input", "--output", "--from", "--to", "--window-seconds", "--error-threshold"))
            if (!options.containsKey(required)) throw new IllegalArgumentException("Missing " + required);
        Instant from = instant(options.get("--from")), to = instant(options.get("--to"));
        if (!from.isBefore(to)) throw new IllegalArgumentException("from must precede to");
        long seconds = nonnegativeLong(options.get("--window-seconds"));
        if (seconds < 1 || seconds > 86_400) throw new IllegalArgumentException("Window must be 1..86400 seconds");
        String thresholdText = options.get("--error-threshold");
        if (!thresholdText.matches("[0-9]{1,2}(\\.[0-9]{1,9})?"))
            throw new IllegalArgumentException("Invalid threshold representation");
        BigDecimal threshold = new BigDecimal(thresholdText);
        if (threshold.signum() <= 0 || threshold.compareTo(BigDecimal.ONE) > 0)
            throw new IllegalArgumentException("Threshold must be >0 and <=1");
        long limit = nonnegativeLong(options.getOrDefault("--max-groups", "10000"));
        if (limit < 3 || limit > 1_000_000) throw new IllegalArgumentException("Group limit must be 3..1000000");
        String model = options.get("--model");
        if (model != null && (model.isBlank() || model.length() > 256 || model.codePoints().anyMatch(Character::isISOControl)))
            throw new IllegalArgumentException("Invalid model filter");
        return new Config(Path.of(options.get("--input")).toAbsolutePath().normalize(),
                Path.of(options.get("--output")).toAbsolutePath().normalize(),
                from, to, seconds, threshold, (int)limit, model);
    }

    static NavigableMap<Key, Stats> analyze(Config config) throws IOException {
        NavigableMap<Key, Stats> groups = new TreeMap<>(ORDER); groups.put(ALL, new Stats());
        try (Csv csv = new Csv(Files.newBufferedReader(config.input, StandardCharsets.UTF_8))) {
            if (!HEADER.equals(csv.next())) throw new IOException("Unexpected CSV header/order");
            List<String> row; long record = 1;
            while ((row = csv.next()) != null) {
                record = Math.incrementExact(record);
                Event e;
                try { e = event(row); }
                catch (RuntimeException invalid) { throw new IOException("Invalid request record " + record, invalid); }
                // Validate even excluded rows: filtering must not hide malformed input.
                if (e.time.isBefore(config.from) || !e.time.isBefore(config.to)
                        || (config.model != null && !config.model.equals(e.model))) continue;
                Instant window = Instant.ofEpochSecond(Math.multiplyExact(
                        Math.floorDiv(e.time.getEpochSecond(), config.windowSeconds), config.windowSeconds));
                for (Key key : List.of(ALL, new Key("MODEL", null, e.model), new Key("WINDOW_MODEL", window, e.model))) {
                    Stats stats = groups.get(key);
                    if (stats == null) {
                        if (groups.size() >= config.maxGroups) throw new IOException("Distinct group limit exceeded");
                        stats = new Stats(); groups.put(key, stats);
                    }
                    stats.add(e);
                }
            }
        }
        return groups;
    }

    static String ratio(long numerator, long denominator) {
        return denominator == 0 ? "N/A" : BigDecimal.valueOf(numerator)
                .divide(BigDecimal.valueOf(denominator), 6, RoundingMode.HALF_UP).toPlainString();
    }
    static String modelDisplay(String raw) {
        // The report is for people/spreadsheets, not a lossless identifier round trip.
        String leading = raw.stripLeading();
        return !leading.isEmpty() && "=+-@".indexOf(leading.charAt(0)) >= 0 ? "'" + raw : raw;
    }
    static String cell(String text) { return "\"" + text.replace("\"", "\"\"") + "\""; }
    static void writeRow(Writer writer, List<String> values) throws IOException {
        for (int i = 0; i < values.size(); i++) {
            if (i != 0) writer.write(','); writer.write(cell(values.get(i)));
        }
        writer.write('\n');
    }
    static void report(Config config, NavigableMap<Key, Stats> groups) throws IOException {
        if (config.input.equals(config.output) || (Files.exists(config.output) && Files.isSameFile(config.input, config.output)))
            throw new IOException("Input and output must be different files");
        Path temporary = Files.createTempFile(config.output.getParent(), ".api-log-", ".tmp");
        try {
            try (BufferedWriter writer = Files.newBufferedWriter(temporary, StandardCharsets.UTF_8)) {
                writeRow(writer, List.of("scope", "window_start_utc", "model_display", "requests", "successes", "errors",
                        "success_rate", "error_rate", "mean_latency_ms", "known_token_rows", "unknown_token_rows", "known_tokens", "breach"));
                for (Map.Entry<Key, Stats> entry : groups.entrySet()) {
                    Key k = entry.getKey(); Stats s = entry.getValue();
                    writeRow(writer, List.of(k.scope, k.window == null ? "" : k.window.toString(), modelDisplay(k.model),
                            Long.toString(s.requests), Long.toString(s.successes), Long.toString(s.errors()),
                            ratio(s.successes, s.requests), ratio(s.errors(), s.requests),
                            s.requests == 0 ? "N/A" : s.latency.divide(BigDecimal.valueOf(s.requests), 6, RoundingMode.HALF_UP).toPlainString(),
                            Long.toString(s.knownTokenRows), Long.toString(s.requests - s.knownTokenRows),
                            s.knownTokenRows == 0 ? "N/A" : Long.toString(s.tokens), Boolean.toString(s.breaches(config.errorThreshold))));
                }
            }
            // Unsupported atomic replacement is an error; no non-atomic silent fallback.
            Files.move(temporary, config.output, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException | RuntimeException | Error failure) {
            try { Files.deleteIfExists(temporary); }
            catch (IOException cleanup) { if (cleanup != failure) failure.addSuppressed(cleanup); }
            throw failure;
        }
    }

    /** 0=pass, 1=invalid input/I/O, 2=threshold breached, 3=no selected requests. */
    static int run(String[] args, PrintStream err) {
        try {
            Config config = parse(args);
            NavigableMap<Key, Stats> groups = analyze(config);
            report(config, groups);
            if (groups.get(ALL).requests == 0) { err.println("NO_DATA: no selected requests"); return 3; }
            long breaches = groups.values().stream().filter(s -> s.breaches(config.errorThreshold)).count();
            if (breaches != 0) { err.println("ALERT: error threshold reached in " + breaches + " aggregate rows"); return 2; }
            err.println("PASS: report written"); return 0;
        } catch (Exception failure) {
            // Do not echo raw log fields or exception messages containing sensitive input.
            err.println("INPUT_OR_IO_ERROR: " + failure.getClass().getSimpleName()); return 1;
        }
    }
    public static void main(String[] args) { System.exit(run(args, System.err)); }
}

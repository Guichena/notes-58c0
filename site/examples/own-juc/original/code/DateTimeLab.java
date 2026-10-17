import java.text.*;
import java.time.*;
import java.time.format.*;
import java.util.*;
import java.util.concurrent.*;

public final class DateTimeLab {
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("uuuu-MM-dd", Locale.ROOT)
            .withResolverStyle(ResolverStyle.STRICT);
    static Date parseLegacyFully(String text) {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT);
        format.setLenient(false); format.setTimeZone(TimeZone.getTimeZone("UTC"));
        ParsePosition position = new ParsePosition(0);
        Date parsed = format.parse(text, position);
        if (parsed == null || position.getIndex() != text.length()) throw new IllegalArgumentException("full valid date required");
        return parsed;
    }
    public static void main(String[] args) throws Exception {
        Checks.that(LocalDate.parse("2024-02-29", DATE).getDayOfMonth() == 29, "leap day");
        for (String bad : List.of("2023-02-29", "2024-02-29junk")) {
            try { LocalDate.parse(bad, DATE); throw new AssertionError("invalid date accepted"); }
            catch (DateTimeParseException expected) { }
            try { parseLegacyFully(bad); throw new AssertionError("legacy prefix accepted"); }
            catch (IllegalArgumentException expected) { }
        }
        LocalDate edge = LocalDate.of(2019, 12, 29);
        Checks.that(edge.format(DateTimeFormatter.ofPattern("YYYY", Locale.US)).equals("2020"), "week-based year");
        Checks.that(edge.format(DateTimeFormatter.ofPattern("uuuu", Locale.US)).equals("2019"), "calendar year");
        ExecutorService pool = Executors.newFixedThreadPool(4);
        try {
            List<Future<?>> jobs = new ArrayList<>();
            for (int t = 0; t < 4; t++) jobs.add(pool.submit(() -> {
                for (int i = 0; i < 1000; i++) {
                    Checks.that(LocalDate.parse("2024-02-29", DATE).format(DATE).equals("2024-02-29"), "shared immutable formatter");
                    Checks.that(parseLegacyFully("2024-02-29").toInstant().equals(Instant.parse("2024-02-29T00:00:00Z")), "per-call legacy state");
                }
            }));
            for (Future<?> f : jobs) Checks.get(f);
        } finally { Checks.stop(pool); }
        System.out.println("DateTimeLab OK");
    }
}

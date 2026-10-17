import java.time.LocalDate;
import java.time.format.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public final class ModernJavaLab {
    private ModernJavaLab() {}
    sealed interface Outcome permits Success, Missing {}
    record Success(String value) implements Outcome {}
    record Missing(String reason) implements Outcome {}
    static String describe(Outcome outcome) {
        return switch (outcome) {
            case null -> "null";
            case Success(String value) -> "ok:" + value;
            case Missing(String reason) -> "missing:" + reason;
        };
    }
    public static void main(String[] args) throws Exception {
        Checks.equal(describe(new Success("x")), "ok:x", "record pattern switch");
        Checks.equal(describe(new Missing("unknown")), "missing:unknown", "sealed exhaustive switch");
        Checks.equal(describe(null), "null", "explicit null case");
        List<Integer> list = new ArrayList<>(List.of(1, 2, 3));
        List<Integer> reverse = list.reversed();
        reverse.set(0, 9);
        Checks.equal(list, List.of(1, 2, 9), "reverse is backed view");
        list.addFirst(0);
        Checks.equal(reverse, List.of(9, 2, 1, 0), "view reflects structure");
        List<Integer> immutable = Stream.of(1, 2).toList();
        Checks.expect(UnsupportedOperationException.class, () -> immutable.add(3), "stream toList");
        List<Integer> mutable = Stream.of(1, 2).collect(Collectors.toCollection(ArrayList::new));
        mutable.add(3);
        Checks.equal(mutable, List.of(1, 2, 3), "explicit mutable collector");
        Stream<Integer> oneShot = Stream.of(1, 2);
        Checks.check(oneShot.count() == 2, "terminal consumption");
        Checks.expect(IllegalStateException.class, oneShot::count, "stream already consumed");
        Checks.expect(IllegalStateException.class,
                () -> Stream.of("a", "a").collect(Collectors.toMap(s -> s, s -> 1)),
                "duplicate map key");
        Checks.equal(Stream.of("a", "a").collect(Collectors.toMap(s -> s, s -> 1, Integer::sum)),
                Map.of("a", 2), "explicit duplicate merge");

        AtomicInteger defaults = new AtomicInteger();
        Optional<Integer> value = Optional.of(7);
        Checks.check(value.orElse(defaults.incrementAndGet()) == 7 && defaults.get() == 1,
                "orElse eager argument");
        Checks.check(value.orElseGet(defaults::incrementAndGet) == 7 && defaults.get() == 1,
                "orElseGet lazy");
        Checks.check(Optional.<Integer>empty().orElseGet(defaults::incrementAndGet) == 2,
                "lazy fallback when absent");
        Checks.expect(NoSuchElementException.class, Optional.empty()::get, "empty optional get");
        Checks.check(Optional.of("x").map(s -> null).isEmpty(), "map null becomes empty");
        Checks.expect(NullPointerException.class, () -> Optional.of("x").flatMap(s -> null),
                "flatMap null rejected");

        DateTimeFormatter strict = DateTimeFormatter.ofPattern("uuuu-MM-dd", Locale.ROOT)
                .withResolverStyle(ResolverStyle.STRICT);
        Checks.equal(LocalDate.parse("2024-02-29", strict), LocalDate.of(2024, 2, 29), "leap date");
        Checks.expect(DateTimeParseException.class, () -> LocalDate.parse("2023-02-29", strict),
                "strict invalid date");
        Thread virtual = Thread.startVirtualThread(() -> {});
        Checks.check(virtual.isVirtual(), "virtual thread API");
        Checks.check(virtual.join(java.time.Duration.ofSeconds(5)), "bounded virtual completion");
        Checks.done("ModernJavaLab");
    }
}

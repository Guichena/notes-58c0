import java.util.*;

public final class ResourceLab {
    private ResourceLab() {}
    @FunctionalInterface interface Task<T> { T run() throws Throwable; }
    @FunctionalInterface interface Cleanup { void close() throws Throwable; }

    static <T> T withCleanup(Task<T> body, Cleanup... resources) throws Throwable {
        Objects.requireNonNull(body);
        Objects.requireNonNull(resources);
        Cleanup[] owned = resources.clone();
        for (Cleanup cleanup : owned) Objects.requireNonNull(cleanup);
        Throwable primary = null;
        T result = null;
        try { result = body.run(); }
        catch (Throwable failure) { primary = failure; }
        for (int i = owned.length - 1; i >= 0; i--) {
            try { owned[i].close(); }
            catch (Throwable failure) {
                if (primary == null) primary = failure;
                else if (failure != primary) primary.addSuppressed(failure);
            }
        }
        if (primary != null) throw primary;
        return result;
    }
    static final class Closing implements AutoCloseable {
        final String name;
        final List<String> order;
        final RuntimeException failure;
        Closing(String name, List<String> order, RuntimeException failure) {
            this.name = name; this.order = order; this.failure = failure;
        }
        @Override public void close() {
            order.add(name);
            if (failure != null) throw failure;
        }
    }
    static Closing cannotOpen() { throw new IllegalStateException("open"); }
    static int primitiveReturn() {
        int value = 1;
        try { return value; } finally { value = 2; }
    }
    static List<Integer> referenceReturn() {
        List<Integer> result = new ArrayList<>();
        try { return result; } finally { result.add(2); }
    }
    @SuppressWarnings("try")
    public static void main(String[] args) throws Throwable {
        Checks.check(primitiveReturn() == 1, "return expression evaluated first");
        Checks.equal(referenceReturn(), List.of(2), "returned referent can change");
        List<String> order = new ArrayList<>();
        RuntimeException body = new RuntimeException("body");
        RuntimeException closeA = new RuntimeException("close A"), closeB = new RuntimeException("close B");
        RuntimeException thrown = Checks.expect(RuntimeException.class, () -> {
            try (Closing a = new Closing("A", order, closeA);
                 Closing b = new Closing("B", order, closeB)) {
                throw body;
            }
        }, "TWR distinct suppression");
        Checks.check(thrown == body, "body is primary");
        Checks.equal(order, List.of("B", "A"), "reverse close order");
        Checks.check(Arrays.equals(body.getSuppressed(), new Throwable[]{closeB, closeA}),
                "suppression order");
        order.clear();
        Checks.expect(IllegalStateException.class, () -> {
            try (Closing a = new Closing("A", order, null); Closing b = cannotOpen()) {
                throw new AssertionError("unreachable");
            }
        }, "second initializer fails");
        Checks.equal(order, List.of("A"), "first resource closed on later initialization failure");

        RuntimeException same = new RuntimeException("same instance");
        IllegalArgumentException self = Checks.expect(IllegalArgumentException.class, () -> {
            try (Closing a = new Closing("same", new ArrayList<>(), same)) { throw same; }
        }, "standard TWR self-suppression boundary");
        Checks.check(self.getCause() == same, "self suppression identifies original");

        RuntimeException primary = new RuntimeException("primary");
        RuntimeException secondary = new RuntimeException("secondary");
        List<String> customOrder = new ArrayList<>();
        RuntimeException preserved = Checks.expect(RuntimeException.class, () ->
            withCleanup(() -> { throw primary; },
                () -> { customOrder.add("first"); throw secondary; },
                () -> { customOrder.add("second"); throw primary; },
                () -> { customOrder.add("third"); throw primary; }),
            "identical throwable guarded");
        Checks.check(preserved == primary, "helper preserves original identity");
        Checks.equal(customOrder, List.of("third", "second", "first"), "all cleanups attempted");
        Checks.check(Arrays.equals(primary.getSuppressed(), new Throwable[]{secondary}),
                "only distinct failure suppressed");
        RuntimeException c1 = new RuntimeException("one"), c2 = new RuntimeException("two");
        RuntimeException firstClose = Checks.expect(RuntimeException.class, () ->
                withCleanup(() -> 7, () -> { throw c1; }, () -> { throw c2; }),
                "success with cleanup failure");
        Checks.check(firstClose == c2 && c2.getSuppressed()[0] == c1, "cleanup primary order");
        Checks.equal(withCleanup(() -> 9, () -> {}), 9, "normal result");
        Checks.done("ResourceLab");
    }
}

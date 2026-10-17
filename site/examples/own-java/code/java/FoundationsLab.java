import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.util.*;

public final class FoundationsLab {
    private FoundationsLab() {}
    static class Animal {
        String field = "animal";
        String speak() { return "animal"; }
        static String kind() { return "animal"; }
    }
    static final class Dog extends Animal {
        String field = "dog";
        @Override String speak() { return "dog"; }
        static String kind() { return "dog"; }
    }
    static String overload(Object value) { return "Object"; }
    static String overload(String value) { return "String"; }

    static final class Box { int value; Box(int value) { this.value = value; } }
    static void change(Box value) { value.value = 2; value = new Box(3); }

    record Key(String tenant, long id) {
        Key { Objects.requireNonNull(tenant); }
    }
    static final class MutableKey {
        int id;
        MutableKey(int id) { this.id = id; }
        @Override public int hashCode() { return id; }
        @Override public boolean equals(Object other) {
            return other instanceof MutableKey k && id == k.id;
        }
    }
    record ArrayRecord(int[] values) {}

    static final class Node {
        final String name;
        final List<Node> edges = new ArrayList<>();
        Node(String name) { this.name = Objects.requireNonNull(name); }
        // Equal contents do not mean the same node in a graph.
        @Override public boolean equals(Object other) {
            return other instanceof Node n && name.equals(n.name);
        }
        @Override public int hashCode() { return name.hashCode(); }
    }
    static Node copyGraph(Node root) {
        return copyGraph(root, new IdentityHashMap<>());
    }
    private static Node copyGraph(Node node, IdentityHashMap<Node, Node> seen) {
        if (node == null) return null;
        Node prior = seen.get(node);
        if (prior != null) return prior;
        Node copy = new Node(node.name);
        seen.put(node, copy); // Register before following cycles.
        for (Node edge : node.edges) copy.edges.add(copyGraph(edge, seen));
        return copy;
    }

    static class GenericBox<T> { T get() { return null; } }
    static final class StringBox extends GenericBox<String> {
        @Override String get() { return "value"; }
    }
    static <T> void copyInto(List<? super T> target, List<? extends T> source) {
        target.addAll(source); // This operation appends; it does not overwrite positions.
    }
    static void swapUnknown(List<?> list, int a, int b) { swapCaptured(list, a, b); }
    private static <T> void swapCaptured(List<T> list, int a, int b) {
        T value = list.get(a);
        list.set(a, list.get(b));
        list.set(b, value);
    }
    @SuppressWarnings({"rawtypes", "unchecked"})
    static void heapPollution() {
        List<String> strings = new ArrayList<>();
        List raw = strings; // Deliberate negative example, isolated here.
        raw.add(42);
        Checks.expect(ClassCastException.class, () -> {
            String bad = strings.get(0);
            System.out.println(bad);
        }, "raw type corruption");
    }

    public static void main(String[] args) throws Exception {
        Animal a = new Dog();
        Checks.equal(a.speak(), "dog", "virtual dispatch");
        Checks.equal(a.field, "animal", "field is statically selected");
        Checks.equal(Animal.kind(), "animal", "static call");
        Object text = "x";
        Checks.equal(overload(text), "Object", "overload uses static argument type");
        Box box = new Box(1); change(box);
        Checks.check(box.value == 2, "reference value copied, caller variable unchanged");
        Checks.check((long) 50_000 * 50_000 == 2_500_000_000L, "widen before multiply");
        Checks.check(50_000 * 50_000 != 2_500_000_000L, "int multiplication overflow");
        Checks.expect(ArithmeticException.class, () -> Math.multiplyExact(50_000, 50_000),
                "exact overflow");
        Integer absent = null;
        Checks.expect(NullPointerException.class, () -> { int value = absent; },
                "unboxing null");
        Checks.check(Integer.valueOf(127) == Integer.valueOf(127), "required cache");
        Checks.equal(Integer.valueOf(1000), Integer.valueOf(1000), "value comparison");
        Checks.check(!Integer.valueOf(1).equals(Long.valueOf(1)), "different wrapper types");
        Checks.check(!new BigDecimal("1.0").equals(new BigDecimal("1.00")), "scale equality");
        Checks.check(new BigDecimal("1.0").compareTo(new BigDecimal("1.00")) == 0,
                "numeric decimal order");

        Map<Key, String> map = new HashMap<>();
        map.put(new Key("t", 1), "ok");
        Checks.equal(map.get(new Key("t", 1)), "ok", "record key equality");
        MutableKey key = new MutableKey(1);
        Map<MutableKey, String> broken = new HashMap<>();
        broken.put(key, "old"); key.id = 2;
        Checks.check(broken.get(key) == null, "mutable key no longer located");
        key.id = 1;
        Checks.equal(broken.get(key), "old", "restore original hash");
        Checks.check(!new ArrayRecord(new int[]{1}).equals(new ArrayRecord(new int[]{1})),
                "record array components use identity equality");

        Node root = new Node("root"), shared = new Node("shared");
        Node sameValueDifferentIdentity = new Node("shared");
        root.edges.add(root); root.edges.add(shared); root.edges.add(shared);
        root.edges.add(sameValueDifferentIdentity);
        Node copy = copyGraph(root);
        Checks.check(copy != root && copy.edges.get(0) == copy, "cycle preserved");
        Checks.check(copy.edges.get(1) == copy.edges.get(2), "alias preserved");
        Checks.check(copy.edges.get(1) != shared, "mutable child copied");
        Checks.check(copy.edges.get(1) != copy.edges.get(3), "identity map not equality map");
        copy.edges.get(1).edges.add(copy);
        Checks.check(shared.edges.isEmpty(), "copy mutation isolated");
        Checks.check(copyGraph(null) == null, "null graph");

        char[] raw = {'h', 'i'}; String immutable = new String(raw); raw[0] = 'X';
        Checks.equal(immutable, "hi", "constructor defensive copy");
        String literal = "abc", fresh = new String("abc");
        Checks.check(literal != fresh && literal.equals(fresh), "identity vs value");
        Checks.check(fresh.intern() == literal, "intern canonical reference");
        Checks.check("a" + "bc" == literal, "constant folding");
        String runtime = literal + "";
        Checks.check(runtime != literal && runtime.equals(literal), "runtime concatenation");
        final String constant = "abc";
        Checks.check(constant + "" == literal, "constant variable concatenation");
        String emoji = "A😀";
        Checks.check(emoji.length() == 3 && emoji.codePointCount(0, emoji.length()) == 2,
                "UTF-16 units and code points");
        Checks.equal(new StringBuilder(emoji).reverse().toString(), "😀A",
                "builder preserves valid surrogate pair");

        Checks.check(new ArrayList<String>().getClass() == new ArrayList<Integer>().getClass(),
                "erased runtime class");
        List<Integer> source = List.of(1, 2);
        List<Number> target = new ArrayList<>();
        copyInto(target, source);
        Checks.equal(target, List.of(1, 2), "PECS copy");
        swapUnknown(target, 0, 1);
        Checks.equal(target, List.of(2, 1), "capture helper");
        Object[] covariant = new String[1];
        Checks.expect(ArrayStoreException.class, () -> covariant[0] = 1, "array covariance");
        boolean bridge = Arrays.stream(StringBox.class.getDeclaredMethods()).anyMatch(Method::isBridge);
        Checks.check(bridge, "compiler bridge");
        GenericBox<String> parent = new StringBox();
        Checks.equal(parent.get(), "value", "bridge dispatch");
        heapPollution();
        Checks.done("FoundationsLab");
    }
}

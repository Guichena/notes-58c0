import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.Collectors;

public final class ApiCookbook {
    private ApiCookbook() {}
    static int firstIndex(int[] values, int target) {
        Objects.requireNonNull(values);
        for (int i = 0; i < values.length; i++) if (values[i] == target) return i;
        return -1;
    }
    static int[] sortedCopy(int[] values) {
        int[] copy = Objects.requireNonNull(values).clone();
        Arrays.sort(copy);
        return copy;
    }
    static boolean balanced(String text) {
        Objects.requireNonNull(text);
        Deque<Character> stack = new ArrayDeque<>();
        // Validate the alphabet first, so an early mismatch cannot hide an invalid character.
        for (int i = 0; i < text.length(); i++) {
            if ("()[]{}".indexOf(text.charAt(i)) < 0)
                throw new IllegalArgumentException("brackets only");
        }
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (c == '(' || c == '[' || c == '{') stack.push(c);
            else {
                if (stack.isEmpty()) return false;
                char expected = c == ')' ? '(' : c == ']' ? '[' : '{';
                if (stack.pop() != expected) return false;
            }
        }
        return stack.isEmpty();
    }
    static Map<String, Long> frequencies(List<String> words) {
        Objects.requireNonNull(words);
        Map<String, Long> result = new LinkedHashMap<>();
        for (String word : words) {
            Objects.requireNonNull(word, "word");
            result.merge(word, 1L, Math::addExact);
        }
        return result;
    }
    static int[] twoSum(int[] values, int target) {
        Objects.requireNonNull(values);
        Map<Integer, Integer> seen = new HashMap<>();
        for (int i = 0; i < values.length; i++) {
            long complement = (long) target - values[i];
            if (complement >= Integer.MIN_VALUE && complement <= Integer.MAX_VALUE) {
                Integer previous = seen.get((int) complement);
                if (previous != null) return new int[]{previous, i};
            }
            seen.putIfAbsent(values[i], i);
        }
        return new int[0];
    }
    static List<Integer> uniqueInOrder(List<Integer> values) {
        return new ArrayList<>(new LinkedHashSet<>(Objects.requireNonNull(values)));
    }
    static List<Integer> largestK(int[] values, int k) {
        Objects.requireNonNull(values);
        if (k < 0) throw new IllegalArgumentException("k must be nonnegative");
        if (k == 0) return new ArrayList<>();
        PriorityQueue<Integer> heap = new PriorityQueue<>();
        for (int x : values) {
            if (heap.size() < k) heap.offer(x);
            else if (x > heap.peek()) { heap.poll(); heap.offer(x); }
        }
        List<Integer> result = new ArrayList<>(heap);
        result.sort(Comparator.reverseOrder());
        return result;
    }
    static String reverseCodePoints(String text) {
        int[] points = Objects.requireNonNull(text).codePoints().toArray();
        StringBuilder result = new StringBuilder(text.length());
        for (int i = points.length - 1; i >= 0; i--) result.appendCodePoint(points[i]);
        return result.toString();
    }

    static void arrays() {
        int[] input = {3, 1, 3};
        Checks.check(firstIndex(input, 3) == 0, "first occurrence");
        Checks.check(firstIndex(new int[0], 3) == -1, "empty array");
        Checks.check(firstIndex(input, 9) == -1, "missing value");
        Checks.check(Arrays.equals(sortedCopy(input), new int[]{1, 3, 3}), "sorted copy");
        Checks.check(Arrays.equals(input, new int[]{3, 1, 3}), "input unchanged");
        int[][] grid = new int[2][3];
        for (int[] row : grid) Arrays.fill(row, -1);
        Checks.check(grid[0] != grid[1] && grid[1][2] == -1, "independent rows");
        int[][] shallow = grid.clone();
        Checks.check(shallow != grid && shallow[0] == grid[0], "two dimensional shallow copy");
        Checks.expect(NullPointerException.class, () -> firstIndex(null, 1), "null array");
        Checks.check(Arrays.binarySearch(new int[]{1, 3, 5}, 2) == -2, "insertion encoding");
    }
    static void lists() {
        List<Integer> values = new ArrayList<>(List.of(10, 20, 10));
        Checks.check(values.remove(Integer.valueOf(10)), "remove first equal value");
        Checks.equal(values, List.of(20, 10), "remove value result");
        Checks.check(values.remove(0) == 20, "remove index result");
        Checks.expect(IndexOutOfBoundsException.class, () -> values.remove(10), "wrong overload");
        values.add(0, 5); values.set(1, 99);
        for (Iterator<Integer> it = values.iterator(); it.hasNext();) {
            if (it.next() < 10) it.remove();
        }
        Checks.equal(values, List.of(99), "iterator deletion");
        Checks.expect(IndexOutOfBoundsException.class, () -> new ArrayList<>(100).get(99),
                "capacity not size");
        Iterator<Integer> it = values.iterator();
        Checks.expect(IllegalStateException.class, it::remove, "remove before next");
        it.next(); it.remove();
        Checks.expect(IllegalStateException.class, it::remove, "double remove");
        Checks.expect(NoSuchElementException.class, it::next, "exhausted next");
        List<Integer> detecting = new ArrayList<>(List.of(1, 2, 3));
        Iterator<Integer> invalid = detecting.iterator(); detecting.add(4);
        Checks.expect(ConcurrentModificationException.class, invalid::next,
                "deterministic single-thread misuse");
        CopyOnWriteArrayList<Integer> cow = new CopyOnWriteArrayList<>(List.of(1));
        Iterator<Integer> old = cow.iterator(); cow.add(2);
        Checks.check(old.next() == 1 && !old.hasNext(), "old snapshot");
        Checks.expect(UnsupportedOperationException.class, old::remove, "snapshot not writable");
    }
    static void deques() {
        Checks.check(balanced("") && balanced("([]{})") && balanced("(()())"), "balanced");
        Checks.check(!balanced("([)]") && !balanced(")") && !balanced("(("), "mismatch");
        Checks.expect(IllegalArgumentException.class, () -> balanced(")a"), "invalid alphabet");
        Deque<Integer> queue = new ArrayDeque<>();
        queue.offerLast(1); queue.offerLast(2);
        Checks.check(queue.pollFirst() == 1 && queue.pollFirst() == 2, "FIFO");
        Checks.check(queue.pollFirst() == null, "empty sentinel");
        Checks.expect(NoSuchElementException.class, queue::pop, "empty pop");
        Checks.expect(NullPointerException.class, () -> queue.add(null), "deque null");
    }
    static void mapsAndSets() {
        Checks.equal(frequencies(List.of("a", "b", "a")), Map.of("a", 2L, "b", 1L), "counts");
        Checks.check(Arrays.equals(twoSum(new int[]{3, 3}, 6), new int[]{0, 1}), "duplicate pair");
        Checks.check(twoSum(new int[]{3}, 6).length == 0, "cannot use index twice");
        Checks.check(twoSum(new int[]{Integer.MAX_VALUE, 1}, Integer.MIN_VALUE).length == 0,
                "no wraparound sum");
        Checks.check(twoSum(new int[0], 0).length == 0, "empty pair");
        Checks.equal(uniqueInOrder(List.of(2, 1, 2)), List.of(2, 1), "first encounter order");
        Set<Integer> seen = new HashSet<>();
        Checks.check(seen.add(2) && !seen.add(2), "set add result");
        Map<String, Integer> map = new HashMap<>();
        map.put("null", null);
        Checks.check(map.containsKey("null") && map.getOrDefault("null", 9) == null,
                "present null not default");
        Checks.check(map.getOrDefault("absent", 9) == 9, "missing default");
        map.computeIfAbsent("null", key -> 4);
        Checks.check(map.get("null") == 4, "compute null mapping");
        map.merge("null", 1, (a, b) -> null);
        Checks.check(!map.containsKey("null"), "merge null result deletes");
        TreeSet<String> byLength = new TreeSet<>(Comparator.comparingInt(String::length));
        byLength.add("ab"); byLength.add("cd");
        Checks.check(byLength.size() == 1, "comparator equality");
    }
    static void heaps() {
        Checks.equal(largestK(new int[]{3, 1, 5, 5, 2}, 3), List.of(5, 5, 3), "top K");
        Checks.equal(largestK(new int[]{-2, -5}, 9), List.of(-2, -5), "k greater than n");
        Checks.check(largestK(new int[]{1}, 0).isEmpty(), "k zero");
        Checks.expect(IllegalArgumentException.class, () -> largestK(new int[0], -1), "negative k");
        Checks.equal(largestK(new int[]{Integer.MIN_VALUE, Integer.MAX_VALUE}, 1),
                List.of(Integer.MAX_VALUE), "safe comparator extremes");
        Random random = new Random(76123);
        for (int trial = 0; trial < 150; trial++) {
            int[] a = random.ints(random.nextInt(30), -100, 101).toArray();
            int k = random.nextInt(35);
            List<Integer> expected = Arrays.stream(a).boxed().sorted(Comparator.reverseOrder())
                    .limit(k).collect(Collectors.toList());
            Checks.equal(largestK(a, k), expected, "random top K " + trial);
        }
    }
    static void stringsAndConversions() {
        Checks.equal("hello".substring(1, 3), "el", "substring bounds");
        Checks.check("a,b,".split(",", -1).length == 3, "trailing field");
        Checks.check("a.b".split("\\.").length == 2, "literal dot regex");
        Checks.equal(reverseCodePoints("A😀"), "😀A", "code point reverse");
        Checks.equal(reverseCodePoints(""), "", "empty reverse");
        Checks.equal(reverseCodePoints("e\u0301"), "\u0301e", "not grapheme reverse");
        String[] raw = {"a", "b"};
        List<String> view = Arrays.asList(raw); view.set(0, "x");
        Checks.equal(raw[0], "x", "asList backed by array");
        Checks.expect(UnsupportedOperationException.class, () -> view.add("c"), "fixed size");
        List<String> copy = new ArrayList<>(view); copy.add("c");
        Checks.check(raw.length == 2 && copy.toArray(String[]::new).length == 3, "copy structure");
        int[] nums = {1, 2};
        Checks.check(Arrays.asList(nums).size() == 1, "primitive array one object");
        List<Integer> boxed = Arrays.stream(nums).boxed().collect(Collectors.toList());
        Checks.check(Arrays.equals(nums, boxed.stream().mapToInt(Integer::intValue).toArray()),
                "boxing round trip");
        List<Integer> nullable = Arrays.asList(1, null);
        Checks.expect(NullPointerException.class,
                () -> nullable.stream().mapToInt(Integer::intValue).toArray(), "null unboxing");
        List<String> backing = new ArrayList<>(List.of("a"));
        List<String> wrapper = Collections.unmodifiableList(backing);
        List<String> snapshot = List.copyOf(backing); backing.add("b");
        Checks.check(wrapper.size() == 2 && snapshot.size() == 1, "view vs snapshot");
        Checks.expect(UnsupportedOperationException.class, () -> wrapper.add("c"), "read-only view");
        Checks.expect(NullPointerException.class, () -> List.copyOf(Arrays.asList("a", null)),
                "copyOf rejects null");
        List<List<Integer>> nested = List.copyOf(List.of(new ArrayList<>(List.of(1))));
        nested.get(0).add(2);
        Checks.check(nested.get(0).size() == 2, "shallow immutable structure");
        Map<String, Integer> map = new LinkedHashMap<>();
        map.put("a", 1); map.put("b", 2);
        List<String> keys = new ArrayList<>(map.keySet());
        map.keySet().remove("a"); map.put("c", 3);
        Checks.equal(keys, List.of("a", "b"), "copied keys stable");
        Checks.check(!map.containsKey("a"), "view deletion");
    }
    public static void main(String[] args) {
        arrays(); lists(); deques(); mapsAndSets(); heaps(); stringsAndConversions();
        Checks.done("ApiCookbook");
    }
}

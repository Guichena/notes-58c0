import java.util.*;

public final class ApiQuickReference {
    private ApiQuickReference() {}
    public static void main(String[] args) {
        int[] numbers = {3, 1, 2};
        int[] sorted = Arrays.copyOf(numbers, numbers.length);
        Arrays.sort(sorted);
        int[][] grid = new int[2][3];
        for (int[] row : grid) Arrays.fill(row, -1);
        Checks.check(numbers.length == 3 && sorted[0] == 1 && grid[1][2] == -1, "arrays");

        List<Integer> list = new ArrayList<>(Arrays.asList(10, 20, 30));
        list.add(40); list.add(0, 5);
        int old = list.set(2, 99);
        list.remove(Integer.valueOf(10)); list.remove(0);
        Collections.sort(list); Collections.reverse(list);
        Checks.check(old == 20 && list.size() == 3 && list.contains(99), "list calls");

        List<Integer> range = list.subList(0, 1);
        range.set(0, 100);
        Checks.check(list.get(0) == 100, "subList shares content");
        String[] oversized = {"old", "old", "old"};
        String[] returned = List.of("x").toArray(oversized);
        Checks.check(returned == oversized && oversized[1] == null, "oversized toArray terminator");

        Deque<Integer> stack = new ArrayDeque<>();
        stack.push(1); stack.push(2);
        Checks.check(stack.peek() == 2 && stack.pop() == 2, "stack");
        Deque<Integer> queue = new ArrayDeque<>();
        queue.offer(1); queue.offer(2);
        Checks.check(queue.poll() == 1 && queue.peek() == 2, "queue");

        Map<String, Integer> map = new HashMap<>();
        map.put("a", 1); map.put("b", 2);
        int sum = 0;
        for (Map.Entry<String, Integer> entry : map.entrySet()) sum += entry.getValue();
        Checks.check(sum == 3 && map.containsKey("a"), "map entrySet");

        Set<Integer> set = new HashSet<>(list);
        set.add(9); set.remove(9);
        Checks.check(set.contains(100), "set calls");
        TreeMap<Integer, String> ordered = new TreeMap<>();
        ordered.put(10, "a"); ordered.put(30, "b"); ordered.put(20, "c");
        Checks.check(ordered.floorKey(21) == 20 && ordered.ceilingKey(21) == 30, "navigation");
        Checks.check(ordered.subMap(10, true, 30, false).size() == 2, "range bounds");

        PriorityQueue<Integer> heap = new PriorityQueue<>(Comparator.reverseOrder());
        heap.offer(Integer.MIN_VALUE); heap.offer(Integer.MAX_VALUE);
        Checks.check(heap.peek() == Integer.MAX_VALUE && heap.poll() == Integer.MAX_VALUE, "heap");
        String text = "hello";
        Checks.check(text.charAt(0) == 'h' && text.indexOf("l") == 2
                && text.substring(1, 3).equals("el"), "string calls");
        StringBuilder builder = new StringBuilder(8);
        builder.append("a").append(1);
        builder.deleteCharAt(builder.length() - 1);
        Checks.check(builder.toString().equals("a") && builder.capacity() >= 8, "builder");
        Checks.done("ApiQuickReference");
    }
}

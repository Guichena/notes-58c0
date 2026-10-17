import java.util.*;
import java.util.concurrent.*;

/** Ordered outputs with a bounded submitted-but-not-emitted window, including buffered completions. */
public final class PipelineDemo {
    private static int assertions;
    private static void check(String name, boolean ok) {
        if (!ok) throw new AssertionError(name);
        assertions++;
        System.out.println("PASS " + name);
    }
    private static final class Item {
        final int index;
        final Long value;
        final String error;
        Item(int index, Long value, String error) { this.index = index; this.value = value; this.error = error; }
    }
    private static final class Batch {
        final List<Item> items = new ArrayList<>();
        int maximumOutstanding;
        int bufferedBeforeFirst, submittedBeforeFirst;
    }
    private static Batch square(List<Long> inputs, int window) throws Exception {
        return square(inputs, window, false);
    }
    private static Batch square(List<Long> inputs, int window, boolean testSlowFirst) throws Exception {
        if (window < 1) throw new IllegalArgumentException("window must be positive");
        if (testSlowFirst && (window < 2 || inputs.size() < 2))
            throw new IllegalArgumentException("slow-first self-test needs two items and slots");
        Batch batch = new Batch();
        if (inputs.isEmpty()) return batch;
        ExecutorService pool = Executors.newFixedThreadPool(Math.min(2, window));
        CompletionService<Item> completed = new ExecutorCompletionService<>(pool);
        Set<Future<Item>> active = new HashSet<>();
        Map<Integer, Item> ready = new HashMap<>();
        int submitted = 0, emitted = 0;
        // Optional gate forces the first item to finish last in its window during self-testing.
        CountDownLatch firstGate = new CountDownLatch(testSlowFirst ? 1 : 0);
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        try {
            while (emitted < inputs.size()) {
                // Counting only running tasks is insufficient: ready results also occupy the window.
                while (submitted < inputs.size() && submitted - emitted < window) {
                    final int index = submitted++;
                    final Long input = inputs.get(index);
                    active.add(completed.submit(() -> {
                        if (index == 0 && !firstGate.await(3, TimeUnit.SECONDS)) throw new TimeoutException("first-item gate");
                        try {
                            if (input == null || input < 0) throw new IllegalArgumentException("nonnegative input required");
                            return new Item(index, Math.multiplyExact(input, input), null);
                        } catch (IllegalArgumentException | ArithmeticException ex) {
                            return new Item(index, null, ex.getClass().getSimpleName());
                        }
                    }));
                    batch.maximumOutstanding = Math.max(batch.maximumOutstanding, submitted - emitted);
                }
                long remaining = deadline - System.nanoTime();
                if (remaining <= 0) throw new TimeoutException("batch deadline");
                Future<Item> future = completed.poll(remaining, TimeUnit.NANOSECONDS);
                if (future == null) throw new TimeoutException("batch deadline");
                active.remove(future);
                Item item = future.get(3, TimeUnit.SECONDS); // Already completed; task failures remain per-item records.
                ready.put(item.index, item);
                if (testSlowFirst && firstGate.getCount() == 1 && ready.size() == Math.min(window, inputs.size()) - 1) {
                    batch.bufferedBeforeFirst = ready.size();
                    batch.submittedBeforeFirst = submitted;
                    firstGate.countDown(); // Only the collector releases item 0, after its successors are buffered.
                }
                while (ready.containsKey(emitted)) batch.items.add(ready.remove(emitted++));
            }
            return batch;
        } finally {
            firstGate.countDown();
            for (Future<Item> future : active) future.cancel(true);
            pool.shutdownNow();
            if (!pool.awaitTermination(3, TimeUnit.SECONDS)) throw new AssertionError("pool stuck");
        }
    }
    public static void main(String[] args) throws Exception {
        Batch empty = square(Collections.<Long>emptyList(), 2);
        check("empty input submits no work", empty.items.isEmpty() && empty.maximumOutstanding == 0);
        Batch batch = square(Arrays.asList(2L, -3L, 2L, Long.MAX_VALUE, 0L), 3);
        check("one ordered record per input", batch.items.size() == 5);
        boolean ordered = true;
        for (int i = 0; i < batch.items.size(); i++) ordered &= batch.items.get(i).index == i;
        check("outputs retain input indices", ordered);
        check("valid square succeeds", Long.valueOf(4).equals(batch.items.get(0).value));
        check("negative input becomes per-item failure", "IllegalArgumentException".equals(batch.items.get(1).error));
        check("duplicate values retain distinct records", Long.valueOf(4).equals(batch.items.get(2).value)
                && batch.items.get(0) != batch.items.get(2));
        check("overflow becomes per-item failure", "ArithmeticException".equals(batch.items.get(3).error));
        check("failure does not drop later result", Long.valueOf(0).equals(batch.items.get(4).value));
        check("outstanding work includes reorder buffer", batch.maximumOutstanding == 3);
        Batch serial = square(Arrays.asList(1L, 2L, 3L), 1);
        check("window one is valid", serial.maximumOutstanding == 1 && serial.items.get(2).value == 9L);
        check("null is an explicit per-item failure", "IllegalArgumentException".equals(
                square(Arrays.asList((Long) null), 1).items.get(0).error));
        Batch delayed = square(Arrays.asList(1L, 2L, 3L, 4L, 5L, 6L), 3, true);
        check("early slow item buffers later completions", delayed.bufferedBeforeFirst == 2);
        check("full reorder window prevents further submissions", delayed.submittedBeforeFirst == 3
                && delayed.maximumOutstanding == 3);
        boolean delayedOrdered = true;
        for (int i = 0; i < delayed.items.size(); i++) delayedOrdered &= delayed.items.get(i).index == i;
        check("out-of-order completion still emits ordered results", delayedOrdered && delayed.items.get(5).value == 36L);
        boolean rejected = false;
        try { square(Collections.<Long>emptyList(), 0); } catch (IllegalArgumentException ex) { rejected = true; }
        check("zero window is rejected even for empty input", rejected);
        System.out.println("ASSERTIONS " + assertions);
    }
}

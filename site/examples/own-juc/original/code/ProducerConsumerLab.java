import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

/** Finite producer/consumer lifecycle with a typed terminal message. */
public final class ProducerConsumerLab {
    record Message(boolean end, int value) {
        static Message item(int value) { return new Message(false, value); }
        static Message stop() { return new Message(true, 0); }
    }
    public static void main(String[] args) throws Exception {
        int producers = 2, consumers = 3, perProducer = 1000;
        BlockingQueue<Message> queue = new ArrayBlockingQueue<>(16);
        ExecutorService executor = Executors.newFixedThreadPool(producers + consumers);
        Set<Integer> seen = ConcurrentHashMap.newKeySet();
        List<Future<?>> producerTasks = new ArrayList<>(), consumerTasks = new ArrayList<>();
        try {
            for (int c = 0; c < consumers; c++) consumerTasks.add(executor.submit(() -> {
                for (;;) {
                    Message item = queue.take();
                    if (item.end()) return null;
                    Checks.that(seen.add(item.value()), "duplicate item");
                }
            }));
            for (int p = 0; p < producers; p++) {
                int base = p * perProducer;
                producerTasks.add(executor.submit(() -> {
                    for (int i = 0; i < perProducer; i++) queue.put(Message.item(base + i));
                    return null;
                }));
            }
            for (Future<?> task : producerTasks) Checks.get(task);
            // Only the coordinator sends terminal messages, after every producer succeeded.
            for (int c = 0; c < consumers; c++) {
                if (!queue.offer(Message.stop(), 5, TimeUnit.SECONDS)) throw new AssertionError("terminal offer timeout");
            }
            for (Future<?> task : consumerTasks) Checks.get(task);
            Checks.that(seen.size() == producers * perProducer && queue.isEmpty(), "all accepted work consumed");
            MonitorQueue<Integer> monitor = new MonitorQueue<>(1);
            monitor.put(0); monitor.close();
            Checks.that(monitor.take() == 0 && monitor.take() == null, "monitor drain then end");
            try { monitor.put(1); throw new AssertionError("closed monitor accepted"); }
            catch (IllegalStateException expected) { }
            System.out.println("ProducerConsumerLab OK");
        } finally {
            // Failure path interrupts blocked puts/takes; accepted work may remain and is not claimed durable.
            for (Future<?> f : producerTasks) f.cancel(true);
            for (Future<?> f : consumerTasks) f.cancel(true);
            Checks.stop(executor);
        }
    }
}

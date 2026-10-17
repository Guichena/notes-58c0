import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import org.apache.kafka.clients.consumer.*;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.errors.WakeupException;
import org.apache.kafka.common.errors.RebalanceInProgressException;
import org.apache.kafka.common.serialization.StringDeserializer;

/** Finite validation exercise, NOT a durable business-effect implementation. */
public final class KafkaConsumerLab implements ConsumerRebalanceListener {
    private record Result(TopicPartition partition, long epoch, long offset, RuntimeException failure) {}
    private final KafkaConsumer<String, String> consumer;
    private final boolean commitValidation;
    private final Map<TopicPartition, Long> assignments = new HashMap<>();
    private final Map<TopicPartition, SafeOffsetProgress> progress = new HashMap<>();
    private final Map<TopicPartition, Long> confirmed = new HashMap<>();
    private final ArrayBlockingQueue<Result> completions = new ArrayBlockingQueue<>(512);
    private final AtomicInteger running = new AtomicInteger();
    private final AtomicBoolean stop = new AtomicBoolean();
    private final AtomicReference<RuntimeException> overflow = new AtomicReference<>();
    private final ThreadPoolExecutor workers = new ThreadPoolExecutor(4, 4, 0, TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(256), r -> {
                Thread t = new Thread(r, "lab-validation"); t.setDaemon(true); return t;
            }, new ThreadPoolExecutor.AbortPolicy());
    private long nextEpoch;
    private RuntimeException processingFailure;
    private boolean paused;
    private int dispatched;
    private int validated;

    private KafkaConsumerLab(String bootstrap, String topic, String group, boolean commitValidation) {
        this.commitValidation = commitValidation;
        Properties p = new Properties();
        p.put("bootstrap.servers", bootstrap); p.put("group.id", group);
        p.put("key.deserializer", StringDeserializer.class.getName());
        p.put("value.deserializer", StringDeserializer.class.getName());
        p.put("enable.auto.commit", "false"); p.put("auto.offset.reset", "none");
        p.put("isolation.level", "read_committed"); p.put("allow.auto.create.topics", "false");
        p.put("group.protocol", "classic");
        p.put("partition.assignment.strategy", CooperativeStickyAssignor.class.getName());
        p.put("max.poll.records", "32"); p.put("max.poll.interval.ms", "120000");
        p.put("session.timeout.ms", "45000"); p.put("heartbeat.interval.ms", "3000");
        p.put("default.api.timeout.ms", "2000");
        p.put("fetch.max.bytes", "2097152"); p.put("max.partition.fetch.bytes", "1048576");
        KafkaConsumer<String, String> created = null;
        try {
            created = new KafkaConsumer<>(p);
            consumer = created;
            consumer.subscribe(List.of(topic), this);
        } catch (RuntimeException | Error failure) {
            LabCleanup exit = new LabCleanup();
            exit.record(failure);
            KafkaConsumer<String, String> acquired = created;
            if (acquired != null) exit.attempt(() -> acquired.close(Duration.ofSeconds(2)));
            exit.attempt(workers::shutdownNow);
            throw failure;
        }
    }
    private void drain() {
        Result r;
        while ((r = completions.poll()) != null) {
            SafeOffsetProgress s = progress.get(r.partition());
            if (s == null || s.epoch() != r.epoch() || !s.owned()) continue;
            if (r.failure() != null) {
                if (processingFailure == null) processingFailure = r.failure();
                continue; // Never complete a failed slot.
            }
            if (s.complete(r.epoch(), r.offset())) validated++;
        }
    }
    private Map<TopicPartition, OffsetAndMetadata> candidates(Collection<TopicPartition> only) {
        Map<TopicPartition, OffsetAndMetadata> m = new HashMap<>();
        for (TopicPartition tp : only) {
            SafeOffsetProgress s = progress.get(tp);
            if (s == null || !s.owned()) continue;
            SafeOffsetProgress.Cursor v = s.safe();
            if (v.offset() > confirmed.getOrDefault(tp, -1L))
                m.put(tp, new OffsetAndMetadata(v.offset(), v.leaderEpoch(), "validation-only"));
        }
        return m;
    }
    private void commit(Collection<TopicPartition> only) {
        if (!commitValidation) return;
        Map<TopicPartition, OffsetAndMetadata> m = candidates(only);
        if (m.isEmpty()) return;
        try {
            consumer.commitSync(m, Duration.ofMillis(500));
            m.forEach((tp, off) -> confirmed.put(tp, off.offset()));
        } catch (CommitFailedException | RebalanceInProgressException | org.apache.kafka.common.errors.TimeoutException e) {
            // No historical async retry. A later attempt uses CURRENT ownership and safe candidates.
            System.err.println("commit not confirmed: " + e.getClass().getSimpleName());
        }
    }
    private void drop(Collection<TopicPartition> partitions) {
        for (TopicPartition tp : partitions) {
            SafeOffsetProgress s = progress.remove(tp);
            if (s != null) s.invalidate();
            assignments.remove(tp); confirmed.remove(tp);
        }
    }
    @Override public void onPartitionsRevoked(Collection<TopicPartition> partitions) {
        long until = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(300);
        while (System.nanoTime() < until && running.get() > 0) {
            drain();
            try { Thread.sleep(5); }
            catch (InterruptedException e) { Thread.currentThread().interrupt(); break; }
        }
        drain();
        try { commit(partitions); } finally { drop(partitions); }
    }
    @Override public void onPartitionsLost(Collection<TopicPartition> partitions) {
        drop(partitions); // Lost ownership: no commit and no wait pretending to own it.
    }
    @Override public void onPartitionsAssigned(Collection<TopicPartition> partitions) {
        Set<TopicPartition> fresh = new HashSet<>(partitions);
        fresh.removeAll(assignments.keySet());
        Map<TopicPartition, OffsetAndMetadata> restored = fresh.isEmpty() ? Map.of()
                : consumer.committed(fresh, Duration.ofSeconds(1));
        for (TopicPartition tp : fresh) {
            assignments.put(tp, ++nextEpoch);
            OffsetAndMetadata saved = restored.get(tp);
            if (saved == null) {
                // Dedicated-lab policy for ABSENT commits; absence cannot prove the group is new.
                // A PRESENT but out-of-range commit fails with auto.offset.reset=none.
                consumer.seekToBeginning(List.of(tp));
            } else confirmed.put(tp, saved.offset());
        }
        if (assignments.size() > 16) throw new IllegalStateException("lab supports at most 16 assigned partitions");
        // Cooperative assignment may retain partitions. Never reset retained state.
    }
    private static SafeOffsetProgress.Cursor cursor(OffsetAndMetadata v) {
        return new SafeOffsetProgress.Cursor(v.offset(), v.leaderEpoch());
    }
    private void register(ConsumerRecords<String, String> batch) {
        // Include empty-poll scan advances. position is queried only on the owner thread.
        for (TopicPartition tp : consumer.assignment()) {
            List<ConsumerRecord<String, String>> rows = batch.records(tp);
            OffsetAndMetadata meta = batch.nextOffsets().get(tp);
            SafeOffsetProgress s = progress.get(tp);
            SafeOffsetProgress.Cursor next = meta != null ? cursor(meta)
                    : (s != null ? s.scanned()
                    : SafeOffsetProgress.Cursor.at(consumer.position(tp, Duration.ofMillis(200))));
            if (s == null) {
                SafeOffsetProgress.Cursor start = rows.isEmpty() ? next
                        : SafeOffsetProgress.Cursor.at(rows.get(0).offset());
                Long epoch = assignments.get(tp);
                if (epoch == null) throw new IllegalStateException("assignment callback missing");
                s = new SafeOffsetProgress(epoch, start, 256);
                progress.put(tp, s);
            }
            List<SafeOffsetProgress.Delivery> ds = rows.stream()
                    .map(r -> new SafeOffsetProgress.Delivery(r.offset(), r.leaderEpoch())).toList();
            s.observe(ds, next); // Backwards reset/truncation is fail-stop, never silently reused.
        }
    }
    private void dispatch(ConsumerRecords<String, String> batch) {
        for (ConsumerRecord<String, String> r : batch) {
            TopicPartition tp = new TopicPartition(r.topic(), r.partition());
            SafeOffsetProgress s = progress.get(tp);
            if (s == null) throw new IllegalStateException("no progress for delivered partition");
            long epoch = s.epoch();
            running.incrementAndGet();
            try {
                workers.execute(() -> {
                    RuntimeException error = null;
                    try {
                        LabEnvelope e = LabEnvelope.decode(r.value());
                        if (!Objects.equals(r.key(), e.entityKey()))
                            throw new IllegalArgumentException("partition key/envelope mismatch");
                        // Only validation. No claim of durable account/order/notification effects.
                    } catch (Throwable failure) {
                        error = failure instanceof RuntimeException re ? re
                                : new IllegalStateException("worker failed", failure);
                    }
                    finally {
                        boolean saved = completions.offer(new Result(tp, epoch, r.offset(), error));
                        if (!saved) overflow.compareAndSet(null, new IllegalStateException("completion queue full"));
                        running.decrementAndGet();
                    }
                });
                dispatched++;
            } catch (RejectedExecutionException reject) {
                running.decrementAndGet(); throw reject; // Registered but not complete: never skip.
            }
        }
    }
    private void backpressure() {
        int pending = progress.values().stream().mapToInt(SafeOffsetProgress::pending).sum();
        if (pending >= 128 || running.get() >= 128) paused = true;
        else if (pending <= 64 && running.get() <= 64) paused = false;
        if (paused || stop.get() || dispatched >= 1000) consumer.pause(consumer.assignment());
        else consumer.resume(consumer.assignment());
    }
    private void awaitWorkers(LabCleanup exit) {
        try {
            if (!workers.awaitTermination(500, TimeUnit.MILLISECONDS))
                System.err.println("worker drain incomplete: unresolved records remain replayable");
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            exit.record(interrupted);
        }
    }
    private void run() throws Exception {
        CountDownLatch finished = new CountDownLatch(1);
        Thread hook = new Thread(() -> {
            stop.set(true);
            try { consumer.wakeup(); }
            finally {
                try {
                    if (!finished.await(6, TimeUnit.SECONDS))
                        System.err.println("shutdown wait expired: unfinished work/commits require replay or reconciliation");
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                }
            }
        }, "lab-stop");
        boolean hookRegistered = false;
        LabCleanup exit = new LabCleanup();
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(60);
        try {
            Runtime.getRuntime().addShutdownHook(hook);
            hookRegistered = true;
            while (!stop.get() && System.nanoTime() < deadline && dispatched < 1000) {
                drain();
                if (processingFailure != null) throw processingFailure;
                if (overflow.get() != null) throw overflow.get();
                backpressure();
                ConsumerRecords<String, String> batch = consumer.poll(Duration.ofMillis(100));
                if (dispatched + batch.count() > 1000) break; // Leave this whole undispatched batch for replay.
                register(batch); dispatch(batch); drain();
                commit(new ArrayList<>(assignments.keySet()));
            }
        } catch (WakeupException wakeup) {
            if (!stop.get()) exit.record(wakeup);
        } catch (Throwable failure) {
            exit.record(failure);
        } finally {
            try {
                stop.set(true);
                exit.attempt(workers::shutdown);
                awaitWorkers(exit);
                exit.attempt(workers::shutdownNow);
                awaitWorkers(exit);
                // Drain before dropping ownership; never register more records during shutdown.
                exit.attempt(this::drain);
                exit.record(processingFailure);
                exit.record(overflow.get());
                if (!workers.isTerminated())
                    exit.record(new IllegalStateException("validation workers did not stop; unresolved records require replay"));
                exit.attempt(() -> commit(new ArrayList<>(assignments.keySet())));
                exit.attempt(() -> drop(new ArrayList<>(assignments.keySet())));
                exit.attempt(() -> consumer.close(Duration.ofSeconds(2)));
                if (hookRegistered) exit.attempt(() -> {
                    try { Runtime.getRuntime().removeShutdownHook(hook); }
                    catch (IllegalStateException shutdownInProgress) { }
                });
                System.out.println("dispatched=" + dispatched + " validated=" + validated
                        + " mode=" + (commitValidation ? "commit-validation" : "inspect-no-commit"));
            } finally {
                finished.countDown(); // The hook waits for the owner; it never closes the consumer.
            }
        }
        exit.rethrow();
    }
    public static void main(String[] a) throws Exception {
        if (a.length != 4 || !Set.of("inspect", "commit-validation").contains(a[0]))
            throw new IllegalArgumentException("inspect|commit-validation bootstrap topic dedicatedGroup");
        new KafkaConsumerLab(a[1], a[2], a[3], a[0].equals("commit-validation")).run();
    }
}

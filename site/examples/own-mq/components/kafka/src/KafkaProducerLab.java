import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.apache.kafka.clients.consumer.*;
import org.apache.kafka.clients.producer.*;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.errors.AuthorizationException;
import org.apache.kafka.common.errors.OutOfOrderSequenceException;
import org.apache.kafka.common.errors.ProducerFencedException;
import org.apache.kafka.common.serialization.ByteArrayDeserializer;
import org.apache.kafka.common.serialization.ByteArraySerializer;
import org.apache.kafka.common.serialization.StringSerializer;

/** Dedicated test-cluster only. No DB or HTTP transaction is implied. */
public final class KafkaProducerLab {
    private static Properties producerProperties(String bootstrap) {
        Properties p = new Properties();
        p.put("bootstrap.servers", bootstrap);
        p.put("key.serializer", StringSerializer.class.getName());
        p.put("value.serializer", StringSerializer.class.getName());
        p.put("acks", "all"); p.put("enable.idempotence", "true");
        p.put("retries", Integer.toString(Integer.MAX_VALUE));
        p.put("max.in.flight.requests.per.connection", "5");
        p.put("batch.size", "32768"); p.put("linger.ms", "5");
        p.put("compression.type", "gzip"); p.put("buffer.memory", "8388608");
        p.put("max.block.ms", "5000"); p.put("request.timeout.ms", "10000");
        p.put("delivery.timeout.ms", "30000"); p.put("max.request.size", "1048576");
        return p;
    }
    private static Properties consumerProperties(String bootstrap, String group) {
        Properties p = new Properties();
        p.put("bootstrap.servers", bootstrap); p.put("group.id", group);
        p.put("key.deserializer", ByteArrayDeserializer.class.getName());
        p.put("value.deserializer", ByteArrayDeserializer.class.getName());
        p.put("enable.auto.commit", "false"); p.put("auto.offset.reset", "earliest");
        p.put("isolation.level", "read_committed"); p.put("group.protocol", "classic");
        p.put("max.poll.records", "20"); p.put("max.poll.interval.ms", "120000");
        p.put("default.api.timeout.ms", "5000"); p.put("allow.auto.create.topics", "false");
        return p;
    }
    private static long remaining(long deadline) throws java.util.concurrent.TimeoutException {
        long n = deadline - System.nanoTime();
        if (n <= 0) throw new java.util.concurrent.TimeoutException("overall deadline");
        return n;
    }
    private static <T> T await(Future<T> f, long deadline) throws Exception {
        return f.get(remaining(deadline), TimeUnit.NANOSECONDS);
    }
    private static void send(String bootstrap, String topic, String runId, int n, boolean duplicate)
            throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(60);
        AtomicInteger ok = new AtomicInteger(), failed = new AtomicInteger();
        List<Future<RecordMetadata>> futures = new ArrayList<>();
        KafkaProducer<String, String> p = new KafkaProducer<>(producerProperties(bootstrap));
        LabCleanup exit = new LabCleanup();
        try {
            for (int i = 0; i < n; i++) {
                remaining(deadline);
                LabEnvelope e = new LabEnvelope(runId + ":" + i, "order-" + (i % 4), i,
                        i % 2 == 0 ? "CN" : "US", "teaching-value-" + i);
                for (int copy = 0; copy < (duplicate ? 2 : 1); copy++) {
                    remaining(deadline);
                    futures.add(p.send(new ProducerRecord<>(topic, e.entityKey(), e.encode()),
                            (metadata, error) -> {
                                if (error == null) ok.incrementAndGet(); else failed.incrementAndGet();
                            }));
                }
            }
            for (Future<RecordMetadata> f : futures) await(f, deadline);
            // Waiting every future avoids an unbounded flush call and proves each submitted result.
        } catch (Throwable failure) {
            exit.record(failure);
        } finally {
            exit.attempt(() -> p.close(Duration.ofSeconds(3)));
            System.out.println("submitted=" + futures.size() + " callbacks_ok=" + ok.get()
                    + " callbacks_failed=" + failed.get());
        }
        exit.rethrow();
        if (failed.get() != 0 || ok.get() != futures.size())
            throw new IllegalStateException("not all sends confirmed");
        System.out.println("CONFIRMED records=" + futures.size()
                + "; independent duplicate sends are still distinct Kafka records");
    }
    private static ProducerRecord<byte[], byte[]> routed(ConsumerRecord<byte[], byte[]> r, String base) {
        ProducerRecord<byte[], byte[]> out;
        try {
            LabEnvelope e = LabEnvelope.decode(r.value());
            if (!Set.of("CN", "US").contains(e.country())) throw new IllegalArgumentException("route");
            out = new ProducerRecord<>(base + "." + e.country().toLowerCase(Locale.ROOT),
                    e.entityKey().getBytes(StandardCharsets.UTF_8), e.encode().getBytes(StandardCharsets.UTF_8));
        } catch (IllegalArgumentException bad) {
            // Byte-array deserialization preserves even malformed UTF-8 and null raw key/value.
            out = new ProducerRecord<>(base + ".dlt", r.key(), r.value());
            for (org.apache.kafka.common.header.Header h : r.headers()) out.headers().add(h);
            out.headers().add("lab-input-timestamp", Long.toString(r.timestamp()).getBytes(StandardCharsets.UTF_8));
            out.headers().add("lab-error", "invalid-envelope-or-country".getBytes(StandardCharsets.UTF_8));
        }
        out.headers().add("lab-origin", (r.topic() + ":" + r.partition() + ":" + r.offset())
                .getBytes(StandardCharsets.UTF_8));
        return out;
    }
    private static void route(String bootstrap, String input, String base, String group, String txId)
            throws Exception {
        Properties pp = producerProperties(bootstrap);
        pp.put("transactional.id", txId); pp.put("transaction.timeout.ms", "60000");
        pp.put("key.serializer", ByteArraySerializer.class.getName());
        pp.put("value.serializer", ByteArraySerializer.class.getName());
        KafkaProducer<byte[], byte[]> p = new KafkaProducer<>(pp);
        KafkaConsumer<byte[], byte[]> c;
        try { c = new KafkaConsumer<>(consumerProperties(bootstrap, group)); }
        catch (RuntimeException | Error constructionFailure) {
            LabCleanup exit = new LabCleanup();
            exit.record(constructionFailure);
            exit.attempt(() -> p.close(Duration.ofSeconds(3)));
            throw constructionFailure;
        }
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(60);
        boolean begun = false, commitStarted = false, fatal = false;
        int handled = 0;
        LabCleanup exit = new LabCleanup();
        try {
            p.initTransactions();
            c.subscribe(List.of(input));
            while (handled < 1000 && deadline - System.nanoTime() > TimeUnit.SECONDS.toNanos(8)) {
                ConsumerRecords<byte[], byte[]> batch = c.poll(Duration.ofMillis(200));
                if (batch.nextOffsets().isEmpty()) continue;
                if (handled + batch.count() > 1000) break;
                p.beginTransaction(); begun = true; commitStarted = false;
                List<Future<RecordMetadata>> sent = new ArrayList<>();
                for (ConsumerRecord<byte[], byte[]> r : batch) {
                    remaining(deadline);
                    sent.add(p.send(routed(r, base)));
                }
                for (Future<RecordMetadata> f : sent) await(f, deadline);
                Map<TopicPartition, OffsetAndMetadata> offsets = batch.nextOffsets();
                p.sendOffsetsToTransaction(offsets, c.groupMetadata());
                commitStarted = true;
                p.commitTransaction();
                begun = false; commitStarted = false;
                handled += batch.count();
            }
            System.out.println("COMMITTED routing records=" + handled + "; Kafka input/output only");
        } catch (ProducerFencedException | OutOfOrderSequenceException | AuthorizationException e) {
            fatal = true; exit.record(e);
        } catch (Throwable e) {
            if (commitStarted) {
                System.err.println("COMMIT RESULT UNKNOWN: stop; recover with the same exclusive transactional.id");
            }
            exit.record(e);
        } finally {
            if (begun && !commitStarted && !fatal) {
                exit.attempt(() -> {
                    try { p.abortTransaction(); }
                    catch (RuntimeException | Error abortFailure) {
                        System.err.println("ABORT unconfirmed: transaction recovery required");
                        throw abortFailure;
                    }
                });
            }
            exit.attempt(() -> c.close(Duration.ofSeconds(3)));
            exit.attempt(() -> p.close(Duration.ofSeconds(3)));
        }
        exit.rethrow();
    }
    public static void main(String[] a) throws Exception {
        if (a.length == 0) throw new IllegalArgumentException(
                "send|duplicate bootstrap topic runId count OR route bootstrap input outputBase group txId");
        if ((a[0].equals("send") || a[0].equals("duplicate")) && a.length == 5) {
            int n = Integer.parseInt(a[4]);
            if (n < 1 || n > 500) throw new IllegalArgumentException("count 1..500");
            send(a[1], a[2], a[3], n, a[0].equals("duplicate"));
        } else if (a[0].equals("route") && a.length == 6) {
            route(a[1], a[2], a[3], a[4], a[5]);
        } else throw new IllegalArgumentException("invalid arguments");
    }
}

import java.io.InputStream;
import java.nio.file.*;
import java.time.Duration;
import java.util.*;
import org.apache.kafka.clients.consumer.*;
import org.apache.kafka.clients.producer.*;

/** One bounded Kafka-to-Kafka batch; no external business side effects. */
public final class KafkaTransactionalRelay {
    static Properties load(String path) throws Exception {
        Properties p = new Properties();
        try (InputStream in = Files.newInputStream(Path.of(path))) { p.load(in); }
        return p;
    }
    public static void main(String[] args) throws Exception {
        if (args.length != 5) throw new IllegalArgumentException(
                "client.properties inputTopic outputTopic groupId transactionalId");
        Properties base = load(args[0]); // Existing local client security configuration.
        Properties cp = new Properties(); cp.putAll(base);
        cp.put("group.id", args[3]);
        cp.put("group.protocol", "classic");
        cp.put("enable.auto.commit", "false");
        cp.put("auto.offset.reset", "earliest");
        cp.put("isolation.level", "read_committed");
        cp.put("max.poll.records", "100");
        cp.put("key.deserializer", "org.apache.kafka.common.serialization.StringDeserializer");
        cp.put("value.deserializer", "org.apache.kafka.common.serialization.StringDeserializer");
        Properties pp = new Properties(); pp.putAll(base);
        pp.put("transactional.id", args[4]); // Stable logical worker ID, exclusive while running.
        pp.put("enable.idempotence", "true"); pp.put("acks", "all");
        pp.put("max.in.flight.requests.per.connection", "5");
        pp.put("linger.ms", "5");
        pp.put("key.serializer", "org.apache.kafka.common.serialization.StringSerializer");
        pp.put("value.serializer", "org.apache.kafka.common.serialization.StringSerializer");
        try (KafkaConsumer<String,String> consumer = new KafkaConsumer<>(cp);
             KafkaProducer<String,String> producer = new KafkaProducer<>(pp)) {
            producer.initTransactions();
            consumer.subscribe(List.of(args[1]));
            ConsumerRecords<String,String> records = consumer.poll(Duration.ofSeconds(10));
            if (records.isEmpty()) { System.out.println("NO_RECORDS"); return; }
            producer.beginTransaction();
            for (ConsumerRecord<String,String> record : records) {
                // Pure transformation; null remains a tombstone.
                String value = record.value() == null ? null : "processed:" + record.value();
                producer.send(new ProducerRecord<>(args[2], record.key(), value));
            }
            producer.sendOffsetsToTransaction(records.nextOffsets(), consumer.groupMetadata());
            producer.commitTransaction();
            System.out.println("KAFKA_TRANSACTION_COMMITTED");
        }
        // Any failure propagates and stops this process. Do not advance or replay in this session.
        // Reuse the same transactional ID on controlled restart to resolve unfinished transactions.
    }
}

import com.rabbitmq.client.*;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

/** Single-flight publisher and one-at-a-time pull consumer for studying boundaries. */
public final class RabbitOnce {
    static Connection connect() throws Exception {
        ConnectionFactory f = new ConnectionFactory();
        f.setHost(required("RABBIT_HOST"));
        f.setPort(Integer.parseInt(System.getenv().getOrDefault("RABBIT_PORT", "5671")));
        f.setVirtualHost(required("RABBIT_VHOST"));
        f.setUsername(required("RABBIT_USER"));
        f.setPassword(required("RABBIT_PASSWORD"));
        // Use the JDK's configured trusted CAs; never the trust-all convenience overload.
        javax.net.ssl.SSLContext tls = javax.net.ssl.SSLContext.getInstance("TLS");
        tls.init(null, null, null);
        f.useSslProtocol(tls);
        f.enableHostnameVerification();
        f.setAutomaticRecoveryEnabled(false); // Explicit fail-stop example.
        f.setConnectionTimeout(10_000);
        f.setHandshakeTimeout(10_000);
        return f.newConnection("mq-study");
    }
    static String required(String key) {
        String value = System.getenv(key);
        if (value == null || value.isBlank()) throw new IllegalArgumentException(key + " required");
        return value;
    }
    static void send(Channel ch, String exchange, String key,
                     String eventId, long accountId, long amount) throws Exception {
        AtomicReference<Return> returned = new AtomicReference<>();
        ch.addReturnListener((ReturnCallback) returned::set);
        ch.confirmSelect();
        byte[] body = (accountId + "," + amount).getBytes(StandardCharsets.UTF_8);
        AMQP.BasicProperties props = new AMQP.BasicProperties.Builder()
                .messageId(eventId).type("debit-v1").contentType("text/plain")
                .contentEncoding("utf-8").deliveryMode(2).build();
        ch.basicPublish(exchange, key, true, props, body); // mandatory
        ch.waitForConfirmsOrDie(10_000);
        if (returned.get() != null) throw new IllegalStateException("unroutable message");
        System.out.println("BROKER_CONFIRMED_ROUTED"); // Not business completion.
    }
    static void receive(Channel ch, String queue) throws Exception {
        GetResponse response = ch.basicGet(queue, false);
        if (response == null) { System.out.println("NO_MESSAGE"); return; }
        String eventId = response.getProps().getMessageId();
        if (!"debit-v1".equals(response.getProps().getType()))
            throw new IllegalArgumentException("unexpected event type");
        String[] fields = new String(response.getBody(), StandardCharsets.UTF_8).split(",", -1);
        if (fields.length != 2) throw new IllegalArgumentException("invalid payload");
        JdbcInbox.Event event = new JdbcInbox.Event("debit-consumer", eventId,
                Long.parseLong(fields[0]), Long.parseLong(fields[1]));
        boolean applied = JdbcInbox.apply(event);
        ch.basicAck(response.getEnvelope().getDeliveryTag(), false);
        System.out.println(applied ? "APPLIED_THEN_ACK_SENT" : "DUPLICATE_THEN_ACK_SENT");
        // ACK has no symmetric business receipt. Lost ACK can cause redelivery.
    }
    public static void main(String[] args) throws Exception {
        if (args.length < 2) throw new IllegalArgumentException(
                "send exchange routingKey eventId accountId amount | receive queue");
        try (Connection connection = connect(); Channel channel = connection.createChannel()) {
            if (args[0].equals("send") && args.length == 6)
                send(channel, args[1], args[2], args[3], Long.parseLong(args[4]), Long.parseLong(args[5]));
            else if (args[0].equals("receive") && args.length == 2)
                receive(channel, args[1]);
            else throw new IllegalArgumentException("bad arguments");
        }
        // On failure the channel closes with the message unacked. No immediate requeue loop.
        // Topology, DLQ policy and operator handling of poison messages must exist beforehand.
    }
}

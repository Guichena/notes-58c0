import com.rabbitmq.client.Channel;
import java.io.IOException;
import java.util.*;

public final class RabbitTopology {
    public static final String EXCHANGE = "mq-interview.lab.exchange";
    public static final String WORK = "mq-interview.lab.work";
    public static final String DLQ = "mq-interview.lab.dlq";
    public static final int PREFETCH = 4;
    private RabbitTopology() {}
    public static void declare(Channel ch) throws IOException {
        ch.exchangeDeclare(EXCHANGE, "direct", true);
        Map<String,Object> base = Map.of("x-queue-type", "quorum", "x-max-length", 128,
                "x-max-length-bytes", 1048576, "x-overflow", "reject-publish");
        ch.queueDeclare(DLQ, true, false, false, base);
        ch.queueBind(DLQ, EXCHANGE, "dead");
        var work = new HashMap<>(base);
        work.put("x-delivery-limit", 5);
        work.put("x-dead-letter-exchange", EXCHANGE);
        work.put("x-dead-letter-routing-key", "dead");
        work.put("x-dead-letter-strategy", "at-least-once");
        ch.queueDeclare(WORK, true, false, false, work);
        ch.queueBind(WORK, EXCHANGE, "work");
    }
}

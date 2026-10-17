import com.rabbitmq.client.*;
import java.util.UUID;

public final class RealRabbitWire implements RabbitPublisherLab.Wire {
    private final Connection connection;
    private final Channel channel;
    public RealRabbitWire(LabRuntime runtime) throws Exception {
        this(runtime.connect());
    }
    RealRabbitWire(Connection connection) throws Exception {
        this.connection = connection;
        try { channel = connection.createChannel(); RabbitTopology.declare(channel); channel.confirmSelect(); }
        catch (Exception | Error e) {
            RabbitCleanup.preserveInterrupt(e);
            RabbitCleanup.after(e, () -> connection.abort(500));
            throw e;
        }
    }
    public void listen(UUID generation, RabbitPublisherLab.Listener l) {
        channel.addReturnListener(r -> l.returned(generation, r.getProperties().getCorrelationId()));
        channel.addConfirmListener((tag, multiple) -> l.confirm(generation, tag, multiple, true),
                (tag, multiple) -> l.confirm(generation, tag, multiple, false));
        channel.addShutdownListener(signal -> l.lost(generation));
    }
    public long nextSequence() { return channel.getNextPublishSeqNo(); }
    public void send(String route, String event, String attempt, byte[] body) throws Exception {
        var props = new AMQP.BasicProperties.Builder().messageId(event).correlationId(attempt)
                .deliveryMode(2).contentType("application/octet-stream").build();
        channel.basicPublish(RabbitTopology.EXCHANGE, route, true, props, body);
    }
    public void abort() { connection.abort(500); }
}

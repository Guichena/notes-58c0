import java.nio.ByteBuffer;
import java.nio.channels.Pipe;
import java.nio.channels.SelectionKey;
import java.nio.channels.Selector;
import java.nio.charset.StandardCharsets;

public final class NioComponents {
    private static int checks;
    private static void check(boolean condition) {
        if(!condition)throw new AssertionError("check "+checks);checks++;
    }
    public static void main(String[] args) throws Exception {
        ByteBuffer b=ByteBuffer.allocate(8);
        check(b.position()==0 && b.limit()==8 && b.capacity()==8);
        b.put(new byte[]{10,20,30});check(b.position()==3);
        b.flip();check(b.position()==0 && b.limit()==3);
        check(b.get()==10);
        b.compact();check(b.position()==2 && b.limit()==8);
        b.put((byte)40).flip();check(b.get()==20 && b.get()==30 && b.get()==40);
        b.clear();check(b.position()==0 && b.limit()==8);
        check(b.get(0)==20); // clear does not erase bytes.
        Pipe pipe=Pipe.open();
        try(var source=pipe.source();var sink=pipe.sink();var selector=Selector.open()) {
            source.configureBlocking(false);
            var key=source.register(selector,SelectionKey.OP_READ);
            check(source.read(ByteBuffer.allocate(1))==0); // Not EOF.
            ByteBuffer outgoing=StandardCharsets.UTF_8.encode("OK");
            while(outgoing.hasRemaining())sink.write(outgoing);
            long deadline=System.nanoTime()+2_000_000_000L;
            while(selector.select(100)==0 && System.nanoTime()<deadline) { }
            check(selector.selectedKeys().contains(key) && key.isReadable());
            selector.selectedKeys().remove(key);
            ByteBuffer incoming=ByteBuffer.allocate(2);
            while(incoming.hasRemaining() && System.nanoTime()<deadline)source.read(incoming);
            incoming.flip();check(StandardCharsets.UTF_8.decode(incoming).toString().equals("OK"));
            sink.close();deadline=System.nanoTime()+2_000_000_000L;int n=0;
            while(n==0 && System.nanoTime()<deadline)n=source.read(ByteBuffer.allocate(1));
            check(n==-1);
        }
        System.out.println("NioComponents: "+checks+" checks passed; Buffer states and real local Pipe/Selector readiness, not network-server integration.");
    }
}


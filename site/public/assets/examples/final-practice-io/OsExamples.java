import java.io.*;
import java.nio.*;
import java.nio.channels.*;
import java.nio.file.*;
import java.time.Duration;
import java.util.*;
public final class OsExamples {
  // Java does not expose the raw representation of an int; use the platform API.
  public static ByteOrder hostOrder() { return ByteOrder.nativeOrder(); }
  public static byte[] encode(int n, ByteOrder order) {
    return ByteBuffer.allocate(4).order(Objects.requireNonNull(order)).putInt(n).array();
  }
  // Follows this opened file, not subsequent replacements at the same pathname.
  public static final class Tail implements AutoCloseable {
    private final FileChannel file;
    private final ByteBuffer buffer = ByteBuffer.allocate(8192);
    private long offset;
    public Tail(Path path, boolean fromEnd) throws IOException {
      file = FileChannel.open(path, StandardOpenOption.READ);
      try { offset = fromEnd ? file.size() : 0; }
      catch (IOException | RuntimeException e) { file.close(); throw e; }
    }
    // Single owner. At most the bytes visible in this size snapshot per call.
    public long poll(OutputStream sink) throws IOException {
      Objects.requireNonNull(sink);
      long end = file.size(), count = 0;
      if (end < offset) offset = 0;
      while (offset < end) {
        buffer.clear().limit((int)Math.min(buffer.capacity(), end-offset));
        int n = file.read(buffer, offset);
        if (n <= 0) break;
        sink.write(buffer.array(), 0, n); // failure is surfaced; no exact-once sink promise
        offset += n;
        count += n;
      }
      return count;
    }
    public void follow(OutputStream sink, Duration interval) throws IOException, InterruptedException {
      Objects.requireNonNull(interval);
      if (interval.isZero() || interval.isNegative()) throw new IllegalArgumentException("interval");
      while (!Thread.currentThread().isInterrupted()) {
        poll(sink); sink.flush(); Thread.sleep(interval);
      }
    }
    public void close() throws IOException { file.close(); }
  }
  static void check(boolean p) { if (!p) throw new AssertionError(); }
  public static void main(String[] args) throws Exception {
    check(Arrays.equals(encode(0x01020304, ByteOrder.BIG_ENDIAN), new byte[]{1,2,3,4}));
    check(Arrays.equals(encode(0x01020304, ByteOrder.LITTLE_ENDIAN), new byte[]{4,3,2,1}));
    check(hostOrder()==ByteOrder.BIG_ENDIAN || hostOrder()==ByteOrder.LITTLE_ENDIAN);
    Path dir=Files.createTempDirectory("os-examples-"); Path p=dir.resolve("log");
    try {
      Files.write(p,new byte[]{9,8,7});
      try(Tail tail=new Tail(p,true)) {
        ByteArrayOutputStream out=new ByteArrayOutputStream();
        check(tail.poll(out)==0);
        byte[] first={(byte)0xe4,(byte)0xb8};
        Files.write(p, first, StandardOpenOption.APPEND); check(tail.poll(out)==2);
        Files.write(p,new byte[]{(byte)0xad,10},StandardOpenOption.APPEND); check(tail.poll(out)==2);
        check(Arrays.equals(out.toByteArray(),new byte[]{(byte)0xe4,(byte)0xb8,(byte)0xad,10}));
        check(tail.poll(out)==0);
        Files.write(p,new byte[]{1}); check(tail.poll(out)==1); // observed shrink
        byte[] big=new byte[20000]; Arrays.fill(big,(byte)42);
        Files.write(p,big,StandardOpenOption.APPEND); check(tail.poll(out)==big.length);
        check(out.size()==20005);
      }
      try(Tail tail=new Tail(p,false)) { check(tail.poll(OutputStream.nullOutputStream())==20001); }
      System.out.println("PASS endian explicit encodings + native order; tail initial EOF, append, UTF8 byte split, idle, observed truncation, multi-buffer, from-start");
    } finally { Files.deleteIfExists(p); Files.deleteIfExists(dir); }
  }
}

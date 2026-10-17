import java.io.*;
import java.nio.*;
import java.nio.channels.*;
import java.nio.charset.*;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.*;
import java.util.zip.CRC32C;

/** Bounded local journal, not a broker. Cooperating single-classloader owners only.
 * Requires local Linux-like filesystem with stable fileKey, advisory locks and directory force.
 * While owned, nobody may replace paths, hard-link segment files or open/close the lock file.
 * No replication, consumer offsets, expiry or automatic repair of complete corrupt frames.
 */
public final class SegmentJournal implements AutoCloseable {
    public static final int MAX_BODY = 1_048_576, MAX_RECORDS = 10_000;
    public static final long MAX_LOG_BYTES = 16L * 1024 * 1024;
    private static final int MAGIC = 0x4A4E4C31, HEADER = 20;
    private record Identity(FileSystem fs, Object key) { }
    private record Owner(Path dir, Identity directory, Identity lockIdentity,
                         FileChannel channel, FileLock lock) { }
    private static final Map<Identity, Owner> OWNERS = new HashMap<>();
    public record Record(long sequence, String id, byte[] payload) {
        public Record { payload = payload.clone(); }
        @Override public byte[] payload() { return payload.clone(); }
    }
    @FunctionalInterface interface Fault { void afterWrite() throws IOException; }
    private final Owner owner;
    private final int segmentBytes;
    private final Fault fault;
    private final LinkedHashMap<String, Record> index = new LinkedHashMap<>();
    private FileChannel active;
    private long bytes;
    private boolean poisoned, closed;

    private static Identity identity(Path p, boolean directory) throws IOException {
        BasicFileAttributes a = Files.readAttributes(p, BasicFileAttributes.class, LinkOption.NOFOLLOW_LINKS);
        if (a.fileKey() == null || (directory ? !a.isDirectory() : !a.isRegularFile()))
            throw new IOException("stable file identity required: " + p);
        return new Identity(p.getFileSystem(), a.fileKey());
    }
    private static void syncDirectory(Path p) throws IOException {
        try (FileChannel c = FileChannel.open(p, StandardOpenOption.READ)) { c.force(true); }
    }
    private static synchronized Owner acquire(Path input) throws IOException {
        // Caller creates its dedicated directory. Resolving symlinks prevents in-JVM directory aliases.
        Path dir = input.toRealPath();
        Identity d = identity(dir, true);
        Path lp = dir.resolve("journal.lock");
        Identity before = Files.exists(lp, LinkOption.NOFOLLOW_LINKS) ? identity(lp, false) : null;
        if (OWNERS.containsKey(d) || (before != null && OWNERS.containsKey(before)))
            throw new IOException("journal already owned in JVM");
        FileChannel c = null;
        FileLock l = null;
        try {
            c = FileChannel.open(lp, StandardOpenOption.CREATE, StandardOpenOption.READ,
                    StandardOpenOption.WRITE, LinkOption.NOFOLLOW_LINKS);
            Identity actual = identity(lp, false);
            if ((before != null && !before.equals(actual)) || OWNERS.containsKey(actual))
                throw new IOException("lock identity changed");
            l = c.tryLock();
            if (l == null) throw new IOException("journal owned by another process");
            syncDirectory(dir);
            Owner o = new Owner(dir, d, actual, c, l);
            OWNERS.put(d, o); OWNERS.put(actual, o);
            return o;
        } catch (IOException | RuntimeException | Error e) {
            // Closing a newly opened alias can release POSIX locks. Alias detection must precede open.
            if (c != null) try { c.close(); } catch (IOException cleanup) { if(e != cleanup)e.addSuppressed(cleanup); }
            throw e;
        }
    }
    private static synchronized void forget(Owner o) {
        OWNERS.remove(o.directory(), o); OWNERS.remove(o.lockIdentity(), o);
    }
    public SegmentJournal(Path dir) throws IOException { this(dir, 2 * 1024 * 1024, () -> { }); }
    public SegmentJournal(Path dir, int segmentBytes) throws IOException { this(dir, segmentBytes, () -> { }); }
    SegmentJournal(Path dir, int segmentBytes, Fault fault) throws IOException {
        if (segmentBytes < 64 || segmentBytes > 2 * 1024 * 1024) throw new IllegalArgumentException("segment size");
        this.segmentBytes = segmentBytes; this.fault = Objects.requireNonNull(fault);
        owner = acquire(dir);
        try { recover(); }
        catch (IOException | RuntimeException | Error e) {
            try { close(); } catch (IOException cleanup) { if(e != cleanup)e.addSuppressed(cleanup); }
            throw e;
        }
    }
    private static int crc(byte[] raw) { CRC32C c = new CRC32C(); c.update(raw); return (int)c.getValue(); }
    static byte[] utf8(String s) throws CharacterCodingException {
        ByteBuffer b = StandardCharsets.UTF_8.newEncoder().onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT).encode(java.nio.CharBuffer.wrap(s));
        byte[] a = new byte[b.remaining()]; b.get(a); return a;
    }
    private static String decode(byte[] b) throws CharacterCodingException {
        return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(b)).toString();
    }
    private static void readFully(FileChannel c, ByteBuffer b) throws IOException {
        while (b.hasRemaining()) { int n = c.read(b); if (n < 0) throw new EOFException(); if (n == 0) throw new IOException("no read progress"); }
    }
    private static void writeFully(FileChannel c, ByteBuffer b) throws IOException {
        while (b.hasRemaining()) if (c.write(b) <= 0) throw new IOException("no write progress");
    }
    private Path segment(long base) { return owner.dir().resolve(String.format(Locale.ROOT, "%020d.seg", base)); }
    private void createSegment() throws IOException {
        active = FileChannel.open(segment(index.size()), StandardOpenOption.CREATE_NEW,
                StandardOpenOption.READ, StandardOpenOption.WRITE, LinkOption.NOFOLLOW_LINKS);
        active.force(true); syncDirectory(owner.dir());
    }
    private void recover() throws IOException {
        List<Path> paths = new ArrayList<>();
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(owner.dir(), "*.seg")) {
            for (Path p : stream) {
                if (paths.size() >= MAX_RECORDS + 1) throw new IOException("too many segments");
                paths.add(p);
            }
        }
        paths.sort(Comparator.naturalOrder());
        long rawSize = 0;
        for (Path p : paths) {
            String n = p.getFileName().toString();
            if (!n.matches("[0-9]{20}\\.seg")) throw new IOException("bad segment name");
            identity(p, false);
            long size = Files.size(p);
            if (size > segmentBytes) throw new IOException("segment exceeds configured limit");
            rawSize = Math.addExact(rawSize, size);
            if (rawSize > MAX_LOG_BYTES) throw new IOException("journal exceeds byte budget");
        }
        for (int i = 0; i < paths.size(); i++) {
            Path p = paths.get(i);
            long base;
            try { base = Long.parseLong(p.getFileName().toString().substring(0, 20)); }
            catch (NumberFormatException e) { throw new IOException("bad segment base", e); }
            if (base != index.size()) throw new IOException("segment sequence gap");
            boolean last = i == paths.size() - 1;
            try (FileChannel c = FileChannel.open(p, StandardOpenOption.READ, StandardOpenOption.WRITE,
                    LinkOption.NOFOLLOW_LINKS)) {
                long at = 0, size = c.size();
                while (at < size) {
                    if (size - at < HEADER) {
                        // A recognizable older frame must never be mistaken for a v2 torn tail.
                        if (size - at >= 6) {
                            c.position(at); ByteBuffer prefix = ByteBuffer.allocate(6); readFully(c, prefix); prefix.flip();
                            if (prefix.getInt() == MAGIC && prefix.getShort() != 2)
                                throw new IOException("unsupported journal format; explicit migration required");
                        }
                        truncateTail(c, at, last); break;
                    }
                    c.position(at); ByteBuffer h = ByteBuffer.allocate(HEADER).order(ByteOrder.BIG_ENDIAN);
                    readFully(c, h); h.flip();
                    int magic = h.getInt(); short version = h.getShort(), flags = h.getShort();
                    int length = h.getInt(), expected = h.getInt(), headerCrc = h.getInt();
                    // Version 2 checks framing metadata for accidental corruption before trusting length.
                    if (magic != MAGIC || version != 2 || flags != 0 ||
                            crc(Arrays.copyOf(h.array(), HEADER - 4)) != headerCrc ||
                            length < 17 || length > MAX_BODY)
                        throw new IOException("invalid complete frame header");
                    if (size - at - HEADER < length) { truncateTail(c, at, last); break; }
                    byte[] raw = new byte[length]; readFully(c, ByteBuffer.wrap(raw));
                    if (crc(raw) != expected) throw new IOException("CRC mismatch; preserved for diagnosis");
                    ByteBuffer b = ByteBuffer.wrap(raw).order(ByteOrder.BIG_ENDIAN);
                    long seq = b.getLong(); int kl = b.getInt();
                    if (kl < 1 || kl > 1024 || kl > b.remaining() - 4) throw new IOException("bad ID length");
                    byte[] key = new byte[kl]; b.get(key); String id = decode(key);
                    int pl = b.getInt();
                    if (id.isBlank() || pl < 0 || pl != b.remaining() || seq != index.size()
                            || index.containsKey(id) || index.size() >= MAX_RECORDS) throw new IOException("invalid record");
                    byte[] value = new byte[pl]; b.get(value);
                    index.put(id, new Record(seq, id, value)); at += HEADER + (long)length;
                }
                if (!last && c.size() == 0) throw new IOException("empty sealed segment");
                bytes += c.size();
            }
        }
        if (paths.isEmpty()) createSegment();
        else {
            active = FileChannel.open(paths.getLast(), StandardOpenOption.READ, StandardOpenOption.WRITE,
                    LinkOption.NOFOLLOW_LINKS);
            active.position(active.size());
        }
    }
    private static void truncateTail(FileChannel c, long at, boolean last) throws IOException {
        if (!last) throw new IOException("incomplete sealed segment");
        c.truncate(at); c.force(true);
    }
    private void usable() throws IOException {
        if (closed || poisoned) throw new IOException("journal closed or poisoned; reopen and recover");
    }
    public synchronized long append(String id, byte[] input) throws IOException {
        usable();
        if (id == null || id.length() > 1024 || id.isBlank() || input == null) throw new IllegalArgumentException("id/payload");
        byte[] key;
        try { key = utf8(id); } catch (CharacterCodingException e) { throw new IllegalArgumentException("malformed UTF-16 ID", e); }
        long length = 16L + key.length + input.length;
        if (key.length > 1024 || length > MAX_BODY || length + HEADER > segmentBytes)
            throw new IllegalArgumentException("frame too large");
        Record old = index.get(id);
        if (old != null) {
            if (!Arrays.equals(old.payload, input)) throw new IllegalArgumentException("same ID, different payload");
            return old.sequence();
        }
        if (index.size() >= MAX_RECORDS || bytes + HEADER + length > MAX_LOG_BYTES)
            throw new IOException("bounded journal full");
        byte[] value = input.clone(); long seq = index.size();
        ByteBuffer body = ByteBuffer.allocate((int)length).order(ByteOrder.BIG_ENDIAN);
        body.putLong(seq).putInt(key.length).put(key).putInt(value.length).put(value);
        ByteBuffer frame = ByteBuffer.allocate(HEADER + (int)length).order(ByteOrder.BIG_ENDIAN);
        frame.putInt(MAGIC).putShort((short)2).putShort((short)0).putInt((int)length)
                .putInt(crc(body.array()));
        frame.putInt(crc(Arrays.copyOf(frame.array(), HEADER - 4))).put(body.array()).flip();
        try {
            if (active.size() + frame.remaining() > segmentBytes) {
                active.force(true); active.close(); active = null; createSegment();
            }
            writeFully(active, frame); fault.afterWrite(); active.force(true);
            // The index and caller's ACK follow force, never precede it.
            index.put(id, new Record(seq, id, value)); bytes += HEADER + length; return seq;
        } catch (IOException | RuntimeException | Error e) { poisoned = true; throw e; }
    }
    public synchronized byte[] get(String id) throws IOException { usable(); Record r = index.get(id); return r == null ? null : r.payload(); }
    public synchronized int size() throws IOException { usable(); return index.size(); }
    public synchronized List<Record> records() throws IOException {
        usable(); return index.values().stream().map(r -> new Record(r.sequence(), r.id(), r.payload)).toList();
    }
    @Override public synchronized void close() throws IOException {
        if (closed) return;
        closed = true; IOException failure = null;
        if (active != null) {
            try { if (!poisoned) active.force(true); } catch (IOException e) { failure = e; }
            try { active.close(); } catch (IOException e) { if (failure == null) failure = e; else if(failure != e)failure.addSuppressed(e); }
        }
        try { owner.channel().close(); } catch (IOException e) { if (failure == null) failure = e; else if(failure != e)failure.addSuppressed(e); }
        // A cleanup failure keeps the JVM reservation: fail closed rather than create two owners.
        if (failure == null) forget(owner); else throw failure;
    }
}

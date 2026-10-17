import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.Random;
import java.util.zip.CRC32C;

/** Teaching byte-array framing only. Not a MySQL or LevelDB file format.
 * Header: big-endian length(4), CRC32C(4), type(1), followed by payload.
 * CRC covers length, type and payload. No file header, transactions or fsync.
 * Input/output arrays are bounded but this is not a streaming implementation.
 */
public final class FragmentedWal {
    private static final int FULL = 1, FIRST = 2, MIDDLE = 3, LAST = 4;
    private static final int HEADER = 9, HARD_BYTES = 8 * 1024 * 1024;
    private static final int HARD_RECORDS = 4096;

    public record Limits(int maxPayload, int maxRecord, int maxLog,
                         int maxRecords) {
        public Limits {
            if (maxPayload < 1 || maxPayload > HARD_BYTES || maxRecord < 0
                    || maxRecord > HARD_BYTES || maxLog < 0
                    || maxLog > HARD_BYTES || maxRecords < 0
                    || maxRecords > HARD_RECORDS) {
                throw new IllegalArgumentException("invalid teaching limits");
            }
        }
    }
    public record Scan(List<byte[]> records, boolean incompleteTail,
                       int validBytes) {}

    private static int checksum(int length, int type, byte[] data, int offset) {
        CRC32C crc = new CRC32C();
        for (int shift = 24; shift >= 0; shift -= 8) {
            crc.update((length >>> shift) & 255);
        }
        crc.update(type);
        crc.update(data, offset, length);
        return (int) crc.getValue();
    }
    public static byte[] encode(List<byte[]> records, int maxPayload,
                                int maxRecord) {
        return encode(records, new Limits(maxPayload, maxRecord,
                                           HARD_BYTES, HARD_RECORDS));
    }
    public static byte[] encode(List<byte[]> records, Limits limits) {
        Objects.requireNonNull(records);
        Objects.requireNonNull(limits);
        if (records.size() > limits.maxRecords()) {
            throw new IllegalArgumentException("record count limit");
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (byte[] value : records) {
            Objects.requireNonNull(value);
            if (value.length > limits.maxRecord()) {
                throw new IllegalArgumentException("record length limit");
            }
            int offset = 0;
            do {
                int length = Math.min(limits.maxPayload(), value.length - offset);
                boolean first = offset == 0, last = offset + length == value.length;
                int type = first ? (last ? FULL : FIRST) : (last ? LAST : MIDDLE);
                if ((long) out.size() + HEADER + length > limits.maxLog()) {
                    throw new IllegalArgumentException("log length limit");
                }
                byte[] head = ByteBuffer.allocate(HEADER).order(ByteOrder.BIG_ENDIAN)
                        .putInt(length).putInt(checksum(length, type, value, offset))
                        .put((byte) type).array();
                out.writeBytes(head);
                out.write(value, offset, length);
                offset += length;
            } while (offset < value.length);
        }
        return out.toByteArray();
    }
    public static Scan scan(byte[] bytes, int maxPayload, int maxRecord)
            throws IOException {
        return scan(bytes, new Limits(maxPayload, maxRecord,
                                      HARD_BYTES, HARD_RECORDS));
    }
    public static Scan scan(byte[] bytes, Limits limits) throws IOException {
        Objects.requireNonNull(bytes);
        Objects.requireNonNull(limits);
        if (bytes.length > limits.maxLog()) throw new IOException("log length limit");
        ByteBuffer in = ByteBuffer.wrap(bytes).order(ByteOrder.BIG_ENDIAN);
        List<byte[]> records = new ArrayList<>();
        ByteArrayOutputStream active = null;
        int valid = 0;
        while (in.hasRemaining()) {
            if (in.remaining() < HEADER) return new Scan(List.copyOf(records), true, valid);
            int length = in.getInt(), expected = in.getInt(), type = in.get() & 255;
            if (length < 0 || length > limits.maxPayload() || type < FULL || type > LAST) {
                throw new IOException("invalid frame header");
            }
            if (in.remaining() < length) return new Scan(List.copyOf(records), true, valid);
            if (expected != checksum(length, type, bytes, in.position())) {
                throw new IOException("checksum mismatch");
            }
            if ((type == FULL || type == FIRST) && active != null) {
                throw new IOException("nested record");
            }
            if ((type == MIDDLE || type == LAST) && active == null) {
                throw new IOException("orphan fragment");
            }
            if (type != FULL && length == 0) throw new IOException("empty split fragment");
            if (type == FULL || type == FIRST) {
                if (records.size() >= limits.maxRecords()) throw new IOException("record count limit");
                active = new ByteArrayOutputStream();
            }
            if (length > limits.maxRecord() - active.size()) throw new IOException("record length limit");
            active.write(bytes, in.position(), length);
            in.position(in.position() + length);
            if (type == FULL || type == LAST) {
                records.add(active.toByteArray());
                active = null;
                valid = in.position();
            }
        }
        return new Scan(List.copyOf(records), active != null, valid);
    }

    // The following helpers are the complete deterministic test harness.
    private static int checks;
    private static void check(boolean ok, String label) {
        if (!ok) throw new AssertionError(label);
        checks++;
    }
    @FunctionalInterface private interface Checked { void run() throws Exception; }
    private static void rejects(Class<? extends Exception> type, Checked test)
            throws Exception {
        try { test.run(); }
        catch (Exception e) {
            if (!type.isInstance(e)) throw e;
            checks++;
            return;
        }
        throw new AssertionError("expected " + type.getSimpleName());
    }
    private static boolean same(List<byte[]> left, List<byte[]> right) {
        if (left.size() != right.size()) return false;
        for (int i = 0; i < left.size(); i++) {
            if (!Arrays.equals(left.get(i), right.get(i))) return false;
        }
        return true;
    }
    private static byte[] join(byte[]... parts) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (byte[] part : parts) out.writeBytes(part);
        return out.toByteArray();
    }
    // Build deliberately malformed chains with otherwise valid checksums.
    private static byte[] frame(int type, byte[] payload) {
        return ByteBuffer.allocate(HEADER + payload.length).order(ByteOrder.BIG_ENDIAN)
                .putInt(payload.length).putInt(checksum(payload.length, type, payload, 0))
                .put((byte) type).put(payload).array();
    }
    public static void main(String[] args) throws Exception {
        if (args.length != 0) throw new IllegalArgumentException("no external input");
        Random random = new Random(20261010L);
        for (int trial = 0; trial < 400; trial++) {
            List<byte[]> values = new ArrayList<>();
            for (int i = 0, n = random.nextInt(9); i < n; i++) {
                byte[] value = new byte[random.nextInt(513)];
                random.nextBytes(value);
                values.add(value);
            }
            for (int payload : new int[]{1, 7, 64, 256}) {
                byte[] encoded = encode(values, payload, 512);
                Scan read = scan(encoded, payload, 512);
                check(same(values, read.records()), "round trip");
                check(!read.incompleteTail() && read.validBytes() == encoded.length, "complete");
                check(same(read.records(), scan(encoded, payload, 512).records()), "repeat scan");
            }
        }
        // Exercise every possible byte truncation, including exact record boundaries.
        for (int payload : new int[]{1, 4, 16}) {
            List<byte[]> values = List.of(new byte[0], new byte[]{42},
                                         new byte[payload], new byte[payload * 2 + 1]);
            byte[] log = encode(values, payload, 64);
            int[] ends = new int[values.size()];
            for (int i = 0, end = 0; i < ends.length; i++) {
                end += encode(List.of(values.get(i)), payload, 64).length;
                ends[i] = end;
            }
            for (int cut = 0; cut <= log.length; cut++) {
                int count = 0, valid = 0;
                while (count < ends.length && ends[count] <= cut) valid = ends[count++];
                Scan read = scan(Arrays.copyOf(log, cut), payload, 64);
                check(same(values.subList(0, count), read.records()), "truncation prefix");
                check(read.validBytes() == valid, "valid bytes");
                check(read.incompleteTail() == (cut != valid), "tail flag");
                Scan repaired = scan(Arrays.copyOf(log, read.validBytes()), payload, 64);
                check(!repaired.incompleteTail() && same(read.records(), repaired.records()), "rescan prefix");
            }
        }
        byte[] one = {9};
        byte[] corrupt = frame(FULL, one); corrupt[HEADER] ^= 1;
        rejects(IOException.class, () -> scan(corrupt, 8, 32));
        byte[] badLength = frame(FULL, one); ByteBuffer.wrap(badLength).putInt(-1);
        rejects(IOException.class, () -> scan(badLength, 8, 32));
        rejects(IOException.class, () -> scan(frame(5, one), 8, 32));
        rejects(IOException.class, () -> scan(frame(MIDDLE, one), 8, 32));
        rejects(IOException.class, () -> scan(frame(LAST, one), 8, 32));
        rejects(IOException.class, () -> scan(frame(FIRST, new byte[0]), 8, 32));
        rejects(IOException.class, () -> scan(join(frame(FIRST, one), frame(FULL, one)), 8, 32));
        rejects(IOException.class, () -> scan(join(frame(FIRST, one), frame(FIRST, one)), 8, 32));
        rejects(IOException.class, () -> scan(frame(FULL, new byte[9]), 8, 32));
        rejects(IOException.class, () -> scan(join(frame(FIRST, one), frame(LAST, one)), 8, 1));
        check(scan(frame(FIRST, one), 8, 32).incompleteTail(), "unclosed chain");
        check(scan(new byte[0], 8, 32).validBytes() == 0, "empty log");
        check(scan(frame(FULL, new byte[0]), 8, 0).records().size() == 1, "empty value");
        Limits tiny = new Limits(8, 8, 10, 1);
        rejects(IOException.class, () -> scan(new byte[11], tiny));
        rejects(IllegalArgumentException.class, () -> encode(List.of(new byte[2]), tiny));
        rejects(IllegalArgumentException.class, () -> encode(List.of(new byte[9]), tiny));
        rejects(IllegalArgumentException.class, () -> encode(List.of(one, one), tiny));
        rejects(IOException.class, () -> scan(join(frame(FULL, one), frame(FULL, one)),
                                               new Limits(8, 8, 32, 1)));
        rejects(IllegalArgumentException.class, () -> new Limits(0, 8, 32, 1));
        rejects(IllegalArgumentException.class, () -> new Limits(8, -1, 32, 1));
        rejects(IllegalArgumentException.class, () -> new Limits(8, 8, HARD_BYTES + 1, 1));
        System.out.println("PASS: " + checks + " bounded framing checks; no database or disk crash tested.");
    }
}

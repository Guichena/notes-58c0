import java.nio.ByteBuffer;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicLongArray;

/** Append-only teaching filter; completed adds are visible to later queries. */
public final class AtomicBloom {
    private static final int MAX_BITS = 1 << 30;
    private final int bitSize;
    private final int hashes;
    private final AtomicLongArray words;

    public AtomicBloom(long expectedItems, double targetFpp) {
        if (expectedItems <= 0 || !Double.isFinite(targetFpp)
                || targetFpp <= 0.0 || targetFpp >= 1.0) {
            throw new IllegalArgumentException("n > 0 and 0 < p < 1 required");
        }
        double ln2 = Math.log(2.0);
        double required = Math.ceil(-expectedItems * Math.log(targetFpp) / (ln2 * ln2));
        if (!Double.isFinite(required) || required > MAX_BITS) {
            throw new IllegalArgumentException("teaching implementation exceeds memory budget");
        }
        long rounded = Math.max(64L, (((long) required + 63L) / 64L) * 64L);
        long k = Math.max(1L, Math.round((double) rounded / expectedItems * ln2));
        if (k > 64L) {
            throw new IllegalArgumentException("teaching implementation allows at most 64 hashes");
        }
        bitSize = (int) rounded;
        hashes = (int) k;
        words = new AtomicLongArray(bitSize / 64);
    }

    public int bitSize() { return bitSize; }
    public int hashCount() { return hashes; }

    public void add(byte[] value) {
        Objects.requireNonNull(value, "value");
        MessageDigest digest = sha256();
        for (int i = 0; i < hashes; i++) {
            int bit = position(digest, i, value);
            int word = bit >>> 6;
            long mask = 1L << (bit & 63);
            long old;
            do {
                old = words.get(word);
                if ((old & mask) != 0) { break; }
            } while (!words.compareAndSet(word, old, old | mask));
        }
    }

    public boolean mightContain(byte[] value) {
        Objects.requireNonNull(value, "value");
        MessageDigest digest = sha256();
        for (int i = 0; i < hashes; i++) {
            int bit = position(digest, i, value);
            if ((words.get(bit >>> 6) & (1L << (bit & 63))) == 0) { return false; }
        }
        return true;
    }

    private int position(MessageDigest digest, int i, byte[] value) {
        digest.update((byte) (i >>> 24));
        digest.update((byte) (i >>> 16));
        digest.update((byte) (i >>> 8));
        digest.update((byte) i);
        byte[] hash = digest.digest(value); // digest() resets this local digest
        long first64 = ByteBuffer.wrap(hash).getLong();
        return (int) Math.floorMod(first64, (long) bitSize);
    }

    private static MessageDigest sha256() {
        try { return MessageDigest.getInstance("SHA-256"); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}

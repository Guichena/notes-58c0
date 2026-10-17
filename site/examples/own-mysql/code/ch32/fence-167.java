import java.util.HashSet;
import java.util.Set;

/** Java 8+. Pure routing model; no database or production ID service. */
public final class RoutingDemo {
    static final int DATABASES = 8;
    static final int TABLES_PER_DATABASE = 128;
    static final int SLOTS = DATABASES * TABLES_PER_DATABASE;
    static final int SLOT_BITS = 10;
    static final long SLOT_MASK = SLOTS - 1L;

    static int slotFromHash(int stableHash) {
        // Fix a shared hash algorithm/encoding before using multiple languages.
        return Math.floorMod(stableHash, SLOTS);
    }
    static int database(int slot) { checkSlot(slot); return slot / TABLES_PER_DATABASE; }
    static int table(int slot) { checkSlot(slot); return slot % TABLES_PER_DATABASE; }
    static void checkSlot(int slot) {
        if (slot < 0 || slot >= SLOTS) throw new IllegalArgumentException("invalid slot");
    }
    static long orderId(long uniqueSequence, int slot) {
        checkSlot(slot);
        // Production must supply a unique sequence and define exhaustion policy.
        if (uniqueSequence < 0 || uniqueSequence > (Long.MAX_VALUE >>> SLOT_BITS)) {
            throw new IllegalArgumentException("sequence would overflow positive long");
        }
        return (uniqueSequence << SLOT_BITS) | slot;
    }
    static int slotFromOrderId(long orderId) {
        if (orderId < 0) throw new IllegalArgumentException("negative order id");
        return (int) (orderId & SLOT_MASK);
    }
    static void check(boolean ok, String what) {
        if (!ok) throw new AssertionError(what);
    }
    public static void main(String[] args) {
        Set<String> oldPairs = new HashSet<String>();
        Set<String> newPairs = new HashSet<String>();
        Set<Long> ids = new HashSet<Long>();
        for (int hash = 0; hash < SLOTS; hash++) {
            oldPairs.add(Math.floorMod(hash, 8) + ":" + Math.floorMod(hash, 128));
            int slot = slotFromHash(hash);
            newPairs.add(database(slot) + ":" + table(slot));
            for (long sequence : new long[] {0, 1, Long.MAX_VALUE >>> SLOT_BITS}) {
                long id = orderId(sequence, slot);
                check(slotFromOrderId(id) == slot, "gene decoding");
                check(ids.add(id), "unique sequence/slot pair must be unique");
            }
        }
        check(oldPairs.size() == 128, "old overlapping modulo bug");
        check(newPairs.size() == 1024, "all database/table pairs covered");
        for (int hash : new int[] {Integer.MIN_VALUE, -1025, -1024, -1, 0, Integer.MAX_VALUE}) {
            int slot = slotFromHash(hash);
            check(slot >= 0 && slot < SLOTS, "negative hash range");
            check(database(slot) * TABLES_PER_DATABASE + table(slot) == slot, "inverse mapping");
        }
        long example = orderId(1L << 22, 37);
        check(slotFromHash(Long.hashCode(example)) != 37, "rehashing can destroy gene");
        try {
            orderId((Long.MAX_VALUE >>> SLOT_BITS) + 1, 0);
            throw new AssertionError("overflow was not rejected");
        } catch (IllegalArgumentException expected) { }
        try {
            orderId(1, 1024);
            throw new AssertionError("invalid slot was not rejected");
        } catch (IllegalArgumentException expected) { }
        System.out.println("PASS old pairs=128, new pairs=1024, unique ID pairs=" + ids.size());
        System.out.println("PASS negative hashes, exact gene decode, overflow and slot bounds");
        System.out.println("PASS rehash counterexample: decoded slot=37, rehashed slot="
                + slotFromHash(Long.hashCode(example)));
    }
}

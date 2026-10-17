import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.locks.ReentrantReadWriteLock;

/** Immutable String values do not expose mutable internals after unlocking. */
public final class ReadMostlyCache {
    private final ReentrantReadWriteLock rw = new ReentrantReadWriteLock(true);
    private final Map<String, String> data = new HashMap<>();
    public String get(String key) throws InterruptedException {
        rw.readLock().lockInterruptibly();
        try { return data.get(key); }
        finally { rw.readLock().unlock(); }
    }
    public void put(String key, String value) throws InterruptedException {
        Objects.requireNonNull(key); Objects.requireNonNull(value);
        rw.writeLock().lockInterruptibly();
        try { data.put(key, value); }
        finally { rw.writeLock().unlock(); }
    }
    public String putIfAbsent(String key, String candidate) throws InterruptedException {
        Objects.requireNonNull(key); Objects.requireNonNull(candidate);
        rw.readLock().lockInterruptibly();
        try {
            String existing = data.get(key);
            if (existing != null) return existing;
        } finally { rw.readLock().unlock(); } // Release read lock BEFORE requesting write.
        rw.writeLock().lockInterruptibly();
        try {
            // Another writer may have won in the gap. Recheck under write lock.
            String existing = data.get(key);
            if (existing == null) { data.put(key, candidate); existing = candidate; }
            return existing;
        } finally { rw.writeLock().unlock(); }
    }
    public Map<String, String> replaceAndSnapshot(Map<String, String> next)
            throws InterruptedException {
        Map<String, String> copy = new HashMap<>(next); // Caller must not mutate next concurrently.
        rw.writeLock().lockInterruptibly();
        try {
            data.clear(); data.putAll(copy);
            // Downgrade: acquire read before releasing write, leaving no writer gap.
            rw.readLock().lock();
        } finally { rw.writeLock().unlock(); }
        try { return new HashMap<>(data); }
        finally { rw.readLock().unlock(); }
    }
}

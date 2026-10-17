import java.io.IOException;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/** Protocol adapter only. A real Redis port must implement each operation atomically. */
public final class LeaseLock {
    public interface RedisPort {
        boolean setIfAbsentWithTtl(String key, String owner, long ttlMillis) throws IOException;
        boolean deleteIfOwner(String key, String owner) throws IOException;
    }
    private final RedisPort port;
    public LeaseLock(RedisPort port) { this.port = Objects.requireNonNull(port); }
    public Optional<Handle> tryAcquire(String key, long ttlMillis) throws IOException {
        if (key == null || key.isBlank() || ttlMillis <= 0)
            throw new IllegalArgumentException("nonblank key and positive TTL required");
        String owner = UUID.randomUUID().toString();
        // A timeout propagates as UNKNOWN, never converted to a false failure result.
        return port.setIfAbsentWithTtl(key, owner, ttlMillis)
                ? Optional.of(new Handle(port, key, owner)) : Optional.empty();
    }
    public static final class Handle implements AutoCloseable {
        private final RedisPort port;
        private final String key, owner;
        private boolean released;
        private Handle(RedisPort port, String key, String owner) {
            this.port = port; this.key = key; this.owner = owner;
        }
        /** Compare-and-delete only. This is not proof that a business write is still authorized. */
        public synchronized boolean release() throws IOException {
            if (released) return false;
            boolean deleted = port.deleteIfOwner(key, owner);
            released = true;
            return deleted;
        }
        @Override public void close() throws IOException { release(); }
    }
}

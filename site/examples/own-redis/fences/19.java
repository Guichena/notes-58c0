import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.function.LongSupplier;

/** Runnable SDK core for immutable versioned values. Remote is a protocol port, not Redis. */
public final class VersionedTwoLevelCache implements AutoCloseable {
    public record Key(String tenant, String resource, long revision) {
        public Key {
            if (tenant == null || resource == null || !tenant.matches("[A-Za-z0-9_-]{1,64}")
                    || !resource.matches("[A-Za-z0-9_-]{1,64}") || revision < 0)
                throw new IllegalArgumentException("bounded ASCII tenant/resource and nonnegative revision required");
        }
        public String redisKey() { return "cache:v1:{" + tenant + ":" + resource + "}:" + revision; }
    }
    public record Value(Optional<String> text) {
        public Value { Objects.requireNonNull(text); }
        public static Value found(String text) { return new Value(Optional.of(text)); }
        public static Value absent() { return new Value(Optional.empty()); }
    }
    public record RemoteHit(Value value, long remainingMillis) {
        public RemoteHit {
            Objects.requireNonNull(value);
            if (remainingMillis <= 0) throw new IllegalArgumentException("positive remaining TTL required");
        }
    }
    public interface Remote {
        // Empty means MISS; a hit whose Value is absent means a cached authoritative NOT_FOUND.
        Optional<RemoteHit> get(Key key) throws Exception;
        // Atomic value+TTL write. Same immutable version must never represent different contents.
        void put(Key key, Value value, long ttlMillis) throws Exception;
    }
    @FunctionalInterface public interface Loader { Value load(Key key) throws Exception; }
    public record Stats(long l1Hits, long l2Hits, long sourceLoads, long remoteFailures, long coalescedWaits, int resident, int inFlight) { }
    private record Local(Value value, long born, long ttl) { }
    private static final class Flight {
        final CompletableFuture<Value> result = new CompletableFuture<>();
        boolean cacheable = true;
    }
    private static final ThreadLocal<Boolean> IN_LOADER = ThreadLocal.withInitial(() -> false);
    private final Remote remote;
    private final LongSupplier clock;
    private final int maxEntries, maxLoads, maxBytes;
    private final long l1Ttl, l2Ttl, negativeTtl, waiterTimeout;
    private final boolean fallback;
    private final Map<Key, Local> local = new LinkedHashMap<>(16, 0.75f, true);
    private final Map<Key, Flight> flights = new HashMap<>();
    private long lastTick, l1Hits, l2Hits, sourceLoads, remoteFailures, coalescedWaits;
    private boolean closed;

    public VersionedTwoLevelCache(Remote remote, LongSupplier monotonicMillis, int maxEntries,
            int maxLoads, int maxBytes, long l1Ttl, long l2Ttl, long negativeTtl,
            long waiterTimeout, boolean allowSourceOnRemoteError) {
        this.remote = Objects.requireNonNull(remote); this.clock = Objects.requireNonNull(monotonicMillis);
        if (maxEntries <= 0 || maxLoads <= 0 || maxBytes <= 0 || l1Ttl <= 0 || l2Ttl <= 0
                || negativeTtl <= 0 || negativeTtl > l2Ttl || waiterTimeout <= 0)
            throw new IllegalArgumentException("positive bounds; negative TTL must not exceed L2 TTL");
        this.maxEntries=maxEntries; this.maxLoads=maxLoads; this.maxBytes=maxBytes;
        this.l1Ttl=l1Ttl; this.l2Ttl=l2Ttl; this.negativeTtl=negativeTtl;
        this.waiterTimeout=waiterTimeout; this.fallback=allowSourceOnRemoteError;
    }
    public Value get(Key key, Loader loader) throws Exception {
        Objects.requireNonNull(key); Objects.requireNonNull(loader);
        if (IN_LOADER.get()) throw new IllegalStateException("recursive SDK loads are forbidden");
        Flight flight; boolean leader;
        synchronized (this) {
            ensureOpen(); long now=tick(); Local hit=local.get(key);
            if (hit != null && now-hit.born()<hit.ttl()) { l1Hits++; return hit.value(); }
            local.remove(key); flight=flights.get(key); leader=flight==null;
            if (!leader && !flight.cacheable) throw new RejectedExecutionException("invalidated load still draining; retry later");
            if (!leader) coalescedWaits++;
            if (leader) {
                if (flights.size() >= maxLoads) throw new RejectedExecutionException("source-load budget exhausted");
                flight=new Flight(); flights.put(key,flight);
            }
        }
        if (!leader) {
            try { return flight.result.get(waiterTimeout,TimeUnit.MILLISECONDS); }
            catch (ExecutionException e) {
                if (e.getCause() instanceof Exception cause) throw cause;
                if (e.getCause() instanceof Error cause) throw cause;
                throw new IllegalStateException(e.getCause());
            }
        }
        try {
            IN_LOADER.set(true);
            long started=now(); Optional<RemoteHit> hit;
            try { hit=Objects.requireNonNull(remote.get(key)); }
            catch (Exception e) {
                if (e instanceof InterruptedException) throw e;
                synchronized (this) { remoteFailures++; }
                if (!fallback || !(e instanceof java.io.IOException)) throw e;
                hit=Optional.empty();
            }
            long ttl, ttlMeasuredAt; Value value; long returnedAt=now();
            if (hit.isPresent() && hit.get().remainingMillis()>returnedAt-started) {
                value=hit.get().value(); ttl=Math.min(l1Ttl,hit.get().remainingMillis()-(returnedAt-started));
                ttlMeasuredAt=returnedAt;
                synchronized (this) { l2Hits++; }
            } else {
                synchronized (this) { sourceLoads++; }
                value=Objects.requireNonNull(loader.load(key)); validate(value);
                long target=value.text().isPresent()?l2Ttl:negativeTtl;
                started=now(); boolean stored=true;
                try { remote.put(key,value,target); }
                catch (Exception e) {
                    if (e instanceof InterruptedException) throw e;
                    synchronized (this) { remoteFailures++; }
                    if (!fallback || !(e instanceof java.io.IOException)) throw e;
                    stored=false;
                }
                ttlMeasuredAt=now();
                // On IOException fallback, local TTL starts at this failed-PUT completion sample.
                ttl=stored?Math.min(l1Ttl,Math.max(0,target-(ttlMeasuredAt-started))):Math.min(l1Ttl,target);
            }
            validate(value);
            synchronized (this) {
                ensureOpen();
                long installNow=tick();
                long remaining=Math.max(0,ttl-(installNow-ttlMeasuredAt));
                if (flight.cacheable && remaining>0) {
                    local.put(key,new Local(value,installNow,remaining));
                    while (local.size()>maxEntries) local.remove(local.keySet().iterator().next());
                }
                flight.result.complete(value);
            }
            return value;
        } catch (Exception | Error e) { flight.result.completeExceptionally(e); throw e; }
        finally {
            IN_LOADER.remove();
            synchronized (this) { flights.remove(key,flight); }
        }
    }
    public synchronized void invalidateLocal(Key key) {
        ensureOpen(); local.remove(Objects.requireNonNull(key)); Flight f=flights.get(key);
        if (f!=null) f.cacheable=false;
    }
    public synchronized void onDisconnect() {
        ensureOpen(); local.clear(); for (Flight f:flights.values()) f.cacheable=false;
    }
    public synchronized Stats stats() { return new Stats(l1Hits,l2Hits,sourceLoads,remoteFailures,coalescedWaits,local.size(),flights.size()); }
    private void validate(Value value) {
        if (value.text().isPresent()) {
            String text=value.text().get();
            if (text.length()>maxBytes || text.getBytes(StandardCharsets.UTF_8).length>maxBytes)
                throw new IllegalArgumentException("value exceeds configured UTF-8 byte budget");
        }
    }
    private synchronized long now() { return tick(); }
    private long tick() {
        long n=clock.getAsLong();
        if (n<0 || n<lastTick) throw new IllegalStateException("nonnegative monotonic clock required");
        lastTick=n; return n;
    }
    private void ensureOpen() { if (closed) throw new IllegalStateException("cache closed"); }
    @Override public synchronized void close() {
        closed=true; local.clear();
        for (Flight f:flights.values()) f.result.completeExceptionally(new IllegalStateException("cache closed"));
        // No owned threads. Caller-owned loaders must enforce their own I/O deadlines/cancellation.
    }
}

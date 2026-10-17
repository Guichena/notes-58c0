import java.util.Objects;
import java.util.concurrent.*;

/** Java21 companion: per-key in-flight suppression, not a persistent cache.
 * Waiter timeout/interruption never cancels shared work. The caller owns the
 * executor and gives loader its own finite deadline/cooperative cancellation.
 * Concurrent same-key callers must agree on loader semantics and authorization.
 */
public final class SharedFlight<K,V> {
    private final ConcurrentHashMap<K,CompletableFuture<V>> active = new ConcurrentHashMap<>();
    private final Executor executor;
    public SharedFlight(Executor executor) { this.executor=Objects.requireNonNull(executor); }
    public V call(K key, Callable<V> loader, long timeout, TimeUnit unit)
            throws InterruptedException, ExecutionException, TimeoutException {
        Objects.requireNonNull(key); Objects.requireNonNull(loader); Objects.requireNonNull(unit);
        if(timeout<0) throw new IllegalArgumentException("negative wait timeout");
        CompletableFuture<V> fresh=new CompletableFuture<>();
        CompletableFuture<V> found=active.putIfAbsent(key,fresh);
        CompletableFuture<V> result=found==null ? fresh : found;
        if(found==null) {
            try {
                executor.execute(()-> {
                    V value=null;
                    Throwable failure=null;
                    try { value=loader.call(); }
                    catch(Throwable caught) { failure=caught; }
                    // End registration before publishing completion: a caller
                    // observing completion must not join a finished generation.
                    active.remove(key,fresh);
                    if(failure==null) fresh.complete(value);
                    else fresh.completeExceptionally(failure);
                });
            } catch(RuntimeException rejected) {
                active.remove(key,fresh); fresh.completeExceptionally(rejected);
            }
        }
        // get(timeout) affects only this wait; never call cancel/orTimeout on root.
        return result.get(timeout,unit);
    }
    public int activeKeys() { return active.size(); } // Diagnostic, not admission control.
}


import interview.tools.Cleanup;
import java.util.*;
import java.util.concurrent.*;

/** Java execution boundary AFTER bounded JSON parsing. No model SDK, JSON parser, real auth or durable ledger. */
public final class ToolWrapper implements AutoCloseable {
    public record Context(String tenant, String user, Set<String> capabilities) {
        public Context {
            if (tenant == null || tenant.isBlank() || user == null || user.isBlank()) throw new IllegalArgumentException();
            capabilities = Set.copyOf(capabilities);
        }
    }
    public record Call(String callId, String name, Map<String, Object> arguments) { }
    public record Reply(String callId, String status, String data) implements java.io.Serializable { }
    public static final class ToolInterruptedException extends InterruptedException {
        private static final long serialVersionUID=1L;
        public final Reply reply;
        ToolInterruptedException(String callId,InterruptedException cause){super("tool outcome unknown");initCause(cause);reply=new Reply(callId,"INTERRUPTED_UNKNOWN","reconcile before further effects");}
    }
    @FunctionalInterface public interface Body { String run(Context context, int amount) throws Exception; }
    public record Tool(String capability, Body body) { public Tool { Objects.requireNonNull(capability); Objects.requireNonNull(body); } }
    private final Map<String, Tool> registry;
    private final ThreadPoolExecutor executor;
    public ToolWrapper(Map<String, Tool> registry, int workers, int queueCapacity) {
        this.registry = Map.copyOf(registry);
        if (workers <= 0 || queueCapacity <= 0) throw new IllegalArgumentException();
        executor = new ThreadPoolExecutor(workers, workers, 0, TimeUnit.MILLISECONDS,
                new ArrayBlockingQueue<>(queueCapacity), new ThreadPoolExecutor.AbortPolicy());
    }
    private static int validate(Map<String, Object> args) {
        if (args == null || !args.keySet().equals(Set.of("amount"))) throw new IllegalArgumentException();
        Object v = args.get("amount");
        // Explicit decoding contract: bounded parser materializes integral JSON numbers as Integer or Long.
        if (!(v instanceof Integer || v instanceof Long)) throw new IllegalArgumentException();
        long n = ((Number) v).longValue(); if (n < 1 || n > 100) throw new IllegalArgumentException();
        return (int) n;
    }
    public Reply invoke(Context context, Call call, long timeoutMillis) throws InterruptedException {
        Objects.requireNonNull(context);
        if (call == null || call.callId() == null || call.callId().isBlank() || call.callId().length() > 128 ||
                call.name() == null || timeoutMillis < 1 || timeoutMillis > 60_000) throw new IllegalArgumentException();
        long start = System.nanoTime(), budget = TimeUnit.MILLISECONDS.toNanos(timeoutMillis);
        Tool tool = registry.get(call.name());
        if (tool == null) return new Reply(call.callId(), "UNKNOWN_TOOL", "");
        if (!context.capabilities().contains(tool.capability())) return new Reply(call.callId(), "FORBIDDEN", "");
        final int amount;
        try { amount = validate(call.arguments()); } catch (IllegalArgumentException e) { return new Reply(call.callId(), "INVALID_ARGUMENT", ""); }
        FutureTask<String> task = new FutureTask<>(() -> {
            String result = tool.body().run(context, amount);
            if (result == null || result.length() > 4096) throw new IllegalArgumentException("invalid tool result");
            return result;
        });
        try { executor.execute(task); } catch (RejectedExecutionException e) { return new Reply(call.callId(), "OVERLOADED", ""); }
        try {
            long remaining = budget - (System.nanoTime() - start);
            if (remaining <= 0) throw new TimeoutException();
            return new Reply(call.callId(), "OK", task.get(remaining, TimeUnit.NANOSECONDS));
        } catch (TimeoutException e) {
            task.cancel(true); executor.remove(task);
            return new Reply(call.callId(), "TIMEOUT_UNKNOWN", "query operation status before retrying effects");
        } catch (ExecutionException e) {
            // A thrown exception does not prove an arbitrary tool had no side effects; avoid secret-bearing stack text.
            return new Reply(call.callId(), "EXECUTION_UNKNOWN", "verify operation outcome");
        } catch (InterruptedException e) {
            task.cancel(true); executor.remove(task); Thread.currentThread().interrupt(); throw new ToolInterruptedException(call.callId(),e);
        }
    }
    public int active() { return executor.getActiveCount(); }
    @Override public void close() {
        Throwable first=null;List<Runnable> pending=List.of();
        try{pending=executor.shutdownNow();}catch(Throwable e){first=Cleanup.merge(first,e);}
        for(Runnable job:pending)if(job instanceof Future<?> f){try{f.cancel(false);}catch(Throwable e){first=Cleanup.merge(first,e);}}
        Throwable failure=Cleanup.collect(first,
            ()->{boolean interrupted=false;long end=System.nanoTime()+TimeUnit.SECONDS.toNanos(5);
                try{while(!executor.isTerminated()){
                    long left=end-System.nanoTime();if(left<=0)throw new IllegalStateException("worker termination unconfirmed");
                    try{executor.awaitTermination(left,TimeUnit.NANOSECONDS);}catch(InterruptedException e){interrupted=true;}
                }}finally{if(interrupted)Thread.currentThread().interrupt();}});
        Cleanup.unchecked(failure);
    }
    private static void check(boolean b) { if (!b) throw new AssertionError(); }
    private static Call call(String name, Map<String, Object> args) { return new Call("call-1", name, args); }
    public static void main(String[] args) throws Exception {
        Set<String> original = new HashSet<>(Set.of("read")); Context c = new Context("tenant-a", "u", original); original.clear();
        Map<String, Tool> tools = Map.of(
                "double", new Tool("read", (ctx, n) -> ctx.tenant() + ":" + (2 * n)),
                "fail", new Tool("read", (ctx, n) -> { throw new IllegalStateException("secret must not escape"); }),
                "big", new Tool("read", (ctx, n) -> "x".repeat(4097)));
        try (ToolWrapper w = new ToolWrapper(tools, 2, 2)) {
            Reply ok = w.invoke(c, call("double", Map.of("amount", 3)), 1000);
            check(ok.equals(new Reply("call-1", "OK", "tenant-a:6")));
            check(w.invoke(c, call("none", Map.of()), 1000).status().equals("UNKNOWN_TOOL"));
            check(w.invoke(new Context("a", "u", Set.of()), call("double", Map.of("amount", 1)), 1000).status().equals("FORBIDDEN"));
            for (Map<String, Object> bad : List.<Map<String, Object>>of(Map.of(), Map.of("amount", -1), Map.of("amount", 101), Map.of("amount", 1.5), Map.of("amount", "2"), Map.of("amount", 2, "tenant", "victim")))
                check(w.invoke(c, call("double", bad), 1000).status().equals("INVALID_ARGUMENT"));
            check(w.invoke(c, call("double", Map.of("amount", 100L)), 1000).data().equals("tenant-a:200"));
            check(w.invoke(c, call("fail", Map.of("amount", 1)), 1000).equals(new Reply("call-1", "EXECUTION_UNKNOWN", "verify operation outcome")));
            check(w.invoke(c, call("big", Map.of("amount", 1)), 1000).status().equals("EXECUTION_UNKNOWN"));
        }
        CountDownLatch entered = new CountDownLatch(1), release = new CountDownLatch(1);
        Tool stubborn = new Tool("read", (ctx, n) -> {
            entered.countDown(); boolean interrupted = false;
            for (;;) { try { release.await(); break; } catch (InterruptedException e) { interrupted = true; } }
            if (interrupted) Thread.currentThread().interrupt(); return "done";
        });
        ToolWrapper w = new ToolWrapper(Map.of("slow", stubborn), 1, 1);
        ExecutorService caller = Executors.newSingleThreadExecutor();
        Throwable primary=null;
        try {
            Future<Reply> result = caller.submit(() -> w.invoke(c, call("slow", Map.of("amount", 1)), 300));
            check(entered.await(5, TimeUnit.SECONDS)); check(result.get(5, TimeUnit.SECONDS).status().equals("TIMEOUT_UNKNOWN"));
            check(w.active() == 1); // response finished, actual non-cooperative worker still occupies its slot
            // Queue one inert job directly for a deterministic overload check; no reliance on sleeps or scheduling luck.
            FutureTask<String> queued = new FutureTask<>(() -> "queued"); w.executor.execute(queued);
            check(w.invoke(c, call("slow", Map.of("amount", 1)), 100).status().equals("OVERLOADED"));
            check(queued.cancel(true)); check(w.executor.remove(queued));
        } catch(Throwable e){primary=e;}
        finally {primary=Cleanup.collect(primary,release::countDown,()->caller.shutdownNow(),w::close,
            ()->{if(!caller.awaitTermination(5,TimeUnit.SECONDS))throw new IllegalStateException("caller termination unconfirmed");});}
        Cleanup.rethrow(primary);
        System.out.println("PASS ToolWrapper: allowlist/trusted immutable context, exact callId, required/type/range/additional fields, auth deny, safe errors/result bound, timeout with noncooperative worker still active, deterministic bounded-queue overload, actual cleanup");
    }
}


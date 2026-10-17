package interview.tools;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.FutureTask;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/** In-process bounded executor. Its bounded operation journal is volatile; no crash durability is claimed. */
public final class ToolExecutor implements ToolPort {
    @FunctionalInterface public interface Validator { void validate(Map<String,Object> args); }
    @FunctionalInterface public interface Authorizer { boolean allowed(Context context, String name, Map<String,Object> args); }
    @FunctionalInterface public interface Handler { void run(Invocation invocation, Output out) throws Exception; }
    public record Invocation(Context context, Call call, Map<String,Object> arguments, Budget budget) {}
    public record Spec(String version, String capability, boolean readonly, int maxAttempts, long timeoutMillis,
                       int maxOutputBytes, boolean allowEmpty, Validator validator, Handler handler) {
        public Spec {
            Objects.requireNonNull(version);Objects.requireNonNull(capability);Objects.requireNonNull(validator);Objects.requireNonNull(handler);
            if(version.isBlank()||maxAttempts<1||maxAttempts>10||timeoutMillis<1||timeoutMillis>60_000||maxOutputBytes<1||maxOutputBytes>8192)throw new IllegalArgumentException();
        }
    }
    /** Only trusted handlers may assert that their own failed execution had no effect. */
    public static final class KnownFailure extends Exception {
        private static final long serialVersionUID=1L;
        final Status status; final boolean retryable;
        public KnownFailure(Status status, boolean retryable) {
            super("classified tool failure");
            if(status!=Status.CONFLICT&&status!=Status.FAILED&&status!=Status.RETRYABLE_FAILURE&&status!=Status.DENIED&&status!=Status.INVALID_ARGUMENT)throw new IllegalArgumentException();
            if(retryable&&status!=Status.RETRYABLE_FAILURE)throw new IllegalArgumentException();
            this.status=status;this.retryable=retryable;
        }
    }
    private static final class OutputLimit extends RuntimeException {
        private static final long serialVersionUID=1L;
    }
    public static final class Output {
        private final int limit; private final StringBuilder text=new StringBuilder(); private int bytes;
        Output(int limit){this.limit=limit;}
        public void write(String part) {
            Objects.requireNonNull(part);
            if(part.length()>limit)throw new OutputLimit();
            int n=part.getBytes(StandardCharsets.UTF_8).length;
            if(n>limit-bytes)throw new OutputLimit();bytes+=n;text.append(part);
        }
        String value(){return text.toString();}
    }
    private record Key(String tenant,String user,String resource,String tool,String operation) {}
    private static final class Entry {
        final String fingerprint; Reply reply;
        Entry(String fingerprint){this.fingerprint=fingerprint;}
    }
    private static final class Attempt {
        boolean started, abandoned;
        synchronized boolean begin(){if(abandoned)return false;started=true;return true;}
        synchronized boolean abandon(){abandoned=true;return started;}
    }
    private final Map<String,Spec> registry;
    private final Authorizer authorizer;
    private final ThreadPoolExecutor workers;
    private final Map<Key,Entry> journal=new ConcurrentHashMap<>();
    private final int maxOperations;
    private final Object journalLock=new Object();
    public ToolExecutor(Map<String,Spec> registry, Authorizer authorizer, int workers, int queue, int maxOperations) {
        this.registry=Map.copyOf(registry);this.authorizer=Objects.requireNonNull(authorizer);
        if(workers<1||queue<1||maxOperations<1)throw new IllegalArgumentException();this.maxOperations=maxOperations;
        this.workers=new ThreadPoolExecutor(workers,workers,0,TimeUnit.MILLISECONDS,new ArrayBlockingQueue<>(queue),new ThreadPoolExecutor.AbortPolicy());
    }
    private static Reply reply(Call call,Status status,String data){return new Reply(call.callId(),call.operationId(),status,data,status==Status.UNKNOWN);}
    private static Status stop(Budget b){
        if(Thread.currentThread().isInterrupted()||b.cancellation().isCancelled())return Status.CANCELLED;
        if(b.remainingNanos()==0)return Status.DEADLINE_EXCEEDED;return null;
    }
    @Override public Reply invoke(Context context,Call call,Budget budget){
        Objects.requireNonNull(context);Objects.requireNonNull(call);Objects.requireNonNull(budget);
        Spec spec=registry.get(call.name());if(spec==null)return reply(call,Status.UNKNOWN_TOOL,"");
        final Map<String,Object> args;
        try{args=StrictJson.object(StrictJson.parse(call.argumentsJson()));spec.validator().validate(args);}
        catch(RuntimeException e){return reply(call,Status.INVALID_ARGUMENT,"");}
        // Model-provided capabilities are never consulted. The caller creates Context from verified identity.
        if(!context.capabilities().contains(spec.capability()))return reply(call,Status.DENIED,"");
        try{if(!authorizer.allowed(context,call.name(),args))return reply(call,Status.DENIED,"");}
        catch(RuntimeException e){return reply(call,Status.DENIED,"");} // policy failure is fail closed
        if(!spec.readonly()&&call.operationId().isBlank())return reply(call,Status.INVALID_ARGUMENT,"");
        Entry entry=null;Key key=null;
        if(!spec.readonly()){
            key=new Key(context.tenant(),context.user(),context.resourceScope(),call.name(),call.operationId());
            String fp=StrictJson.canonical(Map.of("version",spec.version(),"arguments",args));
            synchronized(journalLock){
                entry=journal.get(key);
                if(entry!=null){
                    if(!entry.fingerprint.equals(fp))return reply(call,Status.CONFLICT,"");
                    synchronized(entry){return entry.reply==null?reply(call,Status.UNKNOWN,"operation pending; reconcile"):
                        reply(call,entry.reply.status(),entry.reply.data());}
                }
                Status stopped=stop(budget);if(stopped!=null)return reply(call,stopped,"");
                if(journal.size()>=maxOperations)return reply(call,Status.OVERLOADED,"");
                entry=new Entry(fp);journal.put(key,entry);
            }
        }
        Reply result;
        try{result=execute(context,call,budget,spec,args);}
        catch(RuntimeException e){result=reply(call,spec.readonly()?Status.FAILED:Status.UNKNOWN,"unexpected executor failure");}
        if(entry!=null){
            synchronized(entry){entry.reply=result;}
            // No handler could have started for these statuses; a later same-operation invocation is permitted.
            if(result.status()==Status.OVERLOADED||result.status()==Status.BUDGET_EXHAUSTED||result.status()==Status.CANCELLED||result.status()==Status.DEADLINE_EXCEEDED)
                synchronized(journalLock){journal.remove(key,entry);}
        }
        return result;
    }
    private Reply execute(Context context,Call call,Budget budget,Spec spec,Map<String,Object> args){
        int max=spec.readonly()?spec.maxAttempts():1;
        for(int n=1;n<=max;n++){
            Status stopped=stop(budget);if(stopped!=null)return reply(call,stopped,"");
            // Recheck policy on every new attempt, including an internal read retry.
            try{if(!authorizer.allowed(context,call.name(),args))return reply(call,Status.DENIED,"");}
            catch(RuntimeException e){return reply(call,Status.DENIED,"");}
            if(!budget.reserveAttempt())return reply(call,Status.BUDGET_EXHAUSTED,"");
            Attempt a=new Attempt();Output out=new Output(spec.maxOutputBytes());
            FutureTask<String> task=new FutureTask<>(()->{
                if(!a.begin())return "";
                boolean allowed;try{allowed=authorizer.allowed(context,call.name(),args);}catch(RuntimeException e){allowed=false;}
                if(!allowed)throw new KnownFailure(Status.DENIED,false);
                spec.handler().run(new Invocation(context,call,args,budget),out);return out.value();
            });
            try{workers.execute(task);}catch(RejectedExecutionException e){return reply(call,Status.OVERLOADED,"");}
            long perDeadline=System.nanoTime()+TimeUnit.MILLISECONDS.toNanos(spec.timeoutMillis());
            try{
                for(;;){
                    stopped=stop(budget);long left=Math.min(budget.remainingNanos(),Math.max(0,perDeadline-System.nanoTime()));
                    if(stopped!=null||left==0){boolean started=a.abandon();task.cancel(true);workers.remove(task);
                        Status status=!spec.readonly()&&started?Status.UNKNOWN:stopped==null?Status.DEADLINE_EXCEEDED:stopped;
                        return reply(call,status,status==Status.UNKNOWN?"query original operation; no automatic retry":"");}
                    try{
                        String data=task.get(Math.min(left,TimeUnit.MILLISECONDS.toNanos(10)),TimeUnit.NANOSECONDS);
                        if(data.isEmpty()&&spec.allowEmpty())return reply(call,Status.EMPTY_VALID,"");
                        try{StrictJson.object(StrictJson.parse(data,spec.maxOutputBytes()));}
                        catch(RuntimeException e){return reply(call,spec.readonly()?Status.INVALID_OUTPUT:Status.UNKNOWN,"invalid result");}
                        return reply(call,Status.OK,data);
                    }catch(TimeoutException poll){/* bounded cancellation polling; do not reset either deadline */}
                }
            }catch(InterruptedException e){boolean started=a.abandon();task.cancel(true);workers.remove(task);Thread.currentThread().interrupt();
                return reply(call,!spec.readonly()&&started?Status.UNKNOWN:Status.CANCELLED,"interrupted waiting");
            }catch(ExecutionException e){
                Throwable cause=e.getCause();
                if(cause instanceof KnownFailure failure){
                    if(spec.readonly()&&failure.retryable&&n<max){
                        long pause=Math.min(TimeUnit.MILLISECONDS.toNanos(5L*n),budget.remainingNanos());
                        try{TimeUnit.NANOSECONDS.sleep(pause);}catch(InterruptedException interrupted){Thread.currentThread().interrupt();return reply(call,Status.CANCELLED,"");}
                        continue;
                    }
                    return reply(call,failure.status,"classified failure");
                }
                return reply(call,spec.readonly()?(cause instanceof OutputLimit?Status.INVALID_OUTPUT:Status.FAILED):Status.UNKNOWN,"tool failed; details withheld");
            }
        }
        throw new AssertionError("unreachable");
    }
    public int activeWorkers(){return workers.getActiveCount();}
    public int queued(){return workers.getQueue().size();}
    @Override public void close(){
        Throwable failure=null;java.util.List<Runnable> pending=java.util.List.of();
        try{pending=workers.shutdownNow();}catch(Throwable e){failure=Cleanup.merge(failure,e);}
        for(Runnable job:pending)if(job instanceof FutureTask<?> task){
            try{task.cancel(false);}catch(Throwable e){failure=Cleanup.merge(failure,e);}
        }
        boolean interrupted=Thread.interrupted();long until=System.nanoTime()+TimeUnit.SECONDS.toNanos(5);
        try{while(!workers.isTerminated()){
            long left=until-System.nanoTime();if(left<=0){failure=Cleanup.merge(failure,new IllegalStateException("workers still running; external isolation required"));break;}
            try{workers.awaitTermination(left,TimeUnit.NANOSECONDS);}catch(InterruptedException e){interrupted=true;}
            catch(Throwable e){failure=Cleanup.merge(failure,e);break;}
        }}finally{if(interrupted)Thread.currentThread().interrupt();}
        Cleanup.unchecked(failure);
    }
}

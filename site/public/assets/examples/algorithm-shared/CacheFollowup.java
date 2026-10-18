import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import java.util.function.*;
public final class CacheFollowup {
    private CacheFollowup() {}
    /** Owned scheduler; close stops future starts, awaitStopped can wait for an in-flight cleanup. */
    public static final class ActiveExpiryDriver implements AutoCloseable {
        private final ScheduledExecutorService executor;
        private final ScheduledFuture<?> task;
        private final AtomicReference<RuntimeException> lastFailure=new AtomicReference<>();
        private final AtomicLong completedRuns=new AtomicLong();
        public ActiveExpiryDriver(IntUnaryOperator cleanup,int batch,long delayMillis){
            Objects.requireNonNull(cleanup);if(batch<1||delayMillis<1)throw new IllegalArgumentException("batch/delay");
            executor=Executors.newSingleThreadScheduledExecutor(r->{Thread t=new Thread(r,"cache-expiry");t.setDaemon(true);return t;});
            task=executor.scheduleWithFixedDelay(()->{try{cleanup.applyAsInt(batch);completedRuns.incrementAndGet();}catch(RuntimeException e){lastFailure.set(e);}},delayMillis,delayMillis,TimeUnit.MILLISECONDS);
        }
        public Optional<RuntimeException> lastFailure(){return Optional.ofNullable(lastFailure.get());}
        public long completedRuns(){return completedRuns.get();}
        public boolean terminatedUnexpectedly(){return task.isDone()&&!task.isCancelled();}
        @Override public void close(){task.cancel(false);executor.shutdown();}
        public boolean awaitStopped(long timeout,TimeUnit unit)throws InterruptedException{return executor.awaitTermination(timeout,unit);}
    }
    /** Processing-time window (now-duration,now], immutable String IDs, newest first then ID ascending. */
    public static final class RecentUsers {
        public record Visit(String user,long time) {}
        private final long duration;private final LongSupplier clock;
        private final Map<String,Long> latest=new HashMap<>();
        private final NavigableMap<Long,NavigableSet<String>> times=new TreeMap<>();
        private long previous=-1;
        public RecentUsers(long duration,LongSupplier clock){if(duration<0)throw new IllegalArgumentException("duration");this.duration=duration;this.clock=Objects.requireNonNull(clock);}
        private long now(){long time=clock.getAsLong();if(time<0||time<previous)throw new IllegalArgumentException("nonnegative monotonic clock");previous=time;return time;}
        private void purge(long time){
            if(time<duration)return;long cutoff=time-duration;
            while(!times.isEmpty()&&times.firstKey()<=cutoff){var e=times.pollFirstEntry();for(String user:e.getValue())latest.remove(user);}
        }
        private void unlink(String user,long time){NavigableSet<String> bucket=times.get(time);bucket.remove(user);if(bucket.isEmpty())times.remove(time);}
        public synchronized void seen(String user){
            Objects.requireNonNull(user);long time=now();purge(time);Long old=latest.remove(user);if(old!=null)unlink(user,old);if(duration==0)return;latest.put(user,time);times.computeIfAbsent(time,x->new TreeSet<>()).add(user);
        }
        public synchronized List<Visit> newestFirst(int limit){
            if(limit<0)throw new IllegalArgumentException("limit");purge(now());if(limit==0)return List.of();List<Visit>out=new ArrayList<>();
            for(var e:times.descendingMap().entrySet())for(String user:e.getValue()){out.add(new Visit(user,e.getKey()));if(out.size()==limit)return List.copyOf(out);}return List.copyOf(out);
        }
        public synchronized int size(){purge(now());return latest.size();}
        public synchronized int physicalSize(){return latest.size();}
    }
}

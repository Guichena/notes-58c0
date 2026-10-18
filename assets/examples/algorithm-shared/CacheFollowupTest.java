import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import java.lang.reflect.*;
public class CacheFollowupTest {
    static int assertions;
    static void check(boolean b){assertions++;if(!b)throw new AssertionError();}
    static void eq(Object a,Object b){assertions++;if(!Objects.equals(a,b))throw new AssertionError(a+" != "+b);}
    static void rejects(Class<? extends Throwable>type,Runnable r){try{r.run();throw new AssertionError("not rejected");}catch(Throwable t){if(!type.isInstance(t))throw new AssertionError(t);}}
    static Object field(Object target,String name)throws Exception{Field f=target.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(target);}
    static void verifyIndex(Object cache)throws Exception{
        Map<?,?>map=(Map<?,?>)field(cache,"map");Map<?,?>expiry=(Map<?,?>)field(cache,"expiry");Set<Object>seen=Collections.newSetFromMap(new IdentityHashMap<>());
        for(Object bucket:expiry.values()){Object before=null,last=null;for(Object e=field(bucket,"first");e!=null;e=field(e,"expiryAfter")){check(seen.add(e));check(field(e,"expiryBefore")==before);before=last=e;}check(field(bucket,"last")==last);}
        check(seen.size()==map.size());check(seen.containsAll(map.values()));Set<Object>access=Collections.newSetFromMap(new IdentityHashMap<>());Object before=null,last=null;for(Object e=field(cache,"oldest");e!=null;e=field(e,"after")){check(access.add(e));check(field(e,"before")==before);before=last=e;}check(field(cache,"newest")==last);check(access.equals(seen));
    }
    static void ttlDifferential()throws Exception{
        AtomicLong time=new AtomicLong();var old=new BaselineInterviewCaches.TtlLru<Integer,String>(9,7,time::get);var fresh=new InterviewCaches.TtlLru<Integer,String>(9,7,time::get);Random r=new Random(1871);
        for(int i=0;i<50000;i++){time.addAndGet(r.nextInt(3));int key=r.nextInt(17),op=r.nextInt(8);switch(op){
            case 0,1->{long ttl=r.nextInt(25);String v="v"+i;old.put(key,v,ttl);fresh.put(key,v,ttl);}
            case 2->{old.put(key,"d"+i);fresh.put(key,"d"+i);}
            case 3->eq(old.get(key),fresh.get(key));
            case 4->eq(old.size(),fresh.size());
            case 5->eq(old.keysOldestFirst(),fresh.keysOldestFirst());
            case 6->{int n=r.nextInt(12);eq(old.evict(n),fresh.evict(n));}
            case 7->{int removed=fresh.cleanupBatch(1+r.nextInt(4));check(removed>=0&&removed<=4);}
        }if(i%19==0){eq(old.keysOldestFirst(),fresh.keysOldestFirst());verifyIndex(fresh);}}
        eq(old.keysOldestFirst(),fresh.keysOldestFirst());verifyIndex(fresh);
        rejects(IllegalArgumentException.class,()->fresh.cleanupBatch(0));rejects(IllegalArgumentException.class,()->fresh.evict(-1));rejects(IllegalArgumentException.class,()->fresh.put(1,"x",-1));rejects(NullPointerException.class,()->fresh.put(null,"x"));rejects(NullPointerException.class,()->fresh.put(1,null));rejects(NullPointerException.class,()->fresh.get(null));
        var zero=new InterviewCaches.TtlLru<Integer,String>(0,4,time::get);zero.put(1,"x");eq(zero.size(),0);eq(zero.get(1),Optional.empty());eq(zero.cleanupBatch(1),0);
        fresh.put(777,"x",100);fresh.put(777,"none",0);eq(fresh.get(777),Optional.empty());
        AtomicLong bound=new AtomicLong(Long.MAX_VALUE-1);var c=new InterviewCaches.TtlLru<Integer,String>(2,1,bound::get);c.put(1,"ok");rejects(ArithmeticException.class,()->c.put(1,"overflow",2));eq(c.get(1),Optional.of("ok"));bound.set(Long.MAX_VALUE);eq(c.get(1),Optional.empty());bound.decrementAndGet();rejects(IllegalArgumentException.class,()->c.get(1));
    }
    static void storm()throws Exception{
        AtomicLong time=new AtomicLong(10);var c=new InterviewCaches.TtlLru<Integer,Integer>(1000,5,time::get);for(int i=0;i<1000;i++)c.put(i,i);time.set(15);
        eq(c.physicalSize(),1000);eq(c.get(-1),Optional.empty());eq(c.physicalSize(),1000); // no unrelated full purge
        c.put(2000,2000,20);eq(c.physicalSize(),1000);eq(c.get(2000),Optional.of(2000)); // one expired slot only
        int first=c.cleanupBatch(17);eq(first,17);eq(c.physicalSize(),983);verifyIndex(c);
        int removed=first;for(int n;(n=c.cleanupBatch(17))>0;)removed+=n;eq(removed,999);eq(c.physicalSize(),1);verifyIndex(c);
        for(int i=0;i<100000;i++)c.put(2000,i,100);eq(c.physicalSize(),1);verifyIndex(c);time.set(115);eq(c.get(2000),Optional.empty());eq(c.physicalSize(),0);
        time.set(200);c.put(1,1,5);c.put(2,2,100);c.get(1);time.set(205);c.put(3,3,100);check(c.get(2).isPresent());eq(c.get(1),Optional.empty());
    }
    static void unchangedTypes(){
        var min=new InterviewCaches.MinStack();Deque<Integer>ref=new ArrayDeque<>();Random r=new Random(174);
        for(int i=0;i<10000;i++){if(ref.isEmpty()||r.nextBoolean()){int x=r.nextInt();ref.push(x);min.push(x);}else eq(min.pop(),ref.pop());eq(min.isEmpty(),ref.isEmpty());if(!ref.isEmpty()){eq(min.peek(),ref.peek());eq(min.minimum(),Collections.min(ref));}}
        var oldLfu=new BaselineInterviewCaches.Lfu<Integer,Integer>(7);var lfu=new InterviewCaches.Lfu<Integer,Integer>(7);var oldBatch=new BaselineInterviewCaches.BatchLru<Integer,Integer>(7);var batch=new InterviewCaches.BatchLru<Integer,Integer>(7);var oldRecent=new BaselineInterviewCaches.RecentPlayers<Integer>(7);var recent=new InterviewCaches.RecentPlayers<Integer>(7);
        for(int i=0;i<10000;i++){int k=r.nextInt(20);if(r.nextBoolean()){oldLfu.put(k,i);lfu.put(k,i);oldBatch.put(k,i);batch.put(k,i);}else{eq(oldLfu.get(k),lfu.get(k));eq(oldBatch.get(k),batch.get(k));}eq(oldLfu.size(),lfu.size());eq(oldBatch.size(),batch.size());if(i%13==0){int n=r.nextInt(10);eq(oldBatch.evict(n),batch.evict(n));}oldRecent.seen(k);recent.seen(k);eq(oldRecent.newestFirst(),recent.newestFirst());}
    }
    static void recentWindow(){
        AtomicLong time=new AtomicLong();var c=new CacheFollowup.RecentUsers(10,time::get);Map<String,Long>ref=new HashMap<>();Random r=new Random(982);
        for(int i=0;i<30000;i++){long now=time.addAndGet(r.nextInt(3));ref.values().removeIf(t->t<=now-10);if(r.nextBoolean()){String user="u"+r.nextInt(25);c.seen(user);ref.put(user,now);}else{int limit=r.nextInt(30);var expected=ref.entrySet().stream().sorted(Comparator.<Map.Entry<String,Long>>comparingLong(Map.Entry::getValue).reversed().thenComparing(Map.Entry::getKey)).limit(limit).map(e->new CacheFollowup.RecentUsers.Visit(e.getKey(),e.getValue())).toList();eq(c.newestFirst(limit),expected);}if(i%17==0)eq(c.size(),ref.size());}
        time.set(100000);var ties=new CacheFollowup.RecentUsers(10,time::get);ties.seen("b");ties.seen("a");eq(ties.newestFirst(2),List.of(new CacheFollowup.RecentUsers.Visit("a",100000),new CacheFollowup.RecentUsers.Visit("b",100000)));time.set(100009);check(ties.newestFirst(9).size()==2);time.set(100010);eq(ties.newestFirst(9),List.of());
        var zero=new CacheFollowup.RecentUsers(0,time::get);zero.seen("x");eq(zero.size(),0);rejects(IllegalArgumentException.class,()->ties.newestFirst(-1));rejects(NullPointerException.class,()->ties.seen(null));time.decrementAndGet();rejects(IllegalArgumentException.class,()->ties.size());
        AtomicLong extreme=new AtomicLong(Long.MAX_VALUE);var all=new CacheFollowup.RecentUsers(Long.MAX_VALUE,extreme::get);all.seen("last");check(all.newestFirst(1).size()==1);
    }
    static void scheduler()throws Exception{
        AtomicLong time=new AtomicLong();var c=new InterviewCaches.TtlLru<Integer,Integer>(100,5,time::get);for(int i=0;i<100;i++)c.put(i,i);time.set(5);CountDownLatch empty=new CountDownLatch(1);
        CacheFollowup.ActiveExpiryDriver d=new CacheFollowup.ActiveExpiryDriver(n->{int removed=c.cleanupBatch(n);if(c.physicalSize()==0)empty.countDown();return removed;},7,1);
        try{check(empty.await(5,TimeUnit.SECONDS));eq(c.physicalSize(),0);check(d.completedRuns()>=14);check(d.lastFailure().isEmpty());}finally{d.close();check(d.awaitStopped(5,TimeUnit.SECONDS));}
        AtomicInteger calls=new AtomicInteger();CountDownLatch resumed=new CountDownLatch(1);var errors=new CacheFollowup.ActiveExpiryDriver(n->{if(calls.incrementAndGet()==1)throw new IllegalArgumentException("injected");resumed.countDown();return 0;},1,1);
        try{check(resumed.await(5,TimeUnit.SECONDS));check(errors.lastFailure().isPresent());check(!errors.terminatedUnexpectedly());}finally{errors.close();check(errors.awaitStopped(5,TimeUnit.SECONDS));}
        CountDownLatch entered=new CountDownLatch(1),release=new CountDownLatch(1);AtomicInteger runs=new AtomicInteger();var running=new CacheFollowup.ActiveExpiryDriver(n->{runs.incrementAndGet();entered.countDown();try{if(!release.await(5,TimeUnit.SECONDS))throw new AssertionError();}catch(InterruptedException e){Thread.currentThread().interrupt();throw new RuntimeException(e);}return 0;},1,1);
        check(entered.await(5,TimeUnit.SECONDS));running.close();check(!running.awaitStopped(1,TimeUnit.MILLISECONDS));release.countDown();check(running.awaitStopped(5,TimeUnit.SECONDS));eq(runs.get(),1);
    }
    static void concurrent()throws Exception{
        AtomicLong clock=new AtomicLong();var c=new InterviewCaches.TtlLru<Integer,Integer>(64,100,clock::get);ExecutorService pool=Executors.newFixedThreadPool(5);List<Future<?>>jobs=new ArrayList<>();
        try{for(int thread=0;thread<4;thread++){int base=thread*1000;jobs.add(pool.submit(()->{for(int i=0;i<10000;i++){c.put(base+(i%100),i);c.get(base+(i%100));}}));}jobs.add(pool.submit(()->{for(int i=0;i<10000;i++){clock.incrementAndGet();int n=c.cleanupBatch(3);if(n<0||n>3)throw new AssertionError();}}));for(Future<?>f:jobs)f.get(15,TimeUnit.SECONDS);}finally{pool.shutdownNow();check(pool.awaitTermination(5,TimeUnit.SECONDS));}check(c.physicalSize()<=64);verifyIndex(c);
    }
    public static void main(String[]args)throws Exception{ttlDifferential();storm();unchangedTypes();recentWindow();scheduler();concurrent();System.out.println("PASS "+assertions+" assertions; 50000 before/after TTL operations; 20000 unchanged-type regressions; 30000 recent-window scan oracles; 100000 rewrites no stale index; bounded storm cleanup; no-traffic expiry; exception continuation; close lifecycle; 80000 concurrent put/get plus 10000 cleanup rounds");}
}

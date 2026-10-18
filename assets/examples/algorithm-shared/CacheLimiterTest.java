import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

public final class CacheLimiterTest {
    static long checks;
    static void eq(Object a,Object b){checks++;if(!Objects.equals(a,b))throw new AssertionError(a+" != "+b);}
    static void bad(Runnable r){checks++;try{r.run();}catch(IllegalArgumentException|NullPointerException|NoSuchElementException|ArithmeticException e){return;}throw new AssertionError("invalid accepted");}
    static final class F {int value;long frequency,tick;F(int value,long tick){this.value=value;this.tick=tick;frequency=1;}}
    record T(int value,long deadline) {}
    public static void main(String[] args)throws Exception {
        Random random=new Random(20261016);
        for(int cap=0;cap<=8;cap++) {
            var lfu=new InterviewCaches.Lfu<Integer,Integer>(cap);Map<Integer,F> oracle=new HashMap<>();
            var batch=new InterviewCaches.BatchLru<Integer,Integer>(cap);LinkedHashMap<Integer,Integer> order=new LinkedHashMap<>(16,.75f,true);
            AtomicLong clock=new AtomicLong();var ttl=new InterviewCaches.TtlLru<Integer,Integer>(cap,10,clock::get);LinkedHashMap<Integer,T> live=new LinkedHashMap<>(16,.75f,true);
            for(int step=0;step<6000;step++) {
                int key=random.nextInt(12),value=random.nextInt(),op=random.nextInt(3);
                if(op==0){F f=oracle.get(key);eq(lfu.get(key),f==null?Optional.empty():Optional.of(f.value));if(f!=null){f.frequency++;f.tick=step;}}
                else{F f=oracle.get(key);lfu.put(key,value);if(f!=null){f.value=value;f.frequency++;f.tick=step;}else if(cap>0){if(oracle.size()==cap){int victim=oracle.entrySet().stream().min(Comparator.<Map.Entry<Integer,F>>comparingLong(e->e.getValue().frequency).thenComparingLong(e->e.getValue().tick)).orElseThrow().getKey();oracle.remove(victim);}oracle.put(key,new F(value,step));}}
                eq(lfu.size(),oracle.size());
                if(op==0)eq(batch.get(key),Optional.ofNullable(order.get(key)));
                else if(op==1){batch.put(key,value);if(cap>0){order.put(key,value);if(order.size()>cap)order.remove(order.keySet().iterator().next());}}
                else{int n=random.nextInt(12),removed=0;while(removed<n&&!order.isEmpty()){order.remove(order.keySet().iterator().next());removed++;}eq(batch.evict(n),removed);}
                eq(batch.size(),order.size());
                long now=clock.addAndGet(random.nextInt(3));live.entrySet().removeIf(e->e.getValue().deadline<=now);
                if(op==0){T t=live.get(key);eq(ttl.get(key),t==null?Optional.empty():Optional.of(t.value));}
                else if(op==1){long duration=random.nextInt(20);ttl.put(key,value,duration);live.remove(key);if(duration>0&&cap>0){if(live.size()==cap)live.remove(live.keySet().iterator().next());live.put(key,new T(value,now+duration));}}
                else{int n=random.nextInt(12),removed=0;while(removed<n&&!live.isEmpty()){live.remove(live.keySet().iterator().next());removed++;}eq(ttl.evict(n),removed);}
                eq(ttl.keysOldestFirst(),new ArrayList<>(live.keySet()));eq(ttl.size(),live.size());
            }
        }
        var minimum=new InterviewCaches.MinStack();List<Integer> stack=new ArrayList<>();
        for(int i=0;i<20000;i++) {if(stack.isEmpty()||random.nextBoolean()){int x=random.nextInt(9)-4;minimum.push(x);stack.add(x);}else eq(minimum.pop(),stack.remove(stack.size()-1));if(!stack.isEmpty()){eq(minimum.peek(),stack.get(stack.size()-1));eq(minimum.minimum(),Collections.min(stack));}eq(minimum.isEmpty(),stack.isEmpty());}
        while(!minimum.isEmpty())minimum.pop();bad(minimum::minimum);bad(minimum::pop);
        var recent=new InterviewCaches.RecentPlayers<String>(3);for(String p:List.of("a","b","c","a","d"))recent.seen(p);eq(recent.newestFirst(),List.of("d","a","c"));
        AtomicLong time=new AtomicLong();var limiter=new MultiWindowLimiter<String>(List.of(new MultiWindowLimiter.Window(60,2),new MultiWindowLimiter.Window(3600,3)),100,time::get);
        Map<String,List<Long>> histories=new HashMap<>();
        for(int i=0;i<12000;i++) {
            long now=time.addAndGet(random.nextInt(100));String who="u"+random.nextInt(5);List<Long> past=histories.computeIfAbsent(who,k->new ArrayList<>());past.removeIf(t->t<=now-3600);
            boolean expected=past.stream().filter(t->t>now-60).count()<2&&past.size()<3;
            eq(limiter.allow(who),expected);if(expected)past.add(now);if(i%17==0)limiter.cleanup();
        }
        time.set(0);var atomic=new MultiWindowLimiter<String>(List.of(new MultiWindowLimiter.Window(60,2),new MultiWindowLimiter.Window(3600,3)),2,time::get);
        eq(atomic.allow("a"),true);eq(atomic.allow("a"),true);eq(atomic.allow("a"),false);time.set(60);eq(atomic.allow("a"),true);eq(atomic.allow("a"),false);time.set(3600);eq(atomic.allow("a"),true);eq(atomic.allow("a"),true);eq(atomic.allow("a"),false);
        time.set(0);var bounded=new MultiWindowLimiter<String>(List.of(new MultiWindowLimiter.Window(60,10)),1,time::get);eq(bounded.allow("a"),true);eq(bounded.allow("b"),false);time.set(60);eq(bounded.allow("b"),true);eq(bounded.trackedTenants(),1);
        time.set(0);var concurrent=new MultiWindowLimiter<Integer>(List.of(new MultiWindowLimiter.Window(60_000,10)),10,time::get);
        ExecutorService pool=Executors.newFixedThreadPool(12);CountDownLatch start=new CountDownLatch(1);List<Future<Integer>> futures=new ArrayList<>();
        try {
        for(int worker=0;worker<30;worker++){int user=worker%3;futures.add(pool.submit(()->{start.await();int count=0;for(int i=0;i<200;i++)if(concurrent.allow(user))count++;return count;}));}
        start.countDown();int accepted=0;for(Future<Integer> f:futures)accepted+=f.get(30,TimeUnit.SECONDS);eq(accepted,30);
        var shared=new InterviewCaches.TtlLru<Integer,Integer>(20,100,time::get);List<Future<Boolean>> jobs=new ArrayList<>();
        for(int worker=0;worker<12;worker++){int key=worker;jobs.add(pool.submit(()->{for(int i=0;i<1000;i++){shared.put(key,i);if(!shared.get(key).equals(Optional.of(i)))return false;}return true;}));}
        for(Future<Boolean> f:jobs)eq(f.get(30,TimeUnit.SECONDS),true);pool.shutdown();eq(pool.awaitTermination(30,TimeUnit.SECONDS),true);
        time.set(100);eq(shared.size(),0);
        } finally { pool.shutdownNow(); if(!pool.awaitTermination(5,TimeUnit.SECONDS)) throw new AssertionError("pool stuck"); }
        bad(()->new InterviewCaches.Lfu<>(-1));bad(()->new InterviewCaches.BatchLru<>(-1));bad(()->new InterviewCaches.TtlLru<>(1,-1,()->0));bad(()->new MultiWindowLimiter.Window(0,1));
        AtomicLong backward=new AtomicLong(2);var c=new InterviewCaches.TtlLru<String,String>(1,2,backward::get);c.put("k","v");backward.set(1);bad(()->c.get("k"));
        var overflow=new InterviewCaches.TtlLru<String,String>(1,2,()->Long.MAX_VALUE);bad(()->overflow.put("k","v"));
        var zero=new MultiWindowLimiter<String>(List.of(new MultiWindowLimiter.Window(1,0)),1,()->0);eq(zero.allow("x"),false);eq(zero.trackedTenants(),0);
        var different=new MultiWindowLimiter<String>(Map.of("free",List.of(new MultiWindowLimiter.Window(60,1)),"paid",List.of(new MultiWindowLimiter.Window(60,2))),2,()->0);
        eq(different.allow("free"),true);eq(different.allow("free"),false);eq(different.allow("paid"),true);eq(different.allow("paid"),true);eq(different.allow("paid"),false);eq(different.allow("unknown"),false);
        System.out.println("CacheLimiterTest PASS "+checks);
    }
}

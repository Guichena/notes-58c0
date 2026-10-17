import java.util.*;
import java.util.concurrent.*;
public final class TwoStackQueue<E> {
    private final Deque<E> in = new ArrayDeque<>(), out = new ArrayDeque<>();
    public synchronized void offer(E value) { in.push(Objects.requireNonNull(value)); }
    private void transfer() { if(out.isEmpty()) while(!in.isEmpty()) out.push(in.pop()); }
    public synchronized E poll() { transfer(); return out.poll(); }
    public synchronized E peek() { transfer(); return out.peek(); }
    public synchronized int size() { return Math.addExact(in.size(),out.size()); }
    private static void check(boolean v) { if(!v) throw new AssertionError(); }
    public static void main(String[] args) throws Exception {
        TwoStackQueue<Integer> q=new TwoStackQueue<>(); check(q.poll()==null);
        try { q.offer(null); throw new AssertionError(); } catch(NullPointerException expected) { }
        q.offer(1);q.offer(2);check(q.peek()==1);check(q.poll()==1);q.offer(3);
        check(q.poll()==2 && q.poll()==3 && q.size()==0);
        ExecutorService pool=Executors.newFixedThreadPool(4);
        try {
            List<Future<?>> producers=new ArrayList<>();
            for(int p=0;p<4;p++){final int id=p;producers.add(pool.submit(()->{
                for(int i=0;i<5000;i++)q.offer(id*5000+i);
            }));}
            int[] next=new int[4]; int consumed=0; long start=System.nanoTime();
            while(consumed<20000){
                Integer v=q.poll(); if(v==null){
                    if(System.nanoTime()-start>TimeUnit.SECONDS.toNanos(10))throw new AssertionError("deadline");
                    Thread.yield();continue;
                }
                int p=v/5000;check(v%5000==next[p]++);consumed++;
            }
            for(Future<?> f:producers)f.get(10,TimeUnit.SECONDS);check(q.size()==0);
            for(int i=0;i<20000;i++)q.offer(i);
            Set<Integer> seen=ConcurrentHashMap.newKeySet();List<Future<?>> consumers=new ArrayList<>();
            for(int i=0;i<4;i++)consumers.add(pool.submit(()->{Integer v;while((v=q.poll())!=null)check(seen.add(v));}));
            for(Future<?> f:consumers)f.get(10,TimeUnit.SECONDS);check(seen.size()==20000&&q.size()==0);
        } finally {pool.shutdownNow();check(pool.awaitTermination(10,TimeUnit.SECONDS));}
        System.out.println("PASS FIFO/empty/null/interleaved transfer; 20000 concurrent producer and consumer items");
    }
}


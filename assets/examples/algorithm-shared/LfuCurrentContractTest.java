import java.util.*;
import java.lang.reflect.*;
public final class LfuCurrentContractTest {
    static long checks;
    static void ok(boolean b){checks++;if(!b)throw new AssertionError();}
    static void eq(Object a,Object b){checks++;if(!Objects.equals(a,b))throw new AssertionError(a+" != "+b);}
    static Object get(Object x,String name)throws Exception{Field f=x.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(x);}
    static void set(Object x,String name,Object v)throws Exception{Field f=x.getClass().getDeclaredField(name);f.setAccessible(true);f.set(x,v);}
    static void invariant(InterviewCaches.Lfu<Integer,Integer> c,int capacity)throws Exception{
        Map<?,?> entries=(Map<?,?>)get(c,"entries"),buckets=(Map<?,?>)get(c,"buckets");ok(entries.size()<=capacity);ok(buckets.size()<=entries.size());Set<Object> all=Collections.newSetFromMap(new IdentityHashMap<>());long smallest=Long.MAX_VALUE;
        for(var pair:buckets.entrySet()){long freq=(Long)pair.getKey();smallest=Math.min(smallest,freq);Object first=get(pair.getValue(),"first"),last=get(pair.getValue(),"last");ok(first!=null);Object before=null,tail=null;for(Object e=first;e!=null;e=get(e,"after")){ok(all.add(e));eq(get(e,"before"),before);eq(get(e,"frequency"),freq);before=tail=e;}eq(tail,last);}
        eq(all.size(),entries.size());ok(all.containsAll(entries.values()));if(!entries.isEmpty())eq(get(c,"minimum"),smallest);
    }
    static final class Oracle {final int cap;long tick;Map<Integer,int[]> v=new HashMap<>();Map<Integer,Long> f=new HashMap<>(),last=new HashMap<>();Oracle(int n){cap=n;}int get(int k){if(!v.containsKey(k))return -1;f.put(k,f.get(k)+1);last.put(k,++tick);return v.get(k)[0];}void put(int k,int x){if(v.containsKey(k)){get(k);v.get(k)[0]=x;return;}if(cap==0)return;if(v.size()==cap){int victim=v.keySet().stream().min(Comparator.<Integer>comparingLong(f::get).thenComparingLong(last::get)).orElseThrow();v.remove(victim);f.remove(victim);last.remove(victim);}v.put(k,new int[]{x});f.put(k,1L);last.put(k,++tick);}}
    static void forceMax(Object c,String mapName)throws Exception{Map<?,?> entries=(Map<?,?>)get(c,mapName);Object e=entries.values().iterator().next();Map<Object,Object>b=(Map<Object,Object>)get(c,"buckets");Object bucket=b.values().iterator().next();b.clear();b.put(Long.MAX_VALUE,bucket);set(e,"frequency",Long.MAX_VALUE);set(c,"minimum",Long.MAX_VALUE);}
    static void overflow(Runnable r){checks++;try{r.run();throw new AssertionError();}catch(ArithmeticException expected){}}
    public static void main(String[]args)throws Exception{
        Random r=new Random(460155);for(int capacity:new int[]{0,1,2,8}){var generic=new InterviewCaches.Lfu<Integer,Integer>(capacity);var judge=new LFUCache(capacity);var oracle=new Oracle(capacity);for(int t=0;t<100000;t++){int key=r.nextInt(17);if(r.nextBoolean()){int value=r.nextInt(10000);generic.put(key,value);judge.put(key,value);oracle.put(key,value);}else{int expected=oracle.get(key);eq(generic.get(key).orElse(-1),expected);eq(judge.get(key),expected);}if(t%13==0)invariant(generic,capacity);}invariant(generic,capacity);}
        var hot=new InterviewCaches.Lfu<Integer,Integer>(1);hot.put(1,7);for(int i=0;i<200000;i++){eq(hot.get(1).orElseThrow(),7);if(i%101==0)invariant(hot,1);}invariant(hot,1);
        var generic=new InterviewCaches.Lfu<Integer,Integer>(1);generic.put(1,9);forceMax(generic,"entries");Object node=((Map<?,?>)get(generic,"entries")).get(1);overflow(()->generic.get(1));overflow(()->generic.put(1,10));eq(get(node,"value"),9);eq(get(node,"frequency"),Long.MAX_VALUE);invariant(generic,1);
        var judge=new LFUCache(1);judge.put(1,9);forceMax(judge,"nodes");Object judgeNode=((Map<?,?>)get(judge,"nodes")).get(1);overflow(()->judge.get(1));overflow(()->judge.put(1,10));eq(get(judgeNode,"value"),9);eq(get(judgeNode,"frequency"),Long.MAX_VALUE);
        System.out.println("PASS LfuCurrentContractTest checks="+checks+"; 400000 oracle/current-judge/generic operations, 200000 hot-key accesses, no empty buckets, <=C nodes/buckets, exact frequency/LRU, overflow rejects before mutation");
    }
}

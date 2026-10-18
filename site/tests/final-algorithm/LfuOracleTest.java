import java.util.*;
import java.lang.reflect.*;
public class LfuOracleTest {
    static Object field(Object target, String name) throws Exception {
        Field f = target.getClass().getDeclaredField(name); f.setAccessible(true); return f.get(target);
    }
    @SuppressWarnings("unchecked") static Map<Integer, LFUCache.Node> nodes(LFUCache c) throws Exception {
        return (Map<Integer, LFUCache.Node>) field(c, "nodes");
    }
    @SuppressWarnings("unchecked") static Map<Long, LFUCache.Bucket> buckets(LFUCache c) throws Exception {
        return (Map<Long, LFUCache.Bucket>) field(c, "buckets");
    }
    static void verify(LFUCache c, int capacity) throws Exception {
        Map<Integer, LFUCache.Node> ns = nodes(c); Map<Long, LFUCache.Bucket> bs = buckets(c);
        Set<LFUCache.Node> seen = Collections.newSetFromMap(new IdentityHashMap<>());
        long min = Long.MAX_VALUE;
        for (var e : bs.entrySet()) {
            LFUCache.Bucket b = e.getValue(); if (b.isEmpty()) throw new AssertionError("empty bucket retained");
            min = Math.min(min, e.getKey()); LFUCache.Node prev = null;
            for (LFUCache.Node n = b.first; n != null; n = n.next) {
                if (n.prev != prev || n.frequency != e.getKey() || ns.get(n.key) != n || !seen.add(n)) throw new AssertionError("links/frequency");
                prev = n;
            }
            if (prev != b.last) throw new AssertionError("tail");
        }
        if (seen.size() != ns.size() || ns.size() > capacity || bs.size() > ns.size()) throw new AssertionError("size");
        if (!ns.isEmpty() && min != (long)field(c, "minimum")) throw new AssertionError("minimum");
    }
    static final class Ref { int value; long freq=1, time; Ref(int value,long time){this.value=value;this.time=time;} }
    static int tableSize(Map<?,?> map) throws Exception {
        Field f=HashMap.class.getDeclaredField("table"); f.setAccessible(true); Object[] table=(Object[])f.get(map); return table==null?0:table.length;
    }
    public static void main(String[] args) throws Exception {
        Random random = new Random(460); long checks=0;
        for(int cap=0;cap<=20;cap++){
            LFUCache c=new LFUCache(cap); Map<Integer,Ref> ref=new HashMap<>();
            for(int op=1;op<=10000;op++){
                int key=random.nextInt(30); Ref old=ref.get(key);
                if(random.nextBoolean()){
                    int want=-1; if(old!=null){want=old.value;old.freq++;old.time=op;}
                    if(c.get(key)!=want)throw new AssertionError("get oracle");
                } else {
                    int value=random.nextInt(1000); c.put(key,value);
                    if(old!=null){old.value=value;old.freq++;old.time=op;}
                    else if(cap>0){
                        if(ref.size()==cap){
                            int victim=ref.entrySet().stream().min(Comparator.<Map.Entry<Integer,Ref>>comparingLong(e->e.getValue().freq).thenComparingLong(e->e.getValue().time)).orElseThrow().getKey();ref.remove(victim);
                        }
                        ref.put(key,new Ref(value,op));
                    }
                }
                verify(c,cap); if(nodes(c).size()!=ref.size())throw new AssertionError("oracle size");
                for(var e:ref.entrySet()){
                    var n=nodes(c).get(e.getKey()); var r=e.getValue();
                    if(n==null||n.value!=r.value||n.frequency!=r.freq)throw new AssertionError("oracle state");
                }
                checks++;
            }
        }
        for(int cap:new int[]{16,32,64,128,256,512}){
            LFUCache c=new LFUCache(cap);for(int key=0;key<cap;key++)c.put(key,key);
            for(int floor=1;floor<cap;floor++)for(int key=floor;key<cap;key++)c.get(key);
            verify(c,cap);int retained=tableSize(nodes(c))+tableSize(buckets(c));
            if(nodes(c).size()!=cap||buckets(c).size()!=cap||retained>8*cap)throw new AssertionError("retained capacity");
            for(Field f:LFUCache.Bucket.class.getDeclaredFields())if(f.getType().isArray()||Collection.class.isAssignableFrom(f.getType())||Map.class.isAssignableFrom(f.getType()))throw new AssertionError("bucket has collection/array");
            System.out.println("capacity="+cap+" nodes="+nodes(c).size()+" buckets="+buckets(c).size()+" retainedTopLevelSlots="+retained);
        }
        try{new LFUCache(-1);throw new AssertionError("negative capacity");}catch(IllegalArgumentException expected){}
        LFUCache c=new LFUCache(1);c.put(1,7);LFUCache.Node n=nodes(c).get(1);var b=buckets(c).remove(1L);n.frequency=Long.MAX_VALUE;buckets(c).put(Long.MAX_VALUE,b);
        Field min=LFUCache.class.getDeclaredField("minimum");min.setAccessible(true);min.setLong(c,Long.MAX_VALUE);
        for(boolean put:new boolean[]{false,true}){
            try{if(put)c.put(1,9);else c.get(1);throw new AssertionError("overflow");}catch(ArithmeticException expected){}
            if(n.value!=7||n.frequency!=Long.MAX_VALUE)throw new AssertionError("mutated before rejection");verify(c,1);
        }
        System.out.println("PASS "+checks+" independent scan-oracle operations; node/bucket invariants; LRU ties; overwrite; zero/negative capacity; overflow before mutation; retained structure linear family");
    }
}

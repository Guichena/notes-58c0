import java.util.*;
import java.util.function.LongSupplier;

public final class BaselineInterviewCaches {
    private BaselineInterviewCaches() {}
    public static final class MinStack {
        private record Entry(int value,int minimum) {}
        private final Deque<Entry> stack=new ArrayDeque<>();
        public void push(int value){stack.push(new Entry(value,stack.isEmpty()?value:Math.min(value,stack.peek().minimum)));}
        public int pop(){return stack.remove().value;}
        public int peek(){return stack.element().value;}
        public int minimum(){return stack.element().minimum;}
        public boolean isEmpty(){return stack.isEmpty();}
    }
    /** Single-threaded LFU, LRU tie-break, get and overwrite both count as access. */
    public static final class Lfu<K,V> {
        private final int capacity;
        private final Map<K,Entry> entries=new HashMap<>();
        private final Map<Long,Bucket> buckets=new HashMap<>();
        private long minimum;
        private final class Entry {
            final K key;V value;long frequency=1;Entry before,after;
            Entry(K key,V value){this.key=key;this.value=value;}
        }
        private final class Bucket {
            Entry first,last;
            void append(Entry e){e.before=last;if(last==null)first=e;else last.after=e;last=e;}
            void unlink(Entry e){if(e.before==null)first=e.after;else e.before.after=e.after;if(e.after==null)last=e.before;else e.after.before=e.before;e.before=e.after=null;}
            boolean isEmpty(){return first==null;}
        }
        public Lfu(int capacity){if(capacity<0)throw new IllegalArgumentException("capacity");this.capacity=capacity;}
        public Optional<V> get(K key){Objects.requireNonNull(key);Entry e=entries.get(key);if(e==null)return Optional.empty();promote(e);return Optional.of(e.value);}
        public void put(K key,V value){
            Objects.requireNonNull(key);Objects.requireNonNull(value);Entry e=entries.get(key);
            if(e!=null){promote(e);e.value=value;return;}
            if(capacity==0)return;
            if(entries.size()==capacity){Bucket bucket=buckets.get(minimum);Entry oldest=bucket.first;bucket.unlink(oldest);entries.remove(oldest.key);if(bucket.isEmpty())buckets.remove(minimum);}
            Entry added=new Entry(key,value);entries.put(key,added);buckets.computeIfAbsent(1L,x->new Bucket()).append(added);minimum=1;
        }
        private void promote(Entry e){
            long next=Math.addExact(e.frequency,1); // reject before mutation instead of silently saturating LFU
            Bucket old=buckets.get(e.frequency);old.unlink(e);
            if(old.isEmpty()){buckets.remove(e.frequency);if(minimum==e.frequency)minimum=next;}
            e.frequency=next;buckets.computeIfAbsent(next,x->new Bucket()).append(e);
        }
        public int size(){return entries.size();}
    }
    /** Handwritten doubly-linked LRU list plus HashMap; synchronized complete operations. */
    public static final class TtlLru<K,V> {
        private final class Entry {final K key;V value;long deadline;Entry before,after,expiryBefore,expiryAfter;Entry(K key,V value,long deadline){this.key=key;this.value=value;this.deadline=deadline;}}
        private final int capacity;private final long defaultTtl;private final LongSupplier clock;
        private final Map<K,Entry> map=new HashMap<>();
        private final NavigableMap<Long,ExpiryBucket> expiry=new TreeMap<>();
        private final class ExpiryBucket {
            Entry first,last;
            void append(Entry e){e.expiryBefore=last;if(last==null)first=e;else last.expiryAfter=e;last=e;}
            void unlink(Entry e){if(e.expiryBefore==null)first=e.expiryAfter;else e.expiryBefore.expiryAfter=e.expiryAfter;if(e.expiryAfter==null)last=e.expiryBefore;else e.expiryAfter.expiryBefore=e.expiryBefore;e.expiryBefore=e.expiryAfter=null;}
            boolean isEmpty(){return first==null;}
        }
        private Entry oldest,newest;private boolean haveTime;private long lastTime;
        public TtlLru(int capacity,long ttl,LongSupplier clock){if(capacity<0||ttl<0)throw new IllegalArgumentException("capacity/ttl");this.capacity=capacity;this.defaultTtl=ttl;this.clock=Objects.requireNonNull(clock);}
        private long now(){long t=clock.getAsLong();if(haveTime&&t<lastTime)throw new IllegalArgumentException("clock moved backward");haveTime=true;lastTime=t;return t;}
        public synchronized Optional<V> get(K key){Objects.requireNonNull(key);purge(now());Entry e=map.get(key);if(e==null)return Optional.empty();unlink(e);append(e);return Optional.of(e.value);}
        public synchronized void put(K key,V value){put(key,value,defaultTtl);}
        public synchronized void put(K key,V value,long ttl){
            Objects.requireNonNull(key);Objects.requireNonNull(value);if(ttl<0)throw new IllegalArgumentException("ttl");
            long time=now(),deadline=Math.addExact(time,ttl);purge(time);
            Entry existing=map.get(key);if(existing!=null)remove(existing);
            if(ttl==0||capacity==0)return;
            if(map.size()==capacity)remove(oldest);
            Entry e=new Entry(key,value,deadline);map.put(key,e);append(e);expiry.computeIfAbsent(deadline,x->new ExpiryBucket()).append(e);
        }
        /** Returns number removed; expired entries are purged first and are not counted in evict(n). */
        public synchronized int evict(int n){if(n<0)throw new IllegalArgumentException("n");purge(now());int count=0;while(count<n&&oldest!=null){remove(oldest);count++;}return count;}
        public synchronized int size(){purge(now());return map.size();}
        public synchronized List<K> keysOldestFirst(){purge(now());List<K> out=new ArrayList<>();for(Entry e=oldest;e!=null;e=e.after)out.add(e.key);return List.copyOf(out);}
        private void purge(long time){while(!expiry.isEmpty()&&expiry.firstKey()<=time){ExpiryBucket due=expiry.pollFirstEntry().getValue();while(!due.isEmpty()){Entry e=due.first;due.unlink(e);map.remove(e.key);unlink(e);}}}
        private void remove(Entry e){map.remove(e.key);unlink(e);ExpiryBucket bucket=expiry.get(e.deadline);bucket.unlink(e);if(bucket.isEmpty())expiry.remove(e.deadline);}
        private void unlink(Entry e){if(e.before==null)oldest=e.after;else e.before.after=e.after;if(e.after==null)newest=e.before;else e.after.before=e.before;e.before=e.after=null;}
        private void append(Entry e){e.before=newest;if(newest==null)oldest=e;else newest.after=e;newest=e;}
    }
    /** Pure LRU batch deletion O(number removed), with no TTL index. */
    public static final class BatchLru<K,V> {
        private final int capacity;private final Map<K,Node<K,V>> map=new HashMap<>();private Node<K,V> head,tail;
        private static final class Node<K,V>{final K key;V value;Node<K,V> prev,next;Node(K k,V v){key=k;value=v;}}
        public BatchLru(int capacity){if(capacity<0)throw new IllegalArgumentException("capacity");this.capacity=capacity;}
        public Optional<V> get(K key){Objects.requireNonNull(key);Node<K,V> n=map.get(key);if(n==null)return Optional.empty();unlink(n);append(n);return Optional.of(n.value);}
        public void put(K key,V value){Objects.requireNonNull(key);Objects.requireNonNull(value);Node<K,V> n=map.get(key);if(n!=null){n.value=value;unlink(n);append(n);return;}if(capacity==0)return;if(map.size()==capacity)evict(1);n=new Node<>(key,value);map.put(key,n);append(n);}
        public int evict(int n){if(n<0)throw new IllegalArgumentException("n");int count=0;while(count<n&&head!=null){Node<K,V> old=head;unlink(old);map.remove(old.key);count++;}return count;}
        public int size(){return map.size();}
        private void unlink(Node<K,V> n){if(n.prev==null)head=n.next;else n.prev.next=n.next;if(n.next==null)tail=n.prev;else n.next.prev=n.prev;n.prev=n.next=null;}
        private void append(Node<K,V> n){n.prev=tail;if(tail==null)head=n;else tail.next=n;tail=n;}
    }
    /** Most recent distinct players in arrival order, newest first. */
    public static final class RecentPlayers<K> {
        private final int capacity;private final LinkedHashSet<K> players=new LinkedHashSet<>();
        public RecentPlayers(int capacity){if(capacity<0)throw new IllegalArgumentException("capacity");this.capacity=capacity;}
        public void seen(K player){Objects.requireNonNull(player);players.remove(player);if(capacity==0)return;players.add(player);if(players.size()>capacity)players.remove(players.iterator().next());}
        public List<K> newestFirst(){List<K> out=new ArrayList<>(players);Collections.reverse(out);return out;}
    }
}

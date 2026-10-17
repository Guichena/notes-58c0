import java.util.*;

/** Single-threaded int-to-int map, geometric p=1/2 towers, not a concurrent map. */
public final class SimpleSkipList {
    private static final int MAX_LEVEL = 32;
    private static final class Node {
        final int key; int value; final Node[] next;
        Node(int key, int value, int level) { this.key=key; this.value=value; next=new Node[level]; }
    }
    private final Node head = new Node(0,0,MAX_LEVEL);
    private final Random random;
    private int levels=1, size;
    public SimpleSkipList(Random random) { this.random=Objects.requireNonNull(random); }
    public int size() { return size; }
    public OptionalInt get(int key) {
        Node p=head;
        for (int l=levels-1;l>=0;l--) while (p.next[l]!=null && p.next[l].key<key) p=p.next[l];
        p=p.next[0];
        return p!=null && p.key==key ? OptionalInt.of(p.value) : OptionalInt.empty();
    }
    public boolean put(int key,int value) {
        Node[] before=new Node[MAX_LEVEL]; Node p=head;
        for (int l=levels-1;l>=0;l--) {
            while (p.next[l]!=null && p.next[l].key<key) p=p.next[l];
            before[l]=p;
        }
        Node old=p.next[0];
        if (old!=null && old.key==key) { old.value=value; return false; }
        int height=1;
        while (height<MAX_LEVEL && random.nextBoolean()) height++;
        if (height>levels) {
            for (int l=levels;l<height;l++) before[l]=head;
            levels=height;
        }
        Node x=new Node(key,value,height);
        for (int l=0;l<height;l++) { x.next[l]=before[l].next[l]; before[l].next[l]=x; }
        size++; return true;
    }
    public boolean remove(int key) {
        Node[] before=new Node[MAX_LEVEL]; Node p=head;
        for (int l=levels-1;l>=0;l--) {
            while (p.next[l]!=null && p.next[l].key<key) p=p.next[l];
            before[l]=p;
        }
        Node x=p.next[0];
        if (x==null || x.key!=key) return false;
        for (int l=0;l<x.next.length;l++) before[l].next[l]=x.next[l];
        while (levels>1 && head.next[levels-1]==null) levels--;
        size--; return true;
    }
    private void verify(TreeMap<Integer,Integer> oracle) {
        List<Node> bottom=new ArrayList<>();
        Iterator<Map.Entry<Integer,Integer>> expected=oracle.entrySet().iterator();
        for (Node n=head.next[0];n!=null;n=n.next[0]) {
            if (!expected.hasNext()) throw new AssertionError("extra node");
            Map.Entry<Integer,Integer> e=expected.next();
            if (n.key!=e.getKey() || n.value!=e.getValue()) throw new AssertionError("contents");
            bottom.add(n);
        }
        if (expected.hasNext() || size!=oracle.size()) throw new AssertionError("size");
        for (int l=0;l<MAX_LEVEL;l++) {
            Node p=head.next[l];
            for (Node n:bottom) if (n.next.length>l) {
                if (p!=n) throw new AssertionError("tower identity");
                p=p.next[l];
            }
            if (p!=null) throw new AssertionError("extra tower");
        }
        if (levels>1 && head.next[levels-1]==null) throw new AssertionError("empty top level");
    }
    public static void main(String[] args) {
        SimpleSkipList map=new SimpleSkipList(new Random(1386));
        TreeMap<Integer,Integer> oracle=new TreeMap<>(); Random r=new Random(1391);
        for (int t=0;t<30000;t++) {
            int key=t==0?Integer.MIN_VALUE:t==1?Integer.MAX_VALUE:r.nextInt(2001)-1000;
            if (t<2 || r.nextBoolean()) {
                int v=r.nextInt(); boolean inserted=!oracle.containsKey(key); oracle.put(key,v);
                if (map.put(key,v)!=inserted) throw new AssertionError();
            } else if (map.remove(key)!=(oracle.remove(key)!=null)) throw new AssertionError();
            Integer v=oracle.get(key);
            if (!map.get(key).equals(v==null?OptionalInt.empty():OptionalInt.of(v))) throw new AssertionError();
            if (t%33==0) map.verify(oracle);
        }
        map.verify(oracle);
        for (int key:new ArrayList<>(oracle.keySet())) { map.remove(key); oracle.remove(key); }
        map.verify(oracle);
        if (map.levels!=1 || map.remove(0) || map.get(0).isPresent()) throw new AssertionError();
        System.out.println("PASS 30000 operations vs TreeMap; all tower identity/order invariants; updates/extremes/full deletion/top shrink");
    }
}

import java.util.*;

/** Insert/update-only in-memory B+ tree model. No deletion, concurrency or disk pages. */
public final class BPlusTree {
    private static final class Node {
        final boolean leaf;
        final List<Integer> keys=new ArrayList<>();
        final List<String> values=new ArrayList<>();
        final List<Node> children=new ArrayList<>();
        Node next;
        Node(boolean leaf){this.leaf=leaf;}
    }
    private record Split(int separator,Node right){}
    public record Entry(int key,String value){}
    private final int maxKeys;
    private Node root=new Node(true);
    public BPlusTree(int maxKeys){
        if(maxKeys<3)throw new IllegalArgumentException("maxKeys >= 3");
        this.maxKeys=maxKeys;
    }
    private static int lower(List<Integer> keys,int key){
        int l=0,r=keys.size();
        while(l<r){int m=(l+r)>>>1;if(keys.get(m)<key)l=m+1;else r=m;}
        return l;
    }
    private static int upper(List<Integer> keys,int key){
        int l=0,r=keys.size();
        while(l<r){int m=(l+r)>>>1;if(keys.get(m)<=key)l=m+1;else r=m;}
        return l;
    }
    public void put(int key,String value){
        Objects.requireNonNull(value);
        Split s=insert(root,key,value);
        if(s!=null){Node parent=new Node(false);parent.keys.add(s.separator());
            parent.children.add(root);parent.children.add(s.right());root=parent;}
    }
    private Split insert(Node n,int key,String value){
        if(n.leaf){
            int p=lower(n.keys,key);
            if(p<n.keys.size() && n.keys.get(p)==key){n.values.set(p,value);return null;}
            n.keys.add(p,key);n.values.add(p,value);
            if(n.keys.size()<=maxKeys)return null;
            int mid=n.keys.size()/2;Node right=new Node(true);
            right.keys.addAll(n.keys.subList(mid,n.keys.size()));
            right.values.addAll(n.values.subList(mid,n.values.size()));
            n.keys.subList(mid,n.keys.size()).clear();n.values.subList(mid,n.values.size()).clear();
            right.next=n.next;n.next=right;
            return new Split(right.keys.get(0),right); // copy separator; keep leaf record
        }
        int p=upper(n.keys,key);Split child=insert(n.children.get(p),key,value);
        if(child==null)return null;
        n.keys.add(p,child.separator());n.children.add(p+1,child.right());
        if(n.keys.size()<=maxKeys)return null;
        int mid=n.keys.size()/2,promoted=n.keys.get(mid);Node right=new Node(false);
        right.keys.addAll(n.keys.subList(mid+1,n.keys.size()));
        right.children.addAll(n.children.subList(mid+1,n.children.size()));
        n.keys.subList(mid,n.keys.size()).clear();n.children.subList(mid+1,n.children.size()).clear();
        return new Split(promoted,right); // promoted separator removed from internal child
    }
    public String get(int key){
        Node n=root;while(!n.leaf)n=n.children.get(upper(n.keys,key));
        int p=lower(n.keys,key);return p<n.keys.size() && n.keys.get(p)==key?n.values.get(p):null;
    }
    /** Inclusive low, exclusive high; an inverted/empty interval returns empty. */
    public List<Entry> range(int low,int high){
        List<Entry> result=new ArrayList<>();if(low>=high)return result;
        Node n=root;while(!n.leaf)n=n.children.get(upper(n.keys,low));
        int p=lower(n.keys,low);
        while(n!=null){for(;p<n.keys.size();p++){
            int k=n.keys.get(p);if(k>=high)return result;result.add(new Entry(k,n.values.get(p)));
        }n=n.next;p=0;}
        return result;
    }
    public int height(){int h=1;Node n=root;while(!n.leaf){h++;n=n.children.get(0);}return h;}
    public void validate(){
        List<Node> leaves=new ArrayList<>();int[] depth={-1};validate(root,true,0,depth,leaves);
        for(int i=0;i<leaves.size();i++){
            Node expected=i+1<leaves.size()?leaves.get(i+1):null;
            require(leaves.get(i).next==expected,"leaf chain");
            if(expected!=null)require(leaves.get(i).keys.get(leaves.get(i).keys.size()-1)<expected.keys.get(0),"leaf order");
        }
    }
    private int validate(Node n,boolean isRoot,int d,int[] depth,List<Node> leaves){
        require(n.keys.size()<=maxKeys,"capacity");
        if(!isRoot)require(n.keys.size()>=(n.leaf?maxKeys/2+maxKeys%2:maxKeys/2),"occupancy");
        for(int i=1;i<n.keys.size();i++)require(n.keys.get(i-1)<n.keys.get(i),"key order");
        if(n.leaf){require(n.children.isEmpty() && n.values.size()==n.keys.size(),"leaf shape");
            if(depth[0]<0)depth[0]=d;require(depth[0]==d,"balanced leaf depth");leaves.add(n);
            return n.keys.isEmpty()?0:n.keys.get(0);
        }
        require(n.values.isEmpty() && n.children.size()==n.keys.size()+1 && !n.keys.isEmpty(),"internal shape");
        int min=validate(n.children.get(0),false,d+1,depth,leaves);
        for(int i=1;i<n.children.size();i++)require(n.keys.get(i-1)==validate(n.children.get(i),false,d+1,depth,leaves),"separator");
        return min;
    }
    private static void require(boolean b,String message){if(!b)throw new AssertionError(message);}
}

import java.util.*;

public final class SortedListIntersection {
    private SortedListIntersection() { }
    public static final class Node {
        public int value;
        public Node next;
        public Node(int value) { this.value = value; }
    }
    // Non-null heads collection; each list is sorted and acyclic; null heads allowed.
    // Set intersection: each common value once, no input mutation; O(K+N), O(K) workspace.
    public static List<Integer> sortedListIntersection(List<Node> heads){
        if(heads.isEmpty())return List.of();Node[]p=heads.toArray(Node[]::new);List<Integer>out=new ArrayList<>();
        while(true){for(Node x:p)if(x==null)return out;int target=p[0].value;for(Node x:p)target=Math.max(target,x.value);boolean equal=true;for(int i=0;i<p.length;i++){while(p[i]!=null&&p[i].value<target)p[i]=p[i].next;if(p[i]==null)return out;if(p[i].value!=target)equal=false;}if(equal){out.add(target);for(int i=0;i<p.length;i++)while(p[i]!=null&&p[i].value==target)p[i]=p[i].next;}}
    }
}

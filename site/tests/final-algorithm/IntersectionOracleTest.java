import java.util.*;
public class IntersectionOracleTest {
    static final List<int[]> CHOICES=new ArrayList<>();static long cases;
    static void choices(int[] row,int at,int min){if(at==row.length){CHOICES.add(row.clone());return;}for(int v=min;v<3;v++){row[at]=v;choices(row,at+1,v);}}
    static void check(List<int[]> values){
        List<SortedListIntersection.Node> heads=new ArrayList<>();IdentityHashMap<SortedListIntersection.Node,SortedListIntersection.Node> next=new IdentityHashMap<>();
        Set<Integer> common=null;
        for(int[] a:values){SortedListIntersection.Node head=null,tail=null;Set<Integer> set=new TreeSet<>();
            for(int x:a){set.add(x);var node=new SortedListIntersection.Node(x);if(head==null)head=node;else tail.next=node;tail=node;}
            for(var node=head;node!=null;node=node.next)next.put(node,node.next);heads.add(head);if(common==null)common=set;else common.retainAll(set);
        }
        List<Integer> want=common==null?List.of():new ArrayList<>(common);List<Integer> got=SortedListIntersection.sortedListIntersection(heads);
        if(!got.equals(want))throw new AssertionError("set oracle");for(var e:next.entrySet())if(e.getKey().next!=e.getValue())throw new AssertionError("input mutated");cases++;
    }
    static void enumerate(int remaining,List<int[]> current){if(remaining==0){check(current);return;}for(int[] choice:CHOICES){current.add(choice);enumerate(remaining-1,current);current.remove(current.size()-1);}}
    public static void main(String[] args){
        for(int n=0;n<=3;n++)choices(new int[n],0,0);
        for(int k=0;k<=4;k++)enumerate(k,new ArrayList<>());
        check(List.of(new int[]{Integer.MIN_VALUE,Integer.MIN_VALUE,0,Integer.MAX_VALUE},new int[]{Integer.MIN_VALUE,Integer.MAX_VALUE}));
        check(Collections.nCopies(100000,new int[0]));
        System.out.println("PASS "+cases+" Java executions against independent TreeSet intersection; input links unchanged; empty lists; 100000 empty heads; integer extremes");
    }
}

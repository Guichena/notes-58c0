import java.util.*;
public class InteriorContractTest {
 static int count; static final int[] VALUES={Integer.MIN_VALUE,-1,0,1,Integer.MAX_VALUE};
 static List<Integer> oracle(int[] a){List<Integer> out=new ArrayList<>();for(int i=1;i<a.length-1;i++){boolean ok=true;for(int j=0;j<i;j++)ok &= a[j]<a[i];for(int j=i+1;j<a.length;j++)ok &= a[j]>a[i];if(ok)out.add(a[i]);}return out;}
 static void enumerate(int[] a,int i){if(i==a.length){List<Integer> expected=oracle(a),actual=new Solution().findQualifiedElements(a);if(!expected.equals(actual))throw new AssertionError(Arrays.toString(a)+" expected="+expected+" actual="+actual);count++;return;}for(int v:VALUES){a[i]=v;enumerate(a,i+1);}}
 public static void main(String[] args){for(int n=0;n<=7;n++)enumerate(new int[n],0);if(!new Solution().findQualifiedElements(new int[]{1,2,3}).equals(List.of(2)))throw new AssertionError("Endpoints must be excluded");System.out.println("PASS "+count+" actual Java cases; endpoints excluded; strict comparisons; MIN/MAX covered");}
}

import java.util.*;
public class Lc47OracleTest {
    static void brute(int[] a,int at,Set<List<Integer>> out){
        if(at==a.length){List<Integer> row=new ArrayList<>();for(int x:a)row.add(x);out.add(row);return;}
        for(int i=at;i<a.length;i++){int x=a[at];a[at]=a[i];a[i]=x;brute(a,at+1,out);x=a[at];a[at]=a[i];a[i]=x;}
    }
    static void check(int[] input){
        Set<List<Integer>> want=new HashSet<>();brute(input.clone(),0,want);int[] copy=input.clone();
        List<List<Integer>> got=new Solution().permuteUnique(copy);Set<List<Integer>> distinct=new HashSet<>(got);
        if(got.size()!=distinct.size()||!distinct.equals(want))throw new AssertionError(Arrays.toString(input));
        int[] sorted=input.clone();Arrays.sort(sorted);if(!Arrays.equals(copy,sorted))throw new AssertionError("sort contract");
    }
    public static void main(String[] args){
        long count=0;for(int n=0;n<=6;n++){int combinations=(int)Math.pow(3,n);for(int t=0;t<combinations;t++){int[] a=new int[n];int x=t;for(int i=0;i<n;i++){a[i]=x%3-1;x/=3;}check(a);count++;}}
        check(new int[]{Integer.MAX_VALUE,Integer.MIN_VALUE,Integer.MAX_VALUE});check(new int[]{1,1,2});check(new int[]{0,1,2,3,4,5,6,7});
        System.out.println("PASS "+count+" exhaustive arrays plus extremes and n=8; independent positional-permutation set oracle; no duplicates; sorting side effect");
    }
}

import java.util.*;

/** Current XX substring and weighted-meeting snippets only; unrelated historical methods stay archived. */
public final class ArrayMissing {
    private ArrayMissing() {}
    public record Meeting(int start,int end,long profit){}
    public static String longestSquareSubstring(String s){int best=0,start=0;for(int d=1;d<=s.length()/2;d++){int run=0;for(int i=s.length()-d-1;i>=0;i--){run=s.charAt(i)==s.charAt(i+d)?run+1:0;if(run>=d&&(2*d>best||2*d==best&&i<start)){best=2*d;start=i;}}}return s.substring(start,start+best);}
    public static long weightedMeetings(Meeting[] input){Meeting[] a=input.clone();for(Meeting m:a)if(m.start>=m.end||m.profit<0)throw new IllegalArgumentException("positive-duration/nonnegative-profit");Arrays.sort(a,Comparator.comparingInt(Meeting::end));long[] dp=new long[a.length+1];
        for(int i=0;i<a.length;i++){int l=0,r=i;while(l<r){int mid=(l+r)>>>1;if(a[mid].end<=a[i].start)l=mid+1;else r=mid;}dp[i+1]=Math.max(dp[i],Math.addExact(dp[l],a[i].profit));}return dp[a.length];}
}

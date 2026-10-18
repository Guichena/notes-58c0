import java.util.*;
public final class ArrayMissingTest {
    static int checks;
    static void eq(Object a,Object b){checks++;if(!Objects.equals(a,b))throw new AssertionError(a+" != "+b);}
    static void bad(Class<? extends Throwable> type,Runnable r){checks++;try{r.run();throw new AssertionError("not rejected");}catch(Throwable t){if(!type.isInstance(t))throw new AssertionError(t);}}
    static String brute(String s){int best=0,start=0;for(int i=0;i<s.length();i++)for(int d=1;i+2*d<=s.length();d++)if(s.regionMatches(i,s,i+d,d)&&2*d>best){best=2*d;start=i;}return s.substring(start,start+best);}
    static long brute(ArrayMissing.Meeting[] a){long best=0;for(int mask=0;mask<(1<<a.length);mask++){long total=0;boolean ok=true;for(int i=0;i<a.length;i++)if((mask&(1<<i))!=0){total+=a[i].profit();for(int j=0;j<i;j++)if((mask&(1<<j))!=0&&a[i].start()<a[j].end()&&a[j].start()<a[i].end())ok=false;}if(ok)best=Math.max(best,total);}return best;}
    public static void main(String[]args){
        for(int n=0;n<=9;n++){int count=1;for(int i=0;i<n;i++)count*=3;for(int v=0;v<count;v++){int x=v;StringBuilder s=new StringBuilder();for(int i=0;i<n;i++){s.append((char)('a'+x%3));x/=3;}eq(ArrayMissing.longestSquareSubstring(s.toString()),brute(s.toString()));}}
        for(String s:List.of("", "abc", "abbabb", "ababa", "aaaaa", "ababcdcd", "\uD83D\uDE00\uD83D\uDE00", "\uD83D\uD83D"))eq(ArrayMissing.longestSquareSubstring(s),brute(s));
        Random r=new Random(43155);for(int t=0;t<4000;t++){ArrayMissing.Meeting[] a=new ArrayMissing.Meeting[r.nextInt(11)];for(int i=0;i<a.length;i++){int start=r.nextInt(17)-8;a[i]=new ArrayMissing.Meeting(start,start+1+r.nextInt(6),r.nextInt(30));}ArrayMissing.Meeting[] saved=a.clone();eq(ArrayMissing.weightedMeetings(a),brute(a));eq(Arrays.asList(a),Arrays.asList(saved));}
        eq(ArrayMissing.weightedMeetings(new ArrayMissing.Meeting[0]),0L);eq(ArrayMissing.weightedMeetings(new ArrayMissing.Meeting[]{new ArrayMissing.Meeting(1,3,5),new ArrayMissing.Meeting(3,4,6),new ArrayMissing.Meeting(1,4,10)}),11L);
        eq(ArrayMissing.weightedMeetings(new ArrayMissing.Meeting[]{new ArrayMissing.Meeting(Integer.MIN_VALUE,0,Long.MAX_VALUE)}),Long.MAX_VALUE);
        bad(IllegalArgumentException.class,()->ArrayMissing.weightedMeetings(new ArrayMissing.Meeting[]{new ArrayMissing.Meeting(1,1,0)}));bad(IllegalArgumentException.class,()->ArrayMissing.weightedMeetings(new ArrayMissing.Meeting[]{new ArrayMissing.Meeting(2,1,0)}));bad(IllegalArgumentException.class,()->ArrayMissing.weightedMeetings(new ArrayMissing.Meeting[]{new ArrayMissing.Meeting(1,2,-1)}));bad(ArithmeticException.class,()->ArrayMissing.weightedMeetings(new ArrayMissing.Meeting[]{new ArrayMissing.Meeting(0,1,Long.MAX_VALUE),new ArrayMissing.Meeting(1,2,1)}));
        System.out.println("PASS ArrayMissingTest checks="+checks+"; exhaustive XX lengths 0..9 over abc, leftmost ties/UTF-16, 4000 weighted brute-force/nonmutation rounds, half-open/zero/invalid/overflow boundaries");
    }
}

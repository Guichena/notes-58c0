import java.util.*;
public class Lc30OracleTest {
    static List<Integer> oracle(String s,String[] words){
        List<Integer> out=new ArrayList<>();int length=words[0].length();long total=(long)length*words.length;
        Map<String,Integer> want=new TreeMap<>();for(String w:words)want.merge(w,1,Integer::sum);
        for(int i=0;i+total<=s.length();i++){
            Map<String,Integer> got=new TreeMap<>();
            for(int j=0;j<words.length;j++)got.merge(s.substring(i+j*length,i+(j+1)*length),1,Integer::sum);
            if(got.equals(want))out.add(i);
        }
        return out;
    }
    static void check(Solution c,String s,String[] words){
        List<Integer> got=c.findSubstring(s,words);Collections.sort(got);
        if(!got.equals(oracle(s,words)))throw new AssertionError(s+Arrays.toString(words)+" got "+got);
    }
    public static void main(String[] args){
        Solution c=new Solution();Random random=new Random(30);
        for(int t=0;t<20000;t++){
            int l=1+random.nextInt(4),m=1+random.nextInt(6),n=random.nextInt(45);StringBuilder s=new StringBuilder();
            for(int i=0;i<n;i++)s.append((char)('a'+random.nextInt(3)));String[] words=new String[m];
            for(int j=0;j<m;j++){StringBuilder w=new StringBuilder();for(int i=0;i<l;i++)w.append((char)('a'+random.nextInt(3)));words[j]=w.toString();}
            check(c,s.toString(),words);
        }
        check(c,"barfoofoobarthefoobarman",new String[]{"bar","foo","the"});
        check(c,"wordgoodgoodgoodbestword",new String[]{"word","good","best","good"});
        check(c,"aaaaaaaa",new String[]{"aa","aa"});
        if(!c.findSubstring("aaaaa",new String[]{"aa"}).equals(List.of(0,2,1,3)))throw new AssertionError("offset order changed");
        if(!c.findSubstring(null,new String[]{"a"}).isEmpty()||!c.findSubstring("a",null).isEmpty()||!c.findSubstring("a",new String[0]).isEmpty())throw new AssertionError("empty/null contract");
        for(String[] bad:new String[][]{{""},{"a","bb"}}){try{c.findSubstring("a",bad);throw new AssertionError("invalid words");}catch(IllegalArgumentException expected){}}
        for(String[] bad:new String[][]{{null},{"a",null}}){try{c.findSubstring("a",bad);throw new AssertionError("null word");}catch(NullPointerException expected){}}
        String huge="a".repeat(50000);String[] many=new String[50000];Arrays.fill(many,huge);
        if(!c.findSubstring("a",many).isEmpty())throw new AssertionError("long length multiplication");
        for(int m:new int[]{16,32,64,128,256,512}){
            int l=4;String[] words=new String[m];StringBuilder input=new StringBuilder();
            for(int j=0;j<m;j++){int x=j;char[] w={'a','a','a','a'};for(int i=0;i<l;i++){w[i]=(char)('a'+x%20);x/=20;}words[j]=new String(w);input.append(words[j]);}
            for(int j=0;j<m;j++)input.append(words[0]).append("zzzz");
            InstrumentedSolution instrumented=new InstrumentedSolution();List<Integer> got=instrumented.findSubstring(input.toString(),words);Collections.sort(got);
            if(!got.equals(List.of(0,4)))throw new AssertionError("alternation result "+got);
            if(instrumented.incoming>input.length()||instrumented.removed>instrumented.incoming)throw new AssertionError("amortized visits");
            if(m<=64)check(c,input.toString(),words);
            System.out.println("words="+m+" inputChars="+input.length()+" incoming="+instrumented.incoming+" removed="+instrumented.removed);
        }
        System.out.println("PASS 20000 independent per-start multiset oracles; repeated/overlapping words; offsets; invalid inputs; long product; actual-code token-visit family");
    }
}

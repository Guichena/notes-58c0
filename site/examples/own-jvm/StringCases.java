public final class StringCases {
    public static void main(String[] args) {
        String s1="abc";
        String s2=new String("abc");
        String s3=s1+"";
        if(s1==s2 || s1==s3 || !s1.equals(s2) || !s1.equals(s3)) throw new AssertionError();
        final String constant="abc";
        String folded=constant+"";
        if(folded!=s1 || ("a"+"bc")!=s1 || s2.intern()!=s1) throw new AssertionError();
        final String notConstant=new String("abc");
        String runtime=notConstant+"";
        if(runtime==notConstant || runtime==s1 || !runtime.equals(s1)) throw new AssertionError();
        char[] input={'a','b','c'};
        String copy=new String(input);input[0]='z';
        if(!copy.equals("abc")) throw new AssertionError();
        String unicode="A\uD83D\uDE00";
        if(unicode.length()!=3 || unicode.codePointCount(0,unicode.length())!=2) throw new AssertionError();
        System.out.println("PASS: ordinary runtime concat=false, constant concat=true, final nonconstant=false, intern=true, defensive copy, UTF16 units");
    }
}

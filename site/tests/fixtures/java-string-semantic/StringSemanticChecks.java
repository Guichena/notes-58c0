import java.text.BreakIterator;
import java.util.Locale;

public class StringSemanticChecks {
    private static int checks = 0;
    private static void check(boolean condition, String description) {
        checks++;
        if (!condition) throw new AssertionError(description);
        System.out.println("PASS " + description);
    }

    private static String load() { return "abc"; }

    public static void main(String[] args) {
        String s1 = "abc";
        String s2 = new String("abc");
        String s3 = s1 + "";
        check(s1 != s2 && s1.equals(s2), "new identity vs equal content");
        check(s1 != s3 && s1.equals(s3), "ordinary/effectively-final variable plus empty string");
        check("a" + "b" == "ab", "constant folding");
        final String constant = "abc";
        final String constructed = new String("abc");
        final String returned = load();
        check(constant + "" == constant, "final constant expression");
        check(constructed + "" != constructed, "final constructor is not constant variable");
        check(returned + "" != returned, "final method return is not constant variable");
        check(s2.intern() == s1, "intern returns pre-existing canonical literal");
        s2.intern();
        check(s2 != s1, "ignored intern result does not rebind receiver variable");
        String h1 = "hello";
        String h2 = h1;
        h2 += "world";
        check(h1.equals("hello") && h2.equals("helloworld") && h1 != h2, "compound concatenation rebinds only h2");
        char[] chars = {'a', 'b'};
        String fromChars = new String(chars);
        chars[0] = 'x';
        check(fromChars.equals("ab"), "defensive copy of char array");
        String n1 = new String("abc");
        String n2 = new String("abc");
        check(n1 != n2 && n1.equals(n2), "two new String identities");
        String empty = new String();
        check(empty != "" && empty.equals(""), "no-argument String constructor");
        String supplementary = "A\uD83D\uDE00";
        check(supplementary.length() == 3, "UTF-16 code-unit length");
        check(supplementary.codePointCount(0, supplementary.length()) == 2, "supplementary code-point count");
        String combined = "e\u0301";
        BreakIterator boundaries = BreakIterator.getCharacterInstance(Locale.ROOT);
        boundaries.setText(combined);
        boundaries.first();
        check(combined.codePointCount(0, combined.length()) == 2
            && boundaries.next() == combined.length()
            && boundaries.next() == BreakIterator.DONE,
            "a grapheme cluster may contain multiple code points");
        System.out.println("PASS total=" + checks);
    }
}

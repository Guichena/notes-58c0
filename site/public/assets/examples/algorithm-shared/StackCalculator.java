import java.math.BigInteger;
import java.util.*;

/** Integer arithmetic; whitespace = ASCII space/tab/CR/LF. Division truncates toward zero. */
public final class StackCalculator {
    private StackCalculator() {}
    private static int precedence(char op){return op=='P'||op=='N'?3:op=='*'||op=='/'?2:op=='+'||op=='-'?1:0;}
    private static void apply(ArrayDeque<BigInteger> values,char op){
        if(op=='P'||op=='N'){if(values.isEmpty())throw new IllegalArgumentException("missing operand");BigInteger x=values.pop();values.push(op=='N'?x.negate():x);return;}
        if(values.size()<2)throw new IllegalArgumentException("missing operands");
        BigInteger b=values.pop(),a=values.pop();
        values.push(switch(op){case '+'->a.add(b);case '-'->a.subtract(b);case '*'->a.multiply(b);case '/'->a.divide(b);default->throw new IllegalArgumentException("operator");});
    }
    private static void unary(ArrayDeque<BigInteger> values,ArrayDeque<Character> operators){while(!operators.isEmpty()&&(operators.peek()=='P'||operators.peek()=='N'))apply(values,operators.pop());}
    /** LC227-style syntax: unsigned integer literals, binary + - * /, no parentheses/unary. */
    public static BigInteger basic(String text,int maximumCharacters){return parse(text,maximumCharacters,false);}
    /** Extended grammar adds parentheses and prefix unary +/-; all other tokens remain rejected. */
    public static BigInteger extended(String text,int maximumCharacters){return parse(text,maximumCharacters,true);}
    private static BigInteger parse(String text,int maximumCharacters,boolean extended){
        Objects.requireNonNull(text);if(maximumCharacters<0||text.length()>maximumCharacters)throw new IllegalArgumentException("input limit");
        ArrayDeque<BigInteger> values=new ArrayDeque<>();ArrayDeque<Character> operators=new ArrayDeque<>();boolean operand=true;
        for(int i=0;i<text.length();){char c=text.charAt(i);
            if(c==' '||c=='\t'||c=='\r'||c=='\n'){i++;continue;}
            if(c>='0'&&c<='9'){
                if(!operand)throw new IllegalArgumentException("missing operator at "+i);BigInteger x=BigInteger.ZERO;
                do{x=x.multiply(BigInteger.TEN).add(BigInteger.valueOf(text.charAt(i)-'0'));i++;}while(i<text.length()&&text.charAt(i)>='0'&&text.charAt(i)<='9');
                values.push(x);unary(values,operators);operand=false;continue;
            }
            if(extended&&c=='('){if(!operand)throw new IllegalArgumentException("missing operator");operators.push(c);i++;continue;}
            if(extended&&c==')'){
                if(operand)throw new IllegalArgumentException("empty/missing operand");while(!operators.isEmpty()&&operators.peek()!='(')apply(values,operators.pop());
                if(operators.isEmpty())throw new IllegalArgumentException("unmatched )");operators.pop();unary(values,operators);i++;operand=false;continue;
            }
            if(c=='+'||c=='-'||c=='*'||c=='/'){
                if(operand){if(!extended||(c!='+'&&c!='-'))throw new IllegalArgumentException("missing left operand");operators.push(c=='+'?'P':'N');i++;continue;}
                while(!operators.isEmpty()&&precedence(operators.peek())>=precedence(c))apply(values,operators.pop());
                operators.push(c);operand=true;i++;continue;
            }
            throw new IllegalArgumentException("invalid character at "+i);
        }
        if(operand)throw new IllegalArgumentException("missing final operand");
        while(!operators.isEmpty()){char op=operators.pop();if(op=='(')throw new IllegalArgumentException("unclosed (");apply(values,op);}
        if(values.size()!=1)throw new IllegalArgumentException("malformed expression");return values.pop();
    }
}

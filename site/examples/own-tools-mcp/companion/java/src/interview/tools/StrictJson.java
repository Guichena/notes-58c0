package interview.tools;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/** Bounded JSON syntax parser. This is NOT a general JSON Schema engine. Integer tokens become Long. */
public final class StrictJson {
    private StrictJson() {}
    public static Object parse(String text) { return parse(text, 8192); }
    public static Object parse(String text, int maxBytes) {
        if (text == null || text.length() > maxBytes || text.getBytes(StandardCharsets.UTF_8).length > maxBytes)
            throw new IllegalArgumentException("JSON byte limit");
        Parser p = new Parser(text); Object value = p.value(0); p.ws();
        if (p.i != text.length()) throw new IllegalArgumentException("trailing JSON data");
        return value;
    }
    public static Map<String,Object> object(Object value) {
        if (!(value instanceof Map<?,?> map)) throw new IllegalArgumentException("object required");
        Map<String,Object> out = new LinkedHashMap<>();
        map.forEach((k,v) -> { if (!(k instanceof String s)) throw new IllegalArgumentException(); out.put(s,v); });
        return Collections.unmodifiableMap(out);
    }
    public static String canonical(Object v) {
        StringBuilder out = new StringBuilder(); encode(v, out, 0); return out.toString();
    }
    private static void encode(Object v, StringBuilder b, int depth) {
        if (depth > 16) throw new IllegalArgumentException("depth");
        if (v == null) b.append("null");
        else if (v instanceof String s) {
            b.append('"');
            for (int i = 0; i < s.length(); i++) {
                char c = s.charAt(i);
                switch(c) { case '"' -> b.append("\\\""); case '\\' -> b.append("\\\\");
                    case '\n' -> b.append("\\n"); case '\r' -> b.append("\\r"); case '\t' -> b.append("\\t");
                    default -> { if (c < 32) b.append(String.format("\\u%04x",(int)c));
                        else if (Character.isHighSurrogate(c)) {
                            if (i+1 >= s.length() || !Character.isLowSurrogate(s.charAt(i+1))) throw new IllegalArgumentException("surrogate");
                            b.append(c).append(s.charAt(++i));
                        } else if (Character.isLowSurrogate(c)) throw new IllegalArgumentException("surrogate");
                        else b.append(c); }
                }
            } b.append('"');
        } else if (v instanceof Boolean || v instanceof Long || v instanceof Integer || v instanceof BigDecimal) b.append(v);
        else if (v instanceof Map<?,?> m) {
            TreeMap<String,Object> sorted = new TreeMap<>();
            m.forEach((k,x) -> { if (!(k instanceof String s)) throw new IllegalArgumentException(); sorted.put(s,x); });
            b.append('{'); boolean first=true;
            for (var e:sorted.entrySet()) { if (!first)b.append(',');first=false;encode(e.getKey(),b,depth+1);b.append(':');encode(e.getValue(),b,depth+1); } b.append('}');
        } else if (v instanceof List<?> a) {
            b.append('['); for(int i=0;i<a.size();i++){if(i>0)b.append(',');encode(a.get(i),b,depth+1);}b.append(']');
        } else throw new IllegalArgumentException("unsupported JSON value");
    }
    private static final class Parser {
        final String s; int i, nodes;
        Parser(String s){this.s=s;}
        void ws(){while(i<s.length() && " \n\r\t".indexOf(s.charAt(i))>=0)i++;}
        boolean take(char c){ws();if(i<s.length()&&s.charAt(i)==c){i++;return true;}return false;}
        void need(char c){if(!take(c))throw new IllegalArgumentException("JSON delimiter");}
        Object value(int d){
            if(d>16||++nodes>512)throw new IllegalArgumentException("JSON complexity");ws();
            if(i==s.length())throw new IllegalArgumentException("incomplete JSON");char c=s.charAt(i);
            if(c=='"')return string();
            if(c=='{'){
                i++;Map<String,Object> m=new LinkedHashMap<>();if(take('}'))return Collections.unmodifiableMap(m);
                do{ws();if(i>=s.length()||s.charAt(i)!='"')throw new IllegalArgumentException("key");String k=string();need(':');
                    if(m.containsKey(k))throw new IllegalArgumentException("duplicate key");m.put(k,value(d+1));}while(take(','));need('}');return Collections.unmodifiableMap(m);
            }
            if(c=='['){i++;List<Object>a=new ArrayList<>();if(take(']'))return Collections.unmodifiableList(a);
                do{if(a.size()>=256)throw new IllegalArgumentException("array bound");a.add(value(d+1));}while(take(','));need(']');return Collections.unmodifiableList(a);}
            for(String word:List.of("true","false","null"))if(s.startsWith(word,i)){i+=word.length();return word.equals("null")?null:Boolean.valueOf(word);}
            int start=i;if(c=='-')i++;if(i>=s.length())throw new IllegalArgumentException("number");
            if(s.charAt(i)=='0')i++;else{if(s.charAt(i)<'1'||s.charAt(i)>'9')throw new IllegalArgumentException("number");digits();}
            boolean decimal=false;if(i<s.length()&&s.charAt(i)=='.'){decimal=true;i++;int n=i;digits();if(n==i)throw new IllegalArgumentException("fraction");}
            if(i<s.length()&&(s.charAt(i)=='e'||s.charAt(i)=='E')){decimal=true;i++;if(i<s.length()&&(s.charAt(i)=='+'||s.charAt(i)=='-'))i++;int n=i;digits();if(n==i)throw new IllegalArgumentException("exponent");}
            String num=s.substring(start,i);if(num.length()>64)throw new IllegalArgumentException("number bound");
            try { if(!decimal)return Long.valueOf(num);BigDecimal n=new BigDecimal(num);if(Math.abs((long)n.scale())>1024)throw new IllegalArgumentException("exponent bound");return n; }
            catch(NumberFormatException e){throw new IllegalArgumentException("number range");}
        }
        void digits(){while(i<s.length()&&s.charAt(i)>='0'&&s.charAt(i)<='9')i++;}
        String string(){
            need('"');StringBuilder b=new StringBuilder();boolean closed=false;
            while(i<s.length()) {char c=s.charAt(i++);if(c=='"'){closed=true;break;}if(c<32)throw new IllegalArgumentException("control character");
                if(c=='\\'){if(i==s.length())throw new IllegalArgumentException("escape");c=s.charAt(i++);
                    switch(c){case '"','\\','/' -> b.append(c);case 'b' -> b.append('\b');case 'f' -> b.append('\f');case 'n' -> b.append('\n');case 'r' -> b.append('\r');case 't' -> b.append('\t');
                        case 'u' -> {if(i+4>s.length())throw new IllegalArgumentException("unicode");try{for(int h=i;h<i+4;h++)if(Character.digit(s.charAt(h),16)<0||s.charAt(h)>127)throw new NumberFormatException();b.append((char)Integer.parseInt(s.substring(i,i+4),16));}catch(NumberFormatException e){throw new IllegalArgumentException("unicode");}i+=4;}
                        default -> throw new IllegalArgumentException("escape");}
                }else b.append(c);if(b.length()>4096)throw new IllegalArgumentException("string bound");
            }
            if(!closed)throw new IllegalArgumentException("unterminated string");
            String v=b.toString();for(int x=0;x<v.length();x++)if(Character.isHighSurrogate(v.charAt(x))){if(++x>=v.length()||!Character.isLowSurrogate(v.charAt(x)))throw new IllegalArgumentException("surrogate");}else if(Character.isLowSurrogate(v.charAt(x)))throw new IllegalArgumentException("surrogate");
            return v;
        }
    }
}

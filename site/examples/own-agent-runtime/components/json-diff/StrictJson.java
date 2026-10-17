import java.io.*;
import java.math.BigDecimal;
import java.nio.*;
import java.nio.charset.*;
import java.nio.file.*;
import java.util.*;

/** Dependency-free, bounded teaching parser. JSON null is Java null. */
public final class StrictJson {
    public static final int MAX_BYTES=1_048_576, MAX_DEPTH=64, MAX_NODES=50_000;
    private final String text;
    private int pos, nodes;
    private StrictJson(String text) { this.text=text; }
    public static Object parse(String text) {
        Objects.requireNonNull(text);
        if(text.length()>MAX_BYTES || text.getBytes(StandardCharsets.UTF_8).length>MAX_BYTES)
            throw new IllegalArgumentException("JSON byte limit");
        StrictJson p=new StrictJson(text); Object result=p.value(0); p.ws();
        if(p.pos!=text.length()) throw p.bad("trailing input");
        return result;
    }
    public static Object read(Path file) throws IOException {
        try(InputStream in=Files.newInputStream(file)) { return decode(in.readNBytes(MAX_BYTES+1)); }
    }
    public static Object decode(byte[] bytes) throws CharacterCodingException {
        if(bytes.length>MAX_BYTES) throw new IllegalArgumentException("JSON byte limit");
        return parse(StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString());
    }
    private IllegalArgumentException bad(String message) { return new IllegalArgumentException(message+" at "+pos); }
    private void ws() { while(pos<text.length() && " \t\r\n".indexOf(text.charAt(pos))>=0) pos++; }
    private boolean eat(char c) { ws(); if(pos<text.length()&&text.charAt(pos)==c){pos++;return true;}return false; }
    private void need(char c) { if(!eat(c)) throw bad("expected "+c); }
    private Object value(int depth) {
        ws(); if(depth>MAX_DEPTH || ++nodes>MAX_NODES) throw bad("structure limit");
        if(pos>=text.length()) throw bad("missing value");
        char c=text.charAt(pos);
        if(c=='"') return string();
        if(c=='{') {
            pos++; Map<String,Object> map=new TreeMap<>(); if(eat('}'))return map;
            do { ws(); if(pos>=text.length()||text.charAt(pos)!='"')throw bad("object key");
                String key=string(); need(':'); Object v=value(depth+1);
                if(map.containsKey(key))throw bad("duplicate key"); map.put(key,v);
            } while(eat(',')); need('}'); return map;
        }
        if(c=='[') {
            pos++; List<Object> list=new ArrayList<>(); if(eat(']'))return list;
            do { list.add(value(depth+1)); }while(eat(','));need(']');return list;
        }
        for(String token:List.of("true","false","null")) {
            if(text.startsWith(token,pos)) {pos+=token.length();return token.equals("null")?null:token.equals("true");}
        }
        int start=pos;
        if(c=='-')pos++;
        if(pos>=text.length())throw bad("number");
        if(text.charAt(pos)=='0')pos++;
        else { if(!digit19(text.charAt(pos)))throw bad("value"); while(pos<text.length()&&digit(text.charAt(pos)))pos++; }
        if(pos<text.length()&&text.charAt(pos)=='.') {pos++;int before=pos;while(pos<text.length()&&digit(text.charAt(pos)))pos++;if(pos==before)throw bad("fraction");}
        if(pos<text.length()&&(text.charAt(pos)=='e'||text.charAt(pos)=='E')) {
            pos++; if(pos<text.length()&&(text.charAt(pos)=='+'||text.charAt(pos)=='-'))pos++;
            int before=pos;while(pos<text.length()&&digit(text.charAt(pos)))pos++;
            if(pos==before)throw bad("exponent");
        }
        String token=text.substring(start,pos);
        if(token.length()>128)throw bad("number length");
        try { BigDecimal n=new BigDecimal(token); if(Math.abs((long)n.scale())>1000)throw bad("number scale");return n; }
        catch(NumberFormatException e){throw bad("number range");}
    }
    private static boolean digit(char c){return c>='0'&&c<='9';}
    private static boolean digit19(char c){return c>='1'&&c<='9';}
    private char hex() {
        if(pos+4>text.length())throw bad("unicode escape");int n=0;
        for(int i=0;i<4;i++){char h=text.charAt(pos++);int x=h>='0'&&h<='9'?h-'0':h>='a'&&h<='f'?h-'a'+10:h>='A'&&h<='F'?h-'A'+10:-1;if(x<0)throw bad("unicode escape");n=n*16+x;}
        return (char)n;
    }
    private String string() {
        pos++; StringBuilder out=new StringBuilder(); boolean closed=false;
        while(pos<text.length()) {
            char c=text.charAt(pos++);
            if(c=='"'){closed=true;break;} if(c<32)throw bad("control character");
            if(c=='\\') {
                if(pos==text.length())throw bad("escape");char e=text.charAt(pos++);
                c=switch(e){case '"','\\','/'->e;case 'b'->'\b';case 'f'->'\f';case 'n'->'\n';case 'r'->'\r';case 't'->'\t';case 'u'->hex();default->throw bad("escape");};
            }
            out.append(c);
        }
        if(!closed)throw bad("unclosed string");
        for(int i=0;i<out.length();i++) {
            char c=out.charAt(i);
            if(Character.isHighSurrogate(c)) {if(i+1>=out.length()||!Character.isLowSurrogate(out.charAt(++i)))throw bad("unpaired surrogate");}
            else if(Character.isLowSurrogate(c))throw bad("unpaired surrogate");
        }
        return out.toString();
    }
    public static String write(Object value) {
        if(value==null)return "null";
        if(value instanceof String s) {
            StringBuilder b=new StringBuilder("\"");
            for(int i=0;i<s.length();i++) {
                char c=s.charAt(i);
                switch(c){case '"'->b.append("\\\"");case '\\'->b.append("\\\\");case '\n'->b.append("\\n");case '\r'->b.append("\\r");case '\t'->b.append("\\t");
                    default->{if(c<32||Character.isSurrogate(c))b.append(String.format(Locale.ROOT,"\\u%04x",(int)c));else b.append(c);}}
            }
            return b.append('"').toString();
        }
        if(value instanceof BigDecimal n)return n.signum()==0?"0":n.stripTrailingZeros().toString();
        if(value instanceof Boolean||value instanceof Integer||value instanceof Long)return value.toString();
        if(value instanceof List<?> list){List<String> out=new ArrayList<>();for(Object x:list)out.add(write(x));return "["+String.join(",",out)+"]";}
        if(value instanceof Map<?,?> map){TreeMap<String,Object> sorted=new TreeMap<>();for(var e:map.entrySet())sorted.put((String)e.getKey(),e.getValue());List<String> out=new ArrayList<>();for(var e:sorted.entrySet())out.add(write(e.getKey())+":"+write(e.getValue()));return "{"+String.join(",",out)+"}";}
        throw new IllegalArgumentException("unsupported JSON value");
    }
    public static Map<String,Object> object(Object x){if(!(x instanceof Map<?,?> m))throw new IllegalArgumentException("object required");Map<String,Object> r=new TreeMap<>();for(var e:m.entrySet())r.put((String)e.getKey(),e.getValue());return r;}
    public static String str(Map<String,Object> m,String k){if(!(m.get(k) instanceof String s))throw new IllegalArgumentException("string required: "+k);return s;}
    public static long integer(Map<String,Object> m,String k){try{return ((BigDecimal)m.get(k)).longValueExact();}catch(RuntimeException e){throw new IllegalArgumentException("integer required: "+k);}}
    public static void fields(Map<String,Object> m,String... keys){if(!m.keySet().equals(Set.of(keys)))throw new IllegalArgumentException("fields mismatch");}
    public static String id(String s){if(s==null||!s.matches("[A-Za-z0-9_-]{1,64}"))throw new IllegalArgumentException("identifier");return s;}
}

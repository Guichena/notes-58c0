import java.io.*;
import java.math.BigDecimal;
import java.nio.ByteBuffer;
import java.nio.charset.*;
import java.time.Instant;
import java.util.*;

public final class DslCodec {
    static final int MAX_BYTES=65536, MAX_DEPTH=32, MAX_NODES=1024, MAX_STRING=4096;
    public sealed interface Node permits And, Eq {}
    public record And(List<Node> children) implements Node {
        public And { children=List.copyOf(children); }
    }
    public record Eq(String field, Value value) implements Node {
        public Eq { if(field==null || !field.matches("[A-Za-z_][A-Za-z0-9_.]{0,63}")) throw new IllegalArgumentException("field"); Objects.requireNonNull(value); }
    }
    public sealed interface Value permits Text, Decimal, Null, Missing, Bool, Time {}
    public record Text(String value) implements Value { public Text { Objects.requireNonNull(value); } }
    public record Decimal(String value) implements Value {
        public Decimal { if(value==null || value.length()>MAX_STRING || !value.matches("-?(0|[1-9][0-9]*)(\\.[0-9]+)?") || !new BigDecimal(value).toPlainString().equals(value)) throw new IllegalArgumentException("plain canonical decimal"); }
    }
    public enum Null implements Value { INSTANCE }
    public enum Missing implements Value { INSTANCE }
    public record Bool(boolean value) implements Value {}
    public record Time(Instant value) implements Value { public Time { Objects.requireNonNull(value); } }
    private static final class Budget {
        int nodes;
        void node(int depth) throws IOException { if(depth>MAX_DEPTH || ++nodes>MAX_NODES) throw new IOException("tree budget"); }
    }
    public static byte[] encode(Node n) throws IOException {
        ByteArrayOutputStream bytes=new ByteArrayOutputStream();
        DataOutputStream out=new DataOutputStream(new FilterOutputStream(bytes) {
            int size;
            @Override public void write(int b)throws IOException { if(++size>MAX_BYTES)throw new IOException("byte budget");out.write(b); }
            @Override public void write(byte[] b,int o,int len)throws IOException { if(len>MAX_BYTES-size)throw new IOException("byte budget");size+=len;out.write(b,o,len); }
        });
        out.writeInt(0x44534C31);out.writeByte(1);write(n,out,new Budget(),1);out.flush();return bytes.toByteArray();
    }
    public static Node decode(byte[] bytes)throws IOException {
        if(bytes==null || bytes.length>MAX_BYTES)throw new IOException("byte budget");
        try(DataInputStream in=new DataInputStream(new ByteArrayInputStream(bytes))) {
            if(in.readInt()!=0x44534C31 || in.readUnsignedByte()!=1)throw new IOException("unknown format/version");
            Node n=read(in,new Budget(),1);if(in.read()!=-1)throw new IOException("trailing data");return n;
        }catch(RuntimeException e){throw new IOException("invalid typed value",e);}
    }
    private static void write(Node n,DataOutputStream o,Budget b,int depth)throws IOException {
        b.node(depth);
        if(n instanceof And a){o.writeByte(1);o.writeInt(a.children.size());for(Node c:a.children)write(c,o,b,depth+1);}
        else if(n instanceof Eq e){o.writeByte(2);string(e.field,o);Value v=e.value;
            if(v instanceof Text t){o.writeByte(1);string(t.value,o);}
            else if(v instanceof Decimal d){o.writeByte(2);string(d.value,o);}
            else if(v==Null.INSTANCE)o.writeByte(3);
            else if(v==Missing.INSTANCE)o.writeByte(4);
            else if(v instanceof Bool t){o.writeByte(5);o.writeByte(t.value?1:0);}
            else if(v instanceof Time t){o.writeByte(6);string(t.value.toString(),o);}
            else throw new IOException("unknown value");
        }else throw new IOException("unknown node");
    }
    private static Node read(DataInputStream i,Budget b,int depth)throws IOException {
        b.node(depth);int tag=i.readUnsignedByte();
        if(tag==1){int count=i.readInt();if(count<0 || count>MAX_NODES-b.nodes)throw new IOException("child count");
            List<Node> children=new ArrayList<>(count);for(int j=0;j<count;j++)children.add(read(i,b,depth+1));return new And(children);}
        if(tag!=2)throw new IOException("unknown node tag");String field=string(i);int type=i.readUnsignedByte();
        Value v=switch(type){
            case 1 -> new Text(string(i));case 2 -> new Decimal(string(i));case 3 -> Null.INSTANCE;case 4 -> Missing.INSTANCE;
            case 5 -> {int x=i.readUnsignedByte();if(x>1)throw new IOException("boolean");yield new Bool(x==1);}
            case 6 -> {String s=string(i);Instant t=Instant.parse(s);if(!t.toString().equals(s))throw new IOException("canonical instant");yield new Time(t);}
            default -> throw new IOException("unknown value tag");};return new Eq(field,v);
    }
    private static void string(String s,DataOutputStream o)throws IOException {
        if(s.length()>MAX_STRING)throw new IOException("string budget");
        byte[] data;
        try{ByteBuffer b=StandardCharsets.UTF_8.newEncoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).encode(java.nio.CharBuffer.wrap(s));data=new byte[b.remaining()];b.get(data);}
        catch(CharacterCodingException e){throw new IOException("invalid Unicode",e);}
        if(data.length>MAX_STRING)throw new IOException("string budget");o.writeInt(data.length);o.write(data);
    }
    private static String string(DataInputStream i)throws IOException {
        int n=i.readInt();if(n<0 || n>MAX_STRING)throw new IOException("string budget");byte[] data=i.readNBytes(n);if(data.length!=n)throw new EOFException();
        try{return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(data)).toString();}
        catch(CharacterCodingException e){throw new IOException("invalid UTF-8",e);}
    }
    private interface Bad {void run()throws Exception;}
    private static void rejected(Bad action)throws Exception {try{action.run();}catch(IOException|IllegalArgumentException e){return;}throw new AssertionError("accepted bad input");}
    public static void main(String[] args)throws Exception {
        Node n=new And(List.of(new Eq("name",new Text("001中文😀\"\\\n")),new Eq("amount",new Decimal("123456789012345678901234567890.10")),
            new Eq("empty",Null.INSTANCE),new Eq("absent",Missing.INSTANCE),new Eq("yes",new Bool(true)),new Eq("at",new Time(Instant.parse("2026-10-10T00:00:00Z"))),new And(List.of())));
        byte[] bytes=encode(n);if(!decode(bytes).equals(n)||!Arrays.equals(bytes,encode(decode(bytes))))throw new AssertionError();
        byte[] version=bytes.clone();version[4]=2;rejected(()->decode(version));
        byte[] tag=bytes.clone();tag[5]=99;rejected(()->decode(tag));
        rejected(()->decode(Arrays.copyOf(bytes,bytes.length-1)));rejected(()->decode(Arrays.copyOf(bytes,bytes.length+1)));
        rejected(()->encode(new Eq("bad",new Text("\uD800"))));rejected(()->encode(new Eq("big",new Text("x".repeat(MAX_STRING+1)))));
        rejected(()->new Decimal("1e3"));rejected(()->decode(new byte[MAX_BYTES+1]));
        Node deep=new And(List.of());for(int x=0;x<MAX_DEPTH;x++)deep=new And(List.of(deep));Node bomb=deep;rejected(()->encode(bomb));
        List<Node> many=new ArrayList<>();for(int x=0;x<MAX_NODES;x++)many.add(new And(List.of()));rejected(()->encode(new And(many)));
        System.out.println("PASS DslCodec: typed round-trip, budgets and rejection cases; no execution engine");
    }
    private DslCodec(){}
}

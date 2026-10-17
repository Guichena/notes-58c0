import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;

public final class DiffTests {
    static int checks;
    interface Checked {void run()throws Exception;}
    static void eq(Object a,Object b){checks++;if(!Objects.equals(a,b))throw new AssertionError("expected "+b+" but got "+a);}
    static void rejects(Checked f)throws Exception {checks++;try{f.run();}catch(IllegalArgumentException|IOException|java.nio.channels.OverlappingFileLockException expected){return;}throw new AssertionError("expected rejection");}
    static Object p(String s){return StrictJson.parse(s);}
    static String diff(String a,String b){return StrictJson.write(JsonDiff.compare(p(a),p(b)));}
    static void jsonTests(Path work)throws Exception {
        eq(diff("{\"b\":2,\"a\":1}","{\"a\":1.0,\"b\":2e0}"),"[]");
        eq(diff("{}","{\"a\":null}"),"[{\"new\":{\"present\":true,\"value\":null},\"old\":{\"present\":false},\"operation\":\"add\",\"path\":\"/a\"}]");
        eq(diff("null","null"),"[]");eq(diff("-0.0","0"),"[]");
        eq(diff("1","\"1\""),"[{\"new\":{\"present\":true,\"value\":\"1\"},\"old\":{\"present\":true,\"value\":1},\"operation\":\"type\",\"path\":\"\"}]");
        eq(JsonDiff.compare(p("9007199254740992"),p("9007199254740993")).size(),1);
        eq(JsonDiff.compare(p("[1,2]"),p("[2,1]")).size(),2);
        eq(diff("{\"a/b~c\":true}","{}"),"[{\"new\":{\"present\":false},\"old\":{\"present\":true,\"value\":true},\"operation\":\"remove\",\"path\":\"/a~1b~0c\"}]");
        eq(StrictJson.write(p("\"\\ud83d\\ude00\"")),"\"\\ud83d\\ude00\"");
        eq(JsonDiff.compare(p("[1,null]"),p("[1]")).size(),1);
        eq(JsonDiff.compare(p("{\"x\":{\"y\":[true]}}"),p("{\"x\":{\"y\":[false]}} ")).size(),1);
        for(String bad:List.of("","01","-01","+1","1.","1e","1e+","NaN","Infinity","true false","[1,]","{\"a\":1,}","{\"x\":null,\"x\":2}","{\"a\":1,\"\\u0061\":2}","\"\\ud800\"","\"\\udc00\"","\"\\u１２３４\"","\"\n\"","/* hi */null","\ufeff{}","1e1001","9".repeat(129)))rejects(()->p(bad));
        rejects(()->p("[".repeat(66)+"0"+"]".repeat(66)));
        rejects(()->p("["+"0,".repeat(50000)+"0]"));
        rejects(()->p("\""+"a".repeat(StrictJson.MAX_BYTES)+"\""));
        rejects(()->p("\""+"中".repeat(350000)+"\""));
        rejects(()->StrictJson.decode(new byte[]{(byte)0xc3,0x28}));
        rejects(()->JsonDiff.compare(p("["+"0,".repeat(10000)+"0]"),p("[]")));
        String key="k".repeat(100000);
        String many="["+"0,".repeat(99)+"0]";
        rejects(()->JsonDiff.compare(p("{\""+key+"\":"+many+"}"),p("{\""+key+"\":[]}")));
        Path a=work.resolve("old.json"),b=work.resolve("new.json");
        Files.writeString(a,"{\"x\":null}",StandardCharsets.UTF_8);Files.writeString(b,"{}",StandardCharsets.UTF_8);
        eq(JsonDiff.compare(StrictJson.read(a),StrictJson.read(b)).size(),1);
        // Independent oracle: exactly one scalar change at each of 100 generated object keys.
        for(int i=0;i<100;i++) {
            var changes=JsonDiff.compare(p("{\"k"+i+"\":0}"),p("{\"k"+i+"\":1}"));
            eq(changes.size(),1);eq(StrictJson.object(changes.get(0)).get("path"),"/k"+i);
        }
    }
    public static void main(String[] args)throws Exception {
        Path work=Path.of(args[0]);Files.createDirectories(work);jsonTests(work);
        System.out.println("PASS "+checks+" JSON/diff assertions");
    }
}

import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import java.math.BigDecimal;
import java.util.*;

public final class JsonDiff {
    private static final Object MISSING=new Object();
    private static final int MAX_CHANGES=10000, MAX_OUTPUT_BYTES=4*1024*1024;
    private static final class Budget {
        final List<Object> out=new ArrayList<>(); long bytes=2;
        void add(Object change) {
            long size=StrictJson.write(change).getBytes(StandardCharsets.UTF_8).length+(out.isEmpty()?0:1);
            if(out.size()>=MAX_CHANGES||bytes+size>MAX_OUTPUT_BYTES)throw new IllegalArgumentException("diff output limit");
            out.add(change);bytes+=size;
        }
    }
    public static List<Object> compare(Object oldValue,Object newValue) {
        Budget changes=new Budget(); walk("",oldValue,newValue,changes);return changes.out;
    }
    private static String child(String path,String key){return path+"/"+key.replace("~","~0").replace("/","~1");}
    private static String type(Object v){if(v==MISSING)return "missing";if(v==null)return "null";if(v instanceof Map)return "object";if(v instanceof List)return "array";if(v instanceof BigDecimal)return "number";if(v instanceof Boolean)return "boolean";return "string";}
    private static Object side(Object v){Map<String,Object> s=new TreeMap<>();s.put("present",v!=MISSING);if(v!=MISSING)s.put("value",v);return s;}
    private static void walk(String path,Object a,Object b,Budget out) {
        String at=type(a),bt=type(b);
        if(at.equals("object")&&bt.equals("object")) {
            Map<String,Object> x=StrictJson.object(a),y=StrictJson.object(b);TreeSet<String> keys=new TreeSet<>(x.keySet());keys.addAll(y.keySet());
            for(String key:keys)walk(child(path,key),x.getOrDefault(key,MISSING),y.getOrDefault(key,MISSING),out);return;
        }
        if(a instanceof List<?> x&&b instanceof List<?> y) {
            for(int i=0;i<Math.max(x.size(),y.size());i++)walk(child(path,""+i),i<x.size()?x.get(i):MISSING,i<y.size()?y.get(i):MISSING,out);return;
        }
        if(at.equals(bt)&&(a instanceof BigDecimal x?x.compareTo((BigDecimal)b)==0:Objects.equals(a,b)))return;
        String op=a==MISSING?"add":b==MISSING?"remove":!at.equals(bt)?"type":"replace";
        out.add(Map.of("path",path,"operation",op,"old",side(a),"new",side(b)));
    }
    public static void main(String[] args)throws Exception {
        if(args.length!=2)throw new IllegalArgumentException("JsonDiff old.json new.json");
        System.out.println(StrictJson.write(compare(StrictJson.read(Path.of(args[0])),StrictJson.read(Path.of(args[1])))));
    }
}

package interview.tools;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/** Real framed stdio server for a bounded tools-only MCP 2026-07-28 profile. No SDK or HTTP. */
public final class ModernMcp {
    public static final String VERSION="2026-07-28",PREFIX="io.modelcontextprotocol/";
    private static final Pattern META_KEY=Pattern.compile("^(?:[A-Za-z](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\\.[A-Za-z](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\\/)?(?:[A-Za-z0-9](?:[A-Za-z0-9_.-]*[A-Za-z0-9])?)?$");
    private ModernMcp(){}
    private static boolean id(Object x){
        if(x instanceof String)return true;
        try{integer(x);return true;}catch(IllegalArgumentException e){return false;}
    }
    private static long integer(Object n){
        if(n instanceof Long l)return l;
        if(n instanceof BigDecimal d){try{return d.longValueExact();}catch(ArithmeticException e){throw new IllegalArgumentException();}}
        throw new IllegalArgumentException();
    }
    public static Map<String,Object> meta(){return Map.of(PREFIX+"protocolVersion",VERSION,PREFIX+"clientCapabilities",Map.of(),PREFIX+"clientInfo",Map.of("name","interview-host","version","1.0.0"));}
    public static Map<String,Object> request(String id,String method,Map<String,Object> params){
        Map<String,Object> p=new LinkedHashMap<>(params);p.put("_meta",meta());return Map.of("jsonrpc","2.0","id",id,"method",method,"params",p);
    }
    public static Map<String,Object> error(Object ident,int code,String message,Map<String,Object> data){
        Map<String,Object> e=new LinkedHashMap<>(Map.of("code",code,"message",message));if(data!=null)e.put("data",data);
        Map<String,Object> r=new LinkedHashMap<>(Map.of("jsonrpc","2.0","error",e));if(id(ident))r.put("id",ident);return r;
    }
    public static Map<String,Object> handle(Object raw){
        Map<String,Object> q;try{q=StrictJson.object(raw);}catch(IllegalArgumentException e){return error(null,-32600,"Invalid request",null);}
        Object ident=q.get("id");
        if(!"2.0".equals(q.get("jsonrpc"))||!(q.get("method") instanceof String)||q.containsKey("result")||q.containsKey("error"))return error(ident,-32600,"Invalid request",null);
        if(!q.containsKey("id"))return null; // no outstanding work: bounded synchronous arithmetic only
        if(!id(ident))return error(null,-32600,"Invalid request ID",null);
        Map<String,Object> p,m;
        try{p=StrictJson.object(q.get("params"));m=StrictJson.object(p.get("_meta"));
            if(m.keySet().stream().anyMatch(k->!META_KEY.matcher(k).matches())||!(m.get(PREFIX+"protocolVersion") instanceof String)||!(m.get(PREFIX+"clientCapabilities") instanceof Map))throw new IllegalArgumentException();
        }catch(IllegalArgumentException e){return error(ident,-32602,"Required request metadata missing or invalid",null);}
        String version=(String)m.get(PREFIX+"protocolVersion");
        if(!VERSION.equals(version))return error(ident,-32022,"Unsupported protocol version",Map.of("requested",version,"supported",List.of(VERSION)));
        if(m.containsKey(PREFIX+"clientInfo")){
            try{Map<String,Object> ci=StrictJson.object(m.get(PREFIX+"clientInfo"));if(!(ci.get("name") instanceof String)||!(ci.get("version") instanceof String))throw new IllegalArgumentException();}
            catch(IllegalArgumentException e){return error(ident,-32602,"Invalid clientInfo",null);}
        }
        if(m.containsKey("progressToken")&&!(m.get("progressToken") instanceof String)){
            try{integer(m.get("progressToken"));}catch(IllegalArgumentException e){return error(ident,-32602,"Invalid progress token",null);}
        }
        Map<String,Object> r=new LinkedHashMap<>(Map.of("resultType","complete","_meta",Map.of(PREFIX+"serverInfo",Map.of("name","interview-java-tools","version","1.0.0"))));
        switch((String)q.get("method")){
            case "server/discover" -> r.putAll(Map.of("supportedVersions",List.of(VERSION),"capabilities",Map.of("tools",Map.of()),"ttlMs",0,"cacheScope","private"));
            case "tools/list" -> {
                if(p.containsKey("cursor"))return error(ident,-32602,"No cursor is issued by this bounded catalog",null);
                Map<String,Object> number=Map.of("type","integer","minimum",-1000,"maximum",1000);
                Map<String,Object> input=Map.of("type","object","properties",Map.of("a",number,"b",number),"required",List.of("a","b"),"additionalProperties",false);
                Map<String,Object> output=Map.of("type","object","properties",Map.of("sum",Map.of("type","integer")),"required",List.of("sum"),"additionalProperties",false);
                r.putAll(Map.of("tools",List.of(Map.of("name","sum","description","Add two bounded integers; no external effects","inputSchema",input,"outputSchema",output,"annotations",Map.of("readOnlyHint",true))),"ttlMs",0,"cacheScope","private"));
            }
            case "tools/call" -> {
                if(!"sum".equals(p.get("name")))return error(ident,-32602,"Unknown tool",null);
                Map<String,Object> a;try{a=StrictJson.object(p.getOrDefault("arguments",Map.of()));
                    if(!a.keySet().equals(Set.of("a","b")))throw new IllegalArgumentException();
                    for(String key:List.of("a","b")){long n=integer(a.get(key));if(n< -1000||n>1000)throw new IllegalArgumentException();}
                }catch(IllegalArgumentException e){r.putAll(Map.of("isError",true,"content",List.of(Map.of("type","text","text","a and b must be integers in [-1000,1000]"))));return Map.of("jsonrpc","2.0","id",ident,"result",r);}
                Map<String,Object> data=Map.of("sum",integer(a.get("a"))+integer(a.get("b")));
                r.putAll(Map.of("isError",false,"content",List.of(Map.of("type","text","text",StrictJson.canonical(data))),"structuredContent",data));
            }
            default -> {return error(ident,-32601,"Method not found",null);}
        }
        return Map.of("jsonrpc","2.0","id",ident,"result",r);
    }
    public static String readFrame(InputStream in)throws IOException{
        ByteArrayOutputStream b=new ByteArrayOutputStream();int n;
        while((n=in.read())!=-1){if(n=='\n')return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(b.toByteArray())).toString();
            if(b.size()>=8192)throw new IOException("frame limit");b.write(n);}
        if(b.size()!=0)throw new IOException("unterminated frame");return null;
    }
    public static void main(String[] args)throws IOException{
        System.err.println("interview Java stdio server ready");
        for(int n=0;n<128;n++){
            String frame;try{frame=readFrame(System.in);}catch(IOException invalidFrame){return;}if(frame==null)return;
            Map<String,Object> response;try{response=handle(StrictJson.parse(frame));}catch(IllegalArgumentException e){response=error(null,-32700,"Parse error",null);}
            if(response!=null){String out=StrictJson.canonical(response);if(out.getBytes(StandardCharsets.UTF_8).length>8192)throw new IOException("output limit");System.out.println(out);System.out.flush();}
        }
    }
}

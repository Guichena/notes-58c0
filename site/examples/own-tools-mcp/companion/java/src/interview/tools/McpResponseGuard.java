package interview.tools;

import java.util.List;
import java.util.Map;

/** Narrow verifier for the modern, no-MRTR profile used by this companion; not a general MCP SDK. */
public final class McpResponseGuard {
    private McpResponseGuard(){}
    public static Map<String,Object> verify(Object parsed,String expectedId,String method){
        Map<String,Object> r=StrictJson.object(parsed);
        if(!"2.0".equals(r.get("jsonrpc"))||!expectedId.equals(r.get("id"))||r.containsKey("result")==r.containsKey("error")||r.containsKey("method"))throw new IllegalArgumentException("response envelope");
        if(r.containsKey("error")){
            Map<String,Object> e=StrictJson.object(r.get("error"));if(!(e.get("code") instanceof Long)||!(e.get("message") instanceof String))throw new IllegalArgumentException("error shape");return r;
        }
        Map<String,Object> result=StrictJson.object(r.get("result"));
        if(!"complete".equals(result.get("resultType")))throw new IllegalArgumentException("unsupported or missing result type");
        if(method.equals("server/discover")||method.equals("tools/list")){
            if(!(result.get("ttlMs") instanceof Long ttl)||ttl<0||!List.of("public","private").contains(result.get("cacheScope")))throw new IllegalArgumentException("cache contract");
        }
        if(method.equals("server/discover")){
            if(!(result.get("supportedVersions") instanceof List<?> versions)||!versions.contains(ModernMcp.VERSION)||!(result.get("capabilities") instanceof Map))throw new IllegalArgumentException("discovery contract");
        }else if(method.equals("tools/list")){
            if(!(result.get("tools") instanceof List<?>))throw new IllegalArgumentException("tools contract");
        }else if(method.equals("tools/call")){
            if(!(result.get("content") instanceof List<?> blocks)||blocks.size()>16)throw new IllegalArgumentException("content contract");
            for(Object block:blocks){Map<String,Object> text=StrictJson.object(block);if(!"text".equals(text.get("type"))||!(text.get("text") instanceof String))throw new IllegalArgumentException("profile supports text only");}
            if(result.containsKey("isError")&&!(result.get("isError") instanceof Boolean))throw new IllegalArgumentException("isError type");
            if(!Boolean.TRUE.equals(result.get("isError"))){Map<String,Object> data=StrictJson.object(result.get("structuredContent"));if(data.size()!=1||!(data.get("sum") instanceof Long n)||n< -2000||n>2000)throw new IllegalArgumentException("sum output schema");}
        }
        return r;
    }
    private static void reject(String json){try{verify(StrictJson.parse(json),"c","tools/call");throw new AssertionError("accepted invalid response");}catch(IllegalArgumentException expected){}}
    public static void main(String[] args){
        reject("{\"jsonrpc\":\"2.0\",\"id\":\"other\",\"result\":{\"resultType\":\"complete\"}}");
        reject("{\"jsonrpc\":\"2.0\",\"id\":\"c\",\"result\":{},\"error\":{}}");
        reject("{\"jsonrpc\":\"2.0\",\"id\":\"c\",\"result\":{\"content\":[]}}");
        reject("{\"jsonrpc\":\"2.0\",\"id\":\"c\",\"result\":{\"resultType\":\"input_required\",\"requestState\":\"untrusted\"}}");
        reject("{\"jsonrpc\":\"2.0\",\"id\":\"c\",\"result\":{\"resultType\":\"complete\",\"content\":[],\"structuredContent\":{\"sum\":true}}}");
        reject("{\"jsonrpc\":\"2.0\",\"id\":\"c\",\"result\":{\"resultType\":\"complete\",\"content\":[{\"type\":\"image\"}],\"structuredContent\":{\"sum\":1}}}");
        System.out.println("PASS McpResponseGuard: wrong ID, result/error ambiguity, missing resultType, unsupported MRTR, output schema, content profile");
    }
}

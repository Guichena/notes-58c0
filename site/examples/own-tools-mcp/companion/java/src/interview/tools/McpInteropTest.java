package interview.tools;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

/** Java Host -> actual Python stdio process; isolated tests use only generated local arithmetic. */
public final class McpInteropTest {
    private McpInteropTest(){}
    private static void check(boolean b){if(!b)throw new AssertionError();}
    private static String drain(InputStream in,int bound)throws Exception{
        ByteArrayOutputStream b=new ByteArrayOutputStream();byte[] chunk=new byte[1024];int n;
        while((n=in.read(chunk))!=-1){if(n>bound-b.size())throw new IllegalArgumentException("stream output bound");b.write(chunk,0,n);}
        return StandardCharsets.UTF_8.newDecoder().onMalformedInput(java.nio.charset.CodingErrorAction.REPORT).decode(java.nio.ByteBuffer.wrap(b.toByteArray())).toString();
    }
    private static List<Map<String,Object>> run(Path server,List<String> frames)throws Exception{
        Process p=new ProcessBuilder("python3","-I",server.toString()).start();
        ExecutorService io=Executors.newFixedThreadPool(2);Throwable failure=null;List<Map<String,Object>> answer=new ArrayList<>();
        try{
            Future<String> out=io.submit(()->drain(p.getInputStream(),65536));Future<String> err=io.submit(()->drain(p.getErrorStream(),8192));
            for(String frame:frames){p.getOutputStream().write((frame+"\n").getBytes(StandardCharsets.UTF_8));}p.getOutputStream().close();
            if(!p.waitFor(3,TimeUnit.SECONDS))throw new IllegalStateException("child deadline exceeded");
            String stdout=out.get(1,TimeUnit.SECONDS);String stderr=err.get(1,TimeUnit.SECONDS);check(p.exitValue()==0);check(stderr.contains("ready"));
            check(stdout.isEmpty()||stdout.endsWith("\n"));
            for(String frame:stdout.split("\n")){if(!frame.isEmpty())answer.add(StrictJson.object(StrictJson.parse(frame)));}
        }catch(Throwable e){failure=e;}
        finally{
            failure=Cleanup.collect(failure,
                ()->p.getOutputStream().close(),
                ()->{if(p.isAlive()){p.destroy();if(!p.waitFor(200,TimeUnit.MILLISECONDS))p.destroyForcibly();}},
                ()->{if(!p.waitFor(2,TimeUnit.SECONDS))throw new IllegalStateException("child termination unconfirmed");},
                ()->p.getInputStream().close(),()->p.getErrorStream().close(),
                ()->io.shutdownNow(),()->{if(!io.awaitTermination(2,TimeUnit.SECONDS))throw new IllegalStateException("reader termination unconfirmed");});
        }
        Cleanup.rethrow(failure);return answer;
    }
    private static String req(String id,String method,Map<String,Object> params){return StrictJson.canonical(ModernMcp.request(id,method,params));}
    public static void main(String[] args)throws Exception{
        if(args.length!=1)throw new IllegalArgumentException("modern_server.py path required");
        List<String> frames=new ArrayList<>();
        frames.add(req("discover","server/discover",Map.of()));frames.add(req("list","tools/list",Map.of()));
        frames.add(req("sum","tools/call",Map.of("name","sum","arguments",Map.of("a",2,"b",5))));
        frames.add(req("bool","tools/call",Map.of("name","sum","arguments",Map.of("a",true,"b",5))));
        frames.add(req("missing","tools/call",Map.of("name","absent","arguments",Map.of())));
        frames.add(req("old","initialize",Map.of()));
        frames.add("{\"jsonrpc\":\"2.0\",\"id\":\"badmeta\",\"method\":\"tools/list\",\"params\":{}}");
        frames.add(req("version","server/discover",Map.of()).replace(ModernMcp.VERSION,"2025-11-25"));
        frames.add("{\"jsonrpc\":\"2.0\",\"method\":\"notifications/cancelled\",\"params\":{\"requestId\":\"finished\"}}");
        frames.add("{\"x\":1,\"x\":2}");
        List<Map<String,Object>> r=run(Path.of(args[0]),frames);check(r.size()==9);
        for(int i=0;i<8;i++){check("2.0".equals(r.get(i).get("jsonrpc")));check(List.of("discover","list","sum","bool","missing","old","badmeta","version").get(i).equals(r.get(i).get("id")));check(r.get(i).containsKey("result")!=r.get(i).containsKey("error"));}
        String[] methods={"server/discover","tools/list","tools/call","tools/call","tools/call","initialize","tools/list","server/discover"};
        for(int i=0;i<8;i++)McpResponseGuard.verify(r.get(i),List.of("discover","list","sum","bool","missing","old","badmeta","version").get(i),methods[i]);
        Map<String,Object> discover=StrictJson.object(r.get(0).get("result"));check(discover.get("supportedVersions").equals(List.of(ModernMcp.VERSION)));check(discover.get("ttlMs").equals(0L));check(discover.get("cacheScope").equals("private"));
        for(int i=0;i<4;i++)check(StrictJson.object(r.get(i).get("result")).get("resultType").equals("complete"));
        Map<String,Object> list=StrictJson.object(r.get(1).get("result"));check(((List<?>)list.get("tools")).size()==1);check(list.containsKey("ttlMs")&&list.containsKey("cacheScope"));
        Map<String,Object> data=StrictJson.object(StrictJson.object(r.get(2).get("result")).get("structuredContent"));check(data.get("sum").equals(7L));
        check(Boolean.TRUE.equals(StrictJson.object(r.get(3).get("result")).get("isError")));
        long[] codes={-32602,-32601,-32602,-32022,-32700};for(int i=4;i<9;i++)check(StrictJson.object(r.get(i).get("error")).get("code").equals(codes[i-4]));
        check(!r.get(8).containsKey("id"));
        Map<String,Object> versionData=StrictJson.object(StrictJson.object(r.get(7).get("error")).get("data"));check(versionData.get("supported").equals(List.of(ModernMcp.VERSION)));
        System.out.println("PASS Java Host -> Python stdio: 9 responses; discovery/list/call, version/meta errors, tool error, legacy method rejected, duplicate JSON rejected, notification silent, bounded process cleanup");
    }
}

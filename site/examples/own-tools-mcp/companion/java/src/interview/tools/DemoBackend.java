package interview.tools;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicReference;
import static interview.tools.ToolPort.*;

/** Trusted in-memory fixture backend: version CAS and bounded scoped artifacts; no persistence claim. */
public final class DemoBackend {
    private record Resource(String tenant,String scope){}
    private record Config(long limit,long version){}
    private record ArtifactKey(String tenant,String user,String scope,String id){}
    private final Map<Resource,Config> configs=new HashMap<>();
    private final Map<ArtifactKey,String> artifacts=new HashMap<>();
    private static long number(Map<String,Object> a,String name,long min,long max){
        if(!(a.get(name) instanceof Long n)||n<min||n>max)throw new IllegalArgumentException();return n;
    }
    private static void fields(Map<String,Object> a,String... names){if(!a.keySet().equals(Set.of(names)))throw new IllegalArgumentException();}
    private static String hash(String content){
        try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content.getBytes(StandardCharsets.UTF_8)));}
        catch(NoSuchAlgorithmException e){throw new AssertionError(e);}
    }
    private synchronized Config read(Context c){return configs.getOrDefault(new Resource(c.tenant(),c.resourceScope()),new Config(10,0));}
    private synchronized Config write(Context c,long expected,long limit)throws ToolExecutor.KnownFailure{
        Config before=read(c);if(before.version()!=expected)throw new ToolExecutor.KnownFailure(Status.CONFLICT,false);
        Config after=new Config(limit,expected+1);configs.put(new Resource(c.tenant(),c.resourceScope()),after);return after;
    }
    private synchronized String put(Context c,String text)throws ToolExecutor.KnownFailure{
        if(text.getBytes(StandardCharsets.UTF_8).length>32768)throw new IllegalArgumentException();String id=hash(text);
        ArtifactKey key=new ArtifactKey(c.tenant(),c.user(),c.resourceScope(),id);
        if(!artifacts.containsKey(key)&&artifacts.size()>=8)throw new ToolExecutor.KnownFailure(Status.FAILED,false);
        artifacts.put(key,text);return id;
    }
    private synchronized String page(Context c,String id,int offset)throws ToolExecutor.KnownFailure{
        String text=artifacts.get(new ArtifactKey(c.tenant(),c.user(),c.resourceScope(),id));
        if(text==null)throw new ToolExecutor.KnownFailure(Status.DENIED,false);
        if(offset<0||offset>text.length())throw new ToolExecutor.KnownFailure(Status.INVALID_ARGUMENT,false);
        // ASCII fixture only; general Unicode pagination needs a byte/code-point aware cursor.
        int end=Math.min(text.length(),offset+1000);
        return StrictJson.canonical(Map.of("content",text.substring(offset,end),"nextOffset",end,"complete",end==text.length(),"sha256",id));
    }
    public Map<String,ToolExecutor.Spec> tools(){
        return Map.of(
            "read",new ToolExecutor.Spec("1","read",true,1,1000,8192,false,a->fields(a),(i,o)->{Config c=read(i.context());o.write(StrictJson.canonical(Map.of("limit",c.limit(),"version",c.version())));}),
            "set",new ToolExecutor.Spec("1","write",false,1,1000,8192,false,a->{fields(a,"expectedVersion","limit");number(a,"expectedVersion",0,1_000_000);number(a,"limit",0,100);},(i,o)->{Config c=write(i.context(),(Long)i.arguments().get("expectedVersion"),(Long)i.arguments().get("limit"));o.write(StrictJson.canonical(Map.of("limit",c.limit(),"version",c.version())));}),
            "large",new ToolExecutor.Spec("1","read",true,1,1000,8192,false,a->fields(a),(i,o)->{String text="x".repeat(20000);String id=put(i.context(),text);o.write(StrictJson.canonical(Map.of("artifactId",id,"sha256",id,"bytes",20000,"preview",text.substring(0,50),"nextOffset",0)));}),
            "page",new ToolExecutor.Spec("1","read",true,1,1000,8192,false,a->{fields(a,"artifactId","offset");if(!(a.get("artifactId") instanceof String id)||!id.matches("[a-f0-9]{64}"))throw new IllegalArgumentException();number(a,"offset",0,32768);},(i,o)->o.write(page(i.context(),(String)i.arguments().get("artifactId"),((Long)i.arguments().get("offset")).intValue()))));
    }
    private static void check(boolean condition){if(!condition)throw new AssertionError();}
    private static Budget budget(){return Budget.after(Duration.ofSeconds(3),2,new Cancellation());}
    public static void main(String[] ignored)throws Exception{
        DemoBackend backend=new DemoBackend();Context c=new Context("t","u","module-c",Set.of("read","write"));
        try(ToolExecutor e=new ToolExecutor(backend.tools(),(ctx,n,a)->true,2,4,100)){
            CountDownLatch start=new CountDownLatch(1);AtomicReference<Reply> a=new AtomicReference<>(),b=new AtomicReference<>();
            Thread first=new Thread(()->{try{start.await();a.set(e.invoke(c,new Call("a","op-a","set","{\"expectedVersion\":0,\"limit\":20}"),budget()));}catch(InterruptedException x){Thread.currentThread().interrupt();}});
            Thread second=new Thread(()->{try{start.await();b.set(e.invoke(c,new Call("b","op-b","set","{\"expectedVersion\":0,\"limit\":30}"),budget()));}catch(InterruptedException x){Thread.currentThread().interrupt();}});
            first.start();second.start();start.countDown();first.join(2000);second.join(2000);check(!first.isAlive()&&!second.isAlive());
            check(Set.of(a.get().status(),b.get().status()).equals(Set.of(Status.OK,Status.CONFLICT)));
            Reply read=e.invoke(c,new Call("r","","read","{}"),budget());check(StrictJson.object(StrictJson.parse(read.data())).get("version").equals(1L));
            Reply large=e.invoke(c,new Call("large","","large","{}"),budget());check(large.status()==Status.OK);Map<String,Object> info=StrictJson.object(StrictJson.parse(large.data()));String id=(String)info.get("artifactId");
            StringBuilder reconstructed=new StringBuilder();for(int offset=0;offset<20000;offset+=1000){
                Reply page=e.invoke(c,new Call("page-"+offset,"","page",StrictJson.canonical(Map.of("artifactId",id,"offset",offset))),budget());check(page.status()==Status.OK);reconstructed.append(StrictJson.object(StrictJson.parse(page.data())).get("content"));}
            check(reconstructed.length()==20000&&hash(reconstructed.toString()).equals(id));
            Context other=new Context("other","u","module-c",Set.of("read"));Reply denied=e.invoke(other,new Call("deny","","page",StrictJson.canonical(Map.of("artifactId",id,"offset",0))),budget());check(denied.status()==Status.DENIED);
        }
        System.out.println("PASS DemoBackend: concurrent version CAS, readback, full large artifact retrieval/hash and tenant isolation");
    }
}

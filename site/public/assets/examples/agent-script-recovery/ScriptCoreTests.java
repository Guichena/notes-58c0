import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;

public final class ScriptCoreTests {
    static int checks;
    interface Checked {void run()throws Exception;}
    static void eq(Object a,Object b){checks++;if(!Objects.equals(a,b))throw new AssertionError("expected "+b+" but got "+a);}
    static void rejects(Checked f)throws Exception {checks++;try{f.run();}catch(IllegalArgumentException|ScriptService.Conflict|IOException|java.nio.channels.OverlappingFileLockException expected){return;}throw new AssertionError("expected rejection");}
    static Object p(String s){return StrictJson.parse(s);}
    static Map<String,Object> request(String id,String template,String input,int ttl){return StrictJson.object(p("{\"id\":\""+id+"\",\"template\":\""+template+"\",\"input\":"+input+",\"ttlMillis\":"+ttl+"}"));}
    static Map<String,Object> receipt(Map<String,Object> claim,String output){return StrictJson.object(p("{\"id\":\""+claim.get("id")+"\",\"owner\":\""+claim.get("owner")+"\",\"epoch\":"+claim.get("epoch")+",\"output\":"+output+"}"));}
    static void coreTests(Path work)throws Exception {
        IOException primary=new IOException("write failed"),secondary=new IOException("cleanup failed");
        DurableFile.cleanup(primary,()->{throw secondary;});eq(primary.getSuppressed().length,1);eq(primary.getSuppressed()[0],secondary);
        IOException same=new IOException("same instance");DurableFile.cleanup(same,()->{throw same;});eq(same.getSuppressed().length,0);
        try{DurableFile.cleanup(null,()->{throw secondary;});throw new AssertionError("cleanup swallowed");}catch(IOException e){eq(e,secondary);}
        DurableFile.cleanup(null,()->{});eq(true,true);
        RuntimeException runtime=new RuntimeException("runtime cleanup");DurableFile.cleanup(primary,()->{throw runtime;});eq(primary.getSuppressed()[1],runtime);
        AtomicLong time=new AtomicLong(100);Path file=work.resolve("jobs.json");Map<String,Object> first;
        try(ScriptService.Core c=new ScriptService.Core(file,time::get)) {
            var req=request("one","sum-v1","[1,2,3]",60000);
            eq(c.submit(req).get("state"),"QUEUED");eq(c.submit(req).get("epoch"),0L);
            rejects(()->c.submit(request("one","sum-v1","[3]",60000)));
            rejects(()->c.submit(request("bad","shell","\"echo hi\"",1000)));
            rejects(()->c.submit(request("bad","sum-v1","[1.5]",1000)));
            rejects(()->c.submit(request("bad","sum-v1","[1000000001]",1000)));
            rejects(()->c.submit(request("bad","upper-v1","\""+"中".repeat(171)+"\"",1000)));
            rejects(()->c.submit(request("bad","upper-v1","null",1000)));
            rejects(()->c.submit(request("bad","upper-v1","\"ok\"",99)));
            rejects(()->new ScriptService.Core(file,time::get));
            try(var pool=Executors.newFixedThreadPool(10)) {
                List<Callable<Map<String,Object>>> calls=new ArrayList<>();for(int i=0;i<30;i++){String owner="w"+i;calls.add(()->c.claim(owner));}
                int winners=0;for(var f:pool.invokeAll(calls))if("RUNNING".equals(f.get().get("state")))winners++;
                eq(winners,1);
            }
            first=c.get("one");eq(first.get("attempts"),1);
            ((List<?>)first.get("input")).clear(); // Returned view must not mutate the authoritative input.
            first=c.get("one");eq(((List<?>)first.get("input")).size(),3);
            Map<String,Object> firstView=first;rejects(()->c.complete(receipt(firstView,"7")));
        }
        final Map<String,Object> initial=first;
        // A fresh coordinator instance reads the persisted running lease and does not immediately reassign it.
        try(ScriptService.Core c=new ScriptService.Core(file,time::get)) {
            eq(c.claim("new").get("state"),"EMPTY");eq(c.get("one").get("epoch"),1L);
            time.set(1100);rejects(()->c.complete(receipt(initial,"6")));
            var next=c.claim("new");eq(next.get("epoch"),2L);eq(next.get("attempts"),2);
            rejects(()->c.complete(receipt(initial,"6")));
            eq(c.complete(receipt(next,"6")).get("state"),"SUCCEEDED");
            time.set(5000);eq(c.complete(receipt(next,"6.0")).get("state"),"SUCCEEDED");
            rejects(()->c.complete(receipt(next,"9")));
        }
        try(ScriptService.Core c=new ScriptService.Core(file,time::get)) {
            eq(c.submit(request("one","sum-v1","[1.0,2,3]",60000)).get("state"),"SUCCEEDED");
            eq(c.get("one").get("output").toString(),"6");
            c.submit(request("timeout","upper-v1","\"x\"",100));var claim=c.claim("w");time.addAndGet(100);
            rejects(()->c.complete(receipt(claim,"\"X\"")));eq(c.claim("w").get("state"),"EMPTY");eq(c.get("timeout").get("state"),"FAILED");
            c.submit(request("attempts","sum-v1","[]",60000));
            for(int i=1;i<=3;i++){eq(c.claim("retry").get("attempts"),i);time.addAndGet(1000);}
            eq(c.claim("retry").get("state"),"EMPTY");eq(c.get("attempts").get("state"),"FAILED");
            rejects(()->c.get("missing"));rejects(()->c.claim("../../evil"));
        }
        // Local clock rollback never extends the last persisted authority time backwards.
        try(ScriptService.Core c=new ScriptService.Core(work.resolve("clock.json"),time::get)) {
            c.submit(request("clock","sum-v1","[]",100));time.set(0);var j=c.claim("w");eq(j.get("until"),8200L);
        }
        Path broken=work.resolve("broken.json");Files.writeString(broken,"{\"version\":1");rejects(()->new ScriptService.Core(broken,time::get));
        Path full=work.resolve("full.json");time.set(0);
        try(ScriptService.Core c=new ScriptService.Core(full,time::get)) {
            for(int i=0;i<ScriptService.CAPACITY;i++)c.submit(request("j"+i,"sum-v1","[]",1000));
            rejects(()->c.submit(request("overflow","sum-v1","[]",1000)));
        }
        rejects(()->ScriptService.loopback("http://example.com:123"));rejects(()->ScriptService.loopback("http://127.0.0.1:3@evil:80"));
        rejects(()->ScriptService.loopback("http://127.0.0.1:123/path"));
    }
    public static void main(String[] args)throws Exception {
        Path work=Path.of(args[0]);Files.createDirectories(work);coreTests(work);
        System.out.println("PASS "+checks+" durable control-plane assertions");
    }
}

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;

/** Tests real cooperating JVMs; local trusted directory, no external files/services. */
public final class LockLifecycleTests {
    private static int checks;
    @FunctionalInterface interface Checked {void run()throws Exception;}
    private static void check(boolean ok,String message){checks++;if(!ok)throw new AssertionError(message);}
    private static void rejects(Checked action)throws Exception {
        boolean failed=false;try{action.run();}catch(IOException expected){failed=true;}
        check(failed,"must reject before opening a second conflicting channel");
    }
    private static void openAndClose(Path p)throws IOException {try(DurableFile f=new DurableFile(p)){f.read();}}
    private static void external(Path file,boolean shouldAcquire)throws Exception {
        String java=Path.of(System.getProperty("java.home"),"bin","java").toString();
        Process p=new ProcessBuilder(java,"-cp",System.getProperty("java.class.path"),
                "LockLifecycleTests","probe",file.toString()).redirectErrorStream(true).start();
        try {
            check(p.waitFor(20,TimeUnit.SECONDS),"external probe completed");
            String result=new String(p.getInputStream().readAllBytes(),StandardCharsets.UTF_8).trim();
            check(p.exitValue()==0,"probe exited normally: "+result);
            check(result.equals(shouldAcquire?"ACQUIRED":"BLOCKED"),"external lock state: "+result);
        }finally{if(p.isAlive()){p.destroyForcibly();p.waitFor();}}
    }
    public static void main(String[] args)throws Exception {
        if(args[0].equals("probe")) {
            try(DurableFile f=new DurableFile(Path.of(args[1]))){f.hashCode();System.out.println("ACQUIRED");}
            catch(IOException expected){System.out.println("BLOCKED");}
            return;
        }
        Path dir=Path.of(args[0]).toAbsolutePath();Files.createDirectories(dir);
        Path file=dir.resolve("jobs.json");
        try(DurableFile first=new DurableFile(file)) {
            first.save(StrictJson.parse("{\"ok\":1}"));
            external(file,false);
            for(int i=0;i<20;i++)rejects(()->openAndClose(file));
            external(file,false); // Regression: second-open rejection must NOT unlock the first writer.
            Path relative=Path.of("").toAbsolutePath().relativize(file);
            rejects(()->openAndClose(relative));
            Files.createDirectories(dir.resolve("sub"));
            rejects(()->openAndClose(dir.resolve("sub/../jobs.json")));
            external(file,false);
            Path symlink=dir.resolve("parent-alias");Files.createSymbolicLink(symlink,dir);
            rejects(()->openAndClose(symlink.resolve("jobs.json")));
            external(symlink.resolve("jobs.json"),false);
            Path lockAlias=dir.resolve("other.json.lock");Files.createLink(lockAlias,dir.resolve("jobs.json.lock"));
            rejects(()->openAndClose(dir.resolve("other.json")));
            external(file,false);
            Path dataAlias=dir.resolve("data-alias.json");Files.createLink(dataAlias,file);
            rejects(()->openAndClose(dataAlias));
            // A second ledger must never read/close the first ledger's locked file as its data.
            rejects(()->openAndClose(dir.resolve("jobs.json.lock")));
            Path cross=dir.resolve("cross.json");Files.createLink(cross,dir.resolve("jobs.json.lock"));
            rejects(()->openAndClose(cross));
            external(file,false);
            try(ExecutorService pool=Executors.newFixedThreadPool(8)) {
                List<Future<Boolean>> result=new ArrayList<>();
                for(int i=0;i<80;i++)result.add(pool.submit(()->{
                    try{openAndClose(file);return false;}catch(IOException expected){return true;}
                }));
                for(Future<Boolean> f:result)check(f.get(),"concurrent second opener rejected");
            }
            external(file,false);
            check(StrictJson.write(first.read()).equals("{\"ok\":1}"),"first writer still readable");
        }
        external(file,true);
        DurableFile again=new DurableFile(file);again.close();again.close();
        rejects(again::read);rejects(()->again.save(null));external(file,true);
        // Bad snapshot parsing happens after lock acquisition; Core must close on construction failure.
        Path broken=dir.resolve("broken.json");Files.writeString(broken,"{");
        boolean badSnapshot=false;
        try(ScriptService.Core c=new ScriptService.Core(broken,()->100L)){c.hashCode();}
        catch(IllegalArgumentException expected){badSnapshot=true;}
        check(badSnapshot,"malformed snapshot rejected");
        external(broken,true);Files.delete(broken);
        try(ScriptService.Core c=new ScriptService.Core(broken,()->100L)){c.hashCode();check(true,"reopened repaired store");}
        // Failure before channel creation must not leave a registry reservation.
        Path blocked=dir.resolve("blocked.json");Files.createDirectory(dir.resolve("blocked.json.lock"));
        rejects(()->openAndClose(blocked));Files.delete(dir.resolve("blocked.json.lock"));
        openAndClose(blocked);external(blocked,true);
        Path sym=dir.resolve("symbolic.json");Files.createSymbolicLink(sym,file);
        rejects(()->openAndClose(sym));
        Path own=dir.resolve("own.json");Files.writeString(own,"{}");Files.createLink(dir.resolve("own.json.lock"),own);
        rejects(()->openAndClose(own));
        // Close/open races must leave exactly one usable next owner, never a stale registry entry.
        for(int i=0;i<100;i++) {
            DurableFile before=new DurableFile(file);
            try(ExecutorService pool=Executors.newFixedThreadPool(2)) {
                CountDownLatch start=new CountDownLatch(1);
                Future<?> closer=pool.submit(()->{start.await();before.close();return null;});
                Future<DurableFile> opener=pool.submit(()->{
                    start.await();try{return new DurableFile(file);}catch(IOException expected){return null;}
                });
                start.countDown();closer.get();DurableFile next=opener.get();
                if(next==null)next=new DurableFile(file);
                try(DurableFile accepted=next){check(accepted.read()!=null,"race survivor usable");}
            }finally{before.close();}
        }
        external(file,true);
        System.out.println("PASS LockLifecycleTests checks="+checks+"; independent JVM lock probes, aliases, construction failures, close and reopen races");
    }
}

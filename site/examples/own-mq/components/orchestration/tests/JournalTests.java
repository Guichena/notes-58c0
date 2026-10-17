import java.io.*;
import java.nio.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.zip.CRC32C;

public final class JournalTests {
    private static int checks;
    static void check(boolean b,String m){checks++;if(!b)throw new AssertionError(m);}
    @FunctionalInterface interface Action{void run()throws Exception;}
    static void fails(Action a)throws Exception{
        try{a.run();throw new AssertionError("expected rejection");}catch(IOException|IllegalArgumentException expected){checks++;}
    }
    static byte[] b(String s){return s.getBytes(StandardCharsets.UTF_8);}
    static Path dir(Path root,String name)throws IOException{return Files.createDirectory(root.resolve(name));}
    static Path first(Path d)throws IOException{try(var s=Files.list(d)){return s.filter(p->p.toString().endsWith(".seg")).sorted().findFirst().orElseThrow();}}
    static void delete(Path p)throws IOException{try(var s=Files.walk(p)){for(Path x:s.sorted(Comparator.reverseOrder()).toList())Files.delete(x);}}
    static void childDenied(Path d)throws Exception{
        Process p=new ProcessBuilder(Path.of(System.getProperty("java.home"),"bin","java").toString(),"-Xmx64m","-cp",
                System.getProperty("java.class.path"),"JournalTests","probe",d.toString()).redirectErrorStream(true).start();
        Throwable childFailure=null;
        try{if(!p.waitFor(5,TimeUnit.SECONDS))throw new AssertionError("child timeout");check(p.exitValue()==0,"child must reject active owner: "+new String(p.getInputStream().readAllBytes(),StandardCharsets.UTF_8));}
        catch(Exception|Error failure){childFailure=failure;throw failure;}
        finally{
            Throwable failure=childFailure;
            try{if(p.isAlive()){p.destroyForcibly();if(!p.waitFor(5,TimeUnit.SECONDS))throw new IOException("child remains");}}
            catch(Exception|Error next){if(failure==null)failure=next;else FailureTools.attach(failure,next);}
            for(AutoCloseable stream:List.of(p.getInputStream(),p.getErrorStream(),p.getOutputStream())){
                try{stream.close();}catch(Exception|Error next){if(failure==null)failure=next;else FailureTools.attach(failure,next);}
            }
            if(childFailure==null&&failure!=null){if(failure instanceof Exception e)throw e;throw (Error)failure;}
        }
    }
    public static void main(String[] args)throws Exception{
        if(args.length>0&&args[0].equals("probe")){
            try(SegmentJournal j=new SegmentJournal(Path.of(args[1]))){j.size();System.exit(3);}
            catch(IOException expected){return;}
        }
        Path root=Files.createTempDirectory("journal-lab-");
        Throwable testFailure=null;
        try{
            Path d=dir(root,"main");
            try(SegmentJournal j=new SegmentJournal(d)){
                byte[] a=b("hello");check(j.append("租户",a)==0,"first");a[0]=0;
                check(Arrays.equals(j.get("租户"),b("hello")),"input cloned");
                byte[] result=j.get("租户");result[0]=1;check(Arrays.equals(j.get("租户"),b("hello")),"output cloned");
                check(j.append("租户",b("hello"))==0,"idempotent");fails(()->j.append("租户",b("different")));
                fails(()->j.append("\uD800",b("x")));fails(()->j.append(" ",b("x")));fails(()->j.append("x".repeat(1025),new byte[0]));
                fails(()->j.append("large",new byte[SegmentJournal.MAX_BODY]));
                ExecutorService pool=Executors.newFixedThreadPool(4);
                Throwable poolFailure=null;
                try{
                    List<Callable<Long>> jobs=new ArrayList<>();for(int i=0;i<30;i++)jobs.add(()->j.append("same",b("same")));
                    for(Future<Long> f:pool.invokeAll(jobs,5,TimeUnit.SECONDS))check(f.get()==1,"duplicate race");
                    jobs.clear();for(int i=0;i<30;i++){int n=i;jobs.add(()->j.append("unique-"+n,b("v"+n)));}
                    Set<Long> seq=new HashSet<>();for(Future<Long> f:pool.invokeAll(jobs,5,TimeUnit.SECONDS))seq.add(f.get());
                    check(seq.size()==30&&j.size()==32,"unique race");
                }catch(Exception|Error failure){poolFailure=failure;throw failure;}finally{JdbcSafety.closePool(pool,poolFailure);}
                fails(()->{try(SegmentJournal other=new SegmentJournal(d)){other.size();}});childDenied(d);
                Path symlink=root.resolve("alias");Files.createSymbolicLink(symlink,d);
                fails(()->{try(SegmentJournal other=new SegmentJournal(symlink)){other.size();}});childDenied(d);
                Path hard=dir(root,"hard");Files.createLink(hard.resolve("journal.lock"),d.resolve("journal.lock"));
                fails(()->{try(SegmentJournal other=new SegmentJournal(hard)){other.size();}});childDenied(d);
            }
            SegmentJournal old=new SegmentJournal(d);check(old.size()==32,"rebuild index");old.close();
            try(SegmentJournal fresh=new SegmentJournal(d)){old.close();check(fresh.size()==32,"old close cannot remove new owner");childDenied(d);}
            fails(()->old.append("closed",b("x")));
            Path sample=dir(root,"sample");long prefix;
            try(SegmentJournal j=new SegmentJournal(sample)){j.append("a",b("one"));prefix=Files.size(first(sample));j.append("b",b("two"));}
            byte[] full=Files.readAllBytes(first(sample));
            for(int cut=(int)prefix;cut<full.length;cut++){
                Path c=dir(root,"tail-"+cut);Files.write(c.resolve("00000000000000000000.seg"),Arrays.copyOf(full,cut));
                try(SegmentJournal j=new SegmentJournal(c)){check(j.size()==1,"tail record count");check(Files.size(first(c))==prefix,"truncate incomplete last frame");check(j.append("b",b("two"))==1,"reappend stable sequence");}
            }
            Path corrupt=dir(root,"corrupt");Path cf=corrupt.resolve("00000000000000000000.seg");
            byte[] bad=full.clone();bad[bad.length-1]^=1;Files.write(cf,bad);
            fails(()->{try(SegmentJournal j=new SegmentJournal(corrupt)){j.size();}});check(Arrays.equals(Files.readAllBytes(cf),bad),"CRC refusal preserves bytes");
            Files.write(cf,full);try(SegmentJournal j=new SegmentJournal(corrupt)){check(j.size()==2,"constructor failure releases owner");}
            for(int field:new int[]{0,4,8}){
                byte[] broken=full.clone();broken[field]^=0x7f;Files.write(cf,broken);
                fails(()->{try(SegmentJournal j=new SegmentJournal(corrupt)){j.size();}});
                check(Arrays.equals(Files.readAllBytes(cf),broken),"header refusal preserves bytes");
            }
            // A complete frame with a recomputed CRC but invalid sequence must still be rejected.
            byte[] badSeq=full.clone();ByteBuffer.wrap(badSeq).putLong(20,9);
            int len=ByteBuffer.wrap(badSeq).getInt(8);CRC32C crc=new CRC32C();crc.update(badSeq,20,len);ByteBuffer.wrap(badSeq).putInt(12,(int)crc.getValue());
            CRC32C headerCrc=new CRC32C();headerCrc.update(badSeq,0,16);ByteBuffer.wrap(badSeq).putInt(16,(int)headerCrc.getValue());
            Files.write(cf,badSeq);fails(()->{try(SegmentJournal j=new SegmentJournal(corrupt)){j.size();}});
            // A valid-range corrupted length must not silently discard an acknowledged last frame.
            byte[] changedLength=Arrays.copyOf(full,(int)prefix);
            ByteBuffer.wrap(changedLength).putInt(8,ByteBuffer.wrap(changedLength).getInt(8)+1);
            Files.write(cf,changedLength);fails(()->{try(SegmentJournal j=new SegmentJournal(corrupt)){j.size();}});
            check(Arrays.equals(Files.readAllBytes(cf),changedLength),"bad header length preserves acknowledged bytes");
            byte[] legacy=new byte[17];ByteBuffer.wrap(legacy).putInt(0x4A4E4C31).putShort((short)1);
            Files.write(cf,legacy);fails(()->{try(SegmentJournal j=new SegmentJournal(corrupt)){j.size();}});
            check(Arrays.equals(Files.readAllBytes(cf),legacy),"old format never silently truncated as v2 tail");
            Path rotated=dir(root,"rotated");
            try(SegmentJournal j=new SegmentJournal(rotated,64)){for(int i=0;i<4;i++)j.append("id"+i,new byte[20]);}
            try(SegmentJournal j=new SegmentJournal(rotated,64)){check(j.size()==4,"rotation replay");check(j.append("id2",new byte[20])==2,"dedup across segments");}
            Path sealed=first(rotated);byte[] sealedBytes=Files.readAllBytes(sealed);Files.write(sealed,Arrays.copyOf(sealedBytes,sealedBytes.length-1));
            fails(()->{try(SegmentJournal j=new SegmentJournal(rotated,64)){j.size();}});check(Files.size(sealed)==sealedBytes.length-1,"never truncate sealed segment");
            Path fault=dir(root,"fault");AtomicInteger times=new AtomicInteger();
            try(SegmentJournal j=new SegmentJournal(fault,1024,()->{if(times.getAndIncrement()==0)throw new IOException("injected before force");})){
                fails(()->j.append("uncertain",b("x")));fails(()->j.append("other",b("y")));
            }
            try(SegmentJournal j=new SegmentJournal(fault,1024)){check(j.size()==1&&j.append("uncertain",b("x"))==0,"unknown append recovered, not blindly repeated");}
            Path huge=dir(root,"huge");Path hf=huge.resolve("00000000000000000000.seg");
            try(var raf=new RandomAccessFile(hf.toFile(),"rw")){raf.setLength(SegmentJournal.MAX_LOG_BYTES+1);}
            fails(()->{try(SegmentJournal j=new SegmentJournal(huge)){j.size();}});
            for(int n=0;n<10;n++){try(SegmentJournal j=new SegmentJournal(d)){check(j.size()==32,"repeated clean close/reopen");}}
            System.out.println("PASS JournalTests: "+checks+" bounded checks; local file/locks/rotation/tail/CRC/poison/cleanup. No power loss or replicas.");
        }catch(Exception|Error failure){testFailure=failure;throw failure;}finally{FailureTools.cleanup(testFailure, () -> {delete(root);check(!Files.exists(root),"temporary files cleaned");});}
    }
}

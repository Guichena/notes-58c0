import java.io.*;
import java.nio.*;
import java.nio.charset.*;
import java.nio.file.*;
import java.util.*;
import java.util.function.Consumer;

/** Exact line-frequency aggregation with bounded chunks and bounded fan-in.
 * Input: UTF-8, one query/line. LF and at most one CR immediately before LF are separators; EOF CR is data.
 * No case folding, trimming, Unicode normalization or hash-only equality.
 */
public final class ExternalStringCounts {
    @FunctionalInterface interface DeletePath { void delete(Path path) throws IOException; }
    /** Only a fresh private flat work directory is owned by this invocation. */
    static final class WorkCleanup implements AutoCloseable {
        private final Path directory;
        private final DeletePath delete;
        WorkCleanup(Path directory) { this(directory, Files::deleteIfExists); }
        WorkCleanup(Path directory, DeletePath delete) { this.directory=directory; this.delete=delete; }
        public void close() throws IOException {
            Throwable failure=null;
            try (DirectoryStream<Path> files=Files.newDirectoryStream(directory)) {
                for(Path file:files) {
                    try { delete.delete(file); }
                    catch(IOException | RuntimeException | Error ex) { failure=combine(failure,ex); }
                }
            } catch(IOException | RuntimeException | Error ex) { failure=combine(failure,ex); }
            try { delete.delete(directory); }
            catch(IOException | RuntimeException | Error ex) { failure=combine(failure,ex); }
            if(failure instanceof IOException ex) throw ex;
            if(failure instanceof RuntimeException ex) throw ex;
            if(failure instanceof Error ex) throw ex;
        }
        private static Throwable combine(Throwable first,Throwable next) {
            if(first==null) return next;
            if(first!=next) first.addSuppressed(next);
            return first;
        }
    }

    public static final int MAX_LINE_BYTES=32768;
    public record Entry(String key,long count){}
    private static final Comparator<Entry> BEST=(a,b)->{int c=Long.compare(b.count,a.count);return c!=0?c:a.key.compareTo(b.key);};
    private static final Comparator<Entry> WORST=BEST.reversed();
    private static String decode(byte[] bytes)throws CharacterCodingException{
        return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString();
    }
    private static String line(InputStream in)throws IOException{
        ByteArrayOutputStream out=new ByteArrayOutputStream();int c;
        while((c=in.read())!=-1 && c!='\n'){
            if(out.size()==MAX_LINE_BYTES)throw new IllegalArgumentException("line byte quota");out.write(c);
        }
        if(c==-1 && out.size()==0)return null;
        byte[] data=out.toByteArray();if(c=='\n' && data.length>0 && data[data.length-1]=='\r')data=Arrays.copyOf(data,data.length-1);
        return decode(data);
    }
    private static Path run(Path work,int stage,long number){return work.resolve("s"+stage+"-r"+number+".bin");}
    private static void write(DataOutputStream out,Entry value)throws IOException{
        byte[] key=value.key.getBytes(StandardCharsets.UTF_8);out.writeInt(key.length);out.write(key);out.writeLong(value.count);
    }
    private static Entry read(DataInputStream in)throws IOException{
        int first=in.read();if(first==-1)return null;
        int length=(first<<24)|(in.readUnsignedByte()<<16)|(in.readUnsignedByte()<<8)|in.readUnsignedByte();
        if(length<0||length>MAX_LINE_BYTES)throw new IOException("invalid owned run key length");
        byte[] key=new byte[length];in.readFully(key);long count=in.readLong();if(count<1)throw new IOException("invalid count");
        return new Entry(decode(key),count);
    }
    private static void flush(List<String> chunk,Path target)throws IOException{
        Collections.sort(chunk);
        try(DataOutputStream out=new DataOutputStream(new BufferedOutputStream(Files.newOutputStream(target)))){
            int i=0;while(i<chunk.size()){int j=i+1;while(j<chunk.size()&&chunk.get(j).equals(chunk.get(i)))j++;write(out,new Entry(chunk.get(i),j-i));i=j;}
        }
        chunk.clear();
    }
    private record Head(Entry entry,int source){}
    private static void merge(List<Path> inputs,Path target)throws IOException{
        List<DataInputStream> readers=new ArrayList<>();
        Throwable primary=null;
        PriorityQueue<Head> heap=new PriorityQueue<>(Comparator.comparing((Head h)->h.entry.key).thenComparingInt(Head::source));
        try{
            for(Path path:inputs){DataInputStream in=new DataInputStream(new BufferedInputStream(Files.newInputStream(path)));readers.add(in);Entry e=read(in);if(e!=null)heap.add(new Head(e,readers.size()-1));}
            try(DataOutputStream out=new DataOutputStream(new BufferedOutputStream(Files.newOutputStream(target)))){
                String key=null;long count=0;
                while(!heap.isEmpty()){
                    Head h=heap.remove();Entry e=h.entry;
                    if(key!=null && !key.equals(e.key)){write(out,new Entry(key,count));count=0;}
                    key=e.key;count=Math.addExact(count,e.count);
                    Entry next=read(readers.get(h.source));if(next!=null)heap.add(new Head(next,h.source));
                }
                if(key!=null)write(out,new Entry(key,count));
            }
        }catch(IOException | RuntimeException | Error ex){
            primary=ex;throw ex;
        }finally{
            IOException failure=null;
            for(DataInputStream in:readers)try{in.close();}catch(IOException ex){if(failure==null)failure=ex;else if(failure!=ex)failure.addSuppressed(ex);}
            if(failure!=null){if(primary==null)throw failure;if(primary!=failure)primary.addSuppressed(failure);}
        }
    }
    public static List<Entry> count(List<Path> inputs,Path directory,int chunkRecords,int fanIn,int k,Consumer<Entry> duplicates)throws IOException{
        Objects.requireNonNull(inputs);Objects.requireNonNull(duplicates);
        if(chunkRecords<1||fanIn<2||k<0)throw new IllegalArgumentException("invalid bounds");
        Path work=Files.createTempDirectory(directory,"exact-lines-");
        try(WorkCleanup cleanup=new WorkCleanup(work)){
            List<String> chunk=new ArrayList<>(chunkRecords);long runs=0;
            for(Path input:inputs)try(InputStream in=new BufferedInputStream(Files.newInputStream(input))){
                String s;while((s=line(in))!=null){chunk.add(s);if(chunk.size()==chunkRecords){flush(chunk,run(work,0,runs));runs=Math.incrementExact(runs);}}
            }
            if(!chunk.isEmpty()){flush(chunk,run(work,0,runs));runs=Math.incrementExact(runs);}
            if(runs==0)return List.of();
            int stage=0;
            while(runs>1){
                long next=0;
                for(long start=0;start<runs;){
                    List<Path> batch=new ArrayList<>(fanIn);for(int i=0;i<fanIn&&start<runs;i++,start++)batch.add(run(work,stage,start));
                    merge(batch,run(work,stage+1,next++));for(Path old:batch)Files.delete(old);
                }
                stage++;runs=next;
            }
            PriorityQueue<Entry> top=new PriorityQueue<>(WORST);
            try(DataInputStream in=new DataInputStream(new BufferedInputStream(Files.newInputStream(run(work,stage,0))))){
                Entry e;while((e=read(in))!=null){
                    if(e.count>1)duplicates.accept(e);
                    if(k>0){if(top.size()<k)top.add(e);else if(BEST.compare(e,top.peek())<0){top.remove();top.add(e);}}
                }
            }
            List<Entry> result=new ArrayList<>(top);result.sort(BEST);return result;
        }
    }
    /** Value-ranked occurrences, not frequency TopK. Repeated numeric values are retained. */
    public static long[] largest(PrimitiveIterator.OfLong input,int k){
        if(k<0)throw new IllegalArgumentException("negative k");PriorityQueue<Long> heap=new PriorityQueue<>();
        while(input.hasNext()){long value=input.nextLong();if(k==0)continue;if(heap.size()<k)heap.add(value);else if(value>heap.peek()){heap.remove();heap.add(value);}}
        long[] out=new long[heap.size()];for(int i=out.length-1;i>=0;i--)out[i]=heap.remove();return out;
    }
    public static void main(String[] args)throws IOException{
        Path work=Files.createTempDirectory("external-count-test-");Random random=new Random(999);
        try{
            List<Path> inputs=List.of(work.resolve("a.txt"),work.resolve("b.txt"),work.resolve("c.txt"));
            for(int test=0;test<100;test++){
                Map<String,Long> oracle=new HashMap<>();List<byte[]> snapshots=new ArrayList<>();
                for(Path f:inputs){StringBuilder text=new StringBuilder();int n=test==0?0:random.nextInt(500);for(int i=0;i<n;i++){String key=random.nextInt(15)==0?"":"查询"+random.nextInt(120);oracle.merge(key,1L,Long::sum);text.append(key).append(i%2==0?"\r\n":"\n");}Files.writeString(f,text);snapshots.add(Files.readAllBytes(f));}
                List<Entry> expected=new ArrayList<>();Map<String,Long> expectedDuplicates=new HashMap<>();for(var e:oracle.entrySet()){expected.add(new Entry(e.getKey(),e.getValue()));if(e.getValue()>1)expectedDuplicates.put(e.getKey(),e.getValue());}expected.sort(BEST);
                Map<String,Long> actualDuplicates=new HashMap<>();List<Entry> actual=count(inputs,work,17,4,7,e->{if(actualDuplicates.put(e.key,e.count)!=null)throw new AssertionError("duplicate final key");});
                if(!actual.equals(expected.subList(0,Math.min(7,expected.size())))||!actualDuplicates.equals(expectedDuplicates))throw new AssertionError();
                for(int i=0;i<inputs.size();i++)if(!Arrays.equals(snapshots.get(i),Files.readAllBytes(inputs.get(i))))throw new AssertionError("source changed");
                try(var files=Files.list(work)){if(files.count()!=3)throw new AssertionError("leak");}
            }
            if(!Arrays.equals(largest(Arrays.stream(new long[]{Long.MIN_VALUE,5,5,7,Long.MAX_VALUE}).iterator(),3),new long[]{Long.MAX_VALUE,7,5}))throw new AssertionError();
            Path bad=inputs.get(0);Files.writeString(bad,"x".repeat(MAX_LINE_BYTES+1));try{count(List.of(bad),work,17,4,7,e->{});throw new AssertionError();}catch(IllegalArgumentException expected){}
            Files.write(bad,new byte[]{(byte)0xff});try{count(List.of(bad),work,17,4,7,e->{});throw new AssertionError();}catch(CharacterCodingException expected){}
            System.out.println("PASS 100 actual multi-file external-sort runs (17-record chunks, fan-in4) vs exact Map counts/Top7/duplicates;Unicode/empty/CRLF/ties/source preservation/cleanup;value-TopK extremes;oversized/invalidUTF8 rejection");
        }finally{try(DirectoryStream<Path> files=Files.newDirectoryStream(work)){for(Path file:files)Files.deleteIfExists(file);}Files.deleteIfExists(work);}
    }
}

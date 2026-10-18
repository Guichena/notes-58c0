import java.util.*;
import java.io.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
public final class ExternalIntTop {
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

    public record Count(int value,long frequency) {}
    private static final Comparator<Count> BEST=Comparator.comparingLong(Count::frequency).reversed().thenComparingInt(Count::value);
    private static String readRecord(Reader in)throws IOException{StringBuilder line=new StringBuilder();int c;while((c=in.read())!=-1&&c!='\n'){if(line.length()==64)throw new IOException("record exceeds64 chars");line.append((char)c);}return c==-1&&line.isEmpty()?null:line.toString();}
    private static Integer readInt(DataInputStream in)throws IOException{int a=in.read();if(a<0)return null;return a<<24|in.readUnsignedByte()<<16|in.readUnsignedByte()<<8|in.readUnsignedByte();}
    private static final class Writers implements AutoCloseable {
        private final Path dir;private final LinkedHashMap<Integer,DataOutputStream> open=new LinkedHashMap<>(32,.75f,true);
        Writers(Path dir){this.dir=dir;}
        void append(int bucket,int value)throws IOException{DataOutputStream out=open.get(bucket);if(out==null){if(open.size()==32){var it=open.entrySet().iterator();var eldest=it.next();eldest.getValue().close();it.remove();}out=new DataOutputStream(new BufferedOutputStream(Files.newOutputStream(dir.resolve(bucket+".bin"),StandardOpenOption.CREATE,StandardOpenOption.APPEND),8192));open.put(bucket,out);}out.writeInt(value);}
        public void close()throws IOException{IOException failure=null;for(DataOutputStream out:open.values())try{out.close();}catch(IOException e){if(failure==null)failure=e;else if(failure!=e)failure.addSuppressed(e);}open.clear();if(failure!=null)throw failure;}
    }
    // Input UTF-8 text: exactly one signed decimal int32 per nonempty line.
    // Production lowBits=24 => 256 buckets and 192 MiB primitive counting arrays.
    public static List<Count> top(Path input,Path workDirectory,int k,int lowBits)throws IOException{
        if(k<0||lowBits<1||lowBits>24)throw new IllegalArgumentException();Objects.requireNonNull(input);Objects.requireNonNull(workDirectory);Path dir=Files.createTempDirectory(workDirectory,"int32-top-");
        try(WorkCleanup cleanup=new WorkCleanup(dir)){try(Writers writers=new Writers(dir);BufferedReader in=Files.newBufferedReader(input,StandardCharsets.UTF_8)){String line;while((line=readRecord(in))!=null){if(line.isBlank())throw new IllegalArgumentException("blank record");int value=Integer.parseInt(line.trim());writers.append(value>>>lowBits,value);}}
            int slots=1<<lowBits,mask=slots-1;long[] counts=new long[slots];int[] touched=new int[slots];PriorityQueue<Count> heap=new PriorityQueue<>(Math.max(1,k),BEST.reversed());
            try(DirectoryStream<Path> files=Files.newDirectoryStream(dir,"*.bin")){for(Path bucketFile:files){int bucket=Integer.parseInt(bucketFile.getFileName().toString().replace(".bin","")),used=0;try(DataInputStream in=new DataInputStream(new BufferedInputStream(Files.newInputStream(bucketFile)))){Integer value;while((value=readInt(in))!=null){int index=value&mask;if(counts[index]==0)touched[used++]=index;counts[index]=Math.incrementExact(counts[index]);}}for(int t=0;t<used;t++){int low=touched[t];Count hit=new Count(bucket<<lowBits|low,counts[low]);if(k>0){if(heap.size()<k)heap.add(hit);else if(BEST.compare(hit,heap.peek())<0){heap.remove();heap.add(hit);}}counts[low]=0;}}}
            List<Count> result=new ArrayList<>(heap);result.sort(BEST);return result;
        }
    }
    public static void main(String[] args)throws Exception{Path base=Files.createTempDirectory("external-top-test-");try{Path input=base.resolve("input.txt");Random random=new Random(840);for(int test=0;test<20;test++){Map<Integer,Long> expected=new HashMap<>();StringBuilder data=new StringBuilder();for(int i=0,n=1000+random.nextInt(2000);i<n;i++){int v=i%17==0?Integer.MIN_VALUE:i%19==0?Integer.MAX_VALUE:random.nextInt(501)-250;data.append(v).append('\n');expected.merge(v,1L,Long::sum);}Files.writeString(input,data,StandardCharsets.UTF_8);List<Count> oracle=new ArrayList<>();for(var e:expected.entrySet())oracle.add(new Count(e.getKey(),e.getValue()));oracle.sort(BEST);oracle=new ArrayList<>(oracle.subList(0,Math.min(10,oracle.size())));for(int bits:new int[]{4,8,12})if(!top(input,base,10,bits).equals(oracle))throw new AssertionError();}
            Files.writeString(input,"7\n".repeat(10000),StandardCharsets.UTF_8);if(!top(input,base,10,8).equals(List.of(new Count(7,10000))))throw new AssertionError();Files.writeString(input,"",StandardCharsets.UTF_8);if(!top(input,base,10,8).isEmpty())throw new AssertionError();Files.writeString(input,"1\n2147483648\n",StandardCharsets.UTF_8);try{top(input,base,10,8);throw new AssertionError();}catch(NumberFormatException ok){}try(var files=Files.list(base)){if(files.count()!=1)throw new AssertionError("temporary bucket cleanup");}Files.delete(input);System.out.println("PASS 60 real disk partition/count top10 comparisons; signed extremes/ties/all-identical/empty/invalid/cleanup; no 4TB run claimed");
        }finally{try(var files=Files.list(base)){for(Path file:files.toList())Files.delete(file);}Files.delete(base);}}
}

import java.nio.file.*;
import java.io.*;
import java.util.*;
public class CleanupFaultTests {
 @FunctionalInterface interface Factory { AutoCloseable create(Path p,List<Path> attempts,Throwable shared); }
 static Throwable observed(Factory f,Path p,Throwable primary,List<Path> attempts,Throwable shared){
  try(AutoCloseable cleanup=f.create(p,attempts,shared)){
   if(primary instanceof IOException x)throw x;
   if(primary instanceof RuntimeException x)throw x;
   if(primary instanceof Error x)throw x;
  }catch(Throwable x){return x;}
  return null;
 }
 static void fail(Path p,List<Path> attempts,Throwable shared)throws IOException {
  attempts.add(p);
  if(shared instanceof IOException x)throw x;
  if(shared instanceof RuntimeException x)throw x;
  if(shared instanceof Error x)throw x;
  throw new IOException("delete failed: "+p.getFileName());
 }
 public static void main(String[] args)throws Exception{
  List<Factory> fs=List.of((p,a,s)->new ExternalIntTop.WorkCleanup(p,q->fail(q,a,s)),(p,a,s)->new ExternalStringCounts.WorkCleanup(p,q->fail(q,a,s)));
  int checks=0;
  for(Factory f:fs){Path p=Files.createTempDirectory("cleanup-fault-");try{
   Files.writeString(p.resolve("one"),"1");Files.writeString(p.resolve("two"),"2");
   for(Throwable primary:new Throwable[]{null,new IOException("read failed"),new IllegalArgumentException("invalid input"),new AssertionError("primary error")}){
    List<Path>a=new ArrayList<>();Throwable got=observed(f,p,primary,a,null);
    if(a.size()!=3||!a.getLast().equals(p))throw new AssertionError("must try all files and directory");
    if(primary!=null){if(got!=primary||got.getSuppressed().length!=1||got.getSuppressed()[0].getSuppressed().length!=2)throw new AssertionError("lost primary/secondary");}
    else if(!(got instanceof IOException)||got.getSuppressed().length!=2)throw new AssertionError("cleanup-only must fail");
    checks++;
   }
   for(Throwable cleanup:new Throwable[]{new IOException("shared"),new SecurityException("denied"),new AssertionError("delete error")}){
    List<Path>a=new ArrayList<>();Throwable primary=new IOException("primary"),got=observed(f,p,primary,a,cleanup);
    if(got!=primary||a.size()!=3||got.getSuppressed().length!=1||got.getSuppressed()[0]!=cleanup||cleanup.getSuppressed().length!=0)throw new AssertionError("self suppression or lost unchecked failure");
    checks++;
   }
  }finally{try(var list=Files.list(p)){for(Path q:list.toList())Files.delete(q);}Files.delete(p);}}
  for(int i=0;i<2;i++){Path p=Files.createTempDirectory("cleanup-real-");Files.writeString(p.resolve("a"),"x");try(AutoCloseable c=i==0?new ExternalIntTop.WorkCleanup(p):new ExternalStringCounts.WorkCleanup(p)){}if(Files.exists(p))throw new AssertionError("normal cleanup");checks++;}
  System.out.println("PASS "+checks+" injected cleanup cases; primary IOException/RuntimeException/Error identity retained; all deletion attempts; cleanup-only failure; no self-suppression; normal removal");
 }
}

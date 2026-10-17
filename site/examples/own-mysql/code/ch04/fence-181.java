import java.util.*;
public final class TraceRowKeyTest {
  private static int checks;
  static void check(boolean ok){checks++;if(!ok)throw new AssertionError("check "+checks);}
  static void invalid(Runnable r){try{r.run();throw new AssertionError("expected invalid");}catch(IllegalArgumentException expected){checks++;}}
  public static void main(String[] args){
    invalid(()->TraceRowKey.prefix(-1,0));invalid(()->TraceRowKey.prefix(0,-1));
    invalid(()->TraceRowKey.encode(0,0,-1));invalid(()->TraceRowKey.decode(new byte[24]));
    invalid(()->TraceRowKey.decode(null));invalid(()->TraceRowKey.exclusiveEnd(null));
    check(TraceRowKey.exclusiveEnd(new byte[]{(byte)255}).isEmpty());
    check(TraceRowKey.exclusiveEnd(new byte[0]).isEmpty());
    check(Arrays.equals(TraceRowKey.exclusiveEnd(new byte[]{1,(byte)255}).orElseThrow(),new byte[]{2}));
    Random random=new Random(20261010);
    for(int i=0;i<10000;i++){
      long tenant=random.nextLong()&Long.MAX_VALUE,trace=random.nextLong()&Long.MAX_VALUE;
      long seq=random.nextLong()&Long.MAX_VALUE;
      byte[] key=TraceRowKey.encode(tenant,trace,seq),prefix=TraceRowKey.prefix(tenant,trace);
      check(TraceRowKey.decode(key).equals(new TraceRowKey.Decoded(tenant,trace,seq)));
      check(TraceRowKey.inPrefixRange(key,prefix));
      check(Arrays.compareUnsigned(key,prefix)>=0);
      check(Arrays.compareUnsigned(key,TraceRowKey.exclusiveEnd(prefix).orElseThrow())<0);
      if(seq<Long.MAX_VALUE)check(Arrays.compareUnsigned(key,TraceRowKey.encode(tenant,trace,seq+1))<0);
      byte[] bad=key.clone();bad[0]^=1;invalid(()->TraceRowKey.decode(bad));
    }
    byte[] maximum=TraceRowKey.encode(Long.MAX_VALUE,Long.MAX_VALUE,Long.MAX_VALUE);
    check(TraceRowKey.decode(maximum).sequence()==Long.MAX_VALUE);
    System.out.println("PASS TraceRowKey checks="+checks+", random round trips=10000; no HBase server invoked");
  }
}

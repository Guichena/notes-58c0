import java.util.*;
public final class ArchitectureTest {
 private static int checks;
 private static void check(boolean ok,String what){checks++;if(!ok)throw new AssertionError(what);}
 private static List<EqualityJoin.Pair> oracle(List<EqualityJoin.Row> left,List<EqualityJoin.Row> right,boolean outer){
  List<EqualityJoin.Pair> out=new ArrayList<>();
  for(var l:left){boolean found=false;for(var r:right)if(l.key()!=null&&r.key()!=null&&l.key().equals(r.key())){out.add(new EqualityJoin.Pair(l,r));found=true;}
   if(outer&&!found)out.add(new EqualityJoin.Pair(l,null));}
  return out;
 }
 public static void main(String[]args){
  Random random=new Random(682104);int rows=0;
  for(int i=0;i<5000;i++){
   List<EqualityJoin.Row> l=new ArrayList<>(),r=new ArrayList<>();
   for(int j=0;j<random.nextInt(12);j++)l.add(new EqualityJoin.Row(j,random.nextInt(4)==0?null:random.nextInt(4),"L"+j));
   for(int j=0;j<random.nextInt(12);j++)r.add(new EqualityJoin.Row(j,random.nextInt(4)==0?null:random.nextInt(4),"R"+j));
   for(boolean outer:new boolean[]{false,true}){var expected=oracle(l,r,outer);var got=EqualityJoin.join(l,r,outer);check(got.equals(expected),"bag join");rows+=got.size();}
  }
  var two=List.of(new EqualityJoin.Row(1,7,"a"),new EqualityJoin.Row(2,7,"b"));
  var three=List.of(new EqualityJoin.Row(3,7,"c"),new EqualityJoin.Row(4,7,"d"),new EqualityJoin.Row(5,7,"e"));
  check(EqualityJoin.join(two,three,false).size()==6,"2x3 multiplicity");
  var nil=List.of(new EqualityJoin.Row(7,null,"x"));
  check(EqualityJoin.join(nil,nil,false).isEmpty(),"SQL NULL not equality");
  check(EqualityJoin.join(nil,nil,true).getFirst().right()==null,"left null extension");
  int[] owners=new int[16];for(int i=0;i<16;i++)owners[i]=i;
  ShardRouting original=new ShardRouting(owners);owners[0]=999;
  ShardRouting moved=original.movedBucket(3,99);Set<Integer> buckets=new HashSet<>();
  for(long i=0;i<16000;i++){
   long id=i*16;int bucket=original.bucket(id);buckets.add(bucket);check(Math.floorMod(id,16)==0,"raw low bits skew");
   check(moved.owner(id)==(bucket==3?99:bucket),"only chosen bucket owner changes");
   check(original.owner(id)==bucket,"immutable original owner map");
  }
  check(buckets.size()==16,"fixed sample mixed coverage");
  for(long id:new long[]{Long.MIN_VALUE,Long.MAX_VALUE,-1,0,1})check(original.bucket(id)>=0&&original.bucket(id)<16,"signed hash range");
  for(int i=0;i<1000;i++)check(original.bucket(7)==original.bucket(7),"one hot key remains one bucket");
  RoutingDemo.main(args);
  System.out.println("PASS ArchitectureTest checks="+checks+", joined rows compared="+rows+"; pure algorithms only");
 }
}

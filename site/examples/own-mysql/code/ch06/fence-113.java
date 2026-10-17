import java.util.*;
/** Ordinary SQL equality semantics: NULL never equals NULL; bag multiplicity preserved. */
public final class EqualityJoin {
 public record Row(long id,Integer key,String payload){}
 public record Pair(Row left,Row right){} // right null is LEFT JOIN null-extension
 public static List<Pair> join(List<Row> left,List<Row> right,boolean leftOuter){
  Map<Integer,List<Row>> buckets=new HashMap<>();
  for(Row r:right){Objects.requireNonNull(r);if(r.key()!=null)buckets.computeIfAbsent(r.key(),k->new ArrayList<>()).add(r);}
  List<Pair> out=new ArrayList<>();
  for(Row l:left){Objects.requireNonNull(l);List<Row> matches=l.key()==null?null:buckets.get(l.key());
   if(matches!=null)for(Row r:matches)out.add(new Pair(l,r));
   else if(leftOuter)out.add(new Pair(l,null));
  }
  return out;
 }
}

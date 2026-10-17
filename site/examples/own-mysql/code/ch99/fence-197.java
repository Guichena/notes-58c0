import java.util.*;
public final class BPlusTreeTest {
  private static int checks;
  static void check(boolean ok){checks++;if(!ok)throw new AssertionError("check "+checks);}
  static void invalid(Runnable r){try{r.run();throw new AssertionError("expected invalid");}catch(IllegalArgumentException expected){checks++;}}
  public static void main(String[] args){
    invalid(()->new BPlusTree(2));invalid(()->TreeHeight.estimate(-1,600,60));
    invalid(()->TreeHeight.estimate(1,1,60));invalid(()->TreeHeight.estimate(1,600,0));
    check(TreeHeight.estimate(10000000,600,60)==3);
    check(TreeHeight.estimate(10000000,600,12)==4);
    check(TreeHeight.estimate(0,600,60)==1);
    check(TreeHeight.estimate(Long.MAX_VALUE,2,1)==64);
    for(int max:new int[]{3,4,5,8,16,31}){
      BPlusTree t=new BPlusTree(max);TreeMap<Integer,String> oracle=new TreeMap<>();
      check(t.get(0)==null);check(t.range(0,0).isEmpty());check(t.height()==1);t.validate();
      Random random=new Random(20261010L+max);
      for(int i=0;i<10000;i++){
        int k=random.nextInt(6001)-3000;String v="v"+i;
        t.put(k,v);oracle.put(k,v);check(Objects.equals(t.get(k),v));
        if(i%23==0){
          t.validate();int lo=random.nextInt(6001)-3000,hi=random.nextInt(6001)-3000;
          List<BPlusTree.Entry> expected=new ArrayList<>();
          if(lo<hi)oracle.subMap(lo,true,hi,false).forEach((key,value)->expected.add(new BPlusTree.Entry(key,value)));
          check(t.range(lo,hi).equals(expected));
        }
      }
      t.put(Integer.MIN_VALUE,"min");t.put(Integer.MAX_VALUE,"max");t.validate();
      check(t.get(Integer.MIN_VALUE).equals("min"));check(t.get(Integer.MAX_VALUE).equals("max"));
      check(t.range(Integer.MAX_VALUE,Integer.MIN_VALUE).isEmpty());
      for(var e:oracle.entrySet())check(Objects.equals(t.get(e.getKey()),e.getValue()));
      try{t.put(0,null);throw new AssertionError("null accepted");}catch(NullPointerException expected){checks++;}
    }
    System.out.println("PASS BPlusTree/TreeHeight checks="+checks+", random insert/update operations=60000");
  }
}

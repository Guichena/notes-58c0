import java.util.*;
import java.math.*;
/** Independent bounded recursive oracle for shallow generated trees; production remains extracted iterative Java. */
public final class JsonBudgetOracle {
    static final Object MISSING=new Object();static int checks;static Random random=new Random(762901);
    static void check(boolean b,String reason){checks++;if(!b)throw new AssertionError(reason);}
    static BigDecimal num(Number n){return new BigDecimal(n.toString());}
    static boolean equal(Object a,Object b){return a instanceof Number x&&b instanceof Number y?num(x).compareTo(num(y))==0:Objects.equals(a,b);}
    static int nodes(Object x){int n=1;if(x instanceof Map<?,?> m)for(Object v:m.values())n+=nodes(v);else if(x instanceof List<?> a)for(Object v:a)n+=nodes(v);return n;}
    static int diffCost(Object a,Object b){
        if(a==MISSING)return 2+nodes(b);if(b==MISSING)return 2;
        int cost=1;
        if(a instanceof Map<?,?> aa && b instanceof Map<?,?> bb){Set<Object> keys=new HashSet<>(aa.keySet());keys.addAll(bb.keySet());for(Object key:keys)cost+=diffCost(aa.containsKey(key)?aa.get(key):MISSING,bb.containsKey(key)?bb.get(key):MISSING);return cost;}
        if(a instanceof List<?> aa && b instanceof List<?> bb){for(int i=0;i<Math.max(aa.size(),bb.size());i++)cost+=diffCost(i<aa.size()?aa.get(i):MISSING,i<bb.size()?bb.get(i):MISSING);return cost;}
        boolean same=!(a instanceof Map||a instanceof List||b instanceof Map||b instanceof List)&&equal(a,b);
        return same?cost:cost+1+nodes(b);
    }
    static Object tree(int depth){int kind=random.nextInt(depth==0?4:6);return switch(kind){
        case 0->null;case 1->random.nextBoolean();case 2->random.nextInt(5);case 3->"s"+random.nextInt(3);
        case 4->{List<Object>a=new ArrayList<>();for(int i=0,n=random.nextInt(4);i<n;i++)a.add(tree(depth-1));yield a;}
        default->{Map<String,Object>m=new LinkedHashMap<>();for(int i=0,n=random.nextInt(4);i<n;i++)m.put("k/"+i+"~",tree(depth-1));yield m;}
    };}
    static void reject(Runnable r){try{r.run();throw new AssertionError("accepted insufficient global budget");}catch(IllegalArgumentException expected){checks++;}}
    static void testPair(Object a,Object b){int n=diffCost(a,b);JsonOperations.diff(a,b,n);checks++;if(n>1)reject(()->JsonOperations.diff(a,b,n-1));}
    public static void main(String[] args){
        testPair(Map.of(),Map.of("a",List.of(1,2),"b",List.of(3,4)));
        reject(()->JsonOperations.diff(Map.of(),Map.of("a",List.of(1,2),"b",List.of(3,4)),3));
        for(int i=0;i<5000;i++)testPair(tree(4),tree(4));
        List<Object> child=new ArrayList<>(Arrays.asList(1,null,Map.of("/",2)));
        var result=JsonOperations.diff(Map.of(),Map.of("a",child),100);child.set(0,9);
        check(((List<?>)result.get(0).value()).get(0).equals(new BigDecimal("1")),"deep copied add");
        check(JsonOperations.diff(new BigDecimal("1.0"),1,1).isEmpty(),"numeric equality");
        check(JsonOperations.diff(Map.of("a/b~",1),Map.of("a/b~",2),20).get(0).pointer().equals("/a~1b~0"),"JSON pointer escape");
        check(JsonOperations.diff(Arrays.asList(1,2,3),List.of(1),20).stream().map(JsonOperations.Change::pointer).collect(java.util.stream.Collectors.toSet()).equals(Set.of("/1","/2")),"original array indices");
        // Virtual huge list: allocation or element expansion before reserving the batch would fail this test.
        List<Object> huge=new AbstractList<>(){public int size(){return Integer.MAX_VALUE;}public Object get(int i){throw new AssertionError("expanded before reserving");}};
        reject(()->JsonOperations.merge(List.of(),huge,false,2));reject(()->JsonOperations.diff(List.of(),huge,2));reject(()->JsonOperations.leaves(huge,2));
        reject(()->JsonOperations.diff(Map.of(),Map.of("x",huge),10));
        check(JsonOperations.leaves(null,2).get(0).pointer().isEmpty(),"root pointer");reject(()->JsonOperations.leaves(null,1));
        check(JsonOperations.merge(null,1,false,1).equals(new BigDecimal("1")),"merge single unit");
        System.out.println("JsonBudgetOracle PASS "+checks+" independent checks; 5000 random exact-cost boundaries");
    }
}

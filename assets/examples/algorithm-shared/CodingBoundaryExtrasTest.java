import java.util.*;
import java.math.*;
public final class CodingBoundaryExtrasTest {
    static int checks;static final Random random=new Random(183237227);
    static void eq(Object a,Object b){checks++;if(!Objects.equals(a,b))throw new AssertionError(a+" != "+b);}
    record Expr(String text,BigInteger value){}
    static Expr expression(int depth){if(depth==0||random.nextInt(4)==0){int v=random.nextInt(50);return new Expr(""+v,BigInteger.valueOf(v));}Expr a=expression(depth-1),b=expression(depth-1);char op="+-*/".charAt(random.nextInt(4));if(op=='/'&&b.value().signum()==0)b=new Expr("1",BigInteger.ONE);BigInteger value=switch(op){case '+'->a.value().add(b.value());case '-'->a.value().subtract(b.value());case '*'->a.value().multiply(b.value());default->a.value().divide(b.value());};String text="("+a.text()+op+b.text()+")";if(random.nextBoolean()){text="-"+text;value=value.negate();}return new Expr(text,value);}
    public static void main(String[] args)throws Exception{
        eq(StackCalculator.basic("3+2*2",100),BigInteger.valueOf(7));eq(StackCalculator.basic(" 3/2 ",100),BigInteger.ONE);eq(StackCalculator.extended("-(-3)+8/-3",100),BigInteger.ONE);
        for(int i=0;i<20000;i++){Expr e=expression(5);eq(StackCalculator.extended(e.text(),100000),e.value());}
        for(String s:List.of(""," ","()","(1","1)","1 2","2(3)","1+","*1","a",".5","1**2")){try{StackCalculator.extended(s,100);throw new AssertionError(s);}catch(IllegalArgumentException expected){checks++;}}
        for(String s:List.of("-1","+1","(1)","1+-2")){try{StackCalculator.basic(s,100);throw new AssertionError(s);}catch(IllegalArgumentException expected){checks++;}}
        try{StackCalculator.basic("1/0",100);throw new AssertionError();}catch(ArithmeticException expected){checks++;}
        for(int i=0;i<10000;i++){long n=random.nextLong()&Long.MAX_VALUE;int places=random.nextInt(7);for(boolean round:new boolean[]{false,true}){String expected=BigDecimal.valueOf(n).sqrt(new MathContext(60)).setScale(places,round?RoundingMode.HALF_UP:RoundingMode.DOWN).toPlainString();eq(CodingBoundaryExtras.squareRoot(n,places,round),expected);}}
        for(int i=0;i<20000;i++){long n=random.nextLong()&Long.MAX_VALUE;for(boolean up:new boolean[]{false,true})eq(CodingBoundaryExtras.squareRootFiveNoMath(n,up),CodingBoundaryExtras.squareRoot(n,5,up));}
        for(long n:new long[]{0,1,2,4,Long.MAX_VALUE})for(boolean up:new boolean[]{false,true})eq(CodingBoundaryExtras.squareRootFiveNoMath(n,up),CodingBoundaryExtras.squareRoot(n,5,up));
        eq(CodingBoundaryExtras.squareRoot(2,5,true),"1.41421");eq(CodingBoundaryExtras.squareRoot(0,5,false),"0.00000");
        for(int t=0;t<8000;t++){List<int[]> rows=new LinkedList<>();List<Integer> all=new ArrayList<>();for(int i=random.nextInt(10);i>0;i--){int[] a=new int[random.nextInt(12)];for(int j=0;j<a.length;j++){a[j]=random.nextInt();all.add(a[j]);}Arrays.sort(a);rows.add(a);}Collections.sort(all);var got=CodingBoundaryExtras.medianOfSortedArrays(rows);if(all.isEmpty())eq(got,Optional.empty());else eq(got.orElseThrow(),new CodingBoundaryExtras.Middle(all.get((all.size()-1)/2),all.get(all.size()/2)));}
        CodingBoundaryExtras.DoublyList<Integer> list=new CodingBoundaryExtras.DoublyList<>();List<Integer> oracle=new ArrayList<>();
        for(int t=0;t<5000;t++){int op=random.nextInt(4),value=random.nextInt();if(op==0){list.addFirst(value);oracle.add(0,value);}else if(op==1){list.addLast(value);oracle.add(value);}else if(op==2){int index=random.nextInt(oracle.size()+1);list.insert(index,value);oracle.add(index,value);}else{list.reverse();Collections.reverse(oracle);}list.checkInvariants();eq(list.values(),oracle);eq(list.size(),oracle.size());}
        StringBuilder printed=new StringBuilder();list.print(printed);eq(printed.toString(),String.join(" ",oracle.stream().map(Object::toString).toList())+"\n");
        System.out.println("PASS CodingBoundaryExtrasTest checks="+checks);
    }
}

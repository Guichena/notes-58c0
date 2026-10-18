import java.util.*;
import java.io.*;
public final class DoublyListTopicTest {
    static int checks;
    static void eq(Object a,Object b){checks++;if(!Objects.equals(a,b))throw new AssertionError(a+" != "+b);}
    static void bad(Class<? extends Throwable> type,Runnable r){checks++;try{r.run();throw new AssertionError("not rejected");}catch(Throwable t){if(!type.isInstance(t))throw new AssertionError(t);}}
    public static void main(String[]args)throws Exception{
        var list=new CodingBoundaryExtras.DoublyList<Integer>();List<Integer> oracle=new ArrayList<>();Random random=new Random(183237227);
        list.reverse();list.checkInvariants();eq(list.values(),List.of());bad(IndexOutOfBoundsException.class,()->list.insert(-1,1));bad(IndexOutOfBoundsException.class,()->list.insert(1,1));bad(NullPointerException.class,()->list.addFirst(null));
        for(int t=0;t<5000;t++){int op=random.nextInt(4),value=random.nextInt();if(op==0){list.addFirst(value);oracle.add(0,value);}else if(op==1){list.addLast(value);oracle.add(value);}else if(op==2){int index=random.nextInt(oracle.size()+1);list.insert(index,value);oracle.add(index,value);}else{list.reverse();Collections.reverse(oracle);}list.checkInvariants();eq(list.values(),oracle);eq(list.size(),oracle.size());}
        StringBuilder printed=new StringBuilder();list.print(printed);eq(printed.toString(),String.join(" ",oracle.stream().map(Object::toString).toList())+"\n");
        var single=new CodingBoundaryExtras.DoublyList<Integer>();single.addLast(8);single.reverse();single.checkInvariants();eq(single.values(),List.of(8));
        class Broken implements Appendable{StringBuilder prefix=new StringBuilder();public Appendable append(CharSequence x)throws IOException{if(prefix.length()>0)throw new IOException("planned");prefix.append(x);return this;}public Appendable append(char x)throws IOException{throw new IOException("planned");}public Appendable append(CharSequence x,int s,int e)throws IOException{return append(x.subSequence(s,e));}}
        Broken broken=new Broken();try{single.print(broken);throw new AssertionError();}catch(IOException expected){checks++;eq(broken.prefix.toString(),"8");}single.checkInvariants();eq(single.values(),List.of(8));
        System.out.println("PASS DoublyListTopicTest checks="+checks+"; 5000 ArrayList model operations, invariant checks, empty/singleton, insertion bounds, null, print and partial IOException");
    }
}

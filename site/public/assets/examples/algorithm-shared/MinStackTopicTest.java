import java.util.*;
public final class MinStackTopicTest {
    static int checks;
    static void eq(Object a,Object b){checks++;if(!Objects.equals(a,b))throw new AssertionError(a+" != "+b);}
    static void empty(Runnable r){checks++;try{r.run();throw new AssertionError();}catch(NoSuchElementException expected){}}
    public static void main(String[]args){
        var min=new InterviewCaches.MinStack();var both=new MinMaxStackExample.MinMaxStack();List<Integer> model=new ArrayList<>();Random r=new Random(155);
        for(int t=0;t<12000;t++){if(model.isEmpty()||r.nextBoolean()){int x=t%97==0?Integer.MIN_VALUE:t%101==0?Integer.MAX_VALUE:r.nextInt(7)-3;model.add(x);min.push(x);both.push(x);}else{int x=model.remove(model.size()-1);eq(min.pop(),x);eq(both.pop(),x);}eq(min.isEmpty(),model.isEmpty());if(!model.isEmpty()){eq(min.peek(),model.get(model.size()-1));eq(min.minimum(),Collections.min(model));eq(both.min(),Collections.min(model));eq(both.max(),Collections.max(model));}}
        while(!model.isEmpty()){int x=model.remove(model.size()-1);eq(min.pop(),x);eq(both.pop(),x);}empty(min::pop);empty(min::peek);empty(min::minimum);empty(both::pop);empty(both::min);empty(both::max);
        for(int x:new int[]{2,1,1}){min.push(x);both.push(x);}eq(min.pop(),1);eq(min.minimum(),1);eq(both.pop(),1);eq(both.min(),1);
        System.out.println("PASS MinStackTopicTest checks="+checks+"; 12000 model operations, duplicate minima, int extremes, empty exceptions");
    }
}

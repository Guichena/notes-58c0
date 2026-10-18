import java.util.*;
public final class MinMaxStackExample {
    private MinMaxStackExample() {}
    public static final class MinMaxStack {private static final class Entry{int value,min,max;Entry next;Entry(int x,Entry n){value=x;min=n==null?x:Math.min(x,n.min);max=n==null?x:Math.max(x,n.max);next=n;}}private Entry head;
        public void push(int x){head=new Entry(x,head);}public int pop(){if(head==null)throw new NoSuchElementException();int x=head.value;head=head.next;return x;}public int min(){if(head==null)throw new NoSuchElementException();return head.min;}public int max(){if(head==null)throw new NoSuchElementException();return head.max;}}
}

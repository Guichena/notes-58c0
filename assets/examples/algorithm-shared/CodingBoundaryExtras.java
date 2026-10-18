import java.math.BigInteger;
import java.util.*;
import java.io.IOException;

public final class CodingBoundaryExtras {
    private CodingBoundaryExtras() {}
    /** Decimal sqrt via INTEGER BINARY SEARCH only. Rounds down or half-up, never calls sqrt(). */
    public static String squareRoot(long n,int decimals,boolean halfUp){
        if(n<0||decimals<0||decimals>1000)throw new IllegalArgumentException("nonnegative n; decimals 0..1000");
        BigInteger scale=BigInteger.TEN.pow(decimals),scaled=BigInteger.valueOf(n).multiply(scale).multiply(scale);
        BigInteger low=BigInteger.ZERO,high=BigInteger.ONE.shiftLeft((scaled.bitLength()+1)/2+1);
        while(high.subtract(low).compareTo(BigInteger.ONE)>0){BigInteger middle=low.add(high).shiftRight(1);if(middle.multiply(middle).compareTo(scaled)<=0)low=middle;else high=middle;}
        if(halfUp&&scaled.shiftLeft(2).compareTo(low.shiftLeft(1).add(BigInteger.ONE).pow(2))>=0)low=low.add(BigInteger.ONE);
        String digits=low.toString();if(decimals==0)return digits;
        if(digits.length()<=decimals)digits="0".repeat(decimals+1-digits.length())+digits;
        return digits.substring(0,digits.length()-decimals)+"."+digits.substring(digits.length()-decimals);
    }
    /** Five decimal places with only primitive integer arithmetic: no Math.sqrt/BigInteger/BigDecimal. */
    public static String squareRootFiveNoMath(long n,boolean halfUp){
        if(n<0)throw new IllegalArgumentException("nonnegative integer");
        long[] target=product128(n,10000000000L);long low=0,high=400000000000001L;
        while(high-low>1){long middle=low+(high-low)/2;if(compare128(product128(middle,middle),target)<=0)low=middle;else high=middle;}
        if(halfUp){long[] four=target.clone();long carry=0;for(int i=0;i<four.length;i++){long v=four[i]*4+carry;four[i]=v&65535;carry=v>>>16;}if(carry!=0)throw new AssertionError("fixed range");long twice=2*low+1;if(compare128(four,product128(twice,twice))>=0)low++;}
        String digits=Long.toString(low);if(digits.length()<=5)digits="0".repeat(6-digits.length())+digits;
        return digits.substring(0,digits.length()-5)+"."+digits.substring(digits.length()-5);
    }
    private static long[] product128(long a,long b){
        long[] p=new long[8];for(int i=0;i<4;i++)for(int j=0;j<4;j++)p[i+j]+=((a>>>(16*i))&65535)*((b>>>(16*j))&65535);
        for(int i=0;i<7;i++){p[i+1]+=p[i]>>>16;p[i]&=65535;}return p;
    }
    private static int compare128(long[] a,long[] b){for(int i=7;i>=0;i--)if(a[i]!=b[i])return a[i]<b[i]?-1:1;return 0;}
    private record Cursor(int value,int row,int column){}
    public record Middle(int lower,int upper){public double mean(){return ((long)lower+upper)/2.0;}}
    /** Each array sorted ascending; row ordering is NOT required. Does not modify inputs. */
    public static Optional<Middle> medianOfSortedArrays(List<int[]> arrays){
        Objects.requireNonNull(arrays);List<int[]> rows=new ArrayList<>();long total=0;
        PriorityQueue<Cursor> heap=new PriorityQueue<>(Comparator.comparingInt(Cursor::value).thenComparingInt(Cursor::row));
        for(int[] row:arrays){Objects.requireNonNull(row);int index=rows.size();rows.add(row);total=Math.addExact(total,row.length);if(row.length>0)heap.add(new Cursor(row[0],index,0));}
        if(total==0)return Optional.empty();long lowerRank=(total-1)/2,upperRank=total/2;int lower=0,upper=0;
        for(long rank=0;rank<=upperRank;rank++){
            Cursor c=heap.remove();if(rank==lowerRank)lower=c.value();if(rank==upperRank)upper=c.value();int next=c.column()+1;
            int[] row=rows.get(c.row());if(next<row.length)heap.add(new Cursor(row[next],c.row(),next));
        }
        return Optional.of(new Middle(lower,upper));
    }
    /** Mutable, single-threaded, null-free doubly linked list. No nodes are exposed. */
    public static final class DoublyList<T> {
        private static final class Node<T>{final T value;Node<T> previous,next;Node(T value){this.value=value;}}
        private Node<T> head,tail;private int size;
        public int size(){return size;}
        public void addFirst(T value){insert(0,value);}
        public void addLast(T value){insert(size,value);}
        public void insert(int index,T value){
            if(index<0||index>size)throw new IndexOutOfBoundsException(index);Objects.requireNonNull(value);if(size==Integer.MAX_VALUE)throw new IllegalStateException("size limit");
            Node<T> right;
            if(index==size)right=null;
            else if(index<size/2){right=head;for(int i=0;i<index;i++)right=right.next;}
            else {right=tail;for(int i=size-1;i>index;i--)right=right.previous;}
            Node<T> left=right==null?tail:right.previous,node=new Node<>(value);node.previous=left;node.next=right;
            if(left==null)head=node;else left.next=node;if(right==null)tail=node;else right.previous=node;size++;
        }
        public void reverse(){Node<T> node=head;while(node!=null){Node<T> next=node.next;node.next=node.previous;node.previous=next;node=next;}Node<T> old=head;head=tail;tail=old;}
        public List<T> values(){List<T> out=new ArrayList<>(size);for(Node<T> n=head;n!=null;n=n.next)out.add(n.value);return List.copyOf(out);}
        public void print(Appendable out)throws IOException{Objects.requireNonNull(out);boolean first=true;for(Node<T> n=head;n!=null;n=n.next){if(!first)out.append(' ');out.append(String.valueOf(n.value));first=false;}out.append('\n');}
        public void checkInvariants(){int count=0;Node<T> previous=null;for(Node<T> n=head;n!=null;n=n.next){if(n.previous!=previous)throw new AssertionError("back link");previous=n;if(++count>size)throw new AssertionError("cycle");}if(previous!=tail||count!=size)throw new AssertionError("tail/size");}
    }
}

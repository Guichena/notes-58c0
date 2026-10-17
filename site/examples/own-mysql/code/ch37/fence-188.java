import java.util.Arrays;
import java.util.Objects;

/** Three separate int-array contracts; no missing source conditions inferred. */
public final class MergeArrays {
    private MergeArrays() { }

    private static void sorted(int[] a, int length) {
        for (int i = 1; i < length; i++) {
            if (a[i - 1] > a[i]) {
                throw new IllegalArgumentException("input must be nondecreasing");
            }
        }
    }

    public static int[] concatenate(int[] a, int[] b) {
        Objects.requireNonNull(a, "a");
        Objects.requireNonNull(b, "b");
        int length = Math.addExact(a.length, b.length);
        int[] out = Arrays.copyOf(a, length);
        System.arraycopy(b, 0, out, a.length, b.length);
        return out;
    }

    public static int[] mergeSorted(int[] a, int[] b) {
        Objects.requireNonNull(a, "a");
        Objects.requireNonNull(b, "b");
        sorted(a, a.length);
        sorted(b, b.length);
        int[] out = new int[Math.addExact(a.length, b.length)];
        int i = 0, j = 0, k = 0;
        while (i < a.length && j < b.length) {
            out[k++] = a[i] <= b[j] ? a[i++] : b[j++];
        }
        while (i < a.length) { out[k++] = a[i++]; }
        while (j < b.length) { out[k++] = b[j++]; }
        return out;
    }

    public static void mergeInto(int[] a, int m, int[] b) {
        Objects.requireNonNull(a, "a");
        Objects.requireNonNull(b, "b");
        if (a == b || m < 0 || m > a.length || a.length - m != b.length) {
            throw new IllegalArgumentException("alias, logical length or capacity");
        }
        sorted(a, m);
        sorted(b, b.length);
        int i = m - 1, j = b.length - 1, k = a.length - 1;
        while (j >= 0) {
            if (i >= 0 && a[i] > b[j]) { a[k--] = a[i--]; }
            else { a[k--] = b[j--]; }
        }
    }
    private static void equal(int[] expected,int[] actual) {
        if(!Arrays.equals(expected,actual))throw new AssertionError(Arrays.toString(actual));
    }
    private static void bad(Runnable action) {
        try{action.run();}catch(IllegalArgumentException|NullPointerException e){return;}
        throw new AssertionError("invalid input accepted");
    }
    public static void main(String[] args) {
        equal(new int[]{3,1,2,1},concatenate(new int[]{3,1},new int[]{2,1}));
        equal(new int[]{},mergeSorted(new int[]{},new int[]{}));
        equal(new int[]{-1,0,0,2,2},mergeSorted(new int[]{-1,0,2},new int[]{0,2}));
        int[] a={1,2,3,0,0,0};mergeInto(a,3,new int[]{2,5,6});equal(new int[]{1,2,2,3,5,6},a);
        int[] emptyTarget={0,0};mergeInto(emptyTarget,0,new int[]{-2,4});equal(new int[]{-2,4},emptyTarget);
        int[] unchanged={2,1,0};bad(()->mergeInto(unchanged,2,new int[]{3}));equal(new int[]{2,1,0},unchanged);
        bad(()->mergeInto(a,3,a));bad(()->mergeInto(new int[3],0,new int[2]));
        bad(()->mergeInto(new int[1],-1,new int[2]));bad(()->mergeSorted(new int[]{2,1},new int[0]));bad(()->concatenate(null,new int[0]));
        java.util.Random random=new java.util.Random(170);
        for(int trial=0;trial<500;trial++) {
            int[] left=new int[random.nextInt(20)],right=new int[random.nextInt(20)];
            for(int i=0;i<left.length;i++)left[i]=random.nextInt(11)-5;
            for(int i=0;i<right.length;i++)right[i]=random.nextInt(11)-5;
            Arrays.sort(left);Arrays.sort(right);int[] want=concatenate(left,right);Arrays.sort(want);
            equal(want,mergeSorted(left,right));int[] dest=Arrays.copyOf(left,want.length);mergeInto(dest,left.length,right);equal(want,dest);
        }
        System.out.println("PASS MergeArrays: three contracts, invalid inputs, 500 bounded random cases");
    }
}

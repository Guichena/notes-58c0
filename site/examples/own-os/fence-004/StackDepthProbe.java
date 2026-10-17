/** Run in a fresh, disposable JVM; reports this method's observed frame depth only. */
public final class StackDepthProbe {
    private static int deepest;
    private static volatile long sink;
    private static long recurse(int depth) {
        deepest = depth;
        if (depth >= 100_000) return depth;
        long result = recurse(depth + 1);
        sink = result + depth; // Work after call avoids a tail-recursion form.
        return sink;
    }
    public static void main(String[] args) {
        boolean exhausted = false;
        try { recurse(1); }
        catch (StackOverflowError expected) { exhausted = true; }
        // Print only after recursive frames have unwound.
        System.out.println("exhausted=" + exhausted + " deepest=" + deepest);
        if (!exhausted) throw new AssertionError("bounded depth cap reached");
    }
}


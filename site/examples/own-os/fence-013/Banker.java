import java.util.Arrays;

/** Fixed set of processes/resources; finite nonnegative integer resource units. */
public final class Banker {
    public enum Result { GRANTED, EXCEEDS_NEED, WAIT_AVAILABLE, WAIT_UNSAFE }
    private final int[][] max;
    private int[][] allocation;
    private int[] available;

    public Banker(int[] available, int[][] max, int[][] allocation) {
        if (available == null || max == null || allocation == null ||
                max.length != allocation.length) throw new IllegalArgumentException("shape");
        this.available = available.clone();
        this.max = copy(max);
        this.allocation = copy(allocation);
        available = this.available; max = this.max; allocation = this.allocation;
        int m = available.length;
        long[] total = new long[m];
        for (int j = 0; j < m; j++) {
            if (available[j] < 0) throw new IllegalArgumentException("negative available");
            total[j] = available[j];
        }
        for (int i = 0; i < max.length; i++) {
            if (max[i].length != m || allocation[i].length != m)
                throw new IllegalArgumentException("ragged");
            for (int j = 0; j < m; j++) {
                if (allocation[i][j] < 0 || max[i][j] < allocation[i][j])
                    throw new IllegalArgumentException("allocation/maximum");
                total[j] += allocation[i][j];
            }
        }
        for (int j = 0; j < m; j++) {
            if (total[j] > Integer.MAX_VALUE) throw new IllegalArgumentException("total overflow");
            for (int[] row : max) if (row[j] > total[j])
                throw new IllegalArgumentException("maximum exceeds system total");
        }
    }
    private static int[][] copy(int[][] src) {
        int[][] dst = new int[src.length][];
        for (int i = 0; i < src.length; i++) {
            if (src[i] == null) throw new IllegalArgumentException("null row");
            dst[i] = src[i].clone();
        }
        return dst;
    }
    private void vector(int p, int[] v) {
        if (p < 0 || p >= max.length || v == null || v.length != available.length)
            throw new IllegalArgumentException("process/vector");
        for (int x : v) if (x < 0) throw new IllegalArgumentException("negative request");
    }
    // null means unsafe; an empty array is the safe sequence for zero processes.
    private int[] sequence(int[] av, int[][] al) {
        long[] work = new long[av.length];
        for (int j = 0; j < av.length; j++) work[j] = av[j];
        boolean[] done = new boolean[max.length];
        int[] order = new int[max.length];
        int count = 0;
        boolean progress;
        do {
            progress = false;
            for (int i = 0; i < max.length; i++) {
                if (done[i]) continue;
                boolean fits = true;
                for (int j = 0; j < av.length; j++)
                    if ((long) max[i][j] - al[i][j] > work[j]) fits = false;
                if (!fits) continue;
                done[i] = true;
                order[count++] = i;
                for (int j = 0; j < av.length; j++) work[j] += al[i][j];
                progress = true;
            }
        } while (progress && count < max.length);
        return count == max.length ? order : null;
    }
    public synchronized int[] safeSequence() { return sequence(available, allocation); }
    public synchronized Result request(int p, int[] request) {
        int[] req = request == null ? null : request.clone();
        vector(p, req);
        for (int j = 0; j < req.length; j++)
            if (req[j] > max[p][j] - allocation[p][j]) return Result.EXCEEDS_NEED;
        for (int j = 0; j < req.length; j++)
            if (req[j] > available[j]) return Result.WAIT_AVAILABLE;
        int[] av = available.clone();
        int[][] al = copy(allocation);
        for (int j = 0; j < req.length; j++) { av[j] -= req[j]; al[p][j] += req[j]; }
        if (sequence(av, al) == null) return Result.WAIT_UNSAFE;
        available = av;
        allocation = al;
        return Result.GRANTED;
    }
    public synchronized void release(int p, int[] release) {
        int[] rel = release == null ? null : release.clone();
        vector(p, rel);
        for (int j = 0; j < rel.length; j++)
            if (rel[j] > allocation[p][j]) throw new IllegalArgumentException("release exceeds held");
        for (int j = 0; j < rel.length; j++) {
            available[j] += rel[j]; allocation[p][j] -= rel[j];
        }
    }
    public synchronized int[] available() { return available.clone(); }
    public synchronized int[][] allocation() { return copy(allocation); }
    @Override public synchronized String toString() {
        return Arrays.toString(available) + Arrays.deepToString(allocation);
    }
}


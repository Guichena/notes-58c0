import java.util.concurrent.*;
import java.util.stream.*;

public final class ForkJoinLab {
    static final class Squares extends RecursiveTask<Long> {
        final int from, to;
        Squares(int from, int to) { this.from = from; this.to = to; }
        protected Long compute() {
            if (to - from <= 128) {
                long sum = 0;
                for (long x = from; x < to; x++) sum += x * x;
                return sum;
            }
            int middle = from + (to - from) / 2;
            Squares left = new Squares(from, middle); left.fork();
            long right = new Squares(middle, to).compute();
            return left.join() + right;
        }
    }
    public static void main(String[] args) throws Exception {
        ForkJoinPool pool = new ForkJoinPool(4);
        try {
            long expected = LongStream.range(0, 10000).map(x -> x * x).sum();
            long actual = pool.submit(new Squares(0, 10000)).get(5, TimeUnit.SECONDS);
            Checks.that(actual == expected, "CPU divide and conquer");
            long parallel = IntStream.range(0, 10000).parallel().mapToLong(x -> (long) x * x).sum();
            Checks.that(parallel == expected, "promotion before multiply");
            int single = IntStream.of(1, 2).reduce(10, Integer::sum);
            int split = IntStream.of(1).reduce(10, Integer::sum) + IntStream.of(2).reduce(10, Integer::sum);
            Checks.that(single == 13 && split == 23, "10 is not an addition identity");
            Checks.that(IntStream.range(0, 100).parallel().map(x -> x * 2).toArray().length == 100,
                    "collector/terminal ownership instead of shared ArrayList writes");
            System.out.println("ForkJoinLab OK");
        } finally { Checks.stop(pool); }
    }
}

public final class TreeHeight {
    private TreeHeight() {}
    // Teaching capacity model, not an InnoDB page parser.
    public static int estimate(long rows, long fanout, long leafRows) {
        if (rows < 0 || fanout < 2 || leafRows < 1) {
            throw new IllegalArgumentException("invalid capacity model");
        }
        long pages = rows / leafRows + (rows % leafRows == 0 ? 0 : 1);
        int height = 1; // Even an empty logical index has a root page.
        while (pages > 1) {
            pages = pages / fanout + (pages % fanout == 0 ? 0 : 1);
            height++;
        }
        return height;
    }
}

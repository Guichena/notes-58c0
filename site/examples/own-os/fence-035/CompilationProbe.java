public final class CompilationProbe {
    private CompilationProbe() {}
    static int twice(int x) { return x * 2; }
    public static void main(String[] args) {
        System.out.println(twice(21));
    }
}


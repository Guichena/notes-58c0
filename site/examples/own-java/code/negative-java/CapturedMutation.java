class CapturedMutation {
    static void bad() { int n = 0; Runnable action = () -> System.out.println(n); n++; }
}

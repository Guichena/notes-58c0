class OverloadNull {
    static void f(String value) {}
    static void f(Integer value) {}
    static void bad() { f(null); }
}

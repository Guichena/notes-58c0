import java.lang.reflect.*;
import java.util.*;

public class ProxyBoundaryLab {
    public interface Service { String outer(); String inner(); String fail(); }
    public static final class Target implements Service {
        public String outer() { return "outer/" + this.inner(); }
        public final String inner() { return "inner"; }
        public String fail() { throw new IllegalArgumentException("business failure"); }
    }
    public static void main(String[] args) {
        List<String> trace = new ArrayList<>();
        Service target = new Target();
        Service proxy = (Service) Proxy.newProxyInstance(Service.class.getClassLoader(),
                new Class<?>[]{Service.class}, (p, method, values) -> {
                    trace.add("before:" + method.getName());
                    try {
                        Object result = method.invoke(target, values);
                        trace.add("return:" + method.getName());
                        return result;
                    } catch (InvocationTargetException wrapper) {
                        trace.add("throw:" + method.getName());
                        throw wrapper.getCause();
                    } finally { trace.add("finally:" + method.getName()); }
                });
        require(proxy.outer().equals("outer/inner"));
        require(trace.equals(List.of("before:outer", "return:outer", "finally:outer")));
        trace.clear();
        require(proxy.inner().equals("inner"));
        require(trace.equals(List.of("before:inner", "return:inner", "finally:inner")));
        trace.clear();
        try { proxy.fail(); throw new AssertionError("expected failure"); }
        catch (IllegalArgumentException expected) { require(expected.getMessage().equals("business failure")); }
        require(trace.equals(List.of("before:fail", "throw:fail", "finally:fail")));
        System.out.println("PASS JDK proxy: self-call, final implementation, cause preservation");
    }
    static void require(boolean ok) { if (!ok) throw new AssertionError(); }
}

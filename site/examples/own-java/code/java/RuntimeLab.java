import java.io.IOException;
import java.lang.annotation.*;
import java.lang.reflect.*;
import java.util.Objects;

public final class RuntimeLab {
    private RuntimeLab() {}
    @Retention(RetentionPolicy.RUNTIME)
    @java.lang.annotation.Target(ElementType.METHOD)
    public @interface RequiredRole { String value(); }

    public interface Service {
        String echo(String value) throws IOException;
        default String name() { return "service"; }
    }
    public static final class Target implements Service {
        @Override @RequiredRole("reader")
        public String echo(String value) throws IOException {
            if (value.equals("fail")) throw new IOException("target failed");
            return value;
        }
        private String secret(String value) { return "private:" + value; }
    }
    static Service proxy(Service target, String role) {
        Objects.requireNonNull(target);
        return (Service) Proxy.newProxyInstance(Service.class.getClassLoader(),
                new Class<?>[]{Service.class}, (proxy, method, args) -> {
            if (method.getDeclaringClass() == Object.class) {
                return switch (method.getName()) {
                    case "equals" -> proxy == args[0];
                    case "hashCode" -> System.identityHashCode(proxy);
                    case "toString" -> "ServiceProxy";
                    default -> throw new AssertionError(method);
                };
            }
            if (method.isDefault()) return InvocationHandler.invokeDefault(proxy, method, args);
            Method actual = target.getClass().getMethod(method.getName(), method.getParameterTypes());
            RequiredRole required = actual.getAnnotation(RequiredRole.class);
            if (required != null && !required.value().equals(role))
                throw new SecurityException("required role missing");
            try { return actual.invoke(target, args); }
            catch (InvocationTargetException wrapped) { throw wrapped.getCause(); }
        });
    }
    public interface NoChecked { void call(); }
    public static void main(String[] args) throws Exception {
        Target target = new Target();
        Service good = proxy(target, "reader");
        Checks.equal(good.echo("ok"), "ok", "proxy forwarding");
        Checks.equal(good.name(), "service", "default method");
        Checks.check(good.equals(good) && !good.equals(target) && !good.equals(null), "identity equality");
        Checks.check(good.hashCode() == System.identityHashCode(good), "identity hash");
        Checks.equal(good.toString(), "ServiceProxy", "nonrecursive toString");
        Checks.expect(IOException.class, () -> good.echo("fail"), "target cause unwrapped");
        Checks.expect(SecurityException.class, () -> proxy(target, "writer").echo("x"), "annotation gate");
        Checks.expect(ClassCastException.class, () -> { Target wrong = (Target) good; }, "proxy not target subtype");
        Method secret = Target.class.getDeclaredMethod("secret", String.class);
        Checks.check(secret.trySetAccessible(), "same module access allowed");
        Checks.equal(secret.invoke(target, "x"), "private:x", "private invocation");
        Checks.expect(NoSuchMethodException.class,
                () -> Target.class.getDeclaredMethod("secret", Integer.class), "exact signature");
        Method echo = Target.class.getMethod("echo", String.class);
        InvocationTargetException wrapped = Checks.expect(InvocationTargetException.class,
                () -> echo.invoke(target, "fail"), "raw reflection wraps target");
        Checks.check(wrapped.getCause() instanceof IOException, "reflection cause");
        NoChecked unchecked = (NoChecked) Proxy.newProxyInstance(NoChecked.class.getClassLoader(),
                new Class<?>[]{NoChecked.class}, (p, m, a) -> { throw new IOException("not declared"); });
        UndeclaredThrowableException unexpected = Checks.expect(UndeclaredThrowableException.class,
                unchecked::call, "undeclared checked exception");
        Checks.check(unexpected.getCause() instanceof IOException, "undeclared original cause");
        Checks.done("RuntimeLab");
    }
}

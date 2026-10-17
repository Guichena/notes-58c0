package handbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.BeanCreationException;
import org.springframework.context.annotation.*;
import org.springframework.aop.*;
import org.springframework.aop.support.*;
import org.springframework.aop.framework.autoproxy.DefaultAdvisorAutoProxyCreator;
import org.aopalliance.intercept.MethodInterceptor;
import java.lang.reflect.Method;

public class CircularDependencyLab {
    public static class A {
        @Autowired B b;
        public String ping(){return "A";}
        public B getB(){return b;}
    }
    public static class B {
        @Autowired A a;
        public A getA(){return a;}
    }
    @Configuration(proxyBeanMethods=false) static class SetterConfig {
        @Bean A a(){return new A();}
        @Bean B b(){return new B();}
        @Bean static DefaultAdvisorAutoProxyCreator proxies(){var p=new DefaultAdvisorAutoProxyCreator();p.setProxyTargetClass(true);return p;}
        @Bean Advisor advice(){
            var pc=new StaticMethodMatcherPointcut(){public boolean matches(Method m,Class<?> t){return t==A.class&&m.getName().equals("ping");}};
            return new DefaultPointcutAdvisor(pc,(MethodInterceptor)call->"proxy/"+call.proceed());
        }
    }
    public static class X {X(Y y){}}
    public static class Y {Y(X x){}}
    @Configuration(proxyBeanMethods=false) static class ConstructorConfig {
        @Bean X x(Y y){return new X(y);}
        @Bean Y y(X x){return new Y(x);}
    }
    static AnnotationConfigApplicationContext create(Class<?> config,boolean allow){
        var c=new AnnotationConfigApplicationContext();c.getDefaultListableBeanFactory().setAllowCircularReferences(allow);c.register(config);return c;
    }
    static void mustFail(Class<?> config,boolean allow){
        try(var c=create(config,allow)){
            try{c.refresh();throw new AssertionError("cycle unexpectedly resolved");}
            catch(BeanCreationException expected){}
        }
    }
    public static void main(String[] args){
        try(var c=create(SetterConfig.class,true)){
            c.refresh();A a=c.getBean(A.class);
            if(!AopUtils.isAopProxy(a)||a.getB().getA()!=a||!a.ping().equals("proxy/A"))throw new AssertionError();
        }
        mustFail(SetterConfig.class,false);
        mustFail(ConstructorConfig.class,true);
        System.out.println("PASS early proxy identity, forbidden setter cycle, constructor cycle failure");
    }
}

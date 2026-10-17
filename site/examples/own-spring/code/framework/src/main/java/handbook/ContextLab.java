package handbook;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import jakarta.annotation.*;
import org.springframework.beans.factory.*;
import org.springframework.beans.factory.annotation.*;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.context.annotation.*;

public class ContextLab {
    static final List<String> trace = new ArrayList<>();
    interface Payment { String charge(); }
    record Alipay() implements Payment { public String charge(){return "alipay";} }
    record Wechat() implements Payment { public String charge(){return "wechat";} }
    static final class Order {
        final Payment payment;
        Order(Payment payment){this.payment=payment;}
    }
    static final class Ticket { }
    static final class Life implements InitializingBean, DisposableBean {
        Life(){trace.add("construct");}
        @PostConstruct public void post(){trace.add("postConstruct");}
        public void afterPropertiesSet(){trace.add("afterPropertiesSet");}
        public void init(){trace.add("customInit");}
        @PreDestroy public void pre(){trace.add("preDestroy");}
        public void destroy(){trace.add("destroy");}
        public void close(){trace.add("customDestroy");}
    }
    @Configuration(proxyBeanMethods=false)
    static class Config {
        @Bean Payment alipay(){return new Alipay();}
        @Bean Payment wechat(){return new Wechat();}
        @Bean Order order(@Qualifier("wechat") Payment selected){return new Order(selected);}
        @Bean @Scope("prototype") Ticket ticket(){return new Ticket();}
        @Bean(initMethod="init",destroyMethod="close") Life life(){return new Life();}
        @Bean static BeanFactoryPostProcessor definitionHook(){
            return factory -> { if(!factory.containsBeanDefinition("life")) throw new AssertionError(); };
        }
        @Bean static BeanPostProcessor instanceHook(){return new BeanPostProcessor(){
            public Object postProcessAfterInitialization(Object bean,String name){
                if(name.equals("life")) trace.add("afterInitialization"); return bean;
            }
        };}
    }
    public static void main(String[] args) {
        trace.clear();
        try(var c=new AnnotationConfigApplicationContext(Config.class)){
            check(c.getBean(Order.class).payment.charge().equals("wechat"));
            check(c.getBean(Order.class)==c.getBean(Order.class));
            ObjectProvider<Ticket> provider=c.getBeanProvider(Ticket.class);
            check(provider.getObject()!=provider.getObject());
            check(trace.equals(List.of("construct","postConstruct","afterPropertiesSet","customInit","afterInitialization")));
        }
        check(trace.equals(List.of("construct","postConstruct","afterPropertiesSet","customInit","afterInitialization","preDestroy","destroy","customDestroy")));
        System.out.println("PASS DI, singleton, prototype provider, initialization/destruction order");
    }
    static void check(boolean b){if(!b)throw new AssertionError(trace);}
}

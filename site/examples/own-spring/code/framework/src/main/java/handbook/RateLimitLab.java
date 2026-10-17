package handbook;
import java.lang.annotation.*;
import java.lang.reflect.Method;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import java.util.function.LongSupplier;
import org.aopalliance.intercept.MethodInterceptor;
import org.springframework.aop.*;
import org.springframework.aop.framework.autoproxy.DefaultAdvisorAutoProxyCreator;
import org.springframework.aop.support.*;
import org.springframework.context.annotation.*;
import org.springframework.core.annotation.AnnotatedElementUtils;

public class RateLimitLab {
    @Retention(RetentionPolicy.RUNTIME) @Target({ElementType.METHOD,ElementType.TYPE})
    public @interface Limit {int permits();long nanos();}
    public static final class Window {
        final int limit;final long duration;final LongSupplier clock;
        final ArrayDeque<Long> admitted=new ArrayDeque<>();
        Window(int limit,long duration,LongSupplier clock){
            if(limit<=0||duration<=0)throw new IllegalArgumentException();
            this.limit=limit;this.duration=duration;this.clock=clock;
        }
        synchronized boolean allow(){
            long now=clock.getAsLong();
            while(!admitted.isEmpty()&&now-admitted.peekFirst()>=duration)admitted.removeFirst();
            if(admitted.size()>=limit)return false;
            admitted.addLast(now);return true;
        }
    }
    public static class Service {
        final AtomicInteger calls=new AtomicInteger();
        @Limit(permits=2,nanos=1000) public int work(){return calls.incrementAndGet();}
        public int self(){return work();}
    }
    static Limit rule(Method method,Class<?> type){
        Method specific=AopUtils.getMostSpecificMethod(method,type);
        Limit l=AnnotatedElementUtils.findMergedAnnotation(specific,Limit.class);
        return l==null?AnnotatedElementUtils.findMergedAnnotation(type,Limit.class):l;
    }
    @Configuration(proxyBeanMethods=false) static class Config {
        @Bean static DefaultAdvisorAutoProxyCreator proxies(){var p=new DefaultAdvisorAutoProxyCreator();p.setProxyTargetClass(true);return p;}
        @Bean AtomicLong clock(){return new AtomicLong();}
        @Bean Service service(){return new Service();}
        @Bean Advisor advisor(AtomicLong clock){
            var windows=new ConcurrentHashMap<Method,Window>();
            var pointcut=new StaticMethodMatcherPointcut(){public boolean matches(Method m,Class<?> t){return rule(m,t)!=null;}};
            MethodInterceptor advice=call->{
                Class<?> type=AopUtils.getTargetClass(call.getThis());
                Method m=AopUtils.getMostSpecificMethod(call.getMethod(),type);Limit l=rule(m,type);
                Window w=windows.computeIfAbsent(m,k->new Window(l.permits(),l.nanos(),clock::get));
                if(!w.allow())throw new RejectedExecutionException("quota exhausted");
                return call.proceed();
            };
            var advisor=new DefaultPointcutAdvisor(pointcut,advice);advisor.setOrder(100);return advisor;
        }
    }
    static void denied(Runnable r){try{r.run();throw new AssertionError();}catch(RejectedExecutionException expected){}}
    public static void main(String[] args)throws Exception{
        try(var c=new AnnotationConfigApplicationContext(Config.class)){
            var s=c.getBean(Service.class);var now=c.getBean(AtomicLong.class);
            if(s.work()!=1||s.work()!=2)throw new AssertionError();denied(s::work);
            if(s.self()!=3)throw new AssertionError("self-call example");
            now.set(999);denied(s::work);now.set(1000);if(s.work()!=4)throw new AssertionError();
        }
        var w=new Window(7,1000,()->0);var count=new AtomicInteger();
        ExecutorService pool=Executors.newFixedThreadPool(8);
        try{List<Future<?>> jobs=new ArrayList<>();for(int n=0;n<100;n++)jobs.add(pool.submit(()->{if(w.allow())count.incrementAndGet();}));for(var f:jobs)f.get();}
        finally{pool.shutdownNow();if(!pool.awaitTermination(5,TimeUnit.SECONDS))throw new AssertionError("pool stuck");}
        if(count.get()!=7)throw new AssertionError(count);
        System.out.println("PASS annotation advisor, self-call bypass, exact window boundary, concurrent quota");
    }
}

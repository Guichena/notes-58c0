import java.util.concurrent.*;

public class ContextPropagationLab {
    static final ThreadLocal<String> TENANT=new ThreadLocal<>();
    static Runnable capture(Runnable task){
        String snapshot=TENANT.get();
        return ()->{String previous=TENANT.get();try{set(snapshot);task.run();}finally{set(previous);}};
    }
    static void set(String value){if(value==null)TENANT.remove();else TENANT.set(value);}
    static void check(boolean b){if(!b)throw new AssertionError();}
    public static void main(String[] args)throws Exception{
        ExecutorService pool=Executors.newSingleThreadExecutor();
        try{
            TENANT.set("A");Runnable first=capture(()->check("A".equals(TENANT.get())));
            TENANT.set("B");Runnable second=capture(()->{check("B".equals(TENANT.get()));throw new IllegalArgumentException("business");});
            TENANT.remove();
            pool.submit(first).get();
            try{pool.submit(second).get();throw new AssertionError();}
            catch(ExecutionException e){check(e.getCause() instanceof IllegalArgumentException);}
            check(pool.submit(()->TENANT.get()==null).get());
            TENANT.set("inner");Runnable nested=capture(()->check("inner".equals(TENANT.get())));
            TENANT.set("outer");nested.run();check("outer".equals(TENANT.get()));
        }finally{TENANT.remove();pool.shutdownNow();check(pool.awaitTermination(5,TimeUnit.SECONDS));}
        System.out.println("PASS capture-at-submit, task failure cleanup, thread reuse and nested restoration");
    }
}

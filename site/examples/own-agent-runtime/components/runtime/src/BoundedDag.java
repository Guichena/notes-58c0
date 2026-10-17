import java.util.*;
import java.util.concurrent.*;

/** In-process, read-only teaching scheduler. Not a durable distributed scheduler. */
public final class BoundedDag {
    public record Node(String id, Set<String> dependencies, Callable<String> action) {
        public Node { dependencies=Set.copyOf(dependencies);Objects.requireNonNull(action); }
    }
    private record Result(String id,String value) {}
    public static Map<String,String> run(List<Node> input,int parallelism,long timeoutMillis)
            throws Exception {
        if(parallelism<1 || timeoutMillis<1 || timeoutMillis>60_000 || input.size()>1000)
            throw new IllegalArgumentException("bounded inputs required");
        Map<String,Node> nodes=new LinkedHashMap<>();
        for(Node n:input) if(n.id().isBlank() || nodes.putIfAbsent(n.id(),n)!=null)
            throw new IllegalArgumentException("duplicate or empty node");
        Map<String,Integer> indegree=new HashMap<>();
        Map<String,List<String>> children=new HashMap<>();
        for(Node n:input) {
            indegree.put(n.id(),n.dependencies().size());
            for(String d:n.dependencies()) {
                if(!nodes.containsKey(d)) throw new IllegalArgumentException("unknown dependency");
                children.computeIfAbsent(d,k->new ArrayList<>()).add(n.id());
            }
        }
        // Validate the entire DAG before any side effect or task submission.
        Map<String,Integer> degrees=new HashMap<>(indegree);
        ArrayDeque<String> check=new ArrayDeque<>();
        for(Node n:input) if(degrees.get(n.id())==0) check.add(n.id());
        int visited=0;
        while(!check.isEmpty()) {
            String id=check.remove();visited++;
            for(String child:children.getOrDefault(id,List.of()))
                if(degrees.compute(child,(k,v)->v-1)==0)check.add(child);
        }
        if(visited!=nodes.size()) throw new IllegalArgumentException("cycle");
        ArrayDeque<String> ready=new ArrayDeque<>();
        for(Node n:input)if(indegree.get(n.id())==0)ready.add(n.id());
        ExecutorService pool=Executors.newFixedThreadPool(parallelism);
        ExecutorCompletionService<Result> completions=new ExecutorCompletionService<>(pool);
        List<Future<Result>> futures=new ArrayList<>();
        Map<String,String> result=new LinkedHashMap<>();
        long deadline=System.nanoTime()+TimeUnit.MILLISECONDS.toNanos(timeoutMillis);
        int running=0;
        Throwable failure=null;
        try {
            while(result.size()<nodes.size()) {
                while(running<parallelism&&!ready.isEmpty()) {
                    if(deadline-System.nanoTime()<=0)throw new TimeoutException("before dispatch");
                    String id=ready.remove();Node n=nodes.get(id);
                    futures.add(completions.submit(()->new Result(id,n.action().call())));
                    running++;
                }
                long remaining=deadline-System.nanoTime();
                if(remaining<=0)throw new TimeoutException("DAG deadline");
                Future<Result> future=completions.poll(remaining,TimeUnit.NANOSECONDS);
                if(future==null)throw new TimeoutException("DAG deadline");
                Result done=future.get();running--; // Failure prevents downstream readiness.
                result.put(done.id(),Objects.requireNonNull(done.value()));
                for(String child:children.getOrDefault(done.id(),List.of()))
                    if(indegree.compute(child,(k,v)->v-1)==0)ready.add(child);
            }
            return Collections.unmodifiableMap(result);
        } catch(Exception|Error e) {
            failure=e;throw e;
        } finally {
            try {
                for(Future<Result> f:futures)if(!f.isDone())f.cancel(true);
                pool.shutdownNow();
                // Cooperative tasks only. This is not a hard kill or external rollback.
                if(!pool.awaitTermination(2,TimeUnit.SECONDS))
                    throw new IllegalStateException("worker ignored cancellation");
            } catch(Exception cleanup) {
                if(cleanup instanceof InterruptedException)Thread.currentThread().interrupt();
                if(failure!=null)failure.addSuppressed(cleanup);else throw cleanup;
            } finally {
                if(failure instanceof InterruptedException)Thread.currentThread().interrupt();
            }
        }
    }
}

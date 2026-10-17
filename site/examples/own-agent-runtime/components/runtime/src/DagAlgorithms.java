import java.util.*;

public final class DagAlgorithms {
    private static Map<String,Set<String>> validate(Map<String,Set<String>> graph) {
        Map<String,Set<String>> copy=new TreeMap<>();
        graph.forEach((k,v)->copy.put(Objects.requireNonNull(k),Set.copyOf(v)));
        for(var targets:copy.values())if(!copy.keySet().containsAll(targets))
            throw new IllegalArgumentException("unknown node");
        return copy;
    }
    /** Edges point from prerequisite to dependent. Stable lexicographic batches. */
    public static List<List<String>> batches(Map<String,Set<String>> graph) {
        Map<String,Set<String>> g=validate(graph);Map<String,Integer> degree=new TreeMap<>();
        g.keySet().forEach(n->degree.put(n,0));g.values().forEach(v->v.forEach(n->degree.merge(n,1,Integer::sum)));
        List<String> ready=new ArrayList<>();for(var entry:degree.entrySet())if(entry.getValue()==0)ready.add(entry.getKey());
        List<List<String>> result=new ArrayList<>();int count=0;
        while(!ready.isEmpty()) {
            result.add(List.copyOf(ready));count+=ready.size();List<String> next=new ArrayList<>();
            for(String n:ready)for(String to:g.get(n))if(degree.merge(to,-1,Integer::sum)==0)next.add(to);
            Collections.sort(next);ready=next;
        }
        if(count!=g.size())throw new IllegalArgumentException("cycle");return List.copyOf(result);
    }
    /** Keep exactly nodes on a path from any start to any end (zero-edge paths count). */
    public static Map<String,Set<String>> prune(Map<String,Set<String>> graph,Set<String> starts,Set<String> ends) {
        Map<String,Set<String>> g=validate(graph);batches(g);
        if(!g.keySet().containsAll(starts)||!g.keySet().containsAll(ends))throw new IllegalArgumentException("unknown endpoint");
        Map<String,Set<String>> reverse=new TreeMap<>();g.keySet().forEach(n->reverse.put(n,new TreeSet<>()));
        g.forEach((from,targets)->targets.forEach(to->reverse.get(to).add(from)));
        Set<String> keep=reachable(g,starts);keep.retainAll(reachable(reverse,ends));
        Map<String,Set<String>> output=new TreeMap<>();
        for(String n:keep){Set<String> edges=new TreeSet<>(g.get(n));edges.retainAll(keep);output.put(n,Set.copyOf(edges));}
        return Collections.unmodifiableMap(output);
    }
    private static Set<String> reachable(Map<String,Set<String>> g,Set<String> roots) {
        Set<String> seen=new HashSet<>(roots);Deque<String> queue=new ArrayDeque<>(roots);
        while(!queue.isEmpty())for(String n:g.get(queue.remove()))if(seen.add(n))queue.add(n);
        return seen;
    }
}

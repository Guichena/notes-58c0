import java.util.*;
import java.util.function.LongSupplier;

/** Exact process-local arrival-time windows; one successful request consumes one unit in EVERY window. */
public final class MultiWindowLimiter<K> {
    public record Window(long duration,int limit) {
        public Window {if(duration<=0||limit<0)throw new IllegalArgumentException("positive duration/nonnegative limit");}
    }
    private static final class State {
        final List<ArrayDeque<Long>> history=new ArrayList<>();
        final List<Window> windows;
        State(List<Window> windows){this.windows=windows;for(int i=0;i<windows.size();i++)history.add(new ArrayDeque<>());}
    }
    private final List<Window> windows;
    private final Map<K,List<Window>> policies;
    private final LongSupplier clock;private final int maximumTrackedTenants;
    private final Map<K,State> tenants=new HashMap<>();private long lastTime;private boolean haveTime;
    public MultiWindowLimiter(List<Window> windows,int maximumTrackedTenants,LongSupplier clock){
        Objects.requireNonNull(windows);if(windows.isEmpty()||maximumTrackedTenants<1)throw new IllegalArgumentException("policy/capacity");
        this.windows=List.copyOf(windows);this.policies=null;this.maximumTrackedTenants=maximumTrackedTenants;this.clock=Objects.requireNonNull(clock);
    }
    /** Fixed per-tenant policies; unconfigured tenant IDs are rejected. */
    public MultiWindowLimiter(Map<K,List<Window>> policies,int maximumTrackedTenants,LongSupplier clock){
        Objects.requireNonNull(policies);if(maximumTrackedTenants<1)throw new IllegalArgumentException("capacity");
        Map<K,List<Window>> copy=new HashMap<>();
        for(var e:policies.entrySet()){
            Objects.requireNonNull(e.getKey());List<Window> policy=List.copyOf(e.getValue());
            if(policy.isEmpty())throw new IllegalArgumentException("empty policy");copy.put(e.getKey(),policy);
        }
        this.policies=Map.copyOf(copy);this.windows=null;this.maximumTrackedTenants=maximumTrackedTenants;this.clock=Objects.requireNonNull(clock);
    }
    private long now(){long t=clock.getAsLong();if(t<0||(haveTime&&t<lastTime))throw new IllegalArgumentException("nonnegative monotonic logical time required");haveTime=true;lastTime=t;return t;}
    private void expire(State s,long t){for(int i=0;i<s.windows.size();i++){ArrayDeque<Long> q=s.history.get(i);long boundary=t-s.windows.get(i).duration;while(!q.isEmpty()&&q.peekFirst()<=boundary)q.removeFirst();}}
    private boolean empty(State s){for(ArrayDeque<Long> q:s.history)if(!q.isEmpty())return false;return true;}
    /** Capacity exhaustion rejects admission; it never silently forgets an active tenant's usage. */
    public synchronized boolean allow(K tenant){
        Objects.requireNonNull(tenant);List<Window> policy=policies==null?windows:policies.get(tenant);
        if(policy==null)return false;
        long t=now();State state=tenants.get(tenant);
        if(state==null){
            cleanupAt(t);
            if(tenants.size()>=maximumTrackedTenants)return false;
            state=new State(policy);
        }else expire(state,t);
        for(int i=0;i<state.windows.size();i++)if(state.history.get(i).size()>=state.windows.get(i).limit){if(empty(state))tenants.remove(tenant);return false;}
        for(ArrayDeque<Long> q:state.history)q.addLast(t);
        tenants.put(tenant,state);return true;
    }
    /** Returns reclaimed tenant count; same monitor as allow avoids detached-state races. */
    public synchronized int cleanup(){return cleanupAt(now());}
    private int cleanupAt(long t){int removed=0;Iterator<State> it=tenants.values().iterator();while(it.hasNext()){State s=it.next();expire(s,t);if(empty(s)){it.remove();removed++;}}return removed;}
    public synchronized int trackedTenants(){return tenants.size();}
}

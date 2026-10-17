import java.util.*;

/** Provider JSON is parsed by a bounded adapter before reaching this class. */
public final class UsageLedger {
    public enum Provider { OPENAI_CHAT, OPENAI_RESPONSES, CLAUDE, DEEPSEEK }
    public record Snapshot(long input,long output,long cachedRead,long cacheWrite,
                           long reasoning,boolean complete) {}
    private record Frame(long sequence,Map<String,Long> fields,boolean terminal) {}
    private static final class Attempt {
        final Provider provider;
        final Map<String,Long> raw=new HashMap<>();
        final Map<Long,Frame> seen=new HashMap<>();
        long cursor;
        boolean complete;
        Attempt(Provider provider){this.provider=provider;}
    }
    private final Map<String,Attempt> attempts=new HashMap<>();
    public synchronized void begin(String id,Provider provider) {
        if(id==null||id.isBlank()||attempts.containsKey(id)||attempts.size()>=1000)
            throw new IllegalArgumentException("invalid or duplicate attempt");
        attempts.put(id,new Attempt(Objects.requireNonNull(provider)));
    }
    public synchronized Snapshot accept(String id,Provider provider,long sequence,
                                         Map<String,Long> patch,boolean terminal) {
        if(id==null||id.isBlank()||patch==null||patch.size()>32)
            throw new IllegalArgumentException("invalid usage envelope");
        Frame f=new Frame(sequence,Map.copyOf(patch),terminal);
        Attempt a=attempts.get(id);
        if(a==null){if(attempts.size()>=1000)throw new IllegalStateException("attempt limit");a=new Attempt(Objects.requireNonNull(provider));}
        if(a.provider!=provider)throw new IllegalArgumentException("provider changed within attempt");
        Frame old=a.seen.get(sequence);
        if(old!=null){if(!old.equals(f))throw new IllegalArgumentException("changed event");return normalize(provider,a.raw,a.complete);}
        if(a.complete||sequence!=a.cursor+1||a.seen.size()>=1000)
            throw new IllegalStateException("terminal, gap, or event limit");
        Map<String,Long> next=new HashMap<>(a.raw);
        for(var e:patch.entrySet()) {
            if(e.getValue()<0||e.getValue()<next.getOrDefault(e.getKey(),0L))
                throw new IllegalArgumentException("negative or decreasing cumulative usage");
            next.put(e.getKey(),e.getValue()); // cumulative snapshot, never +=
        }
        Snapshot result=normalize(provider,next,terminal); // validate before commit
        a.raw.clear();a.raw.putAll(next);a.complete=terminal;a.cursor=sequence;a.seen.put(sequence,f);
        attempts.put(id,a);return result;
    }
    private static long value(Map<String,Long> m,String k){return m.getOrDefault(k,0L);}
    private static Snapshot normalize(Provider p,Map<String,Long> m,boolean complete) {
        String in=p==Provider.OPENAI_RESPONSES||p==Provider.CLAUDE?"input_tokens":"prompt_tokens";
        String out=p==Provider.OPENAI_RESPONSES||p==Provider.CLAUDE?"output_tokens":"completion_tokens";
        if(complete&&(!m.containsKey(in)||!m.containsKey(out)))
            throw new IllegalArgumentException("final usage lacks required totals");
        long input=value(m,in),output=value(m,out),read=0,write=0;
        if(p==Provider.CLAUDE){read=value(m,"cache_read_input_tokens");write=value(m,"cache_creation_input_tokens");input=Math.addExact(input,Math.addExact(read,write));}
        else if(p==Provider.DEEPSEEK){
            boolean hit=m.containsKey("prompt_cache_hit_tokens"),alias=m.containsKey("cached_tokens");
            read=hit?value(m,"prompt_cache_hit_tokens"):value(m,"cached_tokens");
            if(hit&&alias&&read!=value(m,"cached_tokens"))
                throw new IllegalArgumentException("cache aliases disagree");
            if(m.containsKey(in)&&m.containsKey("prompt_cache_miss_tokens")) {
                long miss=value(m,"prompt_cache_miss_tokens");
                if(miss>input)throw new IllegalArgumentException("cache misses exceed input");
                if((hit||alias)&&input!=Math.addExact(read,miss))
                    throw new IllegalArgumentException("cache partition disagrees with input");
            }
        } else {read=value(m,"cached_tokens");write=value(m,"cache_write_tokens");}
        // Validate reported totals when all operands are known; omitted is not zero.
        if(p!=Provider.CLAUDE&&m.containsKey("total_tokens")&&m.containsKey(in)&&m.containsKey(out)
                &&value(m,"total_tokens")!=Math.addExact(input,output))
            throw new IllegalArgumentException("reported total disagrees with input plus output");
        long reasoning=value(m,"reasoning_tokens");
        if(read>input||write>input||reasoning>output)throw new IllegalArgumentException("subset exceeds total");
        return new Snapshot(input,output,read,write,reasoning,complete);
    }
    public synchronized Snapshot total() {
        long i=0,o=0,r=0,w=0,t=0;boolean all=!attempts.isEmpty();
        for(Attempt a:attempts.values()){
            Snapshot s=normalize(a.provider,a.raw,a.complete);i=Math.addExact(i,s.input());o=Math.addExact(o,s.output());
            r=Math.addExact(r,s.cachedRead());w=Math.addExact(w,s.cacheWrite());t=Math.addExact(t,s.reasoning());all&=s.complete();
        }
        return new Snapshot(i,o,r,w,t,all);
    }
}

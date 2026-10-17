import java.util.*;

/** Typed event projection after provider/SSE parsing; deliberately no JSON parser. */
public final class StreamProjection {
    public enum Type { START, TEXT, TOOL_START, TOOL_DELTA, TOOL_END, TOOL_RESULT, END }
    public record Event(String run,long sequence,Type type,String call,String text) {}
    public record Call(String id,String arguments) {}
    private final String run;
    private final Map<Long,Event> seen=new HashMap<>();
    private final Map<String,StringBuilder> partial=new HashMap<>();
    private final Map<String,String> complete=new HashMap<>();
    private final Set<String> results=new HashSet<>();
    private final StringBuilder text=new StringBuilder();
    private long cursor=0;
    private boolean started,ended;
    public StreamProjection(String run){this.run=Objects.requireNonNull(run);}
    public synchronized Optional<Call> accept(Event e) {
        if(!run.equals(e.run()))throw new IllegalArgumentException("wrong run");
        Event previous=seen.get(e.sequence());
        if(previous!=null) {
            if(!previous.equals(e))throw new IllegalArgumentException("duplicate ID with different payload");
            return Optional.empty();
        }
        if(e.sequence()!=cursor+1 || seen.size()>=1000 || ended)
            throw new IllegalStateException("gap, limit, or terminal run");
        if(e.text()==null || e.text().length()>8192 || e.call()==null)
            throw new IllegalArgumentException("invalid frame");
        Optional<Call> output=Optional.empty();
        if(e.type()!=Type.START && !started)throw new IllegalStateException("missing start");
        switch(e.type()) {
            case START -> {if(started)throw new IllegalStateException("second start");started=true;}
            case TEXT -> {if(text.length()+e.text().length()>32768)throw new IllegalStateException("text limit");text.append(e.text());}
            case TOOL_START -> {
                if(e.call().isBlank()||partial.containsKey(e.call())||complete.containsKey(e.call()))
                    throw new IllegalStateException("call collision");
                partial.put(e.call(),new StringBuilder());
            }
            case TOOL_DELTA -> {
                StringBuilder p=partial.get(e.call());
                if(p==null || p.length()+e.text().length()>8192)throw new IllegalStateException("invalid delta");
                p.append(e.text());
            }
            case TOOL_END -> {
                StringBuilder p=partial.remove(e.call());
                if(p==null)throw new IllegalStateException("unknown call end");
                String args=p.toString();complete.put(e.call(),args);
                // A candidate only: execution still requires real parsing, schema, auth and budget.
                output=Optional.of(new Call(e.call(),args));
            }
            case TOOL_RESULT -> {
                if(!complete.containsKey(e.call()) || !results.add(e.call()))
                    throw new IllegalStateException("orphan or repeated result");
            }
            case END -> {
                if(!partial.isEmpty() || !results.containsAll(complete.keySet()))
                    throw new IllegalStateException("unfinished calls");
                ended=true;
            }
        }
        seen.put(e.sequence(),e);cursor=e.sequence();return output;
    }
    public synchronized long cursor(){return cursor;}
    public synchronized String text(){return text.toString();}
    public synchronized boolean ended(){return ended;}
}

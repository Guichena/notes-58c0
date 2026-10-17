import java.util.*;

/** A bounded application profile after AG-UI JSON parsing and chunk expansion.
 * UI only; it cannot approve an action or execute a tool. State is flat string data,
 * not a general RFC 6902 engine. IDs and sequences belong to our durable envelope.
 */
public final class AgentEventState {
    public enum Type { RUN_STARTED, TEXT_MESSAGE_START, TEXT_MESSAGE_CONTENT,
        TEXT_MESSAGE_END, TOOL_CALL_START, TOOL_CALL_ARGS, TOOL_CALL_END,
        TOOL_CALL_RESULT, STATE_SNAPSHOT, STATE_DELTA, RUN_FINISHED, RUN_ERROR }
    public enum Op { PUT, REMOVE, TEST }
    public record Change(Op op,String key,String value) {}
    public record Event(long seq,Type type,String id,String text,Map<String,String> snapshot,
                        List<Change> changes) {
        public Event {Objects.requireNonNull(type);Objects.requireNonNull(id);Objects.requireNonNull(text);
            snapshot=Map.copyOf(snapshot);changes=List.copyOf(changes);}
    }
    private final Map<Long,Event> seen=new HashMap<>();
    private final Map<String,String> messages=new HashMap<>(),calls=new HashMap<>();
    private final Set<String> closedMessages=new HashSet<>(),closedCalls=new HashSet<>(),results=new HashSet<>();
    private Map<String,String> state=Map.of();
    private long cursor;
    private boolean started,terminal;
    private String outcome="NEW";
    public synchronized void accept(Event e) {
        Event duplicate=seen.get(e.seq());
        if(duplicate!=null){if(!duplicate.equals(e))throw new IllegalArgumentException("conflicting duplicate");return;}
        if(terminal||e.seq()!=cursor+1||seen.size()>=1000)throw new IllegalStateException("terminal, gap, or limit");
        if(e.text().length()>8192||e.id().length()>256||e.changes().size()>128||e.snapshot().size()>128)
            throw new IllegalArgumentException("oversize frame");
        if(!started&&e.type()!=Type.RUN_STARTED)throw new IllegalStateException("missing run start");
        switch(e.type()) {
            case RUN_STARTED -> {if(started)throw new IllegalStateException("duplicate start");started=true;outcome="RUNNING";}
            case TEXT_MESSAGE_START -> {fresh(e.id());messages.put(e.id(),"");}
            case TEXT_MESSAGE_CONTENT -> append(messages,closedMessages,e.id(),e.text());
            case TEXT_MESSAGE_END -> close(messages,closedMessages,e.id());
            case TOOL_CALL_START -> {fresh(e.id());calls.put(e.id(),"");}
            case TOOL_CALL_ARGS -> append(calls,closedCalls,e.id(),e.text());
            case TOOL_CALL_END -> close(calls,closedCalls,e.id()); // arguments complete, not action success
            case TOOL_CALL_RESULT -> {if(!closedCalls.contains(e.id())||!results.add(e.id()))throw new IllegalStateException("orphan result");}
            case STATE_SNAPSHOT -> {checkState(e.snapshot());state=e.snapshot();}
            case STATE_DELTA -> {
                Map<String,String> next=new HashMap<>(state);
                for(Change c:e.changes()) {
                    if(c.key()==null||c.op()==null)throw new IllegalArgumentException("invalid patch");
                    switch(c.op()) {
                        case PUT -> next.put(c.key(),Objects.requireNonNull(c.value()));
                        case REMOVE -> {if(!next.containsKey(c.key()))throw new IllegalStateException("missing key");next.remove(c.key());}
                        case TEST -> {if(!Objects.equals(next.get(c.key()),c.value())||!next.containsKey(c.key()))throw new IllegalStateException("test failed");}
                    }
                }
                checkState(next);state=Map.copyOf(next); // failed patch never changes existing state
            }
            case RUN_FINISHED -> {
                if(!e.text().equals("success")&&!e.text().equals("interrupt"))throw new IllegalArgumentException("unknown outcome");
                if(e.text().equals("success")&&(!closedMessages.containsAll(messages.keySet())||!results.containsAll(calls.keySet())))
                    throw new IllegalStateException("unfinished result");
                terminal=true;outcome=e.text().equals("success")?"SUCCESS":"INTERRUPTED";
            }
            case RUN_ERROR -> {terminal=true;outcome="ERROR";}
        }
        seen.put(e.seq(),e);cursor=e.seq();
    }
    private void fresh(String id){if(id.isBlank()||messages.containsKey(id)||calls.containsKey(id))throw new IllegalStateException("ID collision");}
    private static void append(Map<String,String> map,Set<String> closed,String id,String delta) {
        String old=map.get(id);if(old==null||closed.contains(id)||old.length()+delta.length()>32768)
            throw new IllegalStateException("unknown, closed, or oversized item");map.put(id,old+delta);
    }
    private static void close(Map<String,String> map,Set<String> closed,String id) {
        if(!map.containsKey(id)||!closed.add(id))throw new IllegalStateException("unknown or closed item");
    }
    private static void checkState(Map<String,String> s) {
        if(s.size()>128)throw new IllegalArgumentException("state limit");
        for(var e:s.entrySet())if(e.getKey().length()>256||e.getValue()==null||e.getValue().length()>8192)
            throw new IllegalArgumentException("state entry limit");
    }
    public synchronized Map<String,String> state(){return Map.copyOf(state);}
    public synchronized String message(String id){return messages.get(id);}
    public synchronized String outcome(){return outcome;}
    public synchronized long cursor(){return cursor;}
}

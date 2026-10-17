import java.io.*;
import java.nio.file.Path;
import java.util.*;

/** Single-authority, file-durable models. No SQL, scheduler, Redis or external delivery. */
public final class BusinessStateModels implements AutoCloseable {
    public record Ban(long version,long until,boolean active) { }
    public record Effect(String id,String user,long version,String kind) { }
    public record Rule(long version,long interval,boolean enabled) { }
    public record Slot(String id,String rule,long version,long window,long epoch,String state,String owner,long lease) { }
    private final SegmentJournal journal;
    private final Map<String,Ban> bans=new HashMap<>();
    private final Map<String,Effect> effects=new LinkedHashMap<>();
    private final Map<String,Rule> rules=new HashMap<>();
    private final Map<String,Slot> slots=new LinkedHashMap<>();
    private boolean closed;
    public BusinessStateModels(Path dir)throws IOException {
        journal=new SegmentJournal(dir);
        try{for(var r:journal.records())apply(r.payload());}
        catch(IOException|RuntimeException|Error e){try{journal.close();}catch(IOException c){if(e != c)e.addSuppressed(c);}throw e;}
    }
    private static void id(String s){if(s==null||!s.matches("[A-Za-z0-9_-]{1,64}"))throw new IllegalArgumentException("identifier");}
    private static void time(long n){if(n<0)throw new IllegalArgumentException("time");}
    private void open()throws IOException{if(closed)throw new IOException("closed");journal.size();}
    @FunctionalInterface private interface Encoder{void write(DataOutputStream out)throws IOException;}
    private void write(int type,Encoder e)throws IOException{
        ByteArrayOutputStream bytes=new ByteArrayOutputStream();
        try(DataOutputStream out=new DataOutputStream(bytes)){out.writeInt(type);e.write(out);}
        byte[] b=bytes.toByteArray();journal.append("business-"+journal.size(),b);apply(b);
    }
    private void apply(byte[] b)throws IOException{
        try(DataInputStream in=new DataInputStream(new ByteArrayInputStream(b))){
            switch(in.readInt()){
                case 1->{String user=in.readUTF();Ban ban=new Ban(in.readLong(),in.readLong(),in.readBoolean());bans.put(user,ban);
                    if(in.readBoolean()){Effect e=new Effect(in.readUTF(),user,ban.version(),in.readUTF());effects.put(e.id(),e);}}
                case 2->effects.remove(in.readUTF());
                case 3->rules.put(in.readUTF(),new Rule(in.readLong(),in.readLong(),in.readBoolean()));
                case 4->{Slot s=new Slot(in.readUTF(),in.readUTF(),in.readLong(),in.readLong(),in.readLong(),in.readUTF(),in.readUTF(),in.readLong());slots.put(s.id(),s);}
                default->throw new IOException("unknown event");
            }
            if(in.available()!=0)throw new IOException("trailing event bytes");
        }
    }
    /** Updating or extending a ban always advances its version. The user is an authenticated target. */
    public synchronized Ban setBan(String user,long until,long now)throws IOException{
        open();id(user);time(now);if(until<=now)throw new IllegalArgumentException("future expiry");
        if(!bans.containsKey(user)&&bans.size()>=100)throw new IllegalStateException("ban capacity");
        long version=bans.containsKey(user)?Math.incrementExact(bans.get(user).version()):1;
        // State and cache-invalidation obligation are one durable event.
        if(effects.size()>=500)throw new IllegalStateException("effect capacity");
        write(1,o->{o.writeUTF(user);o.writeLong(version);o.writeLong(until);o.writeBoolean(true);o.writeBoolean(true);o.writeUTF("ban/"+user+"/"+version);o.writeUTF("BAN_CHANGED");});
        return bans.get(user);
    }
    /** A delayed candidate is only a hint; reread current version and deadline under the authority. */
    public synchronized boolean expire(String user,long expectedVersion,long now)throws IOException{
        open();id(user);time(now);Ban b=bans.get(user);
        if(b==null||!b.active()||b.version()!=expectedVersion||now<b.until())return false;
        if(effects.size()>=500)throw new IllegalStateException("effect capacity");
        write(1,o->{o.writeUTF(user);o.writeLong(b.version());o.writeLong(b.until());o.writeBoolean(false);o.writeBoolean(true);o.writeUTF("unban/"+user+"/"+b.version());o.writeUTF("BAN_EXPIRED");});return true;
    }
    public synchronized Ban ban(String user)throws IOException{open();return bans.get(user);}
    public synchronized List<Effect> pendingEffects()throws IOException{open();return List.copyOf(effects.values());}
    /** Only after the required durable destination confirms responsibility. Duplicate delivery remains possible. */
    public synchronized void acknowledgeEffect(String effectId)throws IOException{
        open();if(effects.containsKey(effectId))write(2,o->o.writeUTF(effectId));
    }
    public synchronized Rule putRule(String name,long version,long interval,boolean enabled)throws IOException{
        open();id(name);if(version<=0||interval<=0)throw new IllegalArgumentException("rule");Rule old=rules.get(name);
        if(old!=null&&version<=old.version())throw new IllegalArgumentException("advance rule version");
        if(old==null&&rules.size()>=100)throw new IllegalStateException("rule capacity");
        write(3,o->{o.writeUTF(name);o.writeLong(version);o.writeLong(interval);o.writeBoolean(enabled);});return rules.get(name);
    }
    private void save(Slot s)throws IOException{
        write(4,o->{o.writeUTF(s.id());o.writeUTF(s.rule());o.writeLong(s.version());o.writeLong(s.window());o.writeLong(s.epoch());o.writeUTF(s.state());o.writeUTF(s.owner());o.writeLong(s.lease());});
    }
    public synchronized Slot claim(String rule,long version,long window,String worker,long now,long ttl)throws IOException{
        open();id(rule);id(worker);time(now);time(window);Rule r=rules.get(rule);
        if(ttl<=0||ttl>Long.MAX_VALUE-now)throw new IllegalArgumentException("lease");
        if(r==null||!r.enabled()||r.version()!=version||window%r.interval()!=0||window>now)return null;
        String key=rule+"/"+version+"/"+window;Slot old=slots.get(key);
        if(old!=null&&!old.state().equals("READY"))return null;
        if(old==null&&slots.size()>=500)throw new IllegalStateException("slot ledger full");
        Slot s=new Slot(key,rule,version,window,old==null?1:Math.incrementExact(old.epoch()),"RUNNING",worker,now+ttl);save(s);return s;
    }
    /** Lease expiry creates UNKNOWN, never automatic re-execution of a possible external alarm. */
    public synchronized boolean expireSlot(String key,long epoch,long now)throws IOException{
        open();time(now);Slot s=slots.get(key);
        if(s==null||s.epoch()!=epoch||!s.state().equals("RUNNING")||now<s.lease())return false;
        save(new Slot(s.id(),s.rule(),s.version(),s.window(),s.epoch(),"UNKNOWN",s.owner(),s.lease()));return true;
    }
    public synchronized boolean complete(Slot ticket,long now)throws IOException{
        open();time(now);Slot s=slots.get(ticket.id());Rule r=rules.get(ticket.rule());
        if(s==null||!s.equals(ticket)||!s.state().equals("RUNNING")||now>=s.lease()||r==null||r.version()!=s.version()||!r.enabled())return false;
        save(new Slot(s.id(),s.rule(),s.version(),s.window(),s.epoch(),"DONE",s.owner(),s.lease()));return true;
    }
    /** proof is obtained outside this model, from an authenticated durable destination. */
    public synchronized boolean resolve(String key,long epoch,TaskOrchestrationLab.Receipt proof)throws IOException{
        open();Slot s=slots.get(key);if(s==null||s.epoch()!=epoch||!s.state().equals("UNKNOWN"))return false;
        String state=switch(proof){case UNRESOLVED->"UNKNOWN";case SUCCEEDED->"DONE";case FAILED->"FAILED";case NOT_STARTED_AND_FENCED->"READY";};
        if(state.equals("UNKNOWN"))return false;save(new Slot(s.id(),s.rule(),s.version(),s.window(),s.epoch(),state,s.owner(),s.lease()));return true;
    }
    public synchronized Slot slot(String id)throws IOException{open();return slots.get(id);}
    public static int suggestedOwner(String rule,int workers){id(rule);if(workers<1||workers>1024)throw new IllegalArgumentException("workers");return Math.floorMod(rule.hashCode(),workers);}
    @Override public synchronized void close()throws IOException{if(!closed){closed=true;journal.close();}}
}

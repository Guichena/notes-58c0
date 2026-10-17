import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.*;

/** Durable single-process teaching state machine, backed by SegmentJournal.
 * No SQL, Kafka client, parser, embedding API or search engine is implemented here.
 * Time is trusted authority time supplied by the caller; tests use a deterministic clock.
 */
public final class TaskOrchestrationLab implements AutoCloseable {
    public enum Stage { PARSE, CHUNK, EMBED, INDEX, DONE }
    public enum State { READY, RUNNING, UNKNOWN, CANCEL_REQUESTED, SUCCEEDED, FAILED, EXPIRED, CANCELLED }
    public enum Receipt { NOT_STARTED_AND_FENCED, SUCCEEDED, FAILED, UNRESOLVED }
    public record Input(String tenant, String requestId, String document, long version,
                        String snapshot, String sha256, long inputBytes, long deadline, int priority) {
        public Input {
            for (String s : List.of(tenant, requestId, document, snapshot, sha256)) text(s);
            if (!sha256.matches("[a-f0-9]{64}") || version < 1 || inputBytes < 0
                    || inputBytes > 128L * 1024 * 1024 || deadline <= 0 || priority < 0 || priority > 2)
                throw new IllegalArgumentException("input contract");
        }
        public String key() { return tenant + "/" + requestId; }
        public String documentKey() { return tenant + "/" + document; }
    }
    public record Task(Input input, Stage stage, State state, long epoch, int attempts,
                       String owner, long leaseUntil, long readyAt, String artifact, long revision) {
        public String operationId() { return input.key() + "/v" + input.version() + "/" + stage; }
    }
    public record Document(long version, boolean deleted, String publishedArtifact) { }
    private final SegmentJournal journal;
    private final LinkedHashMap<String, Task> tasks = new LinkedHashMap<>();
    private final Map<String, Document> documents = new HashMap<>();
    private final Map<String,String> scanCursors = new HashMap<>();
    private final int capacity, perTenant, maxAttempts;
    private boolean closed;
    private static void text(String s) {
        if (s == null || s.isBlank() || s.length() > 512 || s.indexOf('/') >= 0 || s.indexOf('\0') >= 0)
            throw new IllegalArgumentException("bounded identifier, no slash or NUL");
        try { SegmentJournal.utf8(s); } catch (Exception e) { throw new IllegalArgumentException("invalid Unicode", e); }
    }
    private static void time(long n) { if (n < 0) throw new IllegalArgumentException("negative time"); }
    public TaskOrchestrationLab(Path dir, int capacity, int perTenant, int maxAttempts) throws IOException {
        if (capacity < 1 || capacity > 500 || perTenant < 1 || perTenant > capacity || maxAttempts < 1 || maxAttempts > 100)
            throw new IllegalArgumentException("bounded configuration");
        this.capacity = capacity; this.perTenant = perTenant; this.maxAttempts = maxAttempts;
        journal = new SegmentJournal(dir);
        try {
            for (SegmentJournal.Record r : journal.records()) apply(r.payload());
            if (tasks.size() > capacity) throw new IOException("capacity lower than existing identity ledger");
        } catch (IOException | RuntimeException | Error e) {
            try { journal.close(); } catch (IOException cleanup) { if(e != cleanup)e.addSuppressed(cleanup); } throw e;
        }
    }
    private void usable() throws IOException { if (closed) throw new IOException("closed"); journal.size(); }
    private static boolean terminal(State s) { return Set.of(State.SUCCEEDED, State.FAILED, State.EXPIRED, State.CANCELLED).contains(s); }
    private static void string(DataOutputStream d, String s) throws IOException {
        Objects.requireNonNull(s);
        if (s.length() > 4096) throw new IllegalArgumentException("string exceeds durable format limit");
        byte[] b = SegmentJournal.utf8(s);
        if (b.length > 4096) throw new IllegalArgumentException("string exceeds durable format limit");
        d.writeInt(b.length); d.write(b);
    }
    private static String string(DataInputStream d) throws IOException {
        int n = d.readInt(); if (n < 0 || n > 4096 || n > d.available()) throw new IOException("bad string size");
        byte[] b = d.readNBytes(n); String s = new String(b, StandardCharsets.UTF_8);
        if (!Arrays.equals(b, SegmentJournal.utf8(s))) throw new IOException("bad UTF-8"); return s;
    }
    private static void input(DataOutputStream d, Input i) throws IOException {
        string(d,i.tenant()); string(d,i.requestId()); string(d,i.document()); d.writeLong(i.version());
        string(d,i.snapshot()); string(d,i.sha256()); d.writeLong(i.inputBytes()); d.writeLong(i.deadline()); d.writeInt(i.priority());
    }
    private static Input input(DataInputStream d) throws IOException {
        return new Input(string(d),string(d),string(d),d.readLong(),string(d),string(d),d.readLong(),d.readLong(),d.readInt());
    }
    private static byte[] event(Task t, String documentKey, Document doc) throws IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        try (DataOutputStream d = new DataOutputStream(b)) {
            d.writeInt(1); d.writeBoolean(t != null);
            if (t != null) {
                input(d,t.input()); d.writeInt(t.stage().ordinal()); d.writeInt(t.state().ordinal()); d.writeLong(t.epoch());
                d.writeInt(t.attempts()); string(d,t.owner()); d.writeLong(t.leaseUntil()); d.writeLong(t.readyAt());
                string(d,t.artifact()); d.writeLong(t.revision());
            }
            d.writeBoolean(doc != null);
            if (doc != null) { string(d,documentKey); d.writeLong(doc.version()); d.writeBoolean(doc.deleted()); string(d,doc.publishedArtifact()); }
        }
        return b.toByteArray();
    }
    private void apply(byte[] bytes) throws IOException {
        try (DataInputStream d = new DataInputStream(new ByteArrayInputStream(bytes))) {
            int format = d.readInt();
            if (format == 2) { String name=string(d), cursor=string(d); if(d.available()!=0)throw new IOException("trailing cursor bytes"); scanCursors.put(name,cursor); return; }
            if (format != 1) throw new IOException("unknown task event version");
            if (d.readBoolean()) {
                Input i = input(d); int stage = d.readInt(), state = d.readInt();
                if (stage < 0 || stage >= Stage.values().length || state < 0 || state >= State.values().length) throw new IOException("bad enum");
                Task t = new Task(i,Stage.values()[stage],State.values()[state],d.readLong(),d.readInt(),string(d),
                        d.readLong(),d.readLong(),string(d),d.readLong());
                Task old = tasks.get(i.key());
                if (t.revision() != (old == null ? 0 : old.revision() + 1) || (old != null && !old.input().equals(i)))
                    throw new IOException("invalid task history");
                tasks.put(i.key(),t);
            }
            if (d.readBoolean()) { String key = string(d); Document doc = new Document(d.readLong(),d.readBoolean(),string(d)); documents.put(key,doc); }
            if (d.available() != 0) throw new IOException("trailing task bytes");
        } catch (IllegalArgumentException e) { throw new IOException("invalid task event", e); }
    }
    private void persist(Task task, String key, Document doc) throws IOException {
        byte[] b = event(task,key,doc); journal.append("transition-" + journal.size(),b); apply(b);
    }
    public synchronized Task submit(Input input, long now) throws IOException {
        usable(); time(now); Objects.requireNonNull(input);
        Task old = tasks.get(input.key());
        if (old != null) {
            if (!old.input().equals(input)) throw new IllegalArgumentException("same request, different immutable input");
            return old; // Return original receipt even after its deadline.
        }
        if (input.deadline() <= now || tasks.size() >= capacity) throw new IllegalStateException("admission rejected");
        long count = tasks.values().stream().filter(t -> t.input().tenant().equals(input.tenant())).count();
        if (count >= perTenant) throw new IllegalStateException("tenant identity budget full");
        Document doc = documents.get(input.documentKey());
        if (doc != null && input.version() <= doc.version()) throw new IllegalStateException("new request must advance document version");
        Task t = new Task(input,Stage.PARSE,State.READY,0,0,"",0,now,"",0);
        // Task obligation and active generation become durable in one local record.
        persist(t,input.documentKey(),new Document(input.version(),false,"")); return t;
    }
    public synchronized String scanCursor(String name) throws IOException { usable(); return scanCursors.getOrDefault(name,""); }
    public synchronized void saveScanCursor(String name,String cursor) throws IOException {
        usable(); text(name);
        ByteArrayOutputStream b=new ByteArrayOutputStream();
        try(DataOutputStream d=new DataOutputStream(b)){d.writeInt(2);string(d,name);string(d,cursor);}
        byte[] bytes=b.toByteArray();journal.append("transition-"+journal.size(),bytes);apply(bytes);
    }
    public synchronized Task get(String key) throws IOException { usable(); return tasks.get(key); }
    public synchronized Document document(String key) throws IOException { usable(); return documents.get(key); }
    public synchronized List<Task> snapshot() throws IOException { usable(); return List.copyOf(tasks.values()); }
    private Task require(String key) { Task t = tasks.get(key); if (t == null) throw new IllegalArgumentException("unknown task"); return t; }
    private static Task change(Task t, Stage stage, State state, long epoch, int attempts, String owner,
                               long lease, long ready, String artifact) {
        return new Task(t.input(),stage,state,epoch,attempts,owner,lease,ready,artifact,Math.incrementExact(t.revision()));
    }
    private boolean current(Task t) {
        Document d = documents.get(t.input().documentKey()); return d != null && !d.deleted() && d.version() == t.input().version();
    }
    public synchronized Task claim(String key, String worker, long now, long ttl) throws IOException {
        usable(); text(worker); time(now);
        if (ttl <= 0) throw new IllegalArgumentException("lease");
        Task t = require(key);
        if (t.state() != State.READY || t.readyAt() > now || now >= t.input().deadline() || !current(t)
                || t.attempts() >= maxAttempts) return null;
        long lease = now + Math.min(ttl, t.input().deadline() - now);
        Task n = change(t,t.stage(),State.RUNNING,Math.incrementExact(t.epoch()),t.attempts()+1,worker,lease,t.readyAt(),t.artifact());
        persist(n,null,null); return n;
    }
    private boolean owns(Task t, Task ticket, long now) {
        return ticket != null && t.input().equals(ticket.input()) && t.stage() == ticket.stage()
                && t.state() == State.RUNNING && t.epoch() == ticket.epoch() && t.owner().equals(ticket.owner())
                && now < t.leaseUntil() && now < t.input().deadline() && current(t);
    }
    public synchronized boolean heartbeat(Task ticket, long now, long ttl) throws IOException {
        usable(); time(now); if (ttl <= 0) throw new IllegalArgumentException("lease");
        Task t = require(ticket.input().key()); if (!owns(t,ticket,now)) return false;
        long lease = now + Math.min(ttl,t.input().deadline()-now);
        persist(change(t,t.stage(),t.state(),t.epoch(),t.attempts(),t.owner(),lease,t.readyAt(),t.artifact()),null,null); return true;
    }
    public synchronized boolean complete(Task ticket, String artifact, long now) throws IOException {
        usable(); time(now); text(artifact);
        Task t = require(ticket.input().key()); if (!owns(t,ticket,now)) return false;
        completeKnown(t,artifact,now,false); return true;
    }
    private void completeKnown(Task t, String artifact, long now, boolean reconciling) throws IOException {
        // A trusted remote receipt can arrive after deadline. Record outcome without publishing stale/cancelled work.
        boolean publishable = current(t) && now < t.input().deadline() && t.state() != State.CANCEL_REQUESTED;
        if (!publishable) {
            State end = t.state() == State.CANCEL_REQUESTED || !current(t) ? State.CANCELLED : State.EXPIRED;
            persist(change(t,t.stage(),end,t.epoch(),t.attempts(),"",0,now,artifact),null,null); return;
        }
        Stage next = Stage.values()[t.stage().ordinal()+1]; boolean finished = next == Stage.DONE;
        Task n = change(t,next,finished?State.SUCCEEDED:State.READY,t.epoch(),0,"",0,now,artifact);
        // The stage checkpoint and successor obligation share one durable record.
        persist(n,finished?t.input().documentKey():null,finished?new Document(t.input().version(),false,artifact):null);
    }
    public synchronized boolean retryKnownSafe(Task ticket, long now, long delay) throws IOException {
        usable(); time(now); if (delay < 0) throw new IllegalArgumentException("delay");
        Task t = require(ticket.input().key()); if (!owns(t,ticket,now)) return false;
        long ready = now + Math.min(delay,t.input().deadline()-now);
        State s = t.attempts() >= maxAttempts ? State.FAILED : ready >= t.input().deadline()?State.EXPIRED:State.READY;
        persist(change(t,t.stage(),s,t.epoch(),t.attempts(),"",0,ready,t.artifact()),null,null); return true;
    }
    public synchronized boolean markUnknown(Task ticket, long now) throws IOException {
        usable(); time(now); Task t = require(ticket.input().key());
        if (!owns(t,ticket,now)) return false;
        persist(change(t,t.stage(),State.UNKNOWN,t.epoch(),t.attempts(),t.owner(),t.leaseUntil(),t.readyAt(),t.artifact()),null,null); return true;
    }
    public synchronized State cancel(String key, long now) throws IOException {
        usable(); time(now); Task t = require(key); if (terminal(t.state())) return t.state();
        State s = t.state()==State.READY?State.CANCELLED:State.CANCEL_REQUESTED;
        if (s != t.state()) persist(change(t,t.stage(),s,t.epoch(),t.attempts(),t.owner(),t.leaseUntil(),t.readyAt(),t.artifact()),null,null);
        return s;
    }
    public synchronized void deleteDocument(String key, long version) throws IOException {
        usable(); Document d = documents.get(key);
        if (d == null || version <= d.version()) throw new IllegalArgumentException("advance tombstone generation");
        persist(null,key,new Document(version,true,""));
    }
    /** Returns at most limit rows; this bounded local model still scans/sorts up to 500 tasks. */
    public synchronized List<Task> page(String after, int limit) throws IOException {
        usable(); if (limit < 1 || limit > 500) throw new IllegalArgumentException("page limit");
        return tasks.entrySet().stream().filter(e -> after == null || e.getKey().compareTo(after)>0)
                .sorted(Map.Entry.comparingByKey()).limit(limit).map(Map.Entry::getValue).toList();
    }
    public synchronized boolean recover(String key, long observedRevision, long now) throws IOException {
        usable(); time(now); Task t = require(key); if (t.revision()!=observedRevision || terminal(t.state())) return false;
        State s = t.state();
        if (s == State.RUNNING && now >= t.leaseUntil()) s = State.UNKNOWN;
        else if (s == State.READY && (!current(t) || now >= t.input().deadline())) s = !current(t)?State.CANCELLED:State.EXPIRED;
        if (s == t.state()) return false;
        persist(change(t,t.stage(),s,t.epoch(),t.attempts(),t.owner(),t.leaseUntil(),t.readyAt(),t.artifact()),null,null); return true;
    }
    /** NOT_STARTED_AND_FENCED requires proof the old remote operation cannot later begin. */
    public synchronized boolean reconcile(String key, long epoch, Receipt receipt, String artifact, long now) throws IOException {
        usable(); time(now); Objects.requireNonNull(receipt); Task t = require(key);
        if (t.epoch()!=epoch || (t.state()!=State.UNKNOWN && t.state()!=State.CANCEL_REQUESTED)) return false;
        if (receipt == Receipt.UNRESOLVED) return false;
        if (receipt == Receipt.SUCCEEDED) { text(artifact); completeKnown(t,artifact,now,true); return true; }
        State end;
        if (receipt == Receipt.FAILED) end = State.FAILED;
        else if (t.state()==State.CANCEL_REQUESTED || !current(t)) end = State.CANCELLED;
        else if (now >= t.input().deadline()) end = State.EXPIRED;
        else if (t.attempts() >= maxAttempts) end = State.FAILED;
        else end = State.READY;
        persist(change(t,t.stage(),end,t.epoch(),t.attempts(),"",0,now,t.artifact()),null,null); return true;
    }
    /** A file-backed task exists independently of the wake-up. A real adapter must also run its recovery loop. */
    public synchronized boolean durableResponsibility(String key) throws IOException { usable(); return tasks.containsKey(key); }
    @Override public synchronized void close() throws IOException { if (!closed) { closed=true; journal.close(); } }

    /** Local admission gate: concurrency reservation, not a QPS limiter. One caller owns scheduling. */
    public static final class FairGate {
        private final int total, reservedP0;
        private final Map<String,Integer> running = new HashMap<>();
        /** Identity is intentionally per acquisition, even when the same Task object is selected again. */
        public static final class Permit {
            private final Task task;
            private Permit(Task task) { this.task = task; }
            public Task task() { return task; }
        }
        private final Map<String,Permit> permits = new HashMap<>();
        private String lastTenant = "";
        public FairGate(int total, int reservedP0) {
            if(total<1 || reservedP0<0 || reservedP0>=total) throw new IllegalArgumentException();
            this.total=total;this.reservedP0=reservedP0;
        }
        public synchronized Permit choose(List<Task> all, long now) {
            time(now); if(permits.size()>=total)return null;
            List<String> tenants=all.stream().filter(t -> eligible(t,now)).map(t -> t.input().tenant()).distinct().sorted().toList();
            if(tenants.isEmpty())return null;
            String tenant=tenants.stream().filter(s -> s.compareTo(lastTenant)>0).findFirst().orElse(tenants.getFirst());
            Task t=all.stream().filter(x -> x.input().tenant().equals(tenant)&&eligible(x,now))
                    .min(Comparator.comparingInt((Task x) -> now-x.readyAt()>=1000?0:x.input().priority())
                            .thenComparingLong(Task::readyAt).thenComparing(x -> x.input().key())).orElseThrow();
            Permit permit=new Permit(t);
            permits.put(t.input().key(),permit);running.merge(tenant,1,Integer::sum);lastTenant=tenant;return permit;
        }
        private boolean eligible(Task t,long now) {
            return t.state()==State.READY && t.readyAt()<=now && now<t.input().deadline() && !permits.containsKey(t.input().key())
                    && running.getOrDefault(t.input().tenant(),0)<Math.max(1,total/2)
                    && (t.input().priority()==0 || permits.size()<total-reservedP0);
        }
        public synchronized void release(Permit permit) {
            Objects.requireNonNull(permit); Task t=permit.task();
            if(permits.remove(t.input().key(),permit))running.compute(t.input().tenant(),(k,n)->n==null||n<=1?null:n-1);
        }
        public synchronized int inFlight(){return permits.size();}
    }
}

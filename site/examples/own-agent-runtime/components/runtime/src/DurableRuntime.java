import java.io.*;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;

/** Teaching implementation: one local journal, one operation, trusted clock/auth. */
public final class DurableRuntime implements AutoCloseable {
    public enum Phase { PENDING, RUNNING, WAITING_APPROVAL, READY, DISPATCHED,
        UNKNOWN, SUCCEEDED, CANCELLED, FAILED }
    public enum RemoteState { APPLIED, NOT_APPLIED, UNKNOWN }
    public record Auth(String tenant, String actor, boolean mayWrite) {}
    public record View(long sequence, String tenant, String actor, Phase phase,
        long epoch, String owner, long leaseUntil, long deadline, int remaining,
        String operation, String digest, long approvalUntil, boolean cancelled,
        String result) {}
    private final FileChannel channel;
    private final FileLock lock;
    private View state;
    private boolean poisoned;

    public DurableRuntime(Path path, String tenant, String actor,
                          long deadline, int maxAttempts) throws Exception {
        if (tenant.isBlank() || actor.isBlank() || maxAttempts < 1)
            throw new IllegalArgumentException("invalid initial state");
        channel = FileChannel.open(path, StandardOpenOption.CREATE,
                StandardOpenOption.READ, StandardOpenOption.WRITE);
        FileLock acquired;
        try { acquired = channel.tryLock(); }
        catch (RuntimeException | IOException e) { channel.close(); throw e; }
        if (acquired == null) { channel.close(); throw new IOException("journal already owned"); }
        lock = acquired;
        try {
            recover();
            if (state == null) {
                state = new View(0, tenant, actor, Phase.PENDING, 0, "", 0,
                        deadline, maxAttempts, "", "", 0, false, "");
                save(state);
            } else if (!state.tenant().equals(tenant) || !state.actor().equals(actor)) {
                throw new SecurityException("journal identity mismatch");
            }
        } catch (Exception e) {
            try { close(); } catch (IOException cleanup) { e.addSuppressed(cleanup); }
            throw e;
        }
    }
    public synchronized View view() { return state; }
    private static boolean terminal(Phase p) {
        return p == Phase.SUCCEEDED || p == Phase.CANCELLED || p == Phase.FAILED;
    }
    private void auth(Auth a) {
        if (!state.tenant().equals(a.tenant()) || !state.actor().equals(a.actor()) || !a.mayWrite())
            throw new SecurityException("current authorization denied");
    }
    private void live(long now) {
        if (state.cancelled() || now >= state.deadline() || terminal(state.phase()))
            throw new IllegalStateException("task cannot advance");
    }
    private void lease(String owner, long epoch, long now) {
        if (!state.owner().equals(owner) || state.epoch() != epoch || now >= state.leaseUntil())
            throw new IllegalStateException("stale lease");
    }
    private View next(Phase p, long epoch, String owner, long leaseUntil,
                      int remaining, String op, String digest, long approval,
                      boolean cancelled, String result) {
        return new View(state.sequence()+1, state.tenant(), state.actor(), p, epoch,
                owner, leaseUntil, state.deadline(), remaining, op, digest,
                approval, cancelled, result);
    }
    public synchronized long claim(String owner, long now, long leaseMillis) throws Exception {
        live(now);
        if (owner.isBlank() || leaseMillis <= 0) throw new IllegalArgumentException("bad lease");
        boolean eligible = state.phase() == Phase.PENDING || state.phase() == Phase.READY
                || (state.phase() == Phase.RUNNING && now >= state.leaseUntil());
        if (!eligible) throw new IllegalStateException("not claimable");
        long until = Math.min(state.deadline(), Math.addExact(now, leaseMillis));
        save(next(Phase.RUNNING, state.epoch()+1, owner, until, state.remaining(),
                state.operation(), state.digest(), state.approvalUntil(), false, ""));
        return state.epoch();
    }
    public synchronized void heartbeat(String owner, long epoch, long now,
                                       long leaseMillis) throws Exception {
        live(now); lease(owner, epoch, now);
        if (leaseMillis <= 0) throw new IllegalArgumentException("bad lease");
        if (state.phase()!=Phase.RUNNING && state.phase()!=Phase.DISPATCHED)
            throw new IllegalStateException("no active work");
        save(next(state.phase(), epoch, owner,
                Math.min(state.deadline(), Math.addExact(now, leaseMillis)), state.remaining(),
                state.operation(), state.digest(), state.approvalUntil(), false, state.result()));
    }
    public synchronized void requestApproval(String owner, long epoch, long now,
                       String operation, String canonicalAction) throws Exception {
        live(now); lease(owner, epoch, now);
        if (state.phase()!=Phase.RUNNING || operation.isBlank() || canonicalAction.isBlank())
            throw new IllegalStateException("invalid proposal");
        // Waiting is durable; it does not retain a worker or a thread.
        save(next(Phase.WAITING_APPROVAL, epoch, "", 0, state.remaining(), operation,
                sha(canonicalAction.getBytes(StandardCharsets.UTF_8)), 0, false, ""));
    }
    public synchronized void approve(Auth a, String operation, String digest,
                                      long now, long expiresAt) throws Exception {
        auth(a); live(now);
        if (state.phase()!=Phase.WAITING_APPROVAL || !state.operation().equals(operation)
                || !state.digest().equals(digest) || expiresAt<=now)
            throw new IllegalStateException("approval does not match pending action");
        save(next(Phase.READY, state.epoch(), "", 0, state.remaining(), operation,
                digest, Math.min(expiresAt,state.deadline()), false, ""));
    }
    public synchronized void dispatch(Auth a, String owner, long epoch,
                                      long now, String canonicalAction) throws Exception {
        auth(a); live(now); lease(owner,epoch,now);
        if (state.phase()!=Phase.RUNNING || state.approvalUntil()<=now || state.remaining()<=0
                || !state.digest().equals(sha(canonicalAction.getBytes(StandardCharsets.UTF_8))))
            throw new IllegalStateException("dispatch rejected");
        // WAL intent first. Only after this method returns may caller contact tool.
        save(next(Phase.DISPATCHED,epoch,owner,state.leaseUntil(),state.remaining()-1,
                state.operation(),state.digest(),state.approvalUntil(),false,""));
    }
    public synchronized void complete(String owner,long epoch,long now,String receipt) throws Exception {
        lease(owner,epoch,now);
        if(state.phase()!=Phase.DISPATCHED || receipt.isBlank())
            throw new IllegalStateException("completion rejected");
        // Cancellation is not a claim that an already dispatched side effect vanished.
        save(next(Phase.SUCCEEDED,epoch,"",0,state.remaining(),state.operation(),
                state.digest(),state.approvalUntil(),state.cancelled(),receipt));
    }
    public synchronized void loseResponse() throws Exception {
        if(state.phase()!=Phase.DISPATCHED) throw new IllegalStateException("not dispatched");
        save(next(Phase.UNKNOWN,state.epoch(),"",0,state.remaining(),state.operation(),
                state.digest(),state.approvalUntil(),state.cancelled(),"requires reconciliation"));
    }
    public synchronized void requestCancel() throws Exception {
        if(terminal(state.phase())) return;
        Phase p = state.phase()==Phase.DISPATCHED || state.phase()==Phase.UNKNOWN
                ? Phase.UNKNOWN : Phase.CANCELLED;
        save(next(p,state.epoch(),"",0,state.remaining(),state.operation(),state.digest(),
                state.approvalUntil(),true,p==Phase.UNKNOWN?"cancelled; remote outcome unknown":"cancelled"));
    }
    public synchronized void reconcile(Auth a,RemoteState remote,String receipt) throws Exception {
        auth(a);
        if(state.phase()!=Phase.UNKNOWN) throw new IllegalStateException("not unknown");
        if(remote==RemoteState.UNKNOWN) return;
        if(receipt.isBlank()) throw new IllegalArgumentException("authoritative evidence required");
        Phase p = remote==RemoteState.APPLIED ? Phase.SUCCEEDED
                : (state.cancelled()?Phase.CANCELLED:Phase.FAILED);
        save(next(p,state.epoch(),"",0,state.remaining(),state.operation(),state.digest(),
                state.approvalUntil(),state.cancelled(),receipt));
    }
    public synchronized void recoverDispatched() throws Exception {
        if(state.phase()==Phase.DISPATCHED) loseResponse();
    }
    private void save(View v) throws Exception {
        if(poisoned) throw new IOException("journal is fail-closed after an IO error");
        byte[] payload=encode(v);
        if(payload.length>65_536) throw new IOException("state too large");
        String frame=Base64.getEncoder().encodeToString(payload)+" "+sha(payload)+"\n";
        ByteBuffer bytes=StandardCharsets.US_ASCII.encode(frame);
        try {
            if(channel.size()+bytes.remaining()>8_388_608)throw new IOException("journal capacity");
            channel.position(channel.size());
            while(bytes.hasRemaining()) channel.write(bytes);
            channel.force(true);
        } catch(IOException e) { poisoned=true; throw e; }
        state=v;
    }
    private void recover() throws Exception {
        if(channel.size()>8_388_608) throw new IOException("demo journal limit");
        ByteBuffer b=ByteBuffer.allocate((int)channel.size());
        channel.position(0);
        while(b.hasRemaining()) if(channel.read(b)<0) throw new EOFException();
        String all=new String(b.array(),StandardCharsets.US_ASCII);
        if(!all.isEmpty() && !all.endsWith("\n")) throw new IOException("torn tail; reconcile before repair");
        long expected=0;
        for(String line:all.split("\n")) {
            if(line.isEmpty()) continue;
            String[] parts=line.split(" ",-1);
            if(parts.length!=2) throw new IOException("bad frame");
            byte[] raw=Base64.getDecoder().decode(parts[0]);
            if(!sha(raw).equals(parts[1])) throw new IOException("checksum mismatch");
            View v=decode(raw);
            if(v.sequence()!=expected++) throw new IOException("sequence gap");
            state=v;
        }
    }
    private static byte[] encode(View v) throws IOException {
        ByteArrayOutputStream bytes=new ByteArrayOutputStream();
        try(DataOutputStream out=new DataOutputStream(bytes)) {
            out.writeInt(1); out.writeLong(v.sequence());out.writeUTF(v.tenant());out.writeUTF(v.actor());
            out.writeUTF(v.phase().name());out.writeLong(v.epoch());out.writeUTF(v.owner());
            out.writeLong(v.leaseUntil());out.writeLong(v.deadline());out.writeInt(v.remaining());
            out.writeUTF(v.operation());out.writeUTF(v.digest());out.writeLong(v.approvalUntil());
            out.writeBoolean(v.cancelled());out.writeUTF(v.result());
        }
        return bytes.toByteArray();
    }
    private static View decode(byte[] bytes) throws IOException {
        try(DataInputStream in=new DataInputStream(new ByteArrayInputStream(bytes))) {
            if(in.readInt()!=1) throw new IOException("unsupported schema");
            View v=new View(in.readLong(),in.readUTF(),in.readUTF(),Phase.valueOf(in.readUTF()),
                in.readLong(),in.readUTF(),in.readLong(),in.readLong(),in.readInt(),in.readUTF(),
                in.readUTF(),in.readLong(),in.readBoolean(),in.readUTF());
            if(in.available()!=0)throw new IOException("unexpected bytes");
            return v;
        }
    }
    public static String sha(byte[] raw) {
        try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(raw));}
        catch(Exception e){throw new IllegalStateException(e);}
    }
    @Override public synchronized void close() throws IOException {
        IOException failure=null;
        try { if(lock.isValid())lock.release(); } catch(IOException e){failure=e;}
        try { channel.close(); } catch(IOException e){if(failure==null)failure=e;else failure.addSuppressed(e);}
        if(failure!=null)throw failure;
    }
}

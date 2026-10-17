import interview.tools.Cleanup;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.*;
import java.sql.*;
import java.util.*;
import java.util.concurrent.TimeUnit;

/** Durable local operation journal plus actual harmless subprocess. Not an arbitrary-shell exactly-once engine. */
public final class OperationRecovery {
    private final String url;
    public record Status(String fingerprint,String state,String receipt) {}
    public OperationRecovery(String url)throws SQLException{
        this.url=url;
        try(Connection c=open();Statement s=c.createStatement()){
            s.execute("CREATE TABLE IF NOT EXISTS operations(id VARCHAR PRIMARY KEY,fp VARCHAR NOT NULL,state VARCHAR NOT NULL,receipt VARCHAR)");}
    }
    private Connection open()throws SQLException{return DriverManager.getConnection(url);}
    public static String fingerprint(List<String> fields)throws Exception{
        ByteArrayOutputStream bytes=new ByteArrayOutputStream();
        try(DataOutputStream out=new DataOutputStream(bytes)){
            for(String field:fields){byte[] data=Objects.requireNonNull(field).getBytes(StandardCharsets.UTF_8);out.writeInt(data.length);out.write(data);}}
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes.toByteArray()));
    }
    public void accept(String id,String fp)throws SQLException{
        if(id==null||id.isBlank()||fp==null||fp.isBlank())throw new IllegalArgumentException();
        try(Connection c=open();PreparedStatement p=c.prepareStatement("INSERT INTO operations VALUES(?,?,'ACCEPTED',NULL)")){
            p.setString(1,id);p.setString(2,fp);p.executeUpdate();
        }catch(SQLException e){
            if(!"23505".equals(e.getSQLState()))throw e;
            if(!query(id).fingerprint().equals(fp))throw new IllegalArgumentException("operation payload conflict");
        }
    }
    public boolean claim(String id)throws SQLException{
        try(Connection c=open();PreparedStatement p=c.prepareStatement("UPDATE operations SET state='RUNNING' WHERE id=? AND state='ACCEPTED'")){
            p.setString(1,id);return p.executeUpdate()==1;}
    }
    public void timeout(String id)throws SQLException{
        try(Connection c=open();PreparedStatement p=c.prepareStatement("UPDATE operations SET state='UNKNOWN' WHERE id=? AND state='RUNNING'")){p.setString(1,id);p.executeUpdate();}
    }
    public void succeed(String id,String receipt)throws SQLException{
        Objects.requireNonNull(receipt);
        try(Connection c=open()){
            c.setAutoCommit(false);
            try(PreparedStatement q=c.prepareStatement("SELECT state,receipt FROM operations WHERE id=? FOR UPDATE")){
                q.setString(1,id);String state,saved;
                try(ResultSet r=q.executeQuery()){if(!r.next())throw new IllegalArgumentException("missing operation");state=r.getString(1);saved=r.getString(2);}
                if(state.equals("SUCCEEDED")){
                    if(!receipt.equals(saved))throw new IllegalArgumentException("receipt conflict");c.commit();return;}
                if(!Set.of("RUNNING","UNKNOWN").contains(state))throw new IllegalStateException("not started");
                try(PreparedStatement p=c.prepareStatement("UPDATE operations SET state='SUCCEEDED',receipt=? WHERE id=?")){
                    p.setString(1,receipt);p.setString(2,id);p.executeUpdate();}
                c.commit();
            }catch(SQLException|RuntimeException e){try{c.rollback();}catch(Throwable rollback){Cleanup.merge(e,rollback);}throw e;}
        }
    }
    public Status query(String id)throws SQLException{
        try(Connection c=open();PreparedStatement p=c.prepareStatement("SELECT fp,state,receipt FROM operations WHERE id=?")){
            p.setString(1,id);try(ResultSet r=p.executeQuery()){if(!r.next())throw new IllegalArgumentException("missing");return new Status(r.getString(1),r.getString(2),r.getString(3));}}
    }
    public static final class LoopGuard {
        private String lastFingerprint,lastProgress;private int repeats;
        public synchronized boolean allow(String fp,String progress){
            Objects.requireNonNull(fp);Objects.requireNonNull(progress);
            if(fp.equals(lastFingerprint)&&progress.equals(lastProgress))repeats++;
            else{lastFingerprint=fp;lastProgress=progress;repeats=1;}
            return repeats<5;
        }
    }
    private static void check(boolean b){if(!b)throw new AssertionError();}
    public static void main(String[] args)throws Exception{
        if(args.length==1&&args[0].equals("--child")){
            if(System.in.read()!=-1){System.out.print("completed");System.out.flush();}return;
        }
        if(args.length!=2)throw new IllegalArgumentException("unique DB path and receipt path required");
        String url="jdbc:h2:"+args[0]+";LOCK_TIMEOUT=20000";OperationRecovery s=new OperationRecovery(url);
        String fp=fingerprint(List.of("argv: demo child","cwd: isolated","envVersion:1","inputVersion:1"));
        check(!fp.equals(fingerprint(List.of("argv: demo child","cwd: other","envVersion:1","inputVersion:1"))));
        check(!fingerprint(List.of("ab","c")).equals(fingerprint(List.of("a","bc"))));
        LoopGuard guard=new LoopGuard();for(int i=0;i<4;i++)check(guard.allow(fp,"progress0"));check(!guard.allow(fp,"progress0"));
        check(guard.allow(fp,"progress1"));check(guard.allow("different", "progress1"));
        s.accept("op",fp);s.accept("op",fp);check(s.claim("op"));check(!s.claim("op"));
        Path receipt=Path.of(args[1]);Files.createDirectories(receipt.toAbsolutePath().getParent());
        if(Files.exists(receipt))throw new IllegalArgumentException("fresh receipt path required");
        String java=Path.of(System.getProperty("java.home"),"bin","java").toString();
        Process p=new ProcessBuilder(java,"-cp",System.getProperty("java.class.path"),"OperationRecovery","--child")
                .redirectOutput(receipt.toFile()).redirectError(ProcessBuilder.Redirect.INHERIT).start();
        Throwable primary=null;
        try{
            check(!p.waitFor(10,TimeUnit.MILLISECONDS)); // child waits for our input, so no fragile sleep race
            s.timeout("op");check(s.query("op").state().equals("UNKNOWN"));
            check(p.isAlive()&&!s.claim("op")); // timeout does not grant a second launch
            p.getOutputStream().write('\n');p.getOutputStream().close();
            check(p.waitFor(10,TimeUnit.SECONDS)&&p.exitValue()==0);
            String observed=Files.readString(receipt);check(observed.equals("completed"));
            // Simulate transport loss: durable status remains UNKNOWN until the supervisor records receipt.
            OperationRecovery reopened=new OperationRecovery(url);check(reopened.query("op").state().equals("UNKNOWN"));
            reopened.succeed("op",observed);reopened.timeout("op");reopened.succeed("op",observed);
            check(!reopened.claim("op")&&new OperationRecovery(url).query("op").receipt().equals("completed"));
            try{reopened.accept("op","other");throw new AssertionError();}catch(IllegalArgumentException ok){}
            try{reopened.succeed("op","different receipt");throw new AssertionError();}catch(IllegalArgumentException ok){}
        }catch(Throwable e){primary=e;}
        finally{primary=Cleanup.collect(primary,
            ()->p.getOutputStream().close(),()->{if(p.isAlive())p.destroyForcibly();},
            ()->{if(!p.waitFor(10,TimeUnit.SECONDS))throw new IllegalStateException("child termination unconfirmed");},
            ()->p.getInputStream().close(),()->p.getErrorStream().close());}
        Cleanup.rethrow(primary);
        System.out.println("PASS OperationRecovery: fifth no-progress repeat blocked, progress/workdir distinguished, stableID claim once, actual subprocess timed out then succeeded, UNKNOWN prevents relaunch, durable receipt/reopen, conflicts; launch/crash gap unresolved by design");
    }
}


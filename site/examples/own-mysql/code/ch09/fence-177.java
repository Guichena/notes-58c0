import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Objects;

/** Bounded JDBC text-delta ledger; no model, SSE, or external storage client. */
public final class StreamLedger {
    private StreamLedger() {}
    private static void closeConnection(Connection c,Exception primary) throws SQLException {
        try {c.close();}
        catch(SQLException | RuntimeException close) {
            if(primary==null)throw close;
            if(primary!=close)primary.addSuppressed(close);
        }
    }
    public static final int MAX_CHUNKS=10000, MAX_CHUNK_BYTES=4096, MAX_RUN_BYTES=1048576;
    public record Snapshot(String state, Integer expected, int bytes, String body) {}
    public static void init(String url) throws SQLException {
        try(Connection c=DriverManager.getConnection(url); Statement s=c.createStatement()) {
            s.execute("CREATE TABLE stream_run(tenant BIGINT NOT NULL,id BIGINT NOT NULL,epoch BIGINT NOT NULL,state VARCHAR(12) NOT NULL,expected INT,byte_count INT NOT NULL,body LONGTEXT,PRIMARY KEY(tenant,id))");
            s.execute("CREATE TABLE stream_chunk(tenant BIGINT NOT NULL,run_id BIGINT NOT NULL,seq INT NOT NULL,payload VARCHAR(4096) NOT NULL,PRIMARY KEY(tenant,run_id,seq),FOREIGN KEY(tenant,run_id) REFERENCES stream_run(tenant,id))");
        }
    }
    public static void create(String url,long tenant,long run,long epoch) throws SQLException {
        if(tenant<=0 || run<=0 || epoch<1) throw new IllegalArgumentException();
        try(Connection c=DriverManager.getConnection(url); PreparedStatement p=c.prepareStatement("INSERT INTO stream_run VALUES(?,?,?,'OPEN',NULL,0,NULL)")) {
            p.setLong(1,tenant);p.setLong(2,run);p.setLong(3,epoch);p.executeUpdate();
        }
    }
    private static Snapshot read(Connection c,long tenant,long run,boolean lock,long epoch) throws SQLException {
        try(PreparedStatement p=c.prepareStatement("SELECT state,expected,byte_count,body,epoch FROM stream_run WHERE tenant=? AND id=?"+(lock?" FOR UPDATE":""))) {
            p.setLong(1,tenant);p.setLong(2,run);
            try(ResultSet r=p.executeQuery()) {
                if(!r.next()) throw new IllegalArgumentException("unknown run");
                if(lock && r.getLong(5)!=epoch) throw new IllegalStateException("stale writer epoch");
                return new Snapshot(r.getString(1),(r.getObject(2)==null?null:((Number)r.getObject(2)).intValue()),r.getInt(3),r.getString(4));
            }
        }
    }
    public static Snapshot get(String url,long tenant,long run) throws SQLException {
        try(Connection c=DriverManager.getConnection(url)) { return read(c,tenant,run,false,0); }
    }
    private static void finishIfReady(Connection c,long tenant,long run) throws SQLException {
        Snapshot s=read(c,tenant,run,false,0);
        if(s.expected()==null || s.state().equals("COMPLETE")) return;
        StringBuilder body=new StringBuilder();int next=0;
        try(PreparedStatement p=c.prepareStatement("SELECT seq,payload FROM stream_chunk WHERE tenant=? AND run_id=? ORDER BY seq")) {
            p.setLong(1,tenant);p.setLong(2,run);
            try(ResultSet r=p.executeQuery()) {
                while(r.next()) { if(r.getInt(1)!=next) return;body.append(r.getString(2));next++; }
            }
        }
        if(next!=s.expected()) return;
        try(PreparedStatement p=c.prepareStatement("UPDATE stream_run SET state='COMPLETE',body=? WHERE tenant=? AND id=?")) {
            p.setString(1,body.toString());p.setLong(2,tenant);p.setLong(3,run);p.executeUpdate();
        }
    }
    public static Snapshot append(String url,long tenant,long run,long epoch,int seq,String text,boolean fail)
            throws SQLException {
        Objects.requireNonNull(text);
        byte[] encoded=text.getBytes(StandardCharsets.UTF_8);
        if(seq<0 || seq>=MAX_CHUNKS || encoded.length>MAX_CHUNK_BYTES
                || !new String(encoded,StandardCharsets.UTF_8).equals(text)) throw new IllegalArgumentException("bad text delta");
        Connection c=DriverManager.getConnection(url);
        Exception primary=null;
        try {
            c.setAutoCommit(false);
            try {
                Snapshot state=read(c,tenant,run,true,epoch);
                boolean exists=false;
                try(PreparedStatement p=c.prepareStatement("SELECT payload FROM stream_chunk WHERE tenant=? AND run_id=? AND seq=?")) {
                    p.setLong(1,tenant);p.setLong(2,run);p.setInt(3,seq);
                    try(ResultSet r=p.executeQuery()) {
                        if(r.next()) { exists=true;if(!r.getString(1).equals(text)) throw new IllegalArgumentException("same sequence different payload"); }
                    }
                }
                if(!exists) {
                    if(!state.state().equals("OPEN") && !state.state().equals("ENDING")) throw new IllegalStateException("run closed");
                    if(state.expected()!=null && seq>=state.expected()) throw new IllegalArgumentException("past declared end");
                    if(encoded.length>MAX_RUN_BYTES-state.bytes()) throw new IllegalArgumentException("run byte limit");
                    try(PreparedStatement p=c.prepareStatement("INSERT INTO stream_chunk VALUES(?,?,?,?)")) {
                        p.setLong(1,tenant);p.setLong(2,run);p.setInt(3,seq);p.setString(4,text);p.executeUpdate();
                    }
                    try(PreparedStatement p=c.prepareStatement("UPDATE stream_run SET byte_count=byte_count+? WHERE tenant=? AND id=?")) {
                        p.setInt(1,encoded.length);p.setLong(2,tenant);p.setLong(3,run);p.executeUpdate();
                    }
                }
                finishIfReady(c,tenant,run);
                if(fail) throw new SQLException("injected before commit");
                Snapshot result=read(c,tenant,run,false,0);c.commit();return result;
            } catch(SQLException | RuntimeException e) {
                try { c.rollback(); } catch(SQLException x) { if(e!=x)e.addSuppressed(x); }
                throw e;
            }
        } catch(SQLException | RuntimeException e) {primary=e;throw e;}
        finally {closeConnection(c,primary);}
    }
    public static Snapshot end(String url,long tenant,long run,long epoch,int count) throws SQLException {
        if(count<0 || count>MAX_CHUNKS) throw new IllegalArgumentException("bad final count");
        Connection c=DriverManager.getConnection(url);
        Exception primary=null;
        try {
            c.setAutoCommit(false);
            try {
                Snapshot state=read(c,tenant,run,true,epoch);
                if(state.expected()!=null && state.expected()!=count) throw new IllegalArgumentException("conflicting final count");
                try(PreparedStatement p=c.prepareStatement("SELECT MAX(seq) FROM stream_chunk WHERE tenant=? AND run_id=?")) {
                    p.setLong(1,tenant);p.setLong(2,run);
                    try(ResultSet r=p.executeQuery()) { r.next();Integer max=(r.getObject(1)==null?null:((Number)r.getObject(1)).intValue());if(max!=null && max>=count) throw new IllegalArgumentException("existing delta past end"); }
                }
                if(!state.state().equals("COMPLETE")) {
                    if(!state.state().equals("OPEN") && !state.state().equals("ENDING")) throw new IllegalStateException("run closed");
                    try(PreparedStatement p=c.prepareStatement("UPDATE stream_run SET state='ENDING',expected=? WHERE tenant=? AND id=?")) {
                        p.setInt(1,count);p.setLong(2,tenant);p.setLong(3,run);p.executeUpdate();
                    }
                }
                finishIfReady(c,tenant,run);Snapshot result=read(c,tenant,run,false,0);c.commit();return result;
            } catch(SQLException | RuntimeException e) {
                try { c.rollback(); } catch(SQLException x) { if(e!=x)e.addSuppressed(x); }
                throw e;
            }
        } catch(SQLException | RuntimeException e) {primary=e;throw e;}
        finally {closeConnection(c,primary);}
    }
}

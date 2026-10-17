import java.sql.*;

/** Body replacement never retries with a silently refreshed expected version. */
public final class DocumentCas {
    private final Db.Source source;
    public DocumentCas(Db.Source source) { this.source=source; }
    public record Result(long committedVersion,boolean replayed) {}
    public static final class Conflict extends SQLException {
        private static final long serialVersionUID=1L;
        public Conflict() { super("missing, inaccessible, deleted, or stale document"); }
    }
    private static Result receipt(Connection c,long tenant,long id,long expected,String request,String body)
            throws SQLException {
        try (PreparedStatement p=Db.prepare(c,
                "SELECT doc_id,expected,body,result_version FROM doc_receipt WHERE tenant=? AND request_id=?")) {
            p.setLong(1,tenant); p.setString(2,request);
            try(ResultSet r=p.executeQuery()) {
                if(!r.next()) return null;
                if(r.getLong(1)!=id || r.getLong(2)!=expected || !body.equals(r.getString(3)))
                    throw new IllegalArgumentException("request ID reused for different operation");
                return new Result(r.getLong(4),true);
            }
        }
    }
    public Result save(long tenant,long id,long expected,String request,String body,boolean failBeforeCommit)
            throws SQLException {
        Db.key(request);
        if(tenant<=0 || id<=0 || expected<0 || expected==Long.MAX_VALUE || body==null || body.length()>4000)
            throw new IllegalArgumentException("invalid bounded input");
        return Db.transaction(source,c->{
            Result old=receipt(c,tenant,id,expected,request,body);
            if(old!=null) return old;
            try(PreparedStatement p=Db.prepare(c,
                    "INSERT INTO doc_receipt(tenant,request_id,doc_id,expected,body,result_version) VALUES(?,?,?,?,?,?)")) {
                p.setLong(1,tenant);p.setString(2,request);p.setLong(3,id);
                p.setLong(4,expected);p.setString(5,body);p.setLong(6,expected+1);
                try { p.executeUpdate(); }
                catch(SQLException e) {
                    if(!Db.duplicate(e)) throw e;
                    if (!Db.rollback(c, e)) throw e;
                    Result replay=receipt(c,tenant,id,expected,request,body);
                    if(replay==null) throw e;
                    return replay;
                }
            }
            try(PreparedStatement p=Db.prepare(c,
                    "UPDATE doc SET body=?,version=version+1 WHERE tenant=? AND id=? AND version=?")) {
                p.setString(1,body);p.setLong(2,tenant);p.setLong(3,id);p.setLong(4,expected);
                if(p.executeUpdate()!=1) throw new Conflict();
            }
            if(failBeforeCommit) throw new SQLException("injected before commit");
            return new Result(expected+1,false);
        });
    }
}

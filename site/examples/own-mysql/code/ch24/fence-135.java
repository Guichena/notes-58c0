import java.sql.*;
import java.util.Set;

/** Durable NEW -> RUNNING -> SUCCEEDED/FAILED; no dispatcher or external side effect. */
public final class TaskCas {
    private static final Set<String> EDGES=Set.of("NEW:RUNNING","RUNNING:SUCCEEDED","RUNNING:FAILED");
    private final Db.Source source;
    public TaskCas(Db.Source source){this.source=source;}
    public static void validate(String state,long version,String target) {
        if(!EDGES.contains(state+":"+target) || version<0 || version==Long.MAX_VALUE)
            throw new IllegalArgumentException("illegal edge or version");
    }
    private static String receipt(Connection c,long tenant,long id,String op,String state,long version,String target)
            throws SQLException {
        try(PreparedStatement p=Db.prepare(c,
                "SELECT task_id,expected_state,expected_version,target,result FROM task_receipt WHERE tenant=? AND operation_id=?")) {
            p.setLong(1,tenant);p.setString(2,op);
            try(ResultSet r=p.executeQuery()) {
                if(!r.next())return null;
                if(r.getLong(1)!=id || !state.equals(r.getString(2)) || r.getLong(3)!=version || !target.equals(r.getString(4)))
                    throw new IllegalArgumentException("operation ID reused");
                return r.getString(5);
            }
        }
    }
    public String transition(long tenant,long id,String op,String state,long version,String target,boolean failOutbox)
            throws SQLException {
        Db.key(op);validate(state,version,target);
        if(tenant<=0 || id<=0)throw new IllegalArgumentException("tenant/task");
        return Db.transaction(source,c->{
            String old=receipt(c,tenant,id,op,state,version,target);if(old!=null)return old;
            try(PreparedStatement p=Db.prepare(c,"INSERT INTO task_receipt VALUES(?,?,?,?,?,?,?)")) {
                p.setLong(1,tenant);p.setString(2,op);p.setLong(3,id);p.setString(4,state);
                p.setLong(5,version);p.setString(6,target);p.setString(7,"PENDING");
                try{p.executeUpdate();}catch(SQLException e){
                    if(!Db.duplicate(e))throw e;
                    if (!Db.rollback(c, e)) throw e;String replay=receipt(c,tenant,id,op,state,version,target);
                    if(replay==null)throw e;return replay;
                }
            }
            int changed;
            try(PreparedStatement p=Db.prepare(c,
                    "UPDATE task SET state=?,version=version+1 WHERE tenant=? AND id=? AND state=? AND version=?")) {
                p.setString(1,target);p.setLong(2,tenant);p.setLong(3,id);p.setString(4,state);p.setLong(5,version);
                changed=p.executeUpdate();if(changed>1)throw new SQLException("task not unique");
            }
            String result=changed==1?"APPLIED":"CONFLICT_OR_MISSING";
            if(changed==1){
                if(failOutbox)throw new SQLException("injected outbox failure");
                try(PreparedStatement p=Db.prepare(c,"INSERT INTO task_outbox VALUES(?,?,?,?,?)")){
                    p.setLong(1,tenant);p.setString(2,op);p.setLong(3,id);p.setString(4,target);p.setLong(5,version+1);p.executeUpdate();
                }
            }
            try(PreparedStatement p=Db.prepare(c,"UPDATE task_receipt SET result=? WHERE tenant=? AND operation_id=?")) {
                p.setString(1,result);p.setLong(2,tenant);p.setString(3,op);
                if(p.executeUpdate()!=1)throw new SQLException("receipt missing");
            }
            return result;
        });
    }
}

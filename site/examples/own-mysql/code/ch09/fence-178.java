import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Independent JDBC example. Every graph/order writer MUST lock the same board guard. */
public final class TaskBoard {
    private TaskBoard() {}
    private static void closeConnection(Connection c,Exception primary) throws SQLException {
        try {c.close();}
        catch(SQLException | RuntimeException close) {
            if(primary==null)throw close;
            if(primary!=close)primary.addSuppressed(close);
        }
    }
    public static final int MAX_TASKS=1000, MAX_EDGES=10000;
    public static final class Conflict extends Exception {
        private static final long serialVersionUID=1L;
        Conflict(String message) { super(message); }
    }
    public static void init(String url) throws SQLException {
        try (Connection c=DriverManager.getConnection(url); Statement s=c.createStatement()) {
            s.execute("CREATE TABLE task_board(tenant BIGINT NOT NULL,id BIGINT NOT NULL,version BIGINT NOT NULL CHECK(version>=0),PRIMARY KEY(tenant,id))");
            s.execute("CREATE TABLE board_task(tenant BIGINT NOT NULL,board BIGINT NOT NULL,id BIGINT NOT NULL,position BIGINT NOT NULL CHECK(position>=0),PRIMARY KEY(tenant,board,id),FOREIGN KEY(tenant,board) REFERENCES task_board(tenant,id))");
            s.execute("CREATE INDEX ix_task_order ON board_task(tenant,board,position,id)");
            s.execute("CREATE TABLE task_dependency(tenant BIGINT NOT NULL,board BIGINT NOT NULL,task BIGINT NOT NULL,prerequisite BIGINT NOT NULL,PRIMARY KEY(tenant,board,task,prerequisite),CHECK(task<>prerequisite),FOREIGN KEY(tenant,board,task) REFERENCES board_task(tenant,board,id),FOREIGN KEY(tenant,board,prerequisite) REFERENCES board_task(tenant,board,id))");
            s.execute("CREATE INDEX ix_dependents ON task_dependency(tenant,board,prerequisite,task)");
        }
    }
    private static void guard(Connection c,long tenant,long board,long expected) throws SQLException,Conflict {
        if (tenant<=0 || board<=0 || expected<0 || expected==Long.MAX_VALUE) throw new IllegalArgumentException();
        try (PreparedStatement p=c.prepareStatement("SELECT version FROM task_board WHERE tenant=? AND id=? FOR UPDATE")) {
            p.setLong(1,tenant);p.setLong(2,board);p.setQueryTimeout(5);
            try (ResultSet r=p.executeQuery()) {
                if (!r.next() || r.getLong(1)!=expected) throw new Conflict("missing board or stale version");
            }
        }
    }
    private static Set<Long> tasks(Connection c,long tenant,long board) throws SQLException {
        Set<Long> ids=new HashSet<>();
        try (PreparedStatement p=c.prepareStatement("SELECT id FROM board_task WHERE tenant=? AND board=?")) {
            p.setLong(1,tenant);p.setLong(2,board);
            try (ResultSet r=p.executeQuery()) {
                while (r.next()) { if(ids.size()==MAX_TASKS) throw new IllegalStateException("board too large"); ids.add(r.getLong(1)); }
            }
        }
        return ids;
    }
    private static void increment(Connection c,long tenant,long board,long expected) throws SQLException {
        try (PreparedStatement p=c.prepareStatement("UPDATE task_board SET version=version+1 WHERE tenant=? AND id=? AND version=?")) {
            p.setLong(1,tenant);p.setLong(2,board);p.setLong(3,expected);
            if(p.executeUpdate()!=1) throw new SQLException("lost guarded version");
        }
    }
    private static void rollback(Connection c,Exception original) {
        try { c.rollback(); } catch(SQLException e) { if(original!=e)original.addSuppressed(e); }
    }
    /** Complete permutation, not a partially supplied order. Ties in old positions are harmless. */
    public static long reorder(String url,long tenant,long board,long expected,List<Long> requested,boolean fail)
            throws SQLException,Conflict {
        List<Long> order=List.copyOf(requested);
        if(order.size()>MAX_TASKS || new HashSet<>(order).size()!=order.size()) throw new IllegalArgumentException("duplicate/oversized order");
        Connection c=DriverManager.getConnection(url);
        Exception primary=null;
        try {
            c.setTransactionIsolation(Connection.TRANSACTION_READ_COMMITTED);c.setAutoCommit(false);
            try {
                guard(c,tenant,board,expected);
                if(!tasks(c,tenant,board).equals(new HashSet<>(order))) throw new IllegalArgumentException("not a full same-board permutation");
                try(PreparedStatement p=c.prepareStatement("UPDATE board_task SET position=? WHERE tenant=? AND board=? AND id=?")) {
                    for(int i=0;i<order.size();i++) {
                        p.setInt(1,i);p.setLong(2,tenant);p.setLong(3,board);p.setLong(4,order.get(i));
                        if(p.executeUpdate()!=1) throw new SQLException("task vanished");
                    }
                }
                increment(c,tenant,board,expected);
                if(fail) throw new SQLException("injected before commit");
                c.commit();return expected+1;
            } catch(SQLException|Conflict|RuntimeException e) {rollback(c,e);throw e;}
        } catch(SQLException|Conflict|RuntimeException e) {primary=e;throw e;}
        finally {closeConnection(c,primary);}
    }
    /** task depends on prerequisite; true inserts a new edge, false is an existing-edge no-op. */
    public static boolean depend(String url,long tenant,long board,long expected,long task,long prerequisite,boolean fail)
            throws SQLException,Conflict {
        if(task==prerequisite) throw new IllegalArgumentException("self cycle");
        Connection c=DriverManager.getConnection(url);
        Exception primary=null;
        try {
            c.setTransactionIsolation(Connection.TRANSACTION_READ_COMMITTED);c.setAutoCommit(false);
            try {
                guard(c,tenant,board,expected);
                Set<Long> ids=tasks(c,tenant,board);
                if(!ids.contains(task)||!ids.contains(prerequisite)) throw new IllegalArgumentException("unknown same-board task");
                Map<Long,List<Long>> edges=new HashMap<>();int count=0;boolean exists=false;
                try(PreparedStatement p=c.prepareStatement("SELECT task,prerequisite FROM task_dependency WHERE tenant=? AND board=?")) {
                    p.setLong(1,tenant);p.setLong(2,board);
                    try(ResultSet r=p.executeQuery()) {
                        while(r.next()) {
                            if(++count>MAX_EDGES) throw new IllegalStateException("graph too large");
                            long a=r.getLong(1),b=r.getLong(2);
                            edges.computeIfAbsent(a,key->new ArrayList<>()).add(b);
                            if(a==task&&b==prerequisite) exists=true;
                        }
                    }
                }
                if(exists) {c.rollback();return false;}
                if(count==MAX_EDGES) throw new IllegalStateException("edge limit");
                Set<Long> seen=new HashSet<>();ArrayDeque<Long> queue=new ArrayDeque<>();queue.add(prerequisite);
                while(!queue.isEmpty()) {
                    long current=queue.removeFirst();
                    if(current==task) throw new IllegalArgumentException("dependency cycle");
                    if(seen.add(current)) queue.addAll(edges.getOrDefault(current,List.of()));
                }
                try(PreparedStatement p=c.prepareStatement("INSERT INTO task_dependency VALUES(?,?,?,?)")) {
                    p.setLong(1,tenant);p.setLong(2,board);p.setLong(3,task);p.setLong(4,prerequisite);p.executeUpdate();
                }
                increment(c,tenant,board,expected);
                if(fail) throw new SQLException("injected before commit");
                c.commit();return true;
            } catch(SQLException|Conflict|RuntimeException e) {rollback(c,e);throw e;}
        } catch(SQLException|Conflict|RuntimeException e) {primary=e;throw e;}
        finally {closeConnection(c,primary);}
    }
    public static List<Long> ordered(String url,long tenant,long board) throws SQLException {
        try(Connection c=DriverManager.getConnection(url);PreparedStatement p=c.prepareStatement("SELECT id FROM board_task WHERE tenant=? AND board=? ORDER BY position,id")) {
            p.setLong(1,tenant);p.setLong(2,board);List<Long> result=new ArrayList<>();
            try(ResultSet r=p.executeQuery()) {while(r.next()) result.add(r.getLong(1));}
            return List.copyOf(result);
        }
    }
}

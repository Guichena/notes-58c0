import java.sql.*;
import java.util.*;
import java.util.concurrent.*;

/** H2 authority and durable due rows; Redis can only be a rebuildable acceleration index. */
public final class VersionedUnban {
    private final String url;
    public VersionedUnban(String url) throws SQLException {
        this.url = url;
        try (Connection c = open(); Statement s = c.createStatement()) {
            s.execute("CREATE TABLE IF NOT EXISTS ban(user_id VARCHAR PRIMARY KEY, version BIGINT NOT NULL, expires BIGINT NOT NULL, active BOOLEAN NOT NULL)");
            s.execute("CREATE TABLE IF NOT EXISTS due(user_id VARCHAR, version BIGINT, expires BIGINT, done BOOLEAN, PRIMARY KEY(user_id,version))");
            s.execute("CREATE TABLE IF NOT EXISTS unban_event(user_id VARCHAR, version BIGINT, PRIMARY KEY(user_id,version))");
        }
    }
    private Connection open() throws SQLException { return DriverManager.getConnection(url); }
    public void addUser(String user) throws SQLException {
        try (Connection c = open(); PreparedStatement p=c.prepareStatement("INSERT INTO ban VALUES(?,0,0,FALSE)")) { p.setString(1,user); p.executeUpdate(); }
    }
    public long ban(String user, long expires) throws SQLException {
        if (expires < 0) throw new IllegalArgumentException();
        try (Connection c=open()) {
            c.setAutoCommit(false);
            try {
                long version;
                try (PreparedStatement p=c.prepareStatement("SELECT version FROM ban WHERE user_id=? FOR UPDATE")) {
                    p.setString(1,user); try(ResultSet r=p.executeQuery()) { if(!r.next()) throw new IllegalArgumentException("user"); version=Math.incrementExact(r.getLong(1)); }
                }
                try (PreparedStatement p=c.prepareStatement("UPDATE ban SET version=?, expires=?, active=TRUE WHERE user_id=?")) {p.setLong(1,version);p.setLong(2,expires);p.setString(3,user);p.executeUpdate();}
                try (PreparedStatement p=c.prepareStatement("INSERT INTO due VALUES(?,?,?,FALSE)")) {p.setString(1,user);p.setLong(2,version);p.setLong(3,expires);p.executeUpdate();}
                JdbcSafety.commit(c); return version;
            } catch(SQLException | RuntimeException e) {JdbcSafety.rollbackAfterFailure(c,e);throw e;}
        }
    }
    public boolean unban(String user, long version, long now, boolean injectFailure) throws SQLException {
        if(now<0) throw new IllegalArgumentException();
        try(Connection c=open()) {
            c.setAutoCommit(false);
            try {
                int changed;
                try(PreparedStatement p=c.prepareStatement("UPDATE ban SET active=FALSE WHERE user_id=? AND version=? AND active=TRUE AND expires<=?")) {p.setString(1,user);p.setLong(2,version);p.setLong(3,now);changed=p.executeUpdate();}
                if(changed==1) {
                    try(PreparedStatement p=c.prepareStatement("INSERT INTO unban_event VALUES(?,?)")) {p.setString(1,user);p.setLong(2,version);p.executeUpdate();}
                }
                // A future task is never acknowledged early; a superseded due version can be retired when due.
                try(PreparedStatement p=c.prepareStatement("UPDATE due SET done=TRUE WHERE user_id=? AND version=? AND expires<=?")) {p.setString(1,user);p.setLong(2,version);p.setLong(3,now);p.executeUpdate();}
                if(injectFailure) throw new SQLException("injected rollback");
                JdbcSafety.commit(c); return changed==1;
            }catch(SQLException | RuntimeException e){JdbcSafety.rollbackAfterFailure(c,e);throw e;}
        }
    }
    public int catchUp(long now) throws SQLException {
        record Due(String user,long version) {}
        List<Due> rows=new ArrayList<>();
        try(Connection c=open();PreparedStatement p=c.prepareStatement("SELECT user_id,version FROM due WHERE done=FALSE AND expires<=?")) {p.setLong(1,now);try(ResultSet r=p.executeQuery()){while(r.next()) rows.add(new Due(r.getString(1),r.getLong(2)));}}
        int changed=0;for(Due d:rows)if(unban(d.user(),d.version(),now,false))changed++;return changed;
    }
    public long count(String query) throws SQLException {try(Connection c=open();Statement s=c.createStatement();ResultSet r=s.executeQuery(query)){r.next();return r.getLong(1);}}
    private static void check(boolean b){if(!b)throw new AssertionError();}
    public static void main(String[] args)throws Exception {
        if(args.length!=1)throw new IllegalArgumentException("one isolated temporary database path");
        String url="jdbc:h2:"+args[0]+";LOCK_TIMEOUT=3000";VersionedUnban s=new VersionedUnban(url);s.addUser("u");
        long old=s.ban("u",10);check(!s.unban("u",old,9,false));check(s.count("SELECT COUNT(*) FROM due WHERE done=FALSE")==1);
        long newer=s.ban("u",20);check(!s.unban("u",old,10,false));check(s.count("SELECT COUNT(*) FROM ban WHERE active=TRUE")==1);
        try{s.unban("u",newer,20,true);throw new AssertionError();}catch(SQLException e){check(e.getMessage().contains("injected"));}
        check(s.count("SELECT COUNT(*) FROM ban WHERE active=TRUE")==1 && s.count("SELECT COUNT(*) FROM unban_event")==0);
        ExecutorService pool=Executors.newFixedThreadPool(8);
        Throwable testFailure=null;
        try{List<Callable<Boolean>> tasks=new ArrayList<>();for(int i=0;i<30;i++)tasks.add(()->s.unban("u",newer,20,false));int wins=0;for(Future<Boolean> f:pool.invokeAll(tasks, 10, TimeUnit.SECONDS))if(f.get())wins++;check(wins==1);}catch(Exception|Error failure){testFailure=failure;throw failure;}finally{JdbcSafety.closePool(pool,testFailure);}
        check(s.count("SELECT COUNT(*) FROM unban_event")==1);check(!s.unban("u",newer,20,false));
        s.ban("u",30);VersionedUnban reopened=new VersionedUnban(url);check(reopened.catchUp(100)==1);check(reopened.catchUp(100)==0);
        check(reopened.count("SELECT COUNT(*) FROM unban_event")==2);check(reopened.count("SELECT COUNT(*) FROM due WHERE done=FALSE")==0);
        System.out.println("PASS VersionedUnban: early/exact deadline, newer ban blocks stale release, rollback of status+event+due, 30 racing releases yield 1, repeated release, persistent catch-up after all connections closed");
    }
}

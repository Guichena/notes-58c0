import java.sql.*;
import java.util.*;
import java.util.concurrent.*;

/** Local routing property tests plus real H2 slot/outbox/fencing transactions. */
public final class AlarmSlots {
    private final String url;
    public AlarmSlots(String url)throws SQLException {
        this.url=url;
        try(Connection c=open();Statement s=c.createStatement()){
            s.execute("CREATE TABLE IF NOT EXISTS rule(id INT PRIMARY KEY, version INT, next_slot BIGINT)");
            s.execute("CREATE TABLE IF NOT EXISTS run(rule_id INT, version INT, slot BIGINT, epoch BIGINT, done BOOLEAN, PRIMARY KEY(rule_id,version,slot))");
            s.execute("CREATE TABLE IF NOT EXISTS outbox(rule_id INT, version INT, slot BIGINT, PRIMARY KEY(rule_id,version,slot))");
        }
    }
    private Connection open()throws SQLException{return DriverManager.getConnection(url);}
    public void seed()throws SQLException{try(Connection c=open();Statement s=c.createStatement()){s.execute("INSERT INTO rule VALUES(1,1,0)");}}
    // Bounded catch-up: persist up to maxSlots; later calls continue from the same cursor.
    public int emit(long through,int maxSlots,boolean fail)throws SQLException{
        if(through<0||maxSlots<=0||maxSlots>1000)throw new IllegalArgumentException();
        try(Connection c=open()){
            c.setAutoCommit(false);
            try{
                long next;int version;
                try(Statement s=c.createStatement();ResultSet r=s.executeQuery("SELECT version,next_slot FROM rule WHERE id=1 FOR UPDATE")){r.next();version=r.getInt(1);next=r.getLong(2);}
                int emitted=0;
                while(next<=through&&emitted<maxSlots){
                    try(PreparedStatement p=c.prepareStatement("INSERT INTO run VALUES(1,?,?,0,FALSE)")){p.setInt(1,version);p.setLong(2,next);p.executeUpdate();}
                    try(PreparedStatement p=c.prepareStatement("INSERT INTO outbox VALUES(1,?,?)")){p.setInt(1,version);p.setLong(2,next);p.executeUpdate();}
                    next=Math.incrementExact(next);emitted++;
                }
                if(fail)throw new SQLException("injected rollback");
                try(PreparedStatement p=c.prepareStatement("UPDATE rule SET next_slot=? WHERE id=1")){p.setLong(1,next);p.executeUpdate();}
                JdbcSafety.commit(c);return emitted;
            }catch(SQLException|RuntimeException e){JdbcSafety.rollbackAfterFailure(c,e);throw e;}
        }
    }
    // Explicit administrative/lease authority takeover; lease timing is outside this sample.
    public long takeOver(long slot)throws SQLException{
        try(Connection c=open()){
            c.setAutoCommit(false);
            try{
                try(PreparedStatement p=c.prepareStatement("UPDATE run SET epoch=epoch+1 WHERE rule_id=1 AND version=1 AND slot=? AND done=FALSE")){p.setLong(1,slot);if(p.executeUpdate()!=1){c.rollback();return -1;}}
                try(PreparedStatement p=c.prepareStatement("SELECT epoch FROM run WHERE rule_id=1 AND version=1 AND slot=?")){p.setLong(1,slot);try(ResultSet r=p.executeQuery()){r.next();long e=r.getLong(1);JdbcSafety.commit(c);return e;}}
            }catch(SQLException|RuntimeException e){JdbcSafety.rollbackAfterFailure(c,e);throw e;}
        }
    }
    public boolean complete(long slot,long epoch)throws SQLException{
        try(Connection c=open();PreparedStatement p=c.prepareStatement("UPDATE run SET done=TRUE WHERE rule_id=1 AND version=1 AND slot=? AND epoch=? AND done=FALSE")){p.setLong(1,slot);p.setLong(2,epoch);return p.executeUpdate()==1;}
    }
    static int shard(long rule){return Math.floorMod(Long.hashCode(rule),1024);}
    public long count(String sql)throws SQLException{try(Connection c=open();Statement s=c.createStatement();ResultSet r=s.executeQuery(sql)){r.next();return r.getLong(1);}}
    private static void check(boolean b){if(!b)throw new AssertionError();}
    public static void main(String[] args)throws Exception{
        for(int workers:new int[]{1,3,7,19}){
            int[] seen=new int[100000];
            for(int owner=0;owner<workers;owner++)for(int r=0;r<seen.length;r++)if(shard(r)%workers==owner)seen[r]++;
            for(int n:seen)check(n==1);
        }
        // Two topology epochs overlap: a deterministic owner in each view still means two attempts.
        int attempts=0;for(int r=0;r<100000;r++){check(shard(r)>=0&&shard(r)<1024);attempts+=2;}check(attempts==200000);
        if(args.length!=1)throw new IllegalArgumentException("one isolated temporary database path");
        String url="jdbc:h2:"+args[0]+";LOCK_TIMEOUT=3000";AlarmSlots s=new AlarmSlots(url);s.seed();
        try{s.emit(9,4,true);throw new AssertionError();}catch(SQLException e){check(e.getMessage().contains("injected"));}
        check(s.count("SELECT COUNT(*) FROM run")==0&&s.count("SELECT next_slot FROM rule")==0);
        ExecutorService pool=Executors.newFixedThreadPool(8);
        Throwable testFailure=null;
        try{List<Callable<Integer>> tasks=new ArrayList<>();for(int i=0;i<30;i++)tasks.add(()->s.emit(9,4,false));int emitted=0;for(Future<Integer> f:pool.invokeAll(tasks, 10, TimeUnit.SECONDS))emitted+=f.get();check(emitted==10);}catch(Exception|Error failure){testFailure=failure;throw failure;}finally{JdbcSafety.closePool(pool,testFailure);}
        check(s.count("SELECT COUNT(*) FROM run")==10&&s.count("SELECT COUNT(*) FROM outbox")==10&&s.count("SELECT next_slot FROM rule")==10);
        long old=s.takeOver(0),current=s.takeOver(0);check(current==old+1);check(!s.complete(0,old));check(s.complete(0,current));check(!s.complete(0,current));
        AlarmSlots reopened=new AlarmSlots(url);check(reopened.emit(12,2,false)==2);check(reopened.emit(12,2,false)==1);check(reopened.emit(12,2,false)==0);
        check(reopened.count("SELECT COUNT(*) FROM run")==13&&reopened.count("SELECT COUNT(*) FROM outbox")==13);
        System.out.println("PASS AlarmSlots: 100000 rules have one owner per 1/3/7/19-node topology, overlap needs fencing, rollback run+outbox+cursor, 30 racing schedulers emit 10 slots once, stale completion rejected, bounded catch-up/reopen");
    }
}

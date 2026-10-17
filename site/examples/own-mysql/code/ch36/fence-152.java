import java.sql.*;
import java.util.*;
import java.util.concurrent.*;

/** Local authorized ledger posting only, not payment-provider authorization or a banking API. */
public final class AccountLedger {
    private final String url;
    public record Result(String state, long balance) {}
    public AccountLedger(String url)throws SQLException {
        this.url=url;
        try(Connection c=open();Statement s=c.createStatement()) {
            s.execute("CREATE TABLE IF NOT EXISTS account(tenant VARCHAR, id VARCHAR, currency VARCHAR(3), balance BIGINT CHECK(balance>=0), PRIMARY KEY(tenant,id))");
            s.execute("CREATE TABLE IF NOT EXISTS request(tenant VARCHAR, op VARCHAR, account_id VARCHAR, currency VARCHAR(3), delta BIGINT, state VARCHAR, result_balance BIGINT, PRIMARY KEY(tenant,op))");
            s.execute("CREATE TABLE IF NOT EXISTS entry(tenant VARCHAR, op VARCHAR, leg INT, signed_amount BIGINT, PRIMARY KEY(tenant,op,leg))");
            s.execute("CREATE TABLE IF NOT EXISTS outbox(tenant VARCHAR, op VARCHAR, PRIMARY KEY(tenant,op))");
        }
    }
    private Connection open()throws SQLException{return DriverManager.getConnection(url);}
    public void create(String tenant,String id,String currency)throws SQLException {
        if(tenant==null||tenant.isBlank()||id==null||id.isBlank()||currency==null||!currency.matches("[A-Z]{3}"))throw new IllegalArgumentException();
        try(Connection c=open();PreparedStatement p=c.prepareStatement("INSERT INTO account VALUES(?,?,?,0)")){p.setString(1,tenant);p.setString(2,id);p.setString(3,currency);p.executeUpdate();}
    }
    public Result post(String tenant,String op,String account,String currency,long delta,boolean fail)throws SQLException {
        if(tenant==null||tenant.isBlank()||op==null||op.isBlank()||account==null||account.isBlank()||currency==null||!currency.matches("[A-Z]{3}")||delta==0||delta==Long.MIN_VALUE)throw new IllegalArgumentException();
        try(Connection c=open()) {
            c.setAutoCommit(false);
            try {
                try(PreparedStatement p=c.prepareStatement("INSERT INTO request VALUES(?,?,?,?,?,'PENDING',NULL)")){p.setString(1,tenant);p.setString(2,op);p.setString(3,account);p.setString(4,currency);p.setLong(5,delta);p.executeUpdate();}
                catch(SQLException e) {
                    if(!"23505".equals(e.getSQLState()))throw e;
                    try{c.rollback();}catch(SQLException rollback){if(e!=rollback)e.addSuppressed(rollback);throw e;}
                    try(PreparedStatement p=c.prepareStatement("SELECT account_id,currency,delta,state,result_balance FROM request WHERE tenant=? AND op=?")) {
                        p.setString(1,tenant);p.setString(2,op);try(ResultSet r=p.executeQuery()) {
                            if(!r.next())throw new SQLException("retry lookup missing");
                            if(!account.equals(r.getString(1))||!currency.equals(r.getString(2))||delta!=r.getLong(3))throw new IllegalArgumentException("operation payload conflict");
                            String state=r.getString(4);if(!"POSTED".equals(state)&&!"INSUFFICIENT".equals(state))throw new IllegalStateException("unexpected committed state");
                            long saved=r.getLong(5);if(r.wasNull())throw new SQLException("incomplete result");
                            c.rollback();return new Result(state,saved);
                        }
                    }
                }
                long old;
                try(PreparedStatement p=c.prepareStatement("SELECT currency,balance FROM account WHERE tenant=? AND id=? FOR UPDATE")){
                    p.setString(1,tenant);p.setString(2,account);try(ResultSet r=p.executeQuery()){if(!r.next()||!currency.equals(r.getString(1)))throw new IllegalArgumentException("account/currency");old=r.getLong(2);}}
                String state;long result=old;
                if(delta<0 && old < -delta) state="INSUFFICIENT";
                else {
                    result=Math.addExact(old,delta);state="POSTED";
                    try(PreparedStatement p=c.prepareStatement("UPDATE account SET balance=? WHERE tenant=? AND id=?")){p.setLong(1,result);p.setString(2,tenant);p.setString(3,account);if(p.executeUpdate()!=1)throw new SQLException("account missing");}
                    try(PreparedStatement p=c.prepareStatement("INSERT INTO entry VALUES(?,?,?,?)")){
                        for(int leg=0;leg<2;leg++){p.setString(1,tenant);p.setString(2,op);p.setInt(3,leg);p.setLong(4,leg==0?delta:-delta);p.executeUpdate();}}
                    try(PreparedStatement p=c.prepareStatement("INSERT INTO outbox VALUES(?,?)")){p.setString(1,tenant);p.setString(2,op);p.executeUpdate();}
                }
                if(fail)throw new SQLException("injected rollback");
                try(PreparedStatement p=c.prepareStatement("UPDATE request SET state=?,result_balance=? WHERE tenant=? AND op=?")){p.setString(1,state);p.setLong(2,result);p.setString(3,tenant);p.setString(4,op);p.executeUpdate();}
                try{c.commit();}catch(SQLException e){throw new SQLException("COMMIT UNKNOWN; reconcile same tenant/op", "08007",e);}return new Result(state,result);
            }catch(SQLException|RuntimeException e){try{c.rollback();}catch(SQLException rollback){if(e!=rollback)e.addSuppressed(rollback);}throw e;}
        }
    }
    private long scalar(String sql)throws SQLException{try(Connection c=open();Statement s=c.createStatement();ResultSet r=s.executeQuery(sql)){r.next();return r.getLong(1);}}
    private static void check(boolean b){if(!b)throw new AssertionError();}
    public static void main(String[] args)throws Exception{
        if(args.length!=1)throw new IllegalArgumentException("one fresh local database file base path required");
        String url="jdbc:h2:"+args[0]+";LOCK_TIMEOUT=20000";AccountLedger s=new AccountLedger(url);s.create("t","a","CNY");
        check(s.post("t","seed","a","CNY",100,false).balance()==100);
        check(s.post("t","seed","a","CNY",100,false).balance()==100);
        try{s.post("t","seed","a","CNY",101,false);throw new AssertionError();}catch(IllegalArgumentException ok){}
        try{s.post("t","fail","a","CNY",-10,true);throw new AssertionError();}catch(SQLException e){check(e.getMessage().contains("injected"));}
        check(s.scalar("SELECT COUNT(*) FROM request WHERE op='fail'")==0);
        ExecutorService pool=Executors.newFixedThreadPool(12);
        Throwable primary = null;
        try {
            List<Callable<Result>> tasks=new ArrayList<>();
            for(int i=0;i<30;i++){String op="debit"+i;tasks.add(()->s.post("t",op,"a","CNY",-10,false));}
            int posted=0;for(Future<Result> f:pool.invokeAll(tasks,30,TimeUnit.SECONDS))if(f.get(5,TimeUnit.SECONDS).state().equals("POSTED"))posted++;
            check(posted==10 && s.scalar("SELECT balance FROM account WHERE tenant='t' AND id='a'")==0);
            tasks.clear();for(int i=0;i<30;i++)tasks.add(()->s.post("t","same","a","CNY",5,false));
            for(Future<Result> f:pool.invokeAll(tasks,30,TimeUnit.SECONDS))check(f.get(5,TimeUnit.SECONDS).balance()==5);
        } catch (Exception | Error failure) { primary = failure; throw failure; }
        finally {
            Throwable failure = primary;
            try { pool.shutdownNow(); }
            catch (RuntimeException | Error cleanup) { failure = keepFailure(failure, cleanup); }
            try {
                if (!pool.awaitTermination(5,TimeUnit.SECONDS)) throw new AssertionError("executor did not stop");
            } catch (InterruptedException | RuntimeException | Error cleanup) {
                if (cleanup instanceof InterruptedException) Thread.currentThread().interrupt();
                failure = keepFailure(failure, cleanup);
            }
            if (primary == null && failure != null) {
                if (failure instanceof Exception exception) throw exception;
                throw (Error) failure;
            }
        }
        check(s.scalar("SELECT COUNT(*) FROM entry")==24 && s.scalar("SELECT COUNT(*) FROM outbox")==12);
        check(s.scalar("SELECT COUNT(*) FROM (SELECT tenant,op FROM entry GROUP BY tenant,op HAVING SUM(signed_amount)<>0)")==0);
        AccountLedger r=new AccountLedger(url);check(r.post("t","seed","a","CNY",100,false).balance()==100); // saved response, not current 5
        check(r.scalar("SELECT balance FROM account WHERE tenant='t' AND id='a'")==5);
        r.create("other","a","CNY");check(r.post("other","seed","a","CNY",7,false).balance()==7);
        r.create("max","a","CNY");r.post("max","max","a","CNY",Long.MAX_VALUE,false);
        try{r.post("max","overflow","a","CNY",1,false);throw new AssertionError();}catch(ArithmeticException ok){}
        check(r.scalar("SELECT COUNT(*) FROM request WHERE op='overflow'")==0);
        System.out.println("PASS AccountLedger: saved response replay, payload conflict, atomic rollback, 30 debits allow 10 without overdraft, 30 same credits post once, balanced legs, outbox count, persistent reopen, tenant namespace, overflow rollback");
    }
    private static Throwable keepFailure(Throwable first, Throwable next) {
        if (first == null) return next;
        if (first != next) {
            for (Throwable saved : first.getSuppressed()) if (saved == next) return first;
            first.addSuppressed(next);
        }
        return first;
    }
}

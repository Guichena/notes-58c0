import java.sql.*;
import java.util.*;
import java.util.concurrent.*;

public class IdempotentEffect {
  final String url="jdbc:h2:mem:inbox;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000";
  Connection open() throws SQLException { return DriverManager.getConnection(url); }
  IdempotentEffect() throws Exception {
    try(var c=open();var s=c.createStatement()) {
      s.execute("create table account(id bigint primary key,balance bigint not null)");
      s.execute("insert into account values(1,1000)");
      s.execute("create table inbox(event_id varchar(80) primary key,amount bigint not null)");
    }
  }
  // One event type and one account for this bounded example. Production inbox
  // keys also include subscriber/operation identity and canonical payload hash.
  boolean debit(String eventId,long amount,boolean failAfterInsert) throws Exception {
    if(eventId==null || eventId.isBlank() || eventId.length()>80 || amount<=0)
      throw new IllegalArgumentException();
    try(var c=open()) {
      c.setAutoCommit(false);
      try {
        try(var p=c.prepareStatement("insert into inbox values(?,?)")) {
          p.setString(1,eventId);p.setLong(2,amount);
          try { p.executeUpdate(); }
          catch(SQLException e) {
            // H2 SQLState 23505: only this inbox insertion has a unique key.
            // Never treat arbitrary business SQL exceptions as 'already done'.
            if(!"23505".equals(e.getSQLState()))throw e;
            try{c.rollback();}catch(SQLException rollback){if(e!=rollback)e.addSuppressed(rollback);throw e;}
            try(var q=c.prepareStatement("select amount from inbox where event_id=?")) {
              q.setString(1,eventId);
              try(var rs=q.executeQuery()) {
                if(!rs.next() || rs.getLong(1)!=amount)throw new IllegalStateException("event identity conflict");
              }
            }
            c.rollback();return false;
          }
        }
        if(failAfterInsert)throw new IllegalStateException("injected failure");
        try(var p=c.prepareStatement("update account set balance=balance-? where id=1 and balance>=?")) {
          p.setLong(1,amount);p.setLong(2,amount);
          if(p.executeUpdate()!=1)throw new IllegalStateException("insufficient balance");
        }
        try{c.commit();}catch(SQLException e){throw new SQLException("COMMIT UNKNOWN; reconcile same event", "08007", e);}return true;
      } catch(Exception e) { try{c.rollback();}catch(SQLException rollback){if(e!=rollback)e.addSuppressed(rollback);}throw e; }
    }
  }
  long balance() throws Exception {
    try(var c=open();var s=c.createStatement();var r=s.executeQuery("select balance from account where id=1")) {
      r.next();return r.getLong(1);
    }
  }
  static void require(boolean b) { if(!b)throw new AssertionError(); }
  public static void main(String[] args) throws Exception {
    var app=new IdempotentEffect();
    require(app.debit("a",10,false));require(app.balance()==990);
    require(!app.debit("a",10,false));require(app.balance()==990);
    try {app.debit("a",11,false);throw new AssertionError();}catch(IllegalStateException expected){}
    try {app.debit("b",20,true);throw new AssertionError();}catch(IllegalStateException expected){}
    require(app.balance()==990 && app.debit("b",20,false) && app.balance()==970);
    var pool=Executors.newFixedThreadPool(8);
    Throwable primary = null;
    try {
      List<Future<Boolean>> jobs=new ArrayList<>();
      for(int i=0;i<40;i++)jobs.add(pool.submit(()->app.debit("race",30,false)));
      int applied=0;for(var f:jobs)if(f.get(20,TimeUnit.SECONDS))applied++;
      require(applied==1 && app.balance()==940);
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
    try {app.debit("too-large",2000,false);throw new AssertionError();}catch(IllegalStateException expected){}
    require(app.balance()==940);
    // Retry same failed event still reaches the business check: inbox was rolled back.
    try {app.debit("too-large",2000,false);throw new AssertionError();}catch(IllegalStateException expected){}
    require(app.balance()==940);
    System.out.println("PASS apply, replay, payload conflict, rollback/retry, 40 duplicate racers, failed business rollback; local H2 only");
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

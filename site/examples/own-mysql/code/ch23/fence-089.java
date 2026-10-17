import java.sql.*;
import java.util.*;
import java.util.concurrent.*;

/** Controlled MySQL experiment. Requires fresh lock_probe rows 1 and 2, n=0. */
public final class DeadlockDemo {
    private DeadlockDemo(){}
    public record Result(int commits,int deadlocks,int sum){}
    public static Result run(Db.Source source) throws Exception {
        try(Connection c=source.open();Statement s=c.createStatement();ResultSet r=s.executeQuery(
                "SELECT @@innodb_deadlock_detect,@@innodb_lock_wait_timeout")) {
            r.next();if(!r.getBoolean(1) || r.getLong(2)<10)
                throw new IllegalStateException("requires detection ON and lock timeout >=10; no setting changed");
        }
        CountDownLatch firstLocks=new CountDownLatch(2);
        ExecutorService pool=Executors.newFixedThreadPool(2);
        List<Connection> live=Collections.synchronizedList(new ArrayList<>());
        List<Future<String>> jobs=new ArrayList<>();
        Throwable primary = null;
        try{
            for(int first=1;first<=2;first++){
                final int id=first;
                jobs.add(pool.submit(()->{
                    try(Connection c=source.open()){
                        live.add(c);c.setAutoCommit(false);
                        try(PreparedStatement p=Db.prepare(c,"UPDATE lock_probe SET n=n+1 WHERE id=?")){
                            p.setInt(1,id);if(p.executeUpdate()!=1)throw new SQLException("first row missing");
                            firstLocks.countDown();
                            if(!firstLocks.await(2,TimeUnit.SECONDS))throw new SQLException("gate failed; no deadlock established");
                            p.setInt(1,3-id);if(p.executeUpdate()!=1)throw new SQLException("second row missing");
                            c.commit();return "COMMIT";
                        }catch(SQLException e){
                            Db.rollback(c,e);
                            if(e.getErrorCode()==1213 && "40001".equals(e.getSQLState()))return "DEADLOCK";
                            throw e;
                        }catch(InterruptedException e){
                            Db.rollback(c,e);Thread.currentThread().interrupt();throw e;
                        }finally{live.remove(c);}
                    }
                }));
            }
            int commits=0,deadlocks=0;long deadline=System.nanoTime()+12_000_000_000L;
            for(Future<String> f:jobs){
                String result=f.get(Math.max(1,deadline-System.nanoTime()),TimeUnit.NANOSECONDS);
                if(result.equals("COMMIT"))commits++;else deadlocks++;
            }
            try(Connection c=source.open();Statement s=c.createStatement();ResultSet r=s.executeQuery("SELECT SUM(n) FROM lock_probe")){
                r.next();return new Result(commits,deadlocks,r.getInt(1));
            }
        } catch (Exception | Error failure) { primary = failure; throw failure; }
        finally {
            Throwable failure = primary;
            for (Future<String> future : jobs) {
                try { future.cancel(true); }
                catch (RuntimeException | Error cleanup) { failure = keepFailure(failure, cleanup); }
            }
            // Only connections created by this disposable experiment are aborted.
            synchronized (live) {
                for (Connection connection : live) {
                    try { connection.abort(Runnable::run); }
                    catch (SQLException | RuntimeException | Error cleanup) { failure = keepFailure(failure, cleanup); }
                }
            }
            try { pool.shutdownNow(); }
            catch (RuntimeException | Error cleanup) { failure = keepFailure(failure, cleanup); }
            try {
                if (!pool.awaitTermination(8,TimeUnit.SECONDS)) throw new IllegalStateException("workers did not stop");
            } catch (InterruptedException | RuntimeException | Error cleanup) {
                if (cleanup instanceof InterruptedException) Thread.currentThread().interrupt();
                failure = keepFailure(failure, cleanup);
            }
            if (primary == null && failure != null) {
                if (failure instanceof Exception exception) throw exception;
                throw (Error) failure;
            }
        }
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

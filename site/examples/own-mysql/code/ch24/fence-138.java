import java.sql.*;
import java.util.*;
import java.util.concurrent.*;

/** Optional integration against an explicitly authorized local disposable schema. */
public final class MySqlIntegration {
    private static int checks;
    private static void require(boolean b){checks++;if(!b)throw new AssertionError("check "+checks);}
    @FunctionalInterface interface Job { boolean run(int i) throws Exception; }
    private static int race(int count,Job job) throws Exception {
        ExecutorService pool=Executors.newFixedThreadPool(8);
        List<Future<Boolean>> futures=new ArrayList<>();
        Throwable primary = null;
        try{
            for(int i=0;i<count;i++){final int n=i;futures.add(pool.submit(()->job.run(n)));}
            int won=0;long end=System.nanoTime()+60_000_000_000L;
            for(Future<Boolean> f:futures)if(f.get(Math.max(1,end-System.nanoTime()),TimeUnit.NANOSECONDS))won++;
            return won;
        } catch (Exception | Error failure) { primary = failure; throw failure; }
        finally {
            Throwable failure = primary;
            for (Future<Boolean> future : futures) {
                try { future.cancel(true); }
                catch (RuntimeException | Error cleanup) { failure = keepFailure(failure, cleanup); }
            }
            try { pool.shutdownNow(); }
            catch (RuntimeException | Error cleanup) { failure = keepFailure(failure, cleanup); }
            try {
                if (!pool.awaitTermination(12,TimeUnit.SECONDS)) throw new IllegalStateException("workers did not stop");
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
    private static long scalar(Db.Source source,String sql) throws SQLException {
        try(Connection c=source.open();PreparedStatement p=Db.prepare(c,sql);ResultSet r=p.executeQuery()){
            if(!r.next())throw new SQLException("no row");return r.getLong(1);
        }
    }
    private static void sql(Db.Source source,String sql)throws SQLException{
        try(Connection c=source.open();PreparedStatement p=Db.prepare(c,sql)){p.executeUpdate();}
    }
    public static void main(String[] args)throws Exception{
        Db.Source source=Db.localSource();
        try(Connection c=source.open();Statement s=c.createStatement();ResultSet r=s.executeQuery("SELECT VERSION()")){
            r.next();String version=r.getString(1);require(version.equals("8.4.0")||version.startsWith("8.4.0-"));
            require(c.getMetaData().getDriverVersion().contains("8.4.0"));
            System.out.println("MySQL="+version+" driver="+c.getMetaData().getDriverVersion());
        }
        require(scalar(source,"SELECT COUNT(*) FROM transfers")==0);
        TransferService transfers=new TransferService(source);
        require(race(200,i->transfers.transfer("move"+i,i%2==0?1:2,i%2==0?2:1,i%2==0?100:200,"CNY")
                ==TransferService.Outcome.APPLIED)==200);
        require(scalar(source,"SELECT SUM(cents) FROM accounts")==200000);
        require(race(40,i->transfers.transfer("same",1,2,100,"CNY")==TransferService.Outcome.APPLIED)==1);
        require(scalar(source,"SELECT COUNT(*) FROM transfers")==201);
        try{transfers.transfer("same",1,2,200,"CNY");throw new AssertionError();}catch(IllegalArgumentException expected){checks++;}
        try{transfers.transfer("missing",1,999,1,"CNY");throw new AssertionError();}catch(IllegalArgumentException expected){checks++;}
        try{transfers.transfer("funds",2,1,Long.MAX_VALUE,"CNY");throw new AssertionError();}catch(IllegalArgumentException expected){checks++;}
        try{transfers.transfer("currency",1,2,1,"USD");throw new AssertionError();}catch(IllegalArgumentException expected){checks++;}
        require(scalar(source,"SELECT COUNT(*) FROM transfers")==201);
        try{transfers.transfer("same-account",1,1,1,"CNY");throw new AssertionError();}catch(IllegalArgumentException expected){checks++;}
        sql(source,"INSERT INTO accounts VALUES(3,9223372036854775807,'CNY',TRUE),(4,1,'CNY',TRUE)");
        try{transfers.transfer("overflow",4,3,1,"CNY");throw new AssertionError();}catch(ArithmeticException expected){checks++;}
        require(scalar(source,"SELECT cents FROM accounts WHERE id=4")==1);
        require(scalar(source,"SELECT COUNT(*) FROM transfers WHERE request_id='overflow'")==0);
        DocumentCas docs=new DocumentCas(source);
        require(race(80,i->{try{return !docs.save(1,42,7,"edit"+i,"body"+i,false).replayed();}
            catch(DocumentCas.Conflict expected){return false;}})==1);
        require(scalar(source,"SELECT version FROM doc WHERE tenant=1 AND id=42")==8);
        require(race(40,i->!docs.save(1,42,8,"same-edit","next",false).replayed())==1);
        require(docs.save(1,42,8,"same-edit","next",false).committedVersion()==9);
        try{docs.save(1,42,9,"failed-edit","broken",true);throw new AssertionError();}catch(SQLException expected){checks++;}
        require(scalar(source,"SELECT version FROM doc WHERE tenant=1 AND id=42")==9);
        require(scalar(source,"SELECT version FROM doc WHERE tenant=2 AND id=42")==7);
        try{docs.save(1,42,8,"same-edit","different",false);throw new AssertionError();}catch(IllegalArgumentException expected){checks++;}
        try{docs.save(1,999,0,"missing-doc","x",false);throw new AssertionError();}catch(DocumentCas.Conflict expected){checks++;}
        for(int i=0;i<200;i++)require(docs.save(1,42,9+i,"seq"+i,"ordered"+i,false).committedVersion()==10+i);
        require(docs.save(1,42,8,"same-edit","next",false).committedVersion()==9);
        require(scalar(source,"SELECT version FROM doc WHERE tenant=1 AND id=42")==209);
        BucketReservations buckets=new BucketReservations(source);
        require(race(60,i->buckets.reserve(1,List.of(new BucketReservations.Request("r"+i,1)),false))==12);
        require(Arrays.equals(buckets.snapshot(1),new long[]{0,12,12}));
        require(race(40,i->buckets.reserve(2,List.of(new BucketReservations.Request("same-r",3)),false))==40);
        require(Arrays.equals(buckets.snapshot(2),new long[]{9,3,3}));
        try{buckets.reserve(2,List.of(new BucketReservations.Request("bad-r",2)),true);throw new AssertionError();}
        catch(SQLException expected){checks++;}
        require(Arrays.equals(buckets.snapshot(2),new long[]{9,3,3}));
        require(race(80,i->Db.transaction(source,c->{
            long v;try(PreparedStatement p=Db.prepare(c,"SELECT version FROM inventory WHERE tenant_id=1 AND sku_id=1");ResultSet r=p.executeQuery()){
                r.next();v=r.getLong(1);
            }
            return OptimisticStock.tryReserve(c,1,1,1,v);
        }))<=17); // One attempt per operation may conflict before all 17 units are consumed.
        long stock=scalar(source,"SELECT stock FROM inventory WHERE tenant_id=1 AND sku_id=1");
        long v=scalar(source,"SELECT version FROM inventory WHERE tenant_id=1 AND sku_id=1");require(stock>=0 && stock+v==17);
        TaskCas tasks=new TaskCas(source);
        require(race(64,i->tasks.transition(1,1,"start"+i,"NEW",0,"RUNNING",false).equals("APPLIED"))==1);
        require(scalar(source,"SELECT COUNT(*) FROM task_outbox")==1);
        try{tasks.transition(1,1,"finish","RUNNING",1,"SUCCEEDED",true);throw new AssertionError();}
        catch(SQLException expected){checks++;}
        require(scalar(source,"SELECT version FROM task WHERE tenant=1 AND id=1")==1);
        require(tasks.transition(1,1,"finish","RUNNING",1,"SUCCEEDED",false).equals("APPLIED"));
        require(tasks.transition(1,1,"finish","RUNNING",1,"SUCCEEDED",false).equals("APPLIED"));
        require(scalar(source,"SELECT COUNT(*) FROM task_outbox")==2);
        // Twenty independently reset rounds in this dedicated schema, not twenty server instances.
        for(int round=0;round<20;round++){
            sql(source,"UPDATE lock_probe SET n=0");
            DeadlockDemo.Result result=DeadlockDemo.run(source);
            require(result.commits()==1);require(result.deadlocks()==1);require(result.sum()==2);
        }
        System.out.println("PASS "+checks+" actual local MySQL integration checks");
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

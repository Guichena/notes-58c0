import java.sql.Connection;
import java.sql.SQLException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.TimeUnit;

/** Transaction cleanup preserves the original failure. Rollback cannot disprove an unknown commit. */
public final class JdbcSafety {
    private JdbcSafety() { }
    private static void suppress(Throwable primary,Throwable cleanup) {
        if(primary!=cleanup)primary.addSuppressed(cleanup);
    }
    public static void rollbackAfterFailure(Connection c,Throwable primary) {
        try{c.rollback();}catch(SQLException|RuntimeException|Error cleanup){suppress(primary,cleanup);}
    }
    public static void commit(Connection c)throws SQLException {
        try{c.commit();}
        catch(SQLException cause){
            throw new SQLException("COMMIT UNKNOWN; reconcile using the same durable business identity", "08007",cause);
        }
    }
    public static void closePool(ExecutorService pool,Throwable prior)throws InterruptedException {
        try{
            pool.shutdownNow();
            if(!pool.awaitTermination(5,TimeUnit.SECONDS))throw new IllegalStateException("executor did not stop within budget");
        }catch(InterruptedException cleanup){
            Thread.currentThread().interrupt();
            if(prior==null)throw cleanup;
            suppress(prior,cleanup);
        }catch(RuntimeException|Error cleanup){
            if(prior==null)throw cleanup;
            suppress(prior,cleanup);
        }
    }
}

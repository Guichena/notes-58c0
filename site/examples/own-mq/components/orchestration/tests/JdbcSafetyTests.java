import java.lang.reflect.Proxy;
import java.sql.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** Bounded fault doubles only; no real network/database failures are claimed. */
public final class JdbcSafetyTests {
    private static int checks;
    private static void check(boolean b){checks++;if(!b)throw new AssertionError("check "+checks);}
    private static Connection connection(SQLException commitFailure,SQLException rollbackFailure,AtomicBoolean effect){
        return (Connection)Proxy.newProxyInstance(JdbcSafetyTests.class.getClassLoader(),new Class<?>[]{Connection.class},(proxy,method,args)->{
            return switch(method.getName()){
                case "commit"->{effect.set(true);if(commitFailure!=null)throw commitFailure;yield null;}
                case "rollback"->{if(rollbackFailure!=null)throw rollbackFailure;yield null;}
                case "close"->null;
                case "isClosed"->false;
                case "toString"->"bounded Connection fault double";
                default->throw new UnsupportedOperationException(method.getName());
            };
        });
    }
    private static ExecutorService pool(boolean interrupted,boolean terminated){
        return (ExecutorService)Proxy.newProxyInstance(JdbcSafetyTests.class.getClassLoader(),new Class<?>[]{ExecutorService.class},(proxy,method,args)->{
            return switch(method.getName()){
                case "shutdownNow"->java.util.List.of();
                case "awaitTermination"->{if(interrupted)throw new InterruptedException("injected close interruption");yield terminated;}
                case "toString"->"bounded executor fault double";
                default->throw new UnsupportedOperationException(method.getName());
            };
        });
    }
    public static void main(String[] args)throws Exception{
        SQLException original=new SQLException("original"),cleanup=new SQLException("rollback failed");
        try(Connection c=connection(null,cleanup,new AtomicBoolean())){
            JdbcSafety.rollbackAfterFailure(c,original);check(original.getSuppressed().length==1);check(original.getSuppressed()[0]==cleanup);
        }
        SQLException same=new SQLException("same instance");
        try(Connection c=connection(null,same,new AtomicBoolean())){JdbcSafety.rollbackAfterFailure(c,same);check(same.getSuppressed().length==0);}
        AtomicBoolean applied=new AtomicBoolean();SQLException commitFailure=new SQLException("response lost");
        try(Connection c=connection(commitFailure,null,applied)){
            try{JdbcSafety.commit(c);throw new AssertionError("expected commit uncertainty");}
            catch(SQLException unknown){
                check("08007".equals(unknown.getSQLState()));check(unknown.getCause()==commitFailure);
                JdbcSafety.rollbackAfterFailure(c,unknown);check(applied.get());check(unknown.getMessage().contains("UNKNOWN"));
            }
        }
        SQLException failedRollback=new SQLException("cannot rollback");
        try(Connection c=connection(commitFailure,failedRollback,new AtomicBoolean())){
            try{JdbcSafety.commit(c);throw new AssertionError();}catch(SQLException unknown){JdbcSafety.rollbackAfterFailure(c,unknown);check(unknown.getSuppressed()[0]==failedRollback);check(unknown.getCause()==commitFailure);}
        }
        AssertionError testFailure=new AssertionError("primary test failure");
        JdbcSafety.closePool(pool(false,false),testFailure);check(testFailure.getSuppressed().length==1);
        AssertionError interruptedPrimary=new AssertionError("keep me");
        JdbcSafety.closePool(pool(true,false),interruptedPrimary);check(interruptedPrimary.getSuppressed()[0] instanceof InterruptedException);check(Thread.interrupted());
        try{JdbcSafety.closePool(pool(true,false),null);throw new AssertionError();}catch(InterruptedException expected){check(Thread.interrupted());}
        try{JdbcSafety.closePool(pool(false,false),null);throw new AssertionError();}catch(IllegalStateException expected){check(expected.getMessage().contains("budget"));}
        JdbcSafety.closePool(pool(false,true),null);check(!Thread.currentThread().isInterrupted());
        RuntimeException bodyFailure=new RuntimeException("primary executor failure");
        AtomicBoolean destroyed=new AtomicBoolean(),unhooked=new AtomicBoolean();
        CompensationExecutor.cleanup(pool(false,false),()->{destroyed.set(true);throw bodyFailure;},()->unhooked.set(true),bodyFailure);
        check(destroyed.get()&&unhooked.get());check(bodyFailure.getSuppressed().length==1);
        RuntimeException destroyFailure=new RuntimeException("destroy failed");unhooked.set(false);
        try{CompensationExecutor.cleanup(pool(false,true),()->{throw destroyFailure;},()->unhooked.set(true),null);throw new AssertionError();}
        catch(RuntimeException expected){check(expected==destroyFailure&&unhooked.get());}
        AssertionError mainFailure=new AssertionError("main failed");unhooked.set(false);
        CompensationExecutor.cleanup(pool(true,false),()->{},()->unhooked.set(true),mainFailure);
        check(mainFailure.getSuppressed()[0] instanceof InterruptedException);check(Thread.interrupted()&&unhooked.get());
        System.out.println("PASS JdbcSafetyTests: "+checks+" bounded fault-double checks; primary failure/suppression/interrupt preserved, COMMIT uncertainty survives rollback. Not real network fault injection.");
    }
}

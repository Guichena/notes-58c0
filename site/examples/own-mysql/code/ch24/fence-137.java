import java.lang.reflect.Proxy;
import java.sql.*;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

/** Tests only Java validation/transaction orchestration using fake JDBC connections. */
public final class LocalChecks {
    private static int checks;
    private static void check(boolean value) { checks++;if(!value)throw new AssertionError("check "+checks); }
    private static final class FakeSource implements Db.Source {
        int opens,commits,rollbacks,closes;
        boolean failCommit,failRollback;
        @Override public Connection open() {
            opens++;
            return (Connection)Proxy.newProxyInstance(LocalChecks.class.getClassLoader(),new Class<?>[]{Connection.class},
                (proxy,method,args)->{
                    switch(method.getName()){
                        case "setAutoCommit", "setTransactionIsolation": return null;
                        case "commit": commits++;if(failCommit)throw new SQLException("lost acknowledgement","08006",0);return null;
                        case "rollback": rollbacks++;if(failRollback)throw new SQLException("rollback failed");return null;
                        case "close": closes++;return null;
                        case "isClosed": return false;
                        case "toString": return "fake JDBC only";
                        default: throw new UnsupportedOperationException(method.getName());
                    }
                });
        }
    }
    public static void main(String[] args) throws Exception {
        check(Db.duplicate(new SQLException("duplicate","23000",1062)));
        check(!Db.duplicate(new SQLException("foreign key","23000",1452)));
        check(!Db.duplicate(new SQLException("H2 duplicate","23505",23505)));
        check(Db.retryable(new SQLException("deadlock","40001",1213)));
        check(!Db.retryable(new SQLException("transport","08006",0)));
        for(String bad:new String[]{"", "a b", "中文", "x".repeat(101)}) {
            try {Db.key(bad);throw new AssertionError();}catch(IllegalArgumentException expected){checks++;}
        }
        Db.key("valid-01:_A");checks++;
        check(BucketReservations.normalize(List.of(new BucketReservations.Request("a",2),
                new BucketReservations.Request("a",2))).size()==1);
        try {BucketReservations.normalize(List.of(new BucketReservations.Request("a",2),
                new BucketReservations.Request("a",3)));throw new AssertionError();}
        catch(IllegalArgumentException expected){checks++;}
        TaskCas.validate("NEW",0,"RUNNING");checks++;
        for(String bad:new String[]{"NEW", "SUCCEEDED"}){
            try{TaskCas.validate(bad,0,"FAILED");throw new AssertionError();}
            catch(IllegalArgumentException expected){checks++;}
        }
        try{TaskCas.validate("NEW",Long.MAX_VALUE,"RUNNING");throw new AssertionError();}
        catch(IllegalArgumentException expected){checks++;}
        FakeSource success=new FakeSource();check(Db.transaction(success,c->42)==42);
        check(success.opens==1 && success.commits==1 && success.closes==1);
        for(int code:new int[]{1213,1205}){
            FakeSource retry=new FakeSource();AtomicInteger runs=new AtomicInteger();
            check(Db.transaction(retry,c->{if(runs.incrementAndGet()==1)throw new SQLException("retry","40001",code);return 7;})==7);
            check(retry.opens==2 && retry.rollbacks==1 && retry.commits==1 && retry.closes==2);
        }
        FakeSource unknown=new FakeSource();unknown.failCommit=true;
        try{Db.transaction(unknown,c->1);throw new AssertionError();}catch(Db.UnknownCommit expected){checks++;}
        check(unknown.opens==1 && unknown.commits==1 && unknown.closes==1);
        FakeSource broken=new FakeSource();broken.failRollback=true;
        try{Db.transaction(broken,c->{throw new SQLException("deadlock","40001",1213);});throw new AssertionError();}
        catch(SQLException expected){check(expected.getSuppressed().length==1);}
        check(broken.opens==1 && broken.closes==1);
        FakeSource ordinary=new FakeSource();
        try{Db.transaction(ordinary,c->{throw new SQLException("syntax","42000",1064);});throw new AssertionError();}
        catch(SQLException expected){checks++;}
        check(ordinary.opens==1 && ordinary.rollbacks==1);
        System.out.println("PASS "+checks+" Java-only checks; fake JDBC does not establish MySQL behavior");
    }
}

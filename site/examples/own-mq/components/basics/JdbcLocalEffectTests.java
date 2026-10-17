import javax.sql.DataSource;
import java.lang.reflect.Proxy;
import java.sql.*;

/** Fault doubles only: verifies control flow, not MySQL isolation or driver behavior. */
public final class JdbcLocalEffectTests {
    static int checks;
    static void check(boolean b){checks++;if(!b)throw new AssertionError();}
    static final class Fixture {
        SQLException insertFailure,commitFailure,rollbackFailure,closeFailure;
        boolean committed,closed; int rollbacks;
        DataSource source(){return proxy(DataSource.class,(method,args)-> {
            if(method.equals("getConnection"))return connection();throw new UnsupportedOperationException(method);
        });}
        Connection connection(){return proxy(Connection.class,(method,args)->switch(method){
            case "setAutoCommit"->null;
            case "prepareStatement"->statement((String)args[0]);
            case "commit"->{committed=true;if(commitFailure!=null)throw commitFailure;yield null;}
            case "rollback"->{rollbacks++;if(rollbackFailure!=null)throw rollbackFailure;yield null;}
            case "close"->{closed=true;if(closeFailure!=null)throw closeFailure;yield null;}
            default->throw new UnsupportedOperationException(method);
        });}
        PreparedStatement statement(String sql){return proxy(PreparedStatement.class,(method,args)->{
            if(method.startsWith("set")||method.equals("close"))return null;
            if(method.equals("executeUpdate")){if(sql.startsWith("INSERT INTO effect_inbox")&&insertFailure!=null)throw insertFailure;return 1;}
            if(method.equals("executeQuery")){boolean receipt=sql.startsWith("SELECT account_id");boolean[] first={true};
                return proxy(ResultSet.class,(m,a)->switch(m){
                    case "next"->{boolean x=first[0];first[0]=false;yield x;}
                    case "getLong"->receipt?switch((int)a[0]){case 1->1L;case 2->100L;default->900L;}:900L;
                    case "getString"->"CNY";case "wasNull"->false;case "close"->null;
                    default->throw new UnsupportedOperationException(m);
                });}
            throw new UnsupportedOperationException(method);
        });}
    }
    @FunctionalInterface interface Call {Object run(String name,Object[] args)throws Throwable;}
    static <T>T proxy(Class<T> type,Call call){return type.cast(Proxy.newProxyInstance(type.getClassLoader(),new Class<?>[]{type},(p,m,a)->call.run(m.getName(),a)));}
    static JdbcLocalEffect.Result apply(Fixture f)throws Exception{return JdbcLocalEffect.applyDebit(f.source(),1,"sub","event",1,100,"CNY");}
    static void inboxIdentityContract() {
        for (String id : new String[]{"a", "A", "event-1._:ok", "x".repeat(80)}) {
            check(new JdbcInbox.Event(id, id, 1, 1).id().equals(id));
        }
        for (String invalid : new String[]{null, "", " ", "event ", " event", "e\t1",
                "x".repeat(81), "事件", "\uD800"}) {
            try {
                new JdbcInbox.Event("consumer", invalid, 1, 1);
                throw new AssertionError("invalid event ID accepted");
            } catch (IllegalArgumentException expected) {
                check(true);
            }
            try {
                new JdbcInbox.Event(invalid, "event", 1, 1);
                throw new AssertionError("invalid subscriber accepted");
            } catch (IllegalArgumentException expected) {
                check(true);
            }
        }
        check(!new JdbcInbox.Event("sub", "a", 1, 1).equals(
                new JdbcInbox.Event("sub", "A", 1, 1)));
    }

    public static void main(String[] args)throws Exception {
        inboxIdentityContract();
        Fixture f=new Fixture();check(apply(f).equals(new JdbcLocalEffect.Result(JdbcLocalEffect.Kind.APPLIED,900)));check(f.committed&&f.closed);
        f=new Fixture();f.insertFailure=new SQLException("duplicate","23000",1062);check(apply(f).kind()==JdbcLocalEffect.Kind.REPLAYED);check(!f.committed&&f.rollbacks==2);
        f=new Fixture();f.insertFailure=new SQLException("disk","HY000",1);SQLException first=f.insertFailure;f.rollbackFailure=first;f.closeFailure=first;
        try{apply(f);throw new AssertionError();}catch(SQLException e){check(e==first&&e.getSuppressed().length==0);}
        f=new Fixture();f.commitFailure=new SQLException("commit reply lost");f.rollbackFailure=new SQLException("rollback failed");f.closeFailure=new SQLException("close failed");
        try{apply(f);throw new AssertionError();}catch(JdbcLocalEffect.CommitUnknown e){check(f.committed&&f.closed&&e.getCause()==f.commitFailure);check(e.getSuppressed().length==2);}
        f=new Fixture();f.insertFailure=new SQLException("duplicate","23000",1062);f.rollbackFailure=new SQLException("rollback failed");
        try{apply(f);throw new AssertionError();}catch(SQLException e){check(e==f.insertFailure&&e.getSuppressed().length>=1&&!f.committed);}
        System.out.println("JdbcLocalEffectTests OK: "+checks+"; fault doubles only, no MySQL");
    }
}

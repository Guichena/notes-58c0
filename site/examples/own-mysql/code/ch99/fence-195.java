import java.lang.reflect.Proxy;
import java.sql.*;
import java.util.*;

/** Fault-injected JDBC interface model, not an InnoDB or Connector/J execution. */
public final class JdbcBoundaryTest {
    private static Object empty(Class<?> type) {
        if(type==boolean.class)return false;
        if(type==int.class)return 0;
        if(type==long.class)return 0L;
        return null;
    }
    private static ResultSet rows(long... values) {
        int[] i={-1};
        return (ResultSet)Proxy.newProxyInstance(JdbcBoundaryTest.class.getClassLoader(),new Class<?>[]{ResultSet.class},(p,m,a)->switch(m.getName()) {
            case "next" -> ++i[0]<values.length;
            case "getLong" -> values[i[0]];
            default -> empty(m.getReturnType());
        });
    }
    private static final class Faults {
        final List<String> calls=new ArrayList<>();
        boolean rollbackFails, commitUnknown, resetFails, closeFails;
        SQLException commitError=new SQLException("commit UNKNOWN","08007");
        SQLException rollbackError=new SQLException("rollback failed","08006");
        SQLException resetError=new SQLException("reset failed","08006");
        SQLException closeError=new SQLException("close failed");
        Connection connection() {
            return (Connection)Proxy.newProxyInstance(JdbcBoundaryTest.class.getClassLoader(),new Class<?>[]{Connection.class},(p,m,a)->{
                switch(m.getName()) {
                    case "getAutoCommit":return true;
                    case "setAutoCommit":
                        calls.add("auto="+a[0]);
                        if((Boolean)a[0]&&resetFails)throw resetError;
                        return null;
                    case "commit":
                        calls.add("commit");
                        if(commitUnknown)throw commitError;
                        return null;
                    case "rollback":
                        calls.add("rollback");
                        if(rollbackFails)throw rollbackError;
                        return null;
                    case "close":calls.add("close");if(closeFails)throw closeError;return null;
                    case "prepareStatement":
                        String sql=(String)a[0];
                        return Proxy.newProxyInstance(JdbcBoundaryTest.class.getClassLoader(),new Class<?>[]{PreparedStatement.class},(p2,m2,a2)->{
                            if(m2.getName().equals("executeQuery"))return sql.contains("entry_id")?rows(11,12):rows(1);
                            if(m2.getName().equals("executeUpdate"))return 1;
                            if(m2.getName().equals("executeBatch"))return new int[]{1,1};
                            return empty(m2.getReturnType());
                        });
                    default:return empty(m.getReturnType());
                }
            });
        }
    }
    @FunctionalInterface private interface SqlAction { void run() throws Exception; }
    private static void expectSame(SQLException wanted,SqlAction action) throws Exception {
        try {action.run();throw new AssertionError("missing failure");}
        catch(SQLException actual) {if(actual!=wanted)throw new AssertionError("original exception lost",actual);}
    }
    /** Deliberately narrow JDBC surface model, not a database or a transaction simulator. */
    private static final class AliasDriver implements Driver {
        final SQLException shared=new SQLException("shared COMMIT UNKNOWN","08007");
        int commits,rollbacks,closes;
        boolean closeAliases,closeDifferent;
        boolean commitFails=true;
        final SQLException closeError=new SQLException("distinct connection close failure","08006");
        public boolean acceptsURL(String url) {return url!=null&&url.startsWith("jdbc:boundary-test:");}
        public Connection connect(String url,Properties properties) {
            if(!acceptsURL(url))return null;
            return (Connection)Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{Connection.class},(p,m,args)->{
                switch(m.getName()) {
                    case "commit":commits++;if(commitFails)throw shared;return null;
                    case "rollback":rollbacks++;throw shared;
                    case "close":closes++;if(closeAliases)throw shared;if(closeDifferent)throw closeError;return null;
                    case "prepareStatement":
                        String sql=(String)args[0];
                        return Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{PreparedStatement.class},(p2,m2,a2)->{
                            if(m2.getName().equals("executeUpdate"))return 1;
                            if(m2.getName().equals("executeQuery")) {
                                if(sql.startsWith("SELECT version"))return rows(0);
                                if(sql.startsWith("SELECT id FROM board_task"))return rows(1,2);
                                if(sql.startsWith("SELECT state")||sql.startsWith("SELECT MAX")) {
                                    boolean[] first={true};
                                    return Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{ResultSet.class},(p3,m3,a3)->switch(m3.getName()) {
                                        case "next" -> {boolean value=first[0];first[0]=false;yield value;}
                                        case "getString" -> (Integer)a3[0]==1?"OPEN":null;
                                        case "getObject" -> null;
                                        case "getLong" -> 1L;
                                        default -> empty(m3.getReturnType());
                                    });
                                }
                                return rows();
                            }
                            return empty(m2.getReturnType());
                        });
                    default:return empty(m.getReturnType());
                }
            });
        }
        public DriverPropertyInfo[] getPropertyInfo(String url,Properties properties) {return new DriverPropertyInfo[0];}
        public int getMajorVersion() {return 1;}
        public int getMinorVersion() {return 0;}
        public boolean jdbcCompliant() {return false;}
        public java.util.logging.Logger getParentLogger() {return java.util.logging.Logger.getGlobal();}
    }
    private static void transactionCall(int operation) throws Exception {
        switch(operation) {
            case 0 -> StreamLedger.append("jdbc:boundary-test:stream",1,1,1,0,"中😀",false);
            case 1 -> StreamLedger.end("jdbc:boundary-test:stream",1,1,1,0);
            case 2 -> TaskBoard.reorder("jdbc:boundary-test:task",1,1,0,List.of(2L,1L),false);
            case 3 -> TaskBoard.depend("jdbc:boundary-test:task",1,1,0,1,2,false);
            default -> throw new AssertionError(operation);
        }
    }
    private static void aliases() throws Exception {
        Faults pr=new Faults();pr.commitUnknown=true;pr.resetFails=true;pr.resetError=pr.commitError;
        expectSame(pr.commitError,()->PlaylistOrder.reorder(pr.connection(),1,0,0,List.of(12L,11L),false));
        if(pr.commitError.getSuppressed().length!=0||!pr.calls.contains("close"))throw new AssertionError(pr.calls);
        Faults rc=new Faults();rc.resetFails=true;rc.closeFails=true;rc.closeError=rc.resetError;
        expectSame(rc.resetError,()->PlaylistOrder.reorder(rc.connection(),1,0,0,List.of(12L,11L),false));
        if(rc.resetError.getSuppressed().length!=0||!rc.calls.contains("close"))throw new AssertionError(rc.calls);
        Faults pb=new Faults();pb.commitUnknown=true;pb.rollbackFails=true;pb.rollbackError=pb.commitError;
        expectSame(pb.commitError,()->PlaylistOrder.reorder(pb.connection(),1,0,0,List.of(12L,11L),false));
        if(pb.commitError.getSuppressed().length!=0||pb.calls.contains("auto=true")||!pb.calls.contains("close"))throw new AssertionError(pb.calls);
        Faults pc=new Faults();pc.commitUnknown=true;pc.rollbackFails=true;pc.closeFails=true;pc.closeError=pc.commitError;
        expectSame(pc.commitError,()->PlaylistOrder.reorder(pc.connection(),1,0,0,List.of(12L,11L),false));
        if(pc.commitError.getSuppressed().length!=1||pc.commitError.getSuppressed()[0]!=pc.rollbackError||pc.calls.contains("auto=true"))throw new AssertionError(pc.calls);
        System.out.println("PASS Playlist primary/reset, reset/close, primary/rollback and primary/close aliases");
        AliasDriver d=new AliasDriver();DriverManager.registerDriver(d);
        try {
            expectSame(d.shared,()->StreamLedger.append("jdbc:boundary-test:stream",1,1,1,0,"中😀",false));
            expectSame(d.shared,()->StreamLedger.end("jdbc:boundary-test:stream",1,1,1,0));
            expectSame(d.shared,()->TaskBoard.reorder("jdbc:boundary-test:task",1,1,0,List.of(2L,1L),false));
            expectSame(d.shared,()->TaskBoard.depend("jdbc:boundary-test:task",1,1,0,1,2,false));
            if(d.commits!=4||d.rollbacks!=4||d.closes!=4||d.shared.getSuppressed().length!=0)throw new AssertionError("driver fault path");
        } finally {DriverManager.deregisterDriver(d);}
        System.out.println("PASS both StreamLedger and both TaskBoard mutation paths preserve rollback aliases");
        AliasDriver closing=new AliasDriver();closing.closeAliases=true;DriverManager.registerDriver(closing);
        try {
            expectSame(closing.shared,()->StreamLedger.append("jdbc:boundary-test:stream",1,1,1,0,"中😀",false));
            expectSame(closing.shared,()->StreamLedger.end("jdbc:boundary-test:stream",1,1,1,0));
            expectSame(closing.shared,()->TaskBoard.reorder("jdbc:boundary-test:task",1,1,0,List.of(2L,1L),false));
            expectSame(closing.shared,()->TaskBoard.depend("jdbc:boundary-test:task",1,1,0,1,2,false));
            if(closing.commits!=4||closing.rollbacks!=4||closing.closes!=4||closing.shared.getSuppressed().length!=0)throw new AssertionError("connection-close alias path");
        } finally {DriverManager.deregisterDriver(closing);}
        System.out.println("PASS all four self-owned transaction connections preserve commit/rollback/close aliases");
        for(int op=0;op<4;op++) {
            final int operation=op;
            AliasDriver distinct=new AliasDriver();distinct.closeDifferent=true;DriverManager.registerDriver(distinct);
            try {
                expectSame(distinct.shared,()->transactionCall(operation));
                if(distinct.commits!=1||distinct.rollbacks!=1||distinct.closes!=1||distinct.shared.getSuppressed().length!=1||distinct.shared.getSuppressed()[0]!=distinct.closeError)throw new AssertionError("distinct close must be suppressed");
            } finally {DriverManager.deregisterDriver(distinct);}
            AliasDriver committed=new AliasDriver();committed.commitFails=false;committed.closeDifferent=true;DriverManager.registerDriver(committed);
            try {
                expectSame(committed.closeError,()->transactionCall(operation));
                if(committed.commits!=1||committed.rollbacks!=0||committed.closes!=1)throw new AssertionError("known committed cleanup path");
            } finally {DriverManager.deregisterDriver(committed);}
        }
        System.out.println("PASS four UNKNOWN+distinct-close and four known-commit+close-failure controls");
        SQLException shared=new SQLException("shared prepare/close failure");
        Connection report=(Connection)Proxy.newProxyInstance(JdbcBoundaryTest.class.getClassLoader(),new Class<?>[]{Connection.class},(p,m,args)->{
            if(m.getName().equals("prepareStatement"))return Proxy.newProxyInstance(JdbcBoundaryTest.class.getClassLoader(),new Class<?>[]{PreparedStatement.class},(p2,m2,a2)->{
                if(m2.getName().equals("setLong")||m2.getName().equals("close"))throw shared;
                return empty(m2.getReturnType());
            });
            return empty(m.getReturnType());
        });
        expectSame(shared,()->ReportAggregate.javaAggregate(report,1,0,10,7));
        expectSame(shared,()->ReportAggregate.databaseAggregate(report,1,0,10,7));
        if(shared.getSuppressed().length!=0)throw new AssertionError("report self-suppression");
        System.out.println("PASS both ReportAggregate entry points preserve preparation/close alias");
    }
    public static void main(String[] args) throws Exception {
        Faults rollback=new Faults();rollback.rollbackFails=true;
        try {PlaylistOrder.reorder(rollback.connection(),1,0,0,List.of(12L,11L),true);throw new AssertionError();}
        catch(SQLException e){if(!rollback.calls.contains("close")||rollback.calls.contains("auto=true")||e.getSuppressed().length!=1)throw new AssertionError(rollback.calls);}
        System.out.println("PASS rollback failure closes and never enables autoCommit: "+rollback.calls);
        Faults unknown=new Faults();unknown.commitUnknown=true;
        try {PlaylistOrder.reorder(unknown.connection(),1,0,0,List.of(12L,11L),false);throw new AssertionError();}
        catch(SQLException e){if(!e.getMessage().equals("commit UNKNOWN"))throw new AssertionError(e);}
        System.out.println("PASS unknown commit normally propagates: "+unknown.calls);
        Faults masked=new Faults();masked.commitUnknown=true;masked.resetFails=true;
        try {PlaylistOrder.reorder(masked.connection(),1,0,0,List.of(12L,11L),false);throw new AssertionError();}
        catch(SQLException e){
            if(!e.getMessage().equals("commit UNKNOWN")||e.getSuppressed().length!=1||!masked.calls.contains("close"))throw new AssertionError(e);
            System.out.println("PASS COMMIT UNKNOWN preserved and reset failure suppressed: "+masked.calls);
        }
        Faults cleanup=new Faults();cleanup.resetFails=true;cleanup.closeFails=true;
        try {PlaylistOrder.reorder(cleanup.connection(),1,0,0,List.of(12L,11L),false);throw new AssertionError();}
        catch(SQLException e){if(!e.getMessage().equals("reset failed")||e.getSuppressed().length!=1||!cleanup.calls.contains("commit")||!cleanup.calls.contains("close"))throw new AssertionError(e);}
        System.out.println("PASS successful commit with cleanup failure closes and preserves cleanup details");
        Faults business=new Faults();business.resetFails=true;
        try {PlaylistOrder.reorder(business.connection(),1,0,0,List.of(12L,11L),true);throw new AssertionError();}
        catch(SQLException e){if(!e.getMessage().equals("injected rollback test")||e.getSuppressed().length!=1||!business.calls.contains("close"))throw new AssertionError(e);}
        System.out.println("PASS business failure preserved after reset failure");
        aliases();
        System.out.println("JDBC interface fault model only; no MySQL or Connector/J integration executed");
    }
}

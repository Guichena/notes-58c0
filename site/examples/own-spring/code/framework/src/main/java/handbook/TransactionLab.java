package handbook;
import java.util.*;
import javax.sql.DataSource;
import org.h2.jdbcx.JdbcDataSource;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.*;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.*;

public class TransactionLab {
    @Configuration(proxyBeanMethods=false) @EnableTransactionManagement(proxyTargetClass=true)
    static class Config {
        @Bean DataSource dataSource(){var d=new JdbcDataSource();d.setURL("jdbc:h2:mem:tx_lab;DB_CLOSE_DELAY=-1");return d;}
        @Bean JdbcTemplate jdbc(DataSource d){return new JdbcTemplate(d);}
        @Bean PlatformTransactionManager transactionManager(DataSource d){return new DataSourceTransactionManager(d);}
        @Bean Inner inner(JdbcTemplate j){return new Inner(j);}
        @Bean Outer outer(JdbcTemplate j,Inner i){return new Outer(j,i);}
    }
    public static class Inner {
        final JdbcTemplate j;
        Inner(JdbcTemplate j){this.j=j;}
        @Transactional public void fail(){put("inner");throw new IllegalStateException("fail");}
        public void self(){this.fail();}
        @Transactional public void checked() throws Exception{put("checked");throw new Exception("checked");}
        @Transactional(rollbackFor=Exception.class) public void checkedRollback() throws Exception{put("checked");throw new Exception("checked");}
        @Transactional(propagation=Propagation.REQUIRES_NEW) public void independent(){put("independent");}
        @Transactional(propagation=Propagation.NESTED) public void nested(){put("nested");throw new IllegalStateException("savepoint");}
        @Transactional(propagation=Propagation.MANDATORY) public void mandatory(){put("mandatory");}
        @Transactional(propagation=Propagation.NEVER) public void never(){put("never");}
        @Transactional public void cancel(){put("cancel");throw new java.util.concurrent.CancellationException();}
        @Transactional public void swallowed(){put("swallowed");try{throw new IllegalStateException();}catch(IllegalStateException expected){}}
        void put(String value){j.update("insert into events(name) values (?)",value);}
    }
    public static class Outer {
        final JdbcTemplate j;final Inner i;
        Outer(JdbcTemplate j,Inner i){this.j=j;this.i=i;}
        @Transactional public void caught(){i.put("outer");try{i.fail();}catch(IllegalStateException expected){}}
        @Transactional public void independentThenFail(){i.put("outer");i.independent();throw new IllegalStateException();}
        @Transactional public void nestedCaught(){i.put("outer");try{i.nested();}catch(IllegalStateException expected){}}
        @Transactional public void neverInside(){i.never();}
    }
    interface Work{void run()throws Exception;}
    static void throwsType(Class<? extends Throwable> t,Work w){try{w.run();}catch(Throwable e){if(t.isInstance(e))return;throw new AssertionError(e);}throw new AssertionError("missing error");}
    static void rows(JdbcTemplate j,String... wanted){var got=j.queryForList("select name from events order by name",String.class);if(!got.equals(List.of(wanted)))throw new AssertionError(got);j.update("delete from events");}
    public static void main(String[] args){
        try(var c=new AnnotationConfigApplicationContext(Config.class)){
            var j=c.getBean(JdbcTemplate.class);j.execute("create table events(name varchar(40) primary key)");
            var i=c.getBean(Inner.class);var o=c.getBean(Outer.class);
            throwsType(IllegalStateException.class,i::fail);rows(j);
            throwsType(IllegalStateException.class,i::self);rows(j,"inner");
            throwsType(Exception.class,i::checked);rows(j,"checked");
            throwsType(Exception.class,i::checkedRollback);rows(j);
            throwsType(UnexpectedRollbackException.class,o::caught);rows(j);
            throwsType(IllegalStateException.class,o::independentThenFail);rows(j,"independent");
            o.nestedCaught();rows(j,"outer");
            throwsType(IllegalTransactionStateException.class,i::mandatory);rows(j);
            throwsType(IllegalTransactionStateException.class,o::neverInside);rows(j);
            throwsType(java.util.concurrent.CancellationException.class,i::cancel);rows(j);
            i.swallowed();rows(j,"swallowed");
            var tx=new TransactionTemplate(c.getBean(PlatformTransactionManager.class));
            tx.executeWithoutResult(s->i.put("template"));rows(j,"template");
            tx.executeWithoutResult(s->{i.put("rollback");s.setRollbackOnly();});rows(j);
            List<String> callbacks=new ArrayList<>();
            tx.executeWithoutResult(s->{i.put("committed");TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){
                public void afterCommit(){callbacks.add("committed");}
                public void afterCompletion(int status){callbacks.add("completion:"+status);}
            });});rows(j,"committed");
            if(!callbacks.equals(List.of("committed","completion:0")))throw new AssertionError(callbacks);
            throwsType(IllegalStateException.class,()->tx.executeWithoutResult(s->{
                i.put("after_commit_failure");
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){
                    public void afterCommit(){throw new IllegalStateException("notification failed");}
                });
            }));rows(j,"after_commit_failure");
            System.out.println("PASS 15 real Spring/JDBC/H2 transaction scenarios");
        }
    }
}

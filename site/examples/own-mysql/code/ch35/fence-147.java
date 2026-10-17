import java.sql.Connection;
import java.util.*;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.atomic.AtomicInteger;
import javax.sql.DataSource;
import org.apache.ibatis.annotations.*;
import org.apache.ibatis.datasource.unpooled.UnpooledDataSource;
import org.apache.ibatis.executor.statement.StatementHandler;
import org.apache.ibatis.mapping.*;
import org.apache.ibatis.plugin.*;
import org.apache.ibatis.session.*;
import org.apache.ibatis.transaction.jdbc.JdbcTransactionFactory;

public final class MyBatisLab {
    private MyBatisLab() {}
    public interface BindingMapper {
        @Select("SELECT id FROM binding_users WHERE tenant_id=#{tenant} AND username=#{name} ORDER BY id")
        List<Long> find(@Param("tenant") long tenant, @Param("name") String name);
        // Deliberately incomplete: no MyBatis property mapping for the raw '?'.
        @Select("SELECT id FROM binding_users WHERE username=?")
        List<Long> rawQuestionMark(@Param("name") String name);
        @Select("<script>SELECT id FROM binding_users WHERE tenant_id=#{tenant} AND id IN "
              + "<foreach collection='ids' item='item' open='(' separator=',' close=')'>"
              + "#{item}</foreach> ORDER BY id</script>")
        List<Long> byIds(@Param("tenant") long tenant, @Param("ids") List<Long> ids);
    }
    @CacheNamespace(size=64)
    public interface Cached {
        @Select("SELECT name FROM cache_person WHERE tenant=#{tenant} AND id=#{id}")
        String name(@Param("tenant") long tenant, @Param("id") long id);
        @Select("SELECT name FROM cache_person WHERE tenant=#{tenant} AND id=#{id}")
        @Options(useCache=false)
        String localOnly(@Param("tenant") long tenant, @Param("id") long id);
        @Select("SELECT id FROM cache_person WHERE tenant=#{tenant} AND name=#{name}")
        Long byName(@Param("tenant") long tenant, @Param("name") String name);
        @Update("UPDATE cache_person SET name=#{name} WHERE tenant=#{tenant} AND id=#{id}")
        int rename(@Param("tenant") long tenant, @Param("id") long id, @Param("name") String name);
    }
    public interface OtherNamespace {
        @Update("UPDATE cache_person SET name=#{name} WHERE tenant=#{tenant} AND id=#{id}")
        int rename(@Param("tenant") long tenant, @Param("id") long id, @Param("name") String name);
    }
    public record Entry(String sql, List<String> properties) {}
    @Intercepts(@Signature(type=StatementHandler.class, method="prepare",
            args={Connection.class,Integer.class}))
    public static final class SqlCapture implements Interceptor {
        private final ArrayBlockingQueue<Entry> entries = new ArrayBlockingQueue<>(64);
        private final AtomicInteger prepares = new AtomicInteger();
        @Override public Object intercept(Invocation invocation) throws Throwable {
            StatementHandler handler = (StatementHandler) invocation.getTarget();
            BoundSql b = handler.getBoundSql();
            List<String> names = new ArrayList<>();
            for (ParameterMapping p : b.getParameterMappings()) names.add(p.getProperty());
            prepares.incrementAndGet();
            entries.offer(new Entry(b.getSql(), List.copyOf(names))); // Full queue drops diagnostics only.
            return invocation.proceed(); // Preserve execution and exception behavior.
        }
        public List<Entry> snapshot() { return List.copyOf(entries); }
        public int prepares() { return prepares.get(); }
    }
    public record Setup(SqlSessionFactory factory, SqlCapture capture) {}
    public static Setup factory(DataSource source, boolean secondLevel, LocalCacheScope scope) {
        Configuration c = new Configuration(new Environment("teaching",
                new JdbcTransactionFactory(), Objects.requireNonNull(source)));
        c.setCacheEnabled(secondLevel); c.setLocalCacheScope(scope);
        c.setDefaultStatementTimeout(2);
        c.addMapper(BindingMapper.class); c.addMapper(Cached.class); c.addMapper(OtherNamespace.class);
        SqlCapture capture = new SqlCapture(); c.addInterceptor(capture);
        return new Setup(new SqlSessionFactoryBuilder().build(c), capture);
    }
    private static void check(boolean ok) { if (!ok) throw new AssertionError(); }
    public static void main(String[] args) {
        // Building BoundSql does not call getConnection; this URL is never used.
        DataSource unused = new UnpooledDataSource("com.mysql.cj.jdbc.Driver",
                "jdbc:mysql://127.0.0.1:3306/unused", "unused", "unused");
        Setup setup = factory(unused, true, LocalCacheScope.SESSION);
        Configuration c = setup.factory().getConfiguration();
        String prefix = BindingMapper.class.getName() + ".";
        BoundSql good = c.getMappedStatement(prefix + "find")
                .getBoundSql(Map.of("tenant",1L,"name","O'Neil"));
        check(good.getParameterMappings().size() == 2);
        check(!good.getSql().contains("O'Neil"));
        BoundSql raw = c.getMappedStatement(prefix + "rawQuestionMark")
                .getBoundSql(Map.of("name","O'Neil"));
        check(raw.getParameterMappings().isEmpty());
        BoundSql loop = c.getMappedStatement(prefix + "byIds")
                .getBoundSql(Map.of("tenant",1L,"ids",List.of(1L,2L)));
        check(loop.getParameterMappings().size() == 3);
        for (int i=1;i<3;i++)
            check(loop.hasAdditionalParameter(loop.getParameterMappings().get(i).getProperty()));
        check(setup.capture().prepares()==0);
        System.out.println("PASS BoundSql mapping inspection; no connection or cache integration");
    }
}

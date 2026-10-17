package handbook;
import java.beans.*;
import java.lang.reflect.*;
import java.sql.*;
import java.util.*;
import org.h2.jdbcx.JdbcDataSource;
import org.apache.ibatis.annotations.*;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.session.*;
import org.apache.ibatis.transaction.jdbc.JdbcTransactionFactory;

public class MappingLab {
    public static class User {
        private Long id;private String userName;private Integer age;
        public User(){}
        public Long getId(){return id;}public void setId(Long x){id=x;}
        public String getUserName(){return userName;}public void setUserName(String x){userName=x;}
        public Integer getAge(){return age;}public void setAge(Integer x){age=x;}
    }
    public interface Mapper {
        @Select("select id,user_name,age from users where id=#{id}")
        @Results(@Result(column="user_name",property="userName"))
        User find(@Param("id")long id);
    }
    public static <T>T map(ResultSet rs,Class<T> type,Map<String,String> columns)throws Exception{
        Map<String,Method> setters=new HashMap<>();
        for(var p:Introspector.getBeanInfo(type).getPropertyDescriptors())if(p.getWriteMethod()!=null)setters.put(p.getName(),p.getWriteMethod());
        T bean=type.getConstructor().newInstance();var metadata=rs.getMetaData();
        for(int n=1;n<=metadata.getColumnCount();n++){
            String label=metadata.getColumnLabel(n).toLowerCase(Locale.ROOT),property=columns.get(label);
            if(property==null)throw new IllegalArgumentException("unmapped column: "+label);
            Method setter=setters.get(property);if(setter==null)throw new IllegalArgumentException("missing setter: "+property);
            Class<?> target=setter.getParameterTypes()[0];if(target.isPrimitive())throw new IllegalArgumentException("boxed types required");
            try{setter.invoke(bean,rs.getObject(n,target));}catch(InvocationTargetException e){throw new IllegalStateException("setter failed",e.getCause());}
        }
        return bean;
    }
    static void check(User u){if(u==null||!Long.valueOf(7).equals(u.getId())||!"Ada".equals(u.getUserName())||u.getAge()!=null)throw new AssertionError();}
    public static void main(String[] args)throws Exception{
        var d=new JdbcDataSource();d.setURL("jdbc:h2:mem:mapping_lab;DB_CLOSE_DELAY=-1");
        try(var c=d.getConnection();var s=c.createStatement()){s.execute("create table users(id bigint primary key,user_name varchar(40),age integer)");s.execute("insert into users values(7,'Ada',null)");}
        var cfg=new Configuration(new Environment("lab",new JdbcTransactionFactory(),d));cfg.addMapper(Mapper.class);
        var factory=new SqlSessionFactoryBuilder().build(cfg);
        try(var session=factory.openSession()){
            var mapper=session.getMapper(Mapper.class);User first=mapper.find(7);check(first);
            if(first!=mapper.find(7))throw new AssertionError("SESSION cache should reuse object");
            session.clearCache();if(first==mapper.find(7))throw new AssertionError("cache clear");
            if(mapper.find(8)!=null)throw new AssertionError();
        }
        try(var c=d.getConnection();var s=c.createStatement();var rs=s.executeQuery("select id,user_name,age from users")){
            rs.next();check(map(rs,User.class,Map.of("id","id","user_name","userName","age","age")));
            try{map(rs,User.class,Map.of());throw new AssertionError();}catch(IllegalArgumentException expected){}
            try{map(rs,User.class,Map.of("id","absent","user_name","userName","age","age"));throw new AssertionError();}catch(IllegalArgumentException expected){}
        }
        System.out.println("PASS 7 MyBatis/reflection mapping and local-cache scenarios");
    }
}

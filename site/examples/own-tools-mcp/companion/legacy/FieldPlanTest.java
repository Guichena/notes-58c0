import java.sql.*;
import java.util.*;

/** Real H2 JDBC binding/tenant isolation demonstration. It does not prove a MySQL dialect or row-level policy. */
public final class FieldPlanTest {
    private static void check(boolean x){if(!x)throw new AssertionError();}
    private static void bad(String s){try{FieldPlan.parse(s,1,10);throw new AssertionError(s);}catch(IllegalArgumentException expected){}}
    private static List<Long> query(Connection c,String filter,long tenant)throws SQLException{
        FieldPlan.Query q=FieldPlan.parse(filter,tenant,10);
        try(PreparedStatement p=c.prepareStatement(q.sql())){
            int n=1;for(Object value:q.parameters())p.setObject(n++,value);
            p.setQueryTimeout(1);p.setMaxRows(10);List<Long> ids=new ArrayList<>();
            try(ResultSet r=p.executeQuery()){while(r.next())ids.add(r.getLong(1));}return ids;
        }
    }
    public static void main(String[] args)throws Exception{
        try(Connection c=DriverManager.getConnection("jdbc:h2:mem:fieldplan")){
            try(Statement s=c.createStatement()){
                s.execute("CREATE TABLE book(id BIGINT PRIMARY KEY,tenant_id BIGINT, title VARCHAR, category VARCHAR, author_name VARCHAR,published_year INT)");
                s.execute("INSERT INTO book VALUES(1,1,'A','计算机','张三',2024),(2,2,'Private','计算机','张三',2024),(3,1,'B','历史','李四',2020)");
            }
            check(query(c,"类别=计算机;年份=2024;姓名=张三",1).equals(List.of(1L)));
            check(query(c,"姓名=张三;年份=2024;类别=计算机",1).equals(List.of(1L)));
            check(query(c,"类别=计算机",2).equals(List.of(2L)));
            check(query(c,"姓名=' OR 1=1 --",1).isEmpty());
            for(String text:List.of("", "分类=计算机","年份=２０２４","年份=024","年份=0999","年份=20a4","年份=2024;年份=2025","类别=x;","类别=x\ny","tenant_id=2","类别="+"x".repeat(81),"查找张三最近的书"))bad(text);
            Random rng=new Random(17);for(int i=0;i<500;i++){
                String value="x' ? \\ OR "+rng.nextInt()+"=1 --";FieldPlan.Query q=FieldPlan.parse("姓名="+value,1,10);
                check(!q.sql().contains(value));check(q.parameters().get(1).equals(value));check(query(c,"姓名="+value,1).isEmpty());
            }
        }
        System.out.println("PASS FieldPlan: full grammar, JDBC placeholders, tenant isolation, malformed/duplicate clauses, 500 hostile bound values, bounded result and cleanup");
    }
}

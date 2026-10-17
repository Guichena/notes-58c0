import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Map;
import java.util.TreeMap;

/** Pedagogical Java row-iteration baseline versus one conditional aggregate, same connection/snapshot. */
public final class ReportAggregate {
    private ReportAggregate() {}
    public record Totals(long count,long open,long paid,long refunded,BigDecimal paidMinor) {}
    private static final String FILTER=" FROM crm_order o WHERE o.tenant_id=? AND o.created_at>=? AND o.created_at<?"
        +" AND EXISTS(SELECT 1 FROM department_grant g WHERE g.tenant_id=o.tenant_id AND g.principal_id=? AND g.dept_id=o.dept_id)";
    private static PreparedStatement prepare(Connection c,String sql,long tenant,long start,long end,long principal) throws SQLException {
        if(tenant<=0 || principal<=0 || start>=end)throw new IllegalArgumentException();
        PreparedStatement p=c.prepareStatement(sql);
        try {p.setLong(1,tenant);p.setLong(2,start);p.setLong(3,end);p.setLong(4,principal);p.setQueryTimeout(2);return p;}
        catch(SQLException | RuntimeException e) {try {p.close();} catch(SQLException x) {if(e!=x)e.addSuppressed(x);}throw e;}
    }
    public static Map<String,Totals> javaAggregate(Connection c,long tenant,long start,long end,long principal) throws SQLException {
        Map<String,Totals> result=new TreeMap<>();
        try(PreparedStatement p=prepare(c,"SELECT o.currency,o.status,o.amount_minor"+FILTER,tenant,start,end,principal);ResultSet r=p.executeQuery()) {
            while(r.next()) {
                String currency=r.getString(1),status=r.getString(2);BigDecimal amount=r.getBigDecimal(3);
                Totals a=result.getOrDefault(currency,new Totals(0,0,0,0,BigDecimal.ZERO));
                result.put(currency,new Totals(Math.addExact(a.count(),1),Math.addExact(a.open(),status.equals("OPEN")?1:0),
                    Math.addExact(a.paid(),status.equals("PAID")?1:0),Math.addExact(a.refunded(),status.equals("REFUNDED")?1:0),
                    status.equals("PAID")?a.paidMinor().add(amount):a.paidMinor()));
            }
        }
        return result;
    }
    public static Map<String,Totals> databaseAggregate(Connection c,long tenant,long start,long end,long principal) throws SQLException {
        Map<String,Totals> result=new TreeMap<>();
        String projection="SELECT o.currency,COUNT(*),SUM(CASE WHEN o.status='OPEN' THEN 1 ELSE 0 END),"
          +"SUM(CASE WHEN o.status='PAID' THEN 1 ELSE 0 END),SUM(CASE WHEN o.status='REFUNDED' THEN 1 ELSE 0 END),"
          +"SUM(CASE WHEN o.status='PAID' THEN o.amount_minor ELSE 0 END)";
        try(PreparedStatement p=prepare(c,projection+FILTER+" GROUP BY o.currency ORDER BY o.currency",tenant,start,end,principal);ResultSet r=p.executeQuery()) {
            while(r.next())result.put(r.getString(1),new Totals(r.getLong(2),r.getLong(3),r.getLong(4),r.getLong(5),r.getBigDecimal(6)));
        }
        return result;
    }
}

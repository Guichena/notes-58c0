import javax.sql.DataSource;
import java.sql.*;
import java.util.Objects;

/** MySQL 8.4 local effect. Tenant/account authority must be checked before entry. */
public final class JdbcLocalEffect {
    public enum Kind { APPLIED, REPLAYED }
    public record Result(Kind kind, long originalBalance) { }
    public static final class CommitUnknown extends SQLException {
        private static final long serialVersionUID = 1L;
        CommitUnknown(Throwable cause) { super("Commit outcome unknown; reconcile the same identity", "08007", cause); }
    }
    private JdbcLocalEffect() { }
    public static Result applyDebit(DataSource source, long trustedTenant, String consumer,
                                    String eventId, long accountId, long cents, String currency) throws Exception {
        Objects.requireNonNull(source);
        if (trustedTenant <= 0 || accountId <= 0 || cents <= 0 || consumer == null || eventId == null
                || !consumer.matches("[A-Za-z0-9._:-]{1,80}") || !eventId.matches("[A-Za-z0-9._:-]{1,100}")
                || currency == null || !currency.matches("[A-Z]{3}")) throw new IllegalArgumentException("validated identity required");
        Connection c = source.getConnection(); Throwable primary = null;
        try {
            c.setAutoCommit(false);
            try {
                try (PreparedStatement p = c.prepareStatement("INSERT INTO effect_inbox(tenant_id,consumer,event_id,account_id,cents,currency) VALUES(?,?,?,?,?,?)")) {
                    p.setLong(1,trustedTenant);p.setString(2,consumer);p.setString(3,eventId);
                    p.setLong(4,accountId);p.setLong(5,cents);p.setString(6,currency);
                    try { p.executeUpdate(); }
                    catch (SQLException duplicate) {
                        // This INSERT targets a table with exactly one unique constraint: its inbox PK.
                        if (duplicate.getErrorCode()!=1062 || !"23000".equals(duplicate.getSQLState())) throw duplicate;
                        try { c.rollback(); }
                        catch (Exception | Error cleanup) { FailureTools.attach(duplicate,cleanup);throw duplicate; }
                        // A new transaction after rollback reads only committed receipt state.
                        Result replay;
                        try (PreparedStatement read = c.prepareStatement("SELECT account_id,cents,currency,result_balance FROM effect_inbox WHERE tenant_id=? AND consumer=? AND event_id=?")) {
                            read.setLong(1,trustedTenant);read.setString(2,consumer);read.setString(3,eventId);
                            try (ResultSet rs=read.executeQuery()) {
                                if (!rs.next() || rs.getLong(1)!=accountId || rs.getLong(2)!=cents || !currency.equals(rs.getString(3)))
                                    throw new IllegalStateException("identity payload conflict or receipt absent");
                                long balance=rs.getLong(4);
                                if (rs.wasNull()) throw new IllegalStateException("receipt incomplete");
                                replay=new Result(Kind.REPLAYED,balance);
                            }
                        }
                        c.rollback();return replay;
                    }
                }
                try (PreparedStatement p=c.prepareStatement("UPDATE effect_account SET balance=balance-? WHERE tenant_id=? AND account_id=? AND currency=? AND balance>=?")) {
                    p.setLong(1,cents);p.setLong(2,trustedTenant);p.setLong(3,accountId);p.setString(4,currency);p.setLong(5,cents);
                    if(p.executeUpdate()!=1)throw new IllegalStateException("account/currency mismatch or insufficient balance");
                }
                long balance;
                try(PreparedStatement p=c.prepareStatement("SELECT balance FROM effect_account WHERE tenant_id=? AND account_id=?")) {
                    p.setLong(1,trustedTenant);p.setLong(2,accountId);
                    try(ResultSet rs=p.executeQuery()){if(!rs.next())throw new IllegalStateException("account disappeared");balance=rs.getLong(1);}
                }
                try(PreparedStatement p=c.prepareStatement("UPDATE effect_inbox SET result_balance=? WHERE tenant_id=? AND consumer=? AND event_id=?")) {
                    p.setLong(1,balance);p.setLong(2,trustedTenant);p.setString(3,consumer);p.setString(4,eventId);
                    if(p.executeUpdate()!=1)throw new IllegalStateException("receipt update missing");
                }
                try(PreparedStatement p=c.prepareStatement("INSERT INTO effect_outbox(tenant_id,consumer,event_id,account_id,cents,currency,result_balance) VALUES(?,?,?,?,?,?,?)")) {
                    p.setLong(1,trustedTenant);p.setString(2,consumer);p.setString(3,eventId);p.setLong(4,accountId);
                    p.setLong(5,cents);p.setString(6,currency);p.setLong(7,balance);p.executeUpdate();
                }
                try { c.commit(); } catch (SQLException | RuntimeException uncertain) { throw new CommitUnknown(uncertain); }
                return new Result(Kind.APPLIED,balance);
            } catch(Exception|Error failure) { FailureTools.cleanup(failure,c::rollback);throw failure; }
        } catch(Exception|Error failure) { primary=failure;throw failure; }
        finally { FailureTools.cleanup(primary,c::close); }
    }
}

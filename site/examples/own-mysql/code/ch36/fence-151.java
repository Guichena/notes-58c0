import javax.sql.DataSource;
import java.sql.*;
import java.util.Objects;

public final class LocalEffects {
    public enum Outcome { APPLIED, REPLAYED }
    public static final class CommitUnknown extends SQLException {
        public CommitUnknown(SQLException cause) {
            super("COMMIT outcome unknown; reconcile with the same tenant/consumer/event", "08007", cause);
        }
    }
    private static void key(String value) {
        if (value == null || !value.matches("[A-Za-z0-9_.:-]{1,64}"))
            throw new IllegalArgumentException("ASCII identity required, length 1..64");
    }
    public static Outcome applyDebit(DataSource ds, long trustedTenant, String consumer,
            String eventId, long accountId, long cents, String currency) throws SQLException {
        Objects.requireNonNull(ds); key(consumer); key(eventId);
        if (trustedTenant <= 0 || accountId <= 0 || cents <= 0 || currency == null
                || !currency.matches("[A-Z]{3}")) throw new IllegalArgumentException("invalid debit");
        boolean duplicate = false;
        try (Connection c = ds.getConnection()) {
            if (!c.getAutoCommit()) throw new SQLException("fresh auto-commit connection required");
            c.setAutoCommit(false);
            try {
                try (PreparedStatement p = c.prepareStatement("INSERT INTO effect_inbox "
                        + "(tenant_id,consumer_name,event_id,account_id,cents,currency) VALUES (?,?,?,?,?,?)")) {
                    p.setLong(1, trustedTenant); p.setString(2, consumer); p.setString(3, eventId);
                    p.setLong(4, accountId); p.setLong(5, cents); p.setString(6, currency);
                    try { p.executeUpdate(); }
                    catch (SQLException e) {
                        if (e.getErrorCode() == 1062 && "23000".equals(e.getSQLState())) duplicate = true;
                        else throw e;
                    }
                }
                if (duplicate) c.rollback();
                else {
                    try (PreparedStatement p = c.prepareStatement("UPDATE effect_account SET balance_cents=balance_cents-? "
                            + "WHERE tenant_id=? AND account_id=? AND currency=? AND balance_cents>=?")) {
                        p.setLong(1,cents); p.setLong(2,trustedTenant); p.setLong(3,accountId);
                        p.setString(4,currency); p.setLong(5,cents);
                        if (p.executeUpdate()!=1) throw new SQLException("missing account, currency mismatch or insufficient balance", "45000");
                    }
                    long savedBalance;
                    try (PreparedStatement p=c.prepareStatement("SELECT balance_cents FROM effect_account WHERE tenant_id=? AND account_id=?")) {
                        p.setLong(1,trustedTenant); p.setLong(2,accountId);
                        try(ResultSet r=p.executeQuery()) { if(!r.next()) throw new SQLException("account vanished"); savedBalance=r.getLong(1); }
                    }
                    try (PreparedStatement p=c.prepareStatement("UPDATE effect_inbox SET result_balance=? WHERE tenant_id=? AND consumer_name=? AND event_id=?")) {
                        p.setLong(1,savedBalance); p.setLong(2,trustedTenant); p.setString(3,consumer); p.setString(4,eventId);
                        if(p.executeUpdate()!=1) throw new SQLException("receipt missing");
                    }
                    try (PreparedStatement p=c.prepareStatement("INSERT INTO effect_outbox "
                            + "(tenant_id,consumer_name,event_id,account_id,cents,currency) VALUES (?,?,?,?,?,?)")) {
                        p.setLong(1,trustedTenant); p.setString(2,consumer); p.setString(3,eventId);
                        p.setLong(4,accountId); p.setLong(5,cents); p.setString(6,currency); p.executeUpdate();
                    }
                    try { c.commit(); } catch(SQLException e) { throw new CommitUnknown(e); }
                    return Outcome.APPLIED;
                }
            } catch(SQLException | RuntimeException e) {
                try { c.rollback(); } catch(SQLException rollback) { if(e!=rollback)e.addSuppressed(rollback); }
                throw e;
            }
        }
        // A fresh transaction observes the winner's committed immutable receipt.
        try (Connection c=ds.getConnection()) {
            if(!c.getAutoCommit()) throw new SQLException("fresh auto-commit connection required");
            try(PreparedStatement p=c.prepareStatement("SELECT account_id,cents,currency,result_balance FROM effect_inbox "
                    + "WHERE tenant_id=? AND consumer_name=? AND event_id=?")) {
                p.setLong(1,trustedTenant); p.setString(2,consumer); p.setString(3,eventId);
                try(ResultSet r=p.executeQuery()) {
                    if(!r.next()) throw new SQLException("receipt unavailable; reconcile, do not invent success", "08007");
                    if(r.getLong(1)!=accountId || r.getLong(2)!=cents || !currency.equals(r.getString(3)))
                        throw new SQLException("identity reused with a different immutable payload", "45000");
                    r.getLong(4); if(r.wasNull()) throw new SQLException("incomplete committed receipt", "08007");
                    return Outcome.REPLAYED;
                }
            }
        }
    }
    private LocalEffects() {}
}

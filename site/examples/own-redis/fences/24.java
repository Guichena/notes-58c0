import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/** Dedicated JDBC connection/transaction per call. The caller authenticates tenant/user. */
public final class InventoryLedger {
    public enum Result { ACCEPTED, REPLAY, SOLD_OUT, ALREADY_ORDERED }
    private final String url;
    public InventoryLedger(String jdbcUrl) { url = java.util.Objects.requireNonNull(jdbcUrl); }
    public Result reserve(String tenant, String request, String sku, String user, long quantity)
            throws SQLException {
        return reserve(tenant, request, sku, user, quantity, false);
    }
    Result reserve(String tenant, String request, String sku, String user, long quantity,
                   boolean injectFailure) throws SQLException {
        for (String value : new String[]{tenant, request, sku, user})
            if (value == null || value.isBlank() || value.length() > 80)
                throw new IllegalArgumentException("nonblank identifier up to 80 chars required");
        if (quantity <= 0) throw new IllegalArgumentException("positive quantity required");
        try (Connection c = DriverManager.getConnection(url)) {
            c.setAutoCommit(false);
            try {
                try (PreparedStatement p = c.prepareStatement(
                        "SELECT available FROM stock WHERE tenant=? AND sku=? FOR UPDATE")) {
                    p.setString(1, tenant); p.setString(2, sku);
                    try (ResultSet rs = p.executeQuery()) {
                        if (!rs.next()) throw new IllegalArgumentException("unknown sku");
                    }
                }
                try (PreparedStatement p = c.prepareStatement(
                        "SELECT sku, user_id, qty FROM reservation WHERE tenant=? AND request_id=?")) {
                    p.setString(1, tenant); p.setString(2, request);
                    try (ResultSet rs = p.executeQuery()) {
                        if (rs.next()) {
                            if (!sku.equals(rs.getString(1)) || !user.equals(rs.getString(2)) || quantity != rs.getLong(3))
                                throw new IllegalArgumentException("idempotency key reused with different payload");
                            c.commit(); return Result.REPLAY;
                        }
                    }
                }
                try (PreparedStatement p = c.prepareStatement(
                        "SELECT request_id FROM reservation WHERE tenant=? AND sku=? AND user_id=?")) {
                    p.setString(1, tenant); p.setString(2, sku); p.setString(3, user);
                    try (ResultSet rs = p.executeQuery()) {
                        if (rs.next()) { c.commit(); return Result.ALREADY_ORDERED; }
                    }
                }
                try (PreparedStatement p = c.prepareStatement(
                        "UPDATE stock SET available=available-? WHERE tenant=? AND sku=? AND available>=?")) {
                    p.setLong(1, quantity); p.setString(2, tenant); p.setString(3, sku); p.setLong(4, quantity);
                    if (p.executeUpdate() == 0) { c.commit(); return Result.SOLD_OUT; }
                }
                try (PreparedStatement p = c.prepareStatement(
                        "INSERT INTO reservation(tenant,request_id,sku,user_id,qty) VALUES (?,?,?,?,?)")) {
                    p.setString(1, tenant); p.setString(2, request); p.setString(3, sku);
                    p.setString(4, user); p.setLong(5, quantity); p.executeUpdate();
                }
                if (injectFailure) throw new SQLException("injected failure before outbox");
                try (PreparedStatement p = c.prepareStatement(
                        "INSERT INTO outbox(tenant,request_id,sku,qty) VALUES (?,?,?,?)")) {
                    p.setString(1, tenant); p.setString(2, request); p.setString(3, sku);
                    p.setLong(4, quantity); p.executeUpdate();
                }
                c.commit(); return Result.ACCEPTED;
            } catch (SQLException | RuntimeException e) {
                try { c.rollback(); } catch (SQLException rollback) { if (e != rollback) e.addSuppressed(rollback); }
                throw e;
            }
        }
    }
}

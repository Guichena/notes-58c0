import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Objects;
import javax.sql.DataSource;

/** MySQL 8.4 teaching transaction; HTTP/MQ sends must not happen in Effect. */
public final class JdbcInbox {
    private JdbcInbox() { }

    @FunctionalInterface
    public interface Effect {
        // Use only this connection and transactional tables. Return a stored receipt.
        String apply(Connection connection) throws SQLException;
    }

    public static String execute(DataSource source, String scope, String eventId,
                                 String payloadHash, Effect effect) throws SQLException {
        Objects.requireNonNull(source);
        Objects.requireNonNull(effect);
        requireText(scope, 160);
        requireText(eventId, 160);
        if (payloadHash == null || !payloadHash.matches("[0-9a-f]{64}")) {
            throw new IllegalArgumentException("canonical SHA-256 hex required");
        }
        try (Connection connection = source.getConnection()) {
            connection.setAutoCommit(false);
            try {
                boolean duplicate = false;
                try (PreparedStatement insert = connection.prepareStatement(
                        "INSERT INTO inbox(scope_id,event_id,payload_hash,state) VALUES (?,?,?,'PROCESSING')")) {
                    insert.setString(1, scope);
                    insert.setString(2, eventId);
                    insert.setString(3, payloadHash);
                    insert.executeUpdate();
                } catch (SQLException e) {
                    // This INSERT has exactly one unique key in the supplied schema.
                    if (e.getErrorCode() != 1062 || !"23000".equals(e.getSQLState())) { throw e; }
                    connection.rollback(); // discard failed attempt; begin a fresh read transaction
                    duplicate = true;
                }
                if (duplicate) {
                    String receipt = readCompleted(connection, scope, eventId, payloadHash);
                    connection.commit();
                    return receipt;
                }
                String receipt = Objects.requireNonNull(effect.apply(connection), "receipt");
                try (PreparedStatement done = connection.prepareStatement(
                        "UPDATE inbox SET state='DONE',receipt=? WHERE scope_id=? AND event_id=? AND state='PROCESSING'")) {
                    done.setString(1, receipt);
                    done.setString(2, scope);
                    done.setString(3, eventId);
                    if (done.executeUpdate() != 1) { throw new SQLException("inbox transition failed"); }
                }
                connection.commit(); // a connection error here means UNKNOWN, not proven rollback
                return receipt;
            } catch (SQLException | RuntimeException e) {
                try { connection.rollback(); }
                catch (SQLException rollbackFailure) { if (e != rollbackFailure) e.addSuppressed(rollbackFailure); }
                throw e;
            }
        }
    }

    private static String readCompleted(Connection c, String scope, String id,
                                        String payloadHash) throws SQLException {
        try (PreparedStatement select = c.prepareStatement(
                "SELECT payload_hash,state,receipt FROM inbox WHERE scope_id=? AND event_id=? FOR UPDATE")) {
            select.setString(1, scope);
            select.setString(2, id);
            try (ResultSet row = select.executeQuery()) {
                if (!row.next()) { throw new SQLException("receipt missing: retain and reconcile"); }
                if (!payloadHash.equals(row.getString(1))) {
                    throw new IllegalArgumentException("same id with different payload");
                }
                String receipt = row.getString(3);
                if (!"DONE".equals(row.getString(2)) || receipt == null) {
                    throw new SQLException("result not DONE: retain and reconcile");
                }
                return receipt;
            }
        }
    }

    private static void requireText(String value, int maxChars) {
        if (value == null || value.isBlank() || value.length() > maxChars
                || !value.matches("[A-Za-z0-9:._/-]+")) {
            throw new IllegalArgumentException("invalid scoped identity");
        }
    }
}

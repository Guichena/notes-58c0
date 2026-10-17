import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.*;
import java.util.HexFormat;
import java.util.Properties;

/** MySQL 8.4 example: one debit effect and one inbox insert in one transaction. */
public final class JdbcInbox {
    public record Event(String subscriber, String id, long accountId, long amount) {
        public Event {
            if (subscriber == null || !subscriber.matches("[A-Za-z0-9._:-]{1,80}")
                    || id == null || !id.matches("[A-Za-z0-9._:-]{1,80}")
                    || accountId <= 0 || amount <= 0) throw new IllegalArgumentException();
        }
        String digest() throws Exception {
            String canonical = "debit-v1\n" + accountId + "\n" + amount;
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(canonical.getBytes(StandardCharsets.UTF_8)));
        }
    }
    private static Connection connect() throws SQLException {
        String url = System.getenv("JDBC_URL");
        if (url == null || url.isBlank()) throw new IllegalArgumentException("JDBC_URL required");
        Properties p = new Properties();
        String user = System.getenv("JDBC_USER"), password = System.getenv("JDBC_PASSWORD");
        if (user != null) p.setProperty("user", user);
        if (password != null) p.setProperty("password", password);
        return DriverManager.getConnection(url, p);
    }
    public static boolean apply(Event event) throws Exception {
        String digest = event.digest();
        Connection c = connect();
        Throwable primary = null;
        try {
            c.setAutoCommit(false);
            try {
                try (PreparedStatement insert = c.prepareStatement(
                        "INSERT INTO mq_inbox(subscriber,event_id,payload_sha256) VALUES(?,?,?)")) {
                    insert.setString(1, event.subscriber());
                    insert.setString(2, event.id());
                    insert.setString(3, digest);
                    try { insert.executeUpdate(); }
                    catch (SQLException duplicate) {
                        // MySQL duplicate key only; this table has one unique constraint.
                        if (duplicate.getErrorCode() != 1062 || !"23000".equals(duplicate.getSQLState()))
                            throw duplicate;
                        try { c.rollback(); }
                        catch (Exception | Error rollbackFailure) {
                            FailureTools.attach(duplicate, rollbackFailure);
                            throw duplicate;
                        }
                        try (PreparedStatement read = c.prepareStatement(
                                "SELECT payload_sha256 FROM mq_inbox WHERE subscriber=? AND event_id=?")) {
                            read.setString(1, event.subscriber()); read.setString(2, event.id());
                            try (ResultSet rs = read.executeQuery()) {
                                if (!rs.next() || !digest.equals(rs.getString(1)))
                                    throw new IllegalStateException("event identity conflict");
                            }
                        }
                        c.rollback();
                        return false;
                    }
                }
                try (PreparedStatement debit = c.prepareStatement(
                        "UPDATE mq_account SET balance=balance-? WHERE id=? AND balance>=?")) {
                    debit.setLong(1, event.amount()); debit.setLong(2, event.accountId());
                    debit.setLong(3, event.amount());
                    if (debit.executeUpdate() != 1) throw new IllegalStateException("account missing or insufficient balance");
                }
                c.commit(); // A commit exception may be an unknown result. Do not ACK it.
                return true;
            } catch (Exception | Error failure) {
                FailureTools.cleanup(failure, c::rollback);
                throw failure;
            }
        } catch (Exception | Error failure) { primary = failure; throw failure; }
        finally { FailureTools.cleanup(primary, c::close); }
    }
    public static void main(String[] args) throws Exception {
        if (args.length != 4) throw new IllegalArgumentException("subscriber eventId accountId amount");
        boolean applied = apply(new Event(args[0], args[1], Long.parseLong(args[2]), Long.parseLong(args[3])));
        System.out.println(applied ? "APPLIED" : "ALREADY_APPLIED");
    }
}

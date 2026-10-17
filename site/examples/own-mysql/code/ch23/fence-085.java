import java.sql.*;
import java.util.Properties;
import java.util.concurrent.ThreadLocalRandom;

/** JDBC helpers for dedicated connections to an explicitly authorized local scratch database. */
public final class Db {
    private Db() {}
    @FunctionalInterface public interface Source { Connection open() throws SQLException; }
    @FunctionalInterface public interface Work<T> { T run(Connection c) throws SQLException; }
    public static final class UnknownCommit extends SQLException {
        private static final long serialVersionUID = 1L;
        public UnknownCommit(SQLException cause) {
            super("COMMIT outcome unknown; reconcile the SAME request ID on the authority", cause);
        }
    }
    public static final class CommittedCleanup extends SQLException {
        private static final long serialVersionUID = 1L;
        public CommittedCleanup(SQLException cause) {
            super("Transaction COMMITTED; connection cleanup failed; do not reapply the operation", cause);
        }
    }
    public static void suppress(Throwable primary, Throwable cleanup) {
        if (primary != cleanup) primary.addSuppressed(cleanup);
    }
    public static void key(String key) {
        if (key == null || !key.matches("[A-Za-z0-9_.:-]{1,100}"))
            throw new IllegalArgumentException("request ID must be 1..100 ASCII key characters");
    }
    public static boolean duplicate(SQLException e) {
        return e.getErrorCode() == 1062 && "23000".equals(e.getSQLState());
    }
    public static boolean retryable(SQLException e) {
        return e.getErrorCode() == 1213 || e.getErrorCode() == 1205;
    }
    public static PreparedStatement prepare(Connection c, String sql) throws SQLException {
        PreparedStatement p = c.prepareStatement(sql);
        try { p.setQueryTimeout(3); return p; }
        catch (SQLException e) { try { p.close(); } catch (SQLException x) { suppress(e, x); } throw e; }
    }
    public static boolean rollback(Connection c, Throwable cause) {
        try { c.rollback(); return true; }
        catch (SQLException e) { suppress(cause, e); return false; }
    }
    /** At most 3 fresh transactions; 8-second admission budget, not a hard cancellation deadline. */
    public static <T> T transaction(Source source, Work<T> work) throws SQLException {
        long deadline = System.nanoTime() + 8_000_000_000L;
        SQLException last = null;
        for (int attempt = 0; attempt < 3; attempt++) {
            if (System.nanoTime() >= deadline) break;
            Connection c = source.open();
            Throwable primary = null;
            SQLException retry = null;
            boolean committed = false;
            try {
                c.setTransactionIsolation(Connection.TRANSACTION_READ_COMMITTED);
                c.setAutoCommit(false);
                boolean committing = false;
                try {
                    T result = work.run(c); // Every attempt re-reads and revalidates.
                    committing = true;
                    c.commit();
                    committed = true;
                    return result;
                } catch (SQLException e) {
                    boolean rolledBack = rollback(c, e);
                    if (committing) throw new UnknownCommit(e);
                    if (!rolledBack || !retryable(e)) throw e;
                    retry = e;
                } catch (RuntimeException | Error e) {
                    rollback(c, e); throw e;
                }
            } catch (SQLException | RuntimeException | Error e) {
                primary = e;
                throw e;
            } finally {
                try { c.close(); }
                catch (SQLException closeFailure) {
                    if (primary != null) {
                        suppress(primary, closeFailure);
                    } else if (retry != null) {
                        suppress(retry, closeFailure);
                        throw retry; // Cleanup failure stops retries without replacing their cause.
                    } else if (committed) {
                        throw new CommittedCleanup(closeFailure);
                    } else {
                        throw closeFailure;
                    }
                }
            }
            last = retry;
            if (attempt < 2) {
                long remaining = deadline - System.nanoTime();
                if (remaining <= 0) break;
                long delay = Math.min(remaining / 1_000_000L,
                        ThreadLocalRandom.current().nextLong(10L, 30L << attempt));
                try { Thread.sleep(delay); }
                catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new SQLException("retry interrupted", e);
                }
            }
        }
        throw last != null ? last : new SQLException("retry admission budget exhausted");
    }
    public static Source localSource() {
        String url = System.getenv("MYSQL_LAB_URL");
        if (!"YES".equals(System.getenv("MYSQL_LAB_ALLOW")) || url == null ||
            !url.matches("jdbc:mysql://127\\.0\\.0\\.1:[0-9]{1,5}/mysql_tx_lab"))
            throw new IllegalArgumentException("authorize local mysql_tx_lab with MYSQL_LAB_ALLOW=YES");
        String user = System.getenv("MYSQL_LAB_USER"), password = System.getenv("MYSQL_LAB_PASSWORD");
        if (user == null || password == null) throw new IllegalArgumentException("local lab credentials required");
        Properties p = new Properties();
        p.setProperty("user", user); p.setProperty("password", password);
        p.setProperty("useAffectedRows", "false"); // Matched rows; repeated bucket receipt may make a no-op UPDATE.
        p.setProperty("connectTimeout", "3000"); p.setProperty("socketTimeout", "5000");
        return () -> DriverManager.getConnection(url, p);
    }
}

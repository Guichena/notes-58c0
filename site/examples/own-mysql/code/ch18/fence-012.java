import java.math.BigDecimal;
import java.net.URI;
import java.net.URISyntaxException;
import java.sql.*;
import java.time.LocalDateTime;
import java.util.Properties;

public final class SnapshotReport {
    private static final int MAX_DETAIL_ROWS = 10_000;
    private static final int QUERY_TIMEOUT_SECONDS = 10;
    private static final String LAB_SCHEMA = "mysql_txn_report_learning";
    private static final String LAB_OPT_IN = "I_UNDERSTAND_THIS_IS_AN_AUTHORIZED_LAB";

    public record Totals(long rows, BigDecimal amount) {}

    private static String requiredEnv(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Missing environment variable: " + name);
        }
        return value;
    }

    private static String checkedLabUrl(String url) {
        if (!url.startsWith("jdbc:mysql://")) {
            throw new IllegalArgumentException("A single-host jdbc:mysql:// lab URL is required");
        }
        URI u;
        try { u = new URI(url.substring(5)); }
        catch (URISyntaxException invalid) {
            throw new IllegalArgumentException("Invalid lab URL syntax");
        }
        String host = u.getHost();
        String path = u.getRawPath();
        if (host == null || u.getRawUserInfo() != null || u.getRawQuery() != null
                || u.getRawFragment() != null || path == null
                || !path.matches("/[A-Za-z0-9_]+")
                || (u.getPort() != -1 && (u.getPort() < 1 || u.getPort() > 65535))) {
            throw new IllegalArgumentException("Use one host and schema; no credentials or URL options");
        }
        // Literal loopback only: do not accept an arbitrary DNS name resolving locally.
        boolean loopback = host.equals("127.0.0.1") || host.equals("[::1]") || host.equals("::1");
        boolean dedicatedSchema = path.equals("/" + LAB_SCHEMA);
        if ((!loopback || !dedicatedSchema)
                && !LAB_OPT_IN.equals(System.getenv("MYSQL_LAB_OPT_IN"))) {
            throw new IllegalArgumentException("Non-loopback or other schema requires explicit authorized-lab opt-in");
        }
        return url;
    }

    private static void verifyTeachingRuntime(Connection c) throws SQLException {
        if (Runtime.version().feature() != 21) {
            throw new SQLException("This teaching entry requires Java 21");
        }
        DatabaseMetaData m = c.getMetaData();
        String server = m.getDatabaseProductVersion();
        String driver = m.getDriverVersion();
        boolean serverMatches = server.equals("8.4.0") || server.startsWith("8.4.0-");
        boolean driverMatches = driver.equals("mysql-connector-j-8.4.0")
                || driver.startsWith("mysql-connector-j-8.4.0 ");
        if (!m.getDatabaseProductName().equals("MySQL") || !serverMatches
                || !m.getDriverName().equals("MySQL Connector/J") || !driverMatches) {
            throw new SQLException("This teaching entry requires MySQL 8.4.0 and Connector/J 8.4.0");
        }
        try (PreparedStatement p = c.prepareStatement(
                "SELECT ENGINE FROM information_schema.TABLES "
                + "WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='report_sale'")) {
            p.setQueryTimeout(QUERY_TIMEOUT_SECONDS);
            try (ResultSet r = p.executeQuery()) {
                if (!r.next() || !"InnoDB".equalsIgnoreCase(r.getString(1)) || r.next()) {
                    throw new SQLException("report_sale must exist as an InnoDB table in the selected lab schema");
                }
            }
        }
    }

    private static void bind(PreparedStatement p, long tenant,
                             LocalDateTime from, LocalDateTime until) throws SQLException {
        p.setLong(1, tenant);
        p.setObject(2, from);
        p.setObject(3, until);
        p.setQueryTimeout(QUERY_TIMEOUT_SECONDS);
    }

    public static Totals read(Connection c, long tenant,
                              LocalDateTime from, LocalDateTime until) throws SQLException {
        if (tenant <= 0 || !from.isBefore(until)) {
            throw new IllegalArgumentException("positive tenant and nonempty [from,until) required");
        }
        if (!c.getAutoCommit()) {
            throw new IllegalArgumentException("The method requires a fresh, unshared connection");
        }
        c.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);
        c.setReadOnly(true);
        c.setAutoCommit(false);
        try {
            Totals expected;
            String predicate = " WHERE tenant_id=? AND occurred_at>=? AND occurred_at<?";
            try (PreparedStatement p = c.prepareStatement(
                    "SELECT COUNT(*),COALESCE(SUM(amount),0) FROM report_sale" + predicate)) {
                bind(p, tenant, from, until);
                try (ResultSet r = p.executeQuery()) {
                    if (!r.next()) throw new SQLException("Missing aggregate row");
                    expected = new Totals(r.getLong(1), r.getBigDecimal(2));
                }
            }
            if (expected.rows() > MAX_DETAIL_ROWS) {
                throw new SQLException("Report exceeds the 10000-row teaching limit; no partial report returned");
            }
            long count = 0;
            BigDecimal amount = BigDecimal.ZERO;
            try (PreparedStatement p = c.prepareStatement(
                    "SELECT id,amount FROM report_sale" + predicate
                    + " ORDER BY occurred_at,id LIMIT " + (MAX_DETAIL_ROWS + 1))) {
                bind(p, tenant, from, until);
                try (ResultSet r = p.executeQuery()) {
                    while (r.next()) {
                        count = Math.incrementExact(count);
                        if (count > MAX_DETAIL_ROWS) {
                            throw new SQLException("Oversized detail set; no partial report returned");
                        }
                        amount = amount.add(r.getBigDecimal(2));
                    }
                }
            }
            if (count != expected.rows() || amount.compareTo(expected.amount()) != 0) {
                throw new SQLException("Totals and details disagree");
            }
            c.commit();
            return expected;
        } catch (SQLException | RuntimeException | Error failure) {
            try { c.rollback(); }
            catch (SQLException rollbackFailure) {
                if (failure != rollbackFailure) failure.addSuppressed(rollbackFailure);
            }
            throw failure;
        }
        // Caller closes this dedicated connection; never return it to arbitrary code mid-transaction.
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 3) {
            throw new IllegalArgumentException("Usage: SnapshotReport tenant from-UTC until-UTC");
        }
        String url = checkedLabUrl(requiredEnv("DB_URL"));
        Properties properties = new Properties();
        properties.setProperty("user", requiredEnv("DB_USER"));
        properties.setProperty("password", requiredEnv("DB_PASSWORD"));
        properties.setProperty("connectTimeout", "5000");
        properties.setProperty("socketTimeout", "15000");
        properties.setProperty("readOnlyPropagatesToServer", "true");
        try (Connection c = DriverManager.getConnection(url, properties)) {
            verifyTeachingRuntime(c);
            try (Statement s = c.createStatement()) {
                s.setQueryTimeout(QUERY_TIMEOUT_SECONDS);
                s.execute("SET time_zone='+00:00'");
            }
            Totals result = read(c, Long.parseLong(args[0]),
                    LocalDateTime.parse(args[1]), LocalDateTime.parse(args[2]));
            System.out.println("rows=" + result.rows() + ", amount=" + result.amount().toPlainString());
        }
    }
}

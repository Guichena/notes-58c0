import java.math.BigDecimal;
import java.sql.*;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

public final class TransactionQueries {
    private TransactionQueries() {}
    public record Transaction(long id, BigDecimal amount, String currency,
                              Instant time, String description) {}
    public record Cursor(Instant time, long id) {
        public Cursor {
            Objects.requireNonNull(time, "time");
            if (id <= 0 || !time.equals(time.truncatedTo(ChronoUnit.MICROS)))
                throw new IllegalArgumentException("positive id and exact microsecond cursor required");
        }
    }
    public static Instant startOfWindow(Instant end) {
        return Objects.requireNonNull(end, "end").truncatedTo(ChronoUnit.MICROS)
                      .minus(30, ChronoUnit.DAYS);
    }
    public static List<Transaction> firstPage(Connection c, long trustedUser,
            Instant end, int pageSize) throws SQLException {
        return page(c, trustedUser, end, pageSize, null);
    }
    public static List<Transaction> nextPage(Connection c, long trustedUser,
            Instant end, int pageSize, Cursor cursor) throws SQLException {
        return page(c, trustedUser, end, pageSize, Objects.requireNonNull(cursor));
    }
    private static List<Transaction> page(Connection c, long user, Instant end,
            int size, Cursor cursor) throws SQLException {
        Objects.requireNonNull(c, "connection");
        if (user <= 0 || size < 1 || size > 1000)
            throw new IllegalArgumentException("user > 0, pageSize 1..1000");
        end = Objects.requireNonNull(end, "end").truncatedTo(ChronoUnit.MICROS);
        Instant start = startOfWindow(end);
        if (cursor != null && (cursor.time().isBefore(start) || !cursor.time().isBefore(end)))
            throw new IllegalArgumentException("cursor must belong to the fixed window");
        String sql = "SELECT id,amount,currency,txn_time,description FROM user_transactions "
                   + "WHERE user_id=? AND txn_time>=? AND txn_time<? "
                   + (cursor == null ? "" : "AND (txn_time<? OR (txn_time=? AND id<?)) ")
                   + "ORDER BY txn_time DESC,id DESC LIMIT ?";
        Calendar utc = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        try (PreparedStatement p = c.prepareStatement(sql)) {
            int i = 1;
            p.setLong(i++, user);
            p.setTimestamp(i++, Timestamp.from(start), utc);
            p.setTimestamp(i++, Timestamp.from(end), utc);
            if (cursor != null) {
                p.setTimestamp(i++, Timestamp.from(cursor.time()), utc);
                p.setTimestamp(i++, Timestamp.from(cursor.time()), utc);
                p.setLong(i++, cursor.id());
            }
            p.setInt(i, size); p.setQueryTimeout(10);
            try (ResultSet r = p.executeQuery()) {
                List<Transaction> result = new ArrayList<>();
                while (r.next()) result.add(new Transaction(r.getLong("id"),
                    r.getBigDecimal("amount"), r.getString("currency"),
                    r.getTimestamp("txn_time", utc).toInstant(), r.getString("description")));
                return List.copyOf(result);
            }
        }
    }
    public static void main(String[] args) {
        Instant end = Instant.parse("2026-10-09T00:00:00.000000999Z");
        if (!startOfWindow(end).equals(Instant.parse("2026-09-09T00:00:00Z")))
            throw new AssertionError("time window");
        if (new BigDecimal("0.10").add(new BigDecimal("0.20"))
                .compareTo(new BigDecimal("0.30")) != 0) throw new AssertionError("money");
        try {
            new Cursor(end, 1);
            throw new AssertionError("nanosecond cursor accepted");
        } catch (IllegalArgumentException expected) { }
        System.out.println("PASS pure Java time/money/cursor checks; no database connection");
    }
}

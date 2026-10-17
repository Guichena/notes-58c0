import java.sql.*;
import java.util.Objects;

/** Same-database, same-currency transfer. No real payment or external side effect. */
public final class TransferService {
    private final Db.Source source;
    public TransferService(Db.Source source) { this.source = Objects.requireNonNull(source); }
    public enum Outcome { APPLIED, ALREADY_APPLIED }
    private record Account(long cents, String currency, boolean active) {}
    public Outcome transfer(String request, long from, long to, long cents, String currency)
            throws SQLException {
        Db.key(request);
        if (from <= 0 || to <= 0 || from == to || cents <= 0 || currency == null ||
                !currency.matches("[A-Z]{3}")) throw new IllegalArgumentException("invalid transfer");
        return Db.transaction(source, c -> {
            try (PreparedStatement p = Db.prepare(c,
                    "INSERT INTO transfers(request_id,from_id,to_id,cents,currency) VALUES(?,?,?,?,?)")) {
                p.setString(1,request); p.setLong(2,from); p.setLong(3,to);
                p.setLong(4,cents); p.setString(5,currency);
                try { p.executeUpdate(); }
                catch (SQLException e) {
                    if (!Db.duplicate(e)) throw e;
                    if (!Db.rollback(c, e)) throw e; // Lookup only after rollback succeeds; keep the original duplicate on failure.
                    try (PreparedStatement q = Db.prepare(c,
                            "SELECT from_id,to_id,cents,currency FROM transfers WHERE request_id=?")) {
                        q.setString(1,request);
                        try (ResultSet r = q.executeQuery()) {
                            if (!r.next()) throw e;
                            if (r.getLong(1)!=from || r.getLong(2)!=to || r.getLong(3)!=cents ||
                                    !currency.equals(r.getString(4)))
                                throw new IllegalArgumentException("request ID reused with different input");
                        }
                    }
                    return Outcome.ALREADY_APPLIED;
                }
            }
            long low = Math.min(from,to), high = Math.max(from,to);
            Account a = lock(c,low), b = lock(c,high);
            if (!a.active || !b.active || !a.currency.equals(currency) || !b.currency.equals(currency))
                throw new IllegalArgumentException("inactive account or currency mismatch");
            Account debit = from == low ? a : b, credit = to == low ? a : b;
            if (debit.cents < cents) throw new IllegalArgumentException("insufficient funds");
            long newCredit = Math.addExact(credit.cents,cents);
            update(c,from,debit.cents-cents); update(c,to,newCredit);
            return Outcome.APPLIED;
        });
    }
    private static Account lock(Connection c, long id) throws SQLException {
        try (PreparedStatement p = Db.prepare(c,"SELECT cents,currency,active FROM accounts WHERE id=? FOR UPDATE")) {
            p.setLong(1,id);
            try (ResultSet r = p.executeQuery()) {
                if (!r.next()) throw new IllegalArgumentException("missing account");
                return new Account(r.getLong(1),r.getString(2),r.getBoolean(3));
            }
        }
    }
    private static void update(Connection c,long id,long cents) throws SQLException {
        try (PreparedStatement p = Db.prepare(c,"UPDATE accounts SET cents=? WHERE id=?")) {
            p.setLong(1,cents); p.setLong(2,id);
            if (p.executeUpdate()!=1) throw new SQLException("locked account missing");
        }
    }
}

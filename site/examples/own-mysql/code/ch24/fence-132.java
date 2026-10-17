import java.sql.*;

/** A single SQL CAS. Caller owns transaction, receipt, order and outbox. */
public final class OptimisticStock {
    private OptimisticStock() {}
    public static boolean tryReserve(Connection c,long tenant,long sku,long quantity,long expected)
            throws SQLException {
        if (tenant<=0 || sku<=0 || quantity<=0 || expected<0 || expected==Long.MAX_VALUE)
            throw new IllegalArgumentException("positive IDs/quantity and incrementable version required");
        try (PreparedStatement p = Db.prepare(c,
                "UPDATE inventory SET stock=stock-?,version=version+1 " +
                "WHERE tenant_id=? AND sku_id=? AND version=? AND stock>=?")) {
            p.setLong(1,quantity); p.setLong(2,tenant); p.setLong(3,sku);
            p.setLong(4,expected); p.setLong(5,quantity);
            int changed=p.executeUpdate();
            if (changed>1) throw new SQLException("stock key is not unique");
            return changed==1;
        }
    }
}

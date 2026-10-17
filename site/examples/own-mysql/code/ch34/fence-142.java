import java.sql.*;
import java.util.*;

public final class SafeUserLookup {
    private SafeUserLookup() {}
    public enum Order { ID, NAME }
    public static List<Long> find(Connection c, long trustedTenant, String name,
                                  Order order, int limit) throws SQLException {
        Objects.requireNonNull(c, "connection");
        Objects.requireNonNull(name, "name");
        Objects.requireNonNull(order, "order");
        if (trustedTenant <= 0 || limit < 1 || limit > 100)
            throw new IllegalArgumentException("tenant > 0, limit 1..100");
        String sort = switch (order) { case ID -> "id"; case NAME -> "username,id"; };
        String sql = "SELECT id FROM app_users WHERE tenant_id=? AND username=? "
                   + "ORDER BY " + sort + " LIMIT ?";
        try (PreparedStatement p = c.prepareStatement(sql)) {
            p.setLong(1, trustedTenant); p.setString(2, name); p.setInt(3, limit);
            p.setQueryTimeout(10);
            try (ResultSet r = p.executeQuery()) {
                List<Long> out = new ArrayList<>();
                while (r.next()) out.add(r.getLong(1));
                return List.copyOf(out);
            }
        }
    }
}

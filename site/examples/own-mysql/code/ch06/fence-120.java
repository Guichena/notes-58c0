import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.Map;

/** Two-column multiset comparison. No JOIN, hashes, or NULL-sensitive NOT IN. */
public final class TableDiff {
    private TableDiff() {}
    public record Row(Long businessId, String payload) {}
    public static final String SQL = "SELECT business_id,payload,SUM(delta) AS difference FROM ("
        + "SELECT business_id,payload,-1 AS delta FROM compare_a UNION ALL "
        + "SELECT business_id,payload,1 AS delta FROM compare_b"
        + ") all_rows GROUP BY business_id,payload HAVING SUM(delta)<>0";
    /** Positive delta means B has that many extra copies; negative means A has extra. */
    public static Map<Row,Long> compare(Connection connection) throws SQLException {
        Map<Row,Long> result = new LinkedHashMap<>();
        try (PreparedStatement p = connection.prepareStatement(SQL); ResultSet r = p.executeQuery()) {
            while (r.next()) {
                long value = r.getLong(1);
                Long key = r.wasNull() ? null : value;
                result.put(new Row(key,r.getString(2)),r.getBigDecimal(3).longValueExact());
            }
        }
        return Map.copyOf(result);
    }
}

import java.sql.*;
import java.util.*;

/** Transaction-owned, bounded whole-list reorder. Authorize the caller before calling. */
public final class PlaylistOrder {
    private PlaylistOrder() {}
    private static void suppress(Exception primary,Exception secondary) {
        if(primary!=secondary) primary.addSuppressed(secondary);
    }
    public static boolean reorder(Connection c, long playlist, long viewer, long expected,
                                  List<Long> input, boolean failAfterDelete) throws SQLException {
        List<Long> ids = List.copyOf(input); // immutable, rejects null entries
        if (viewer < 0 || expected < 0 || expected == Long.MAX_VALUE || ids.size() > 10_000
            || new HashSet<>(ids).size() != ids.size()) throw new IllegalArgumentException("invalid reorder");
        if (!c.getAutoCommit()) throw new IllegalArgumentException("requires an unowned connection");
        c.setAutoCommit(false);
        boolean transactionEnded = false;
        Exception primary = null;
        try {
            // Every add/remove/reorder must lock the same parent first, in the same order.
            try (PreparedStatement p = c.prepareStatement("SELECT playlist_id FROM playlist WHERE playlist_id=? FOR UPDATE")) {
                p.setLong(1, playlist);
                try (ResultSet r = p.executeQuery()) { if (!r.next()) throw new IllegalArgumentException("playlist absent"); }
            }
            try (PreparedStatement p = c.prepareStatement("UPDATE playlist_order SET version=version+1 WHERE playlist_id=? AND view_user_id=? AND version=?")) {
                p.setLong(1, playlist); p.setLong(2, viewer); p.setLong(3, expected);
                if (p.executeUpdate() != 1) { c.rollback(); transactionEnded = true; return false; }
            }
            Set<Long> members = new HashSet<>();
            try (PreparedStatement p = c.prepareStatement("SELECT entry_id FROM playlist_entry WHERE playlist_id=?")) {
                p.setLong(1, playlist);
                try (ResultSet r = p.executeQuery()) { while (r.next()) members.add(r.getLong(1)); }
            }
            if (!members.equals(new HashSet<>(ids))) throw new IllegalArgumentException("not an exact permutation");
            try (PreparedStatement p = c.prepareStatement("DELETE FROM playlist_order_item WHERE playlist_id=? AND view_user_id=?")) {
                p.setLong(1, playlist); p.setLong(2, viewer); p.executeUpdate();
            }
            if (failAfterDelete) throw new SQLException("injected rollback test");
            try (PreparedStatement p = c.prepareStatement("INSERT INTO playlist_order_item VALUES(?,?,?,?)")) {
                for (int i=0;i<ids.size();i++) {
                    p.setLong(1,playlist); p.setLong(2,viewer); p.setLong(3,ids.get(i)); p.setInt(4,i); p.addBatch();
                }
                p.executeBatch();
            }
            c.commit(); transactionEnded = true; return true;
        } catch (SQLException | RuntimeException ex) {
            primary = ex;
            try { c.rollback(); transactionEnded = true; }
            catch (SQLException rollback) {
                suppress(ex,rollback);
                // Never enable autoCommit after an unconfirmed rollback: that can commit.
                try { c.close(); } catch (SQLException close) { suppress(ex,close); }
            }
            throw ex;
        } finally {
            if (transactionEnded) {
                try { c.setAutoCommit(true); }
                catch (SQLException | RuntimeException reset) {
                    // Cleanup must never replace the original failure, especially COMMIT UNKNOWN.
                    try { c.close(); } catch (SQLException | RuntimeException close) { suppress(reset,close); }
                    if (primary != null) suppress(primary,reset);
                    else throw reset;
                }
            }
        }
    }
}

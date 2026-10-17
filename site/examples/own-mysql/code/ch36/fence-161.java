import javax.sql.DataSource;
import java.sql.*;
public final class ManifestPublisher {
    public static void publish(DataSource ds,long tenant,long source,long candidate,long expectedVisible)throws SQLException {
        if(ds==null || tenant<=0 || source<=0 || candidate<=expectedVisible || expectedVisible<0)throw new IllegalArgumentException();
        try(Connection c=ds.getConnection()) {
            if(!c.getAutoCommit())throw new SQLException("fresh auto-commit connection required");
            c.setAutoCommit(false);
            try {
                try(PreparedStatement p=c.prepareStatement("SELECT current_version,visible_version FROM source_head WHERE tenant_id=? AND source_id=? FOR UPDATE")) {
                    p.setLong(1,tenant);p.setLong(2,source);
                    try(ResultSet r=p.executeQuery()){if(!r.next()||r.getLong(1)!=candidate||r.getLong(2)!=expectedVisible)throw new SQLException("stale candidate or manifest", "45000");}
                }
                int expected;
                try(PreparedStatement p=c.prepareStatement("SELECT expected_chunks,state FROM projection_build WHERE tenant_id=? AND source_id=? AND version=? FOR UPDATE")) {
                    bind(p,tenant,source,candidate);
                    try(ResultSet r=p.executeQuery()){if(!r.next()||!"BUILDING".equals(r.getString(2)))throw new SQLException("build unavailable");expected=r.getInt(1);}
                }
                try(PreparedStatement p=c.prepareStatement("SELECT COUNT(*),MIN(chunk_no),MAX(chunk_no) FROM projection_receipt WHERE tenant_id=? AND source_id=? AND version=?")) {
                    bind(p,tenant,source,candidate);
                    try(ResultSet r=p.executeQuery()){r.next();long n=r.getLong(1);if(n!=expected||(n>0&&(r.getInt(2)!=0||r.getInt(3)!=expected-1)))throw new SQLException("incomplete manifest");}
                }
                try(PreparedStatement p=c.prepareStatement("UPDATE source_head SET visible_version=? WHERE tenant_id=? AND source_id=? AND current_version=? AND visible_version=?")) {
                    p.setLong(1,candidate);p.setLong(2,tenant);p.setLong(3,source);p.setLong(4,candidate);p.setLong(5,expectedVisible);
                    if(p.executeUpdate()!=1)throw new SQLException("manifest CAS lost");
                }
                try(PreparedStatement p=c.prepareStatement("UPDATE projection_build SET state='VISIBLE' WHERE tenant_id=? AND source_id=? AND version=? AND state='BUILDING'")) {
                    bind(p,tenant,source,candidate);if(p.executeUpdate()!=1)throw new SQLException("build CAS lost");
                }
                try{c.commit();}catch(SQLException e){throw new SQLException("manifest COMMIT UNKNOWN; query visible_version before retry", "08007",e);}
            }catch(SQLException|RuntimeException e){try{c.rollback();}catch(SQLException x){if(e!=x)e.addSuppressed(x);}throw e;}
        }
    }
    private static void bind(PreparedStatement p,long tenant,long source,long version)throws SQLException {
        p.setLong(1,tenant);p.setLong(2,source);p.setLong(3,version);
    }
    private ManifestPublisher(){}
}

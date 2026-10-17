import javax.sql.DataSource;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.*;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.UUID;

public final class ApprovalService {
    // trustedTenant and actor come from authenticated server context, not request JSON.
    public static String approve(DataSource ds, long trustedTenant, long actor, long runId,
            long expectedVersion, UUID command) throws SQLException {
        if(ds==null || trustedTenant<=0 || actor<=0 || runId<=0 || expectedVersion<0 || command==null)
            throw new IllegalArgumentException();
        String cmd=command.toString();
        try(Connection c=ds.getConnection()) {
            if(!c.getAutoCommit()) throw new SQLException("fresh auto-commit connection required");
            c.setAutoCommit(false);
            try {
                try(PreparedStatement p=c.prepareStatement("SELECT enabled FROM approval_role WHERE tenant_id=? AND actor_id=? FOR SHARE")) {
                    p.setLong(1,trustedTenant);p.setLong(2,actor);
                    try(ResultSet r=p.executeQuery()){if(!r.next() || !r.getBoolean(1)) throw reject("not authorized");}
                }
                String status,payload,hash; long version; LocalDateTime deadline;
                try(PreparedStatement p=c.prepareStatement("SELECT version,status,deadline_at,approved_payload,payload_hash "
                        + "FROM approval_run WHERE tenant_id=? AND run_id=? FOR UPDATE")) {
                    p.setLong(1,trustedTenant);p.setLong(2,runId);
                    try(ResultSet r=p.executeQuery()) {
                        if(!r.next()) throw reject("run unavailable");
                        version=r.getLong(1);status=r.getString(2);deadline=r.getObject(3,LocalDateTime.class);
                        payload=r.getString(4);hash=r.getString(5);
                    }
                }
                if(!sha256(payload).equals(hash)) throw reject("stored payload hash mismatch");
                try(PreparedStatement p=c.prepareStatement("SELECT run_id,actor_id,expected_version,payload_hash,request_id "
                        + "FROM approval_receipt WHERE tenant_id=? AND command_id=?")) {
                    p.setLong(1,trustedTenant);p.setString(2,cmd);
                    try(ResultSet r=p.executeQuery()) {
                        if(r.next()) {
                            if(r.getLong(1)!=runId || r.getLong(2)!=actor || r.getLong(3)!=expectedVersion || !hash.equals(r.getString(4)))
                                throw reject("command identity conflict");
                            String previous=r.getString(5);commit(c);return previous;
                        }
                    }
                }
                if(!"PENDING".equals(status) || version!=expectedVersion) throw reject("state or version conflict");
                // This query starts after the row lock is acquired. Admission time, not commit deadline.
                LocalDateTime admitted;
                try(Statement s=c.createStatement();ResultSet r=s.executeQuery("SELECT UTC_TIMESTAMP(6)")) {
                    r.next();admitted=r.getObject(1,LocalDateTime.class);
                }
                if(!admitted.isBefore(deadline)) throw reject("approval expired");
                long next=Math.addExact(version,1L);
                String request=UUID.randomUUID().toString();
                try(PreparedStatement p=c.prepareStatement("UPDATE approval_run SET status='APPROVED',version=? "
                        + "WHERE tenant_id=? AND run_id=? AND status='PENDING' AND version=?")) {
                    p.setLong(1,next);p.setLong(2,trustedTenant);p.setLong(3,runId);p.setLong(4,version);
                    if(p.executeUpdate()!=1) throw reject("state transition lost");
                }
                try(PreparedStatement p=c.prepareStatement("INSERT INTO external_intent "
                        + "(tenant_id,business_key,stable_request_id,approved_payload,payload_hash,state) VALUES (?,?,?,?,?,'READY')")) {
                    p.setLong(1,trustedTenant);p.setLong(2,runId);p.setString(3,request);p.setString(4,payload);p.setString(5,hash);p.executeUpdate();
                }
                try(PreparedStatement p=c.prepareStatement("INSERT INTO approval_receipt VALUES (?,?,?,?,?,?,?)")) {
                    p.setLong(1,trustedTenant);p.setString(2,cmd);p.setLong(3,runId);p.setLong(4,actor);
                    p.setLong(5,expectedVersion);p.setString(6,hash);p.setString(7,request);p.executeUpdate();
                }
                try(PreparedStatement p=c.prepareStatement("INSERT INTO approval_audit VALUES (?,?,?,?,?)")) {
                    p.setLong(1,trustedTenant);p.setLong(2,runId);p.setString(3,cmd);p.setLong(4,actor);p.setObject(5,admitted);p.executeUpdate();
                }
                commit(c);return request;
            } catch(SQLException | RuntimeException e) {
                try{c.rollback();}catch(SQLException rollback){if(e!=rollback)e.addSuppressed(rollback);}throw e;
            }
        }
    }
    public static String sha256(String s) {
        try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));}
        catch(NoSuchAlgorithmException e){throw new AssertionError(e);}
    }
    private static SQLException reject(String message){return new SQLException(message,"45000");}
    private static void commit(Connection c)throws SQLException {
        try{c.commit();}catch(SQLException e){throw new SQLException("approval commit UNKNOWN; retry same command", "08007",e);}
    }
    private ApprovalService(){}
}

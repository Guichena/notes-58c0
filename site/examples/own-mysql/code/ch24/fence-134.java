import java.sql.*;
import java.util.*;

/** Same-bucket all-or-none batch reservation; no release, payment or cross-bucket transfer. */
public final class BucketReservations {
    public record Request(String id,long quantity) {
        public Request { Db.key(id); if(quantity<=0) throw new IllegalArgumentException("quantity"); }
    }
    private final Db.Source source;
    public BucketReservations(Db.Source source){this.source=source;}
    static List<Request> normalize(List<Request> input) {
        if(input==null || input.isEmpty() || input.size()>1000) throw new IllegalArgumentException("batch 1..1000");
        Map<String,Request> unique=new TreeMap<>();
        for(Request r:input) {
            Objects.requireNonNull(r);
            Request previous=unique.putIfAbsent(r.id(),r);
            if(previous!=null && previous.quantity()!=r.quantity()) throw new IllegalArgumentException("conflicting duplicate");
        }
        return List.copyOf(unique.values());
    }
    public boolean reserve(int bucket,List<Request> input,boolean failAfterReceipts) throws SQLException {
        if(bucket<=0) throw new IllegalArgumentException("bucket");
        List<Request> requests=normalize(input);
        return Db.transaction(source,c->{
            long available,held;
            try(PreparedStatement p=Db.prepare(c,"SELECT available,held FROM bucket WHERE id=? FOR UPDATE")) {
                p.setInt(1,bucket);
                try(ResultSet r=p.executeQuery()) {
                    if(!r.next()) throw new IllegalArgumentException("missing bucket");
                    available=r.getLong(1);held=r.getLong(2);
                }
            }
            List<Request> fresh=new ArrayList<>();long total=0;
            for(Request request:requests) {
                try(PreparedStatement p=Db.prepare(c,"SELECT bucket_id,qty FROM reservation WHERE request_id=?")) {
                    p.setString(1,request.id());
                    try(ResultSet r=p.executeQuery()) {
                        if(r.next()) {
                            if(r.getInt(1)!=bucket || r.getLong(2)!=request.quantity())
                                throw new IllegalArgumentException("same ID must keep bucket and quantity");
                        } else {total=Math.addExact(total,request.quantity());fresh.add(request);}
                    }
                }
            }
            if(available<total) return false; // No mutations before this point.
            long newHeld=Math.addExact(held,total);
            for(Request request:fresh) {
                try(PreparedStatement p=Db.prepare(c,"INSERT INTO reservation(request_id,bucket_id,qty) VALUES(?,?,?)")) {
                    p.setString(1,request.id());p.setInt(2,bucket);p.setLong(3,request.quantity());p.executeUpdate();
                }
            }
            if(failAfterReceipts) throw new SQLException("injected after receipts");
            try(PreparedStatement p=Db.prepare(c,"UPDATE bucket SET available=?,held=? WHERE id=?")) {
                p.setLong(1,available-total);p.setLong(2,newHeld);p.setInt(3,bucket);
                if(p.executeUpdate()!=1) throw new SQLException("locked bucket missing");
            }
            return true;
        });
    }
    public long[] snapshot(int bucket) throws SQLException {
        try(Connection c=source.open();PreparedStatement p=Db.prepare(c,
                "SELECT available,held,(SELECT COALESCE(SUM(qty),0) FROM reservation WHERE bucket_id=?) FROM bucket WHERE id=?")) {
            p.setInt(1,bucket);p.setInt(2,bucket);
            try(ResultSet r=p.executeQuery()) {
                if(!r.next()) throw new IllegalArgumentException("missing bucket");
                return new long[]{r.getLong(1),r.getLong(2),r.getLong(3)};
            }
        }
    }
}

import java.time.Instant;
import java.util.Set;

public final class AuthDecision {
    // Created ONLY by a trusted, already-validated token/session adapter.
    // This class does not decode JWTs or verify cryptographic signatures.
    public record VerifiedIdentity(String userId, String tenantId,
                                   Instant expiresAt, Set<String> scopes) {
        public VerifiedIdentity { scopes = Set.copyOf(scopes); }
    }
    public record Resource(String tenantId, String ownerId) {}
    public static int status(VerifiedIdentity identity, Instant now,
                             String requiredScope, Resource resource) {
        if (identity == null || !now.isBefore(identity.expiresAt())) return 401;
        if (!identity.scopes().contains(requiredScope)) return 403;
        if (resource != null && (!identity.tenantId().equals(resource.tenantId())
                || !identity.userId().equals(resource.ownerId()))) return 403;
        return 200;
    }
    private static void expect(int expected, int actual) {
        if (expected != actual) throw new AssertionError(expected + " != " + actual);
    }
    public static void main(String[] args) {
        Instant expiry = Instant.ofEpochSecond(1000);
        var identity = new VerifiedIdentity("u1", "t1", expiry, Set.of("edit"));
        var mine = new Resource("t1", "u1");
        expect(401, status(null, expiry.minusSeconds(1), "edit", mine));
        expect(200, status(identity, expiry.minusSeconds(1), "edit", mine));
        expect(401, status(identity, expiry, "edit", mine));
        expect(401, status(identity, expiry.plusSeconds(1), "edit", mine));
        expect(403, status(identity, expiry.minusSeconds(1), "admin", mine));
        expect(403, status(identity, expiry.minusSeconds(1), "edit", new Resource("t2", "u1")));
        expect(403, status(identity, expiry.minusSeconds(1), "edit", new Resource("t1", "u2")));
        expect(200, status(identity, expiry.minusSeconds(1), "edit", null));
        System.out.println("AuthDecision: 8 cases passed; pure authorization logic only, no JWT/Spring integration test.");
    }
}

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.locks.ReentrantLock;

/** Bounded, single-process teaching model. No network, files or database. */
public final class MemoryStoreLesson {
    public enum Origin { USER_EXPLICIT, VERIFIED_TOOL, EXTERNAL, MODEL }
    public enum Status { CANDIDATE, ACTIVE, QUARANTINED, REVOKED, DELETED }

    public record Scope(String tenant, String user, String project) {
        public Scope {
            id(tenant); id(user); id(project);
        }
    }

    /** Construct only from server-verified identity in a real application. */
    public record Auth(Scope scope, String actor, long epoch) {
        public Auth {
            Objects.requireNonNull(scope);
            id(actor);
            if (epoch < 1) throw new IllegalArgumentException("invalid epoch");
        }
    }

    public record Item(String id, long revision, String text, Origin origin,
                       Status status, Instant validUntil, String sourceRef) { }
    public record Ref(Scope scope, String id, long revision) { }
    private record Key(Scope scope, String id) { }
    private record Grant(long epoch, boolean enabled) { }

    public static final class Failure extends RuntimeException {
        private static final long serialVersionUID = 1L;
        public final String code;
        Failure(String code) { super(code); this.code = code; }
    }

    private static final int MAX_ITEMS = 128;
    private static final int MAX_TEXT = 4096;
    private static final int MAX_QUERY_REFS = 128;
    private final ReentrantLock lock = new ReentrantLock();
    private final Map<Scope, Grant> grants = new HashMap<>();
    private final Map<Key, Item> heads = new LinkedHashMap<>();

    /** Trusted administration boundary, not a model-callable tool. */
    public Auth grant(Scope scope) throws InterruptedException {
        Objects.requireNonNull(scope);
        lock.lockInterruptibly();
        try {
            Grant old = grants.get(scope);
            if (old == null && grants.size() >= MAX_ITEMS) fail("CAPACITY");
            long epoch = old == null ? 1 : Math.addExact(old.epoch(), 1);
            grants.put(scope, new Grant(epoch, true));
            return new Auth(scope, scope.user(), epoch);
        } finally {
            lock.unlock();
        }
    }

    public void revokeAccess(Auth auth) throws InterruptedException {
        lock.lockInterruptibly();
        try {
            authorize(auth);
            grants.put(auth.scope(), new Grant(Math.addExact(auth.epoch(), 1), false));
        } finally {
            lock.unlock();
        }
    }

    public Item propose(Auth auth, String memoryId, String text, Origin origin,
                        Instant validUntil, String sourceRef) throws InterruptedException {
        id(memoryId); validateText(text); Objects.requireNonNull(origin);
        validateSource(sourceRef);
        lock.lockInterruptibly();
        try {
            authorize(auth);
            Key key = new Key(auth.scope(), memoryId);
            if (heads.containsKey(key)) fail("ALREADY_EXISTS");
            if (heads.size() >= MAX_ITEMS) fail("CAPACITY");
            Item item = new Item(memoryId, 1, text, origin, Status.CANDIDATE,
                    validUntil, sourceRef);
            heads.put(key, item);
            return item;
        } finally {
            lock.unlock();
        }
    }

    public Item approve(Auth auth, String memoryId, long expected) throws InterruptedException {
        lock.lockInterruptibly();
        try {
            Item old = checked(auth, memoryId, expected);
            if (old.status() != Status.CANDIDATE) fail("INVALID_TRANSITION");
            if (old.origin() != Origin.USER_EXPLICIT && old.origin() != Origin.VERIFIED_TOOL) {
                fail("REVIEW_REQUIRED");
            }
            return save(auth.scope(), old, old.text(), Status.ACTIVE, old.origin());
        } finally {
            lock.unlock();
        }
    }

    public Item revise(Auth auth, String memoryId, long expected, String text,
                       Origin origin, String sourceRef) throws InterruptedException {
        validateText(text); Objects.requireNonNull(origin); validateSource(sourceRef);
        lock.lockInterruptibly();
        try {
            Item old = checked(auth, memoryId, expected);
            if (old.status() == Status.DELETED || old.status() == Status.REVOKED) {
                fail("INVALID_TRANSITION");
            }
            // New evidence is explicit. This small model stores no revision history.
            Item next = new Item(old.id(), Math.addExact(old.revision(), 1), text,
                    origin, Status.CANDIDATE, old.validUntil(), sourceRef);
            heads.put(new Key(auth.scope(), memoryId), next);
            return next;
        } finally {
            lock.unlock();
        }
    }

    public Item retire(Auth auth, String memoryId, long expected, Status status)
            throws InterruptedException {
        if (status != Status.QUARANTINED && status != Status.REVOKED && status != Status.DELETED) {
            throw new IllegalArgumentException("not a retirement state");
        }
        lock.lockInterruptibly();
        try {
            Item old = checked(auth, memoryId, expected);
            if (old.status() == Status.DELETED
                    || (old.status() == Status.REVOKED && status != Status.DELETED)) {
                fail("INVALID_TRANSITION");
            }
            // Tombstone keeps the revision but removes text and source payload.
            Item item = new Item(old.id(), Math.addExact(old.revision(), 1),
                    status == Status.DELETED ? "" : old.text(), old.origin(), status,
                    old.validUntil(), status == Status.DELETED ? "" : old.sourceRef());
            heads.put(new Key(auth.scope(), memoryId), item);
            return item;
        } finally {
            lock.unlock();
        }
    }

    /** Index/cache returns references only. Every use rechecks current authority and head. */
    public List<Item> resolve(Auth auth, List<Ref> refs, Instant now)
            throws InterruptedException {
        Objects.requireNonNull(refs); Objects.requireNonNull(now);
        List<Ref> stable = List.copyOf(refs);
        if (stable.size() > MAX_QUERY_REFS) fail("CAPACITY");
        lock.lockInterruptibly();
        try {
            authorize(auth);
            Map<String, Item> result = new LinkedHashMap<>();
            for (Ref ref : stable) {
                if (!auth.scope().equals(ref.scope())) fail("SCOPE_DENIED");
                Item current = heads.get(new Key(auth.scope(), ref.id()));
                if (current == null || current.revision() != ref.revision()
                        || current.status() != Status.ACTIVE) continue;
                if (current.validUntil() != null && !now.isBefore(current.validUntil())) continue;
                result.putIfAbsent(current.id(), current);
            }
            return List.copyOf(result.values());
        } finally {
            lock.unlock();
        }
    }

    /** Administrative view, still scope-authorized; no hidden global lookup. */
    public Item inspect(Auth auth, String memoryId) throws InterruptedException {
        id(memoryId);
        lock.lockInterruptibly();
        try {
            authorize(auth);
            Item item = heads.get(new Key(auth.scope(), memoryId));
            if (item == null) fail("NOT_FOUND");
            return item;
        } finally {
            lock.unlock();
        }
    }

    public List<Ref> indexSnapshot(Auth auth) throws InterruptedException {
        lock.lockInterruptibly();
        try {
            authorize(auth);
            List<Ref> refs = new ArrayList<>();
            heads.forEach((key, item) -> {
                if (key.scope().equals(auth.scope()) && item.status() == Status.ACTIVE) {
                    refs.add(new Ref(key.scope(), key.id(), item.revision()));
                }
            });
            return List.copyOf(refs);
        } finally {
            lock.unlock();
        }
    }

    private Item checked(Auth auth, String memoryId, long expected) {
        id(memoryId);
        if (expected < 1) throw new IllegalArgumentException("invalid revision");
        authorize(auth);
        Item old = heads.get(new Key(auth.scope(), memoryId));
        if (old == null) fail("NOT_FOUND");
        if (old.revision() != expected) fail("CONFLICT");
        return old;
    }

    private Item save(Scope scope, Item old, String text, Status status, Origin origin) {
        Item item = new Item(old.id(), Math.addExact(old.revision(), 1), text,
                origin, status, old.validUntil(), old.sourceRef());
        heads.put(new Key(scope, old.id()), item);
        return item;
    }

    private void authorize(Auth auth) {
        Objects.requireNonNull(auth);
        Grant grant = grants.get(auth.scope());
        if (!auth.actor().equals(auth.scope().user()) || grant == null
                || !grant.enabled() || grant.epoch() != auth.epoch()) fail("ACCESS_DENIED");
    }

    private static void id(String value) {
        if (value == null || !value.matches("[A-Za-z0-9_-]{1,64}")) {
            throw new IllegalArgumentException("invalid identifier");
        }
    }

    private static void validateSource(String value) {
        if (value == null || !value.matches("event:[A-Za-z0-9_-]{1,64}")) {
            throw new IllegalArgumentException("invalid source reference");
        }
    }

    private static void validateText(String value) {
        if (value == null || value.isBlank() || value.length() > MAX_TEXT) {
            throw new IllegalArgumentException("invalid text length");
        }
        for (int i = 0; i < value.length(); i++) {
            char ch = value.charAt(i);
            if (Character.isHighSurrogate(ch)) {
                if (++i >= value.length() || !Character.isLowSurrogate(value.charAt(i))) {
                    throw new IllegalArgumentException("invalid Unicode");
                }
            } else if (Character.isLowSurrogate(ch)
                    || (Character.isISOControl(ch) && ch != '\n' && ch != '\t')) {
                throw new IllegalArgumentException("invalid character");
            }
        }
    }

    private static void fail(String code) { throw new Failure(code); }
}

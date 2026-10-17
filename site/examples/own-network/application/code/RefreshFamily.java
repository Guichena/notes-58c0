import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;

/** Local transition model only. Token objects are NOT serialized credentials. */
public final class RefreshFamily {
    public enum Status { ROTATED, REUSED, REVOKED, EXPIRED, INVALID, LIMIT }
    public static final class Token {
        private final RefreshFamily owner;
        private final int generation;
        private Token(RefreshFamily owner, int generation) {
            this.owner = owner; this.generation = generation;
        }
    }
    public record Result(Status status, Token next) {}
    private final long expiresAt;
    private final int maxRotations;
    private Token current = new Token(this, 0);
    private boolean revoked;
    public RefreshFamily(long expiresAt, int maxRotations) {
        if (expiresAt <= 0 || maxRotations < 1 || maxRotations > 1024)
            throw new IllegalArgumentException();
        this.expiresAt = expiresAt; this.maxRotations = maxRotations;
    }
    public synchronized Token initial() {
        if (current.generation != 0 || revoked) throw new IllegalStateException();
        return current;
    }
    public synchronized Result rotate(Token token, long now) {
        if (now < 0) throw new IllegalArgumentException();
        if (token == null || token.owner != this) return new Result(Status.INVALID, null);
        if (revoked) return new Result(Status.REVOKED, null);
        if (now >= expiresAt) { revoked = true; return new Result(Status.EXPIRED, null); }
        if (token != current) { revoked = true; return new Result(Status.REUSED, null); }
        if (current.generation >= maxRotations) {
            revoked = true; return new Result(Status.LIMIT, null);
        }
        current = new Token(this, current.generation + 1);
        return new Result(Status.ROTATED, current);
    }
    public synchronized void revoke() { revoked = true; }
    private static int checks;
    private static void check(boolean ok) { if (!ok) throw new AssertionError(); checks++; }
    public static void main(String[] args) throws Exception {
        RefreshFamily f = new RefreshFamily(100, 8);
        Token first = f.initial();
        check(f.rotate(null, 0).status == Status.INVALID);
        check(f.rotate(new RefreshFamily(100, 1).initial(), 0).status == Status.INVALID);
        Result second = f.rotate(first, 1); check(second.status == Status.ROTATED);
        Result third = f.rotate(second.next, 2); check(third.status == Status.ROTATED);
        check(f.rotate(first, 3).status == Status.REUSED);
        check(f.rotate(third.next, 4).status == Status.REVOKED);
        f = new RefreshFamily(10, 2); first = f.initial();
        second = f.rotate(first, 9); check(second.status == Status.ROTATED);
        check(f.rotate(second.next, 10).status == Status.EXPIRED);
        f = new RefreshFamily(100, 1); first = f.initial();
        second = f.rotate(first, 1); check(second.status == Status.ROTATED);
        check(f.rotate(second.next, 2).status == Status.LIMIT);
        f = new RefreshFamily(100, 2); first = f.initial(); f.revoke(); f.revoke();
        check(f.rotate(first, 0).status == Status.REVOKED);
        try { new RefreshFamily(0, 1); throw new AssertionError(); }
        catch (IllegalArgumentException expected) { checks++; }
        try { new RefreshFamily(1, 1025); throw new AssertionError(); }
        catch (IllegalArgumentException expected) { checks++; }
        f = new RefreshFamily(100, 1024); Token token = f.initial();
        for (int i = 0; i < 1024; i++) {
            Result r = f.rotate(token, 0); check(r.status == Status.ROTATED); token = r.next;
        }
        check(f.rotate(token, 0).status == Status.LIMIT);
        ExecutorService pool = Executors.newFixedThreadPool(8);
        try {
            for (int round = 0; round < 200; round++) {
                RefreshFamily family = new RefreshFamily(100, 8);
                Token shared = family.initial(); CountDownLatch start = new CountDownLatch(1);
                List<Future<Result>> futures = new ArrayList<>();
                for (int i = 0; i < 8; i++) futures.add(pool.submit(() -> {
                    if (!start.await(5, TimeUnit.SECONDS)) throw new AssertionError();
                    return family.rotate(shared, 1);
                }));
                start.countDown(); int rotated = 0, reused = 0, revokedCount = 0;
                Token winner = null;
                for (Future<Result> future : futures) {
                    Result r = future.get(5, TimeUnit.SECONDS);
                    if (r.status == Status.ROTATED) { rotated++; winner = r.next; }
                    else if (r.status == Status.REUSED) reused++;
                    else if (r.status == Status.REVOKED) revokedCount++;
                    else throw new AssertionError();
                }
                check(rotated == 1); check(reused == 1); check(revokedCount == 6);
                check(family.rotate(winner, 2).status == Status.REVOKED);
            }
        } finally {
            pool.shutdownNow(); if (!pool.awaitTermination(5, TimeUnit.SECONDS)) throw new AssertionError();
        }
        System.out.println("PASS " + checks + " local family transition checks; no OAuth service or credentials");
    }
}

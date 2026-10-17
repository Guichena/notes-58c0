import java.util.*;

/** Deterministic local state model, not a database or broker implementation. */
public final class OutboxModel {
    enum State { READY, PROCESSING, SENT }
    record Event(String id, long amount) {}
    record Claim(Event event, long token) {}
    static final class Row {
        final Event event;
        State state = State.READY;
        long token, until;
        Row(Event event) { this.event = event; }
    }
    static final class Store {
        final Map<String, Row> outbox = new HashMap<>();
        final Set<String> orders = new HashSet<>();
        synchronized void accept(Event e, boolean failBeforeCommit) {
            if (orders.contains(e.id())) {
                if (!outbox.get(e.id()).event.equals(e)) throw new IllegalStateException("identity conflict");
                return;
            }
            if (e.amount() <= 0) throw new IllegalArgumentException();
            if (failBeforeCommit) throw new IllegalStateException("transaction rolled back");
            // One synchronized model transition stands in for one DB transaction.
            orders.add(e.id()); outbox.put(e.id(), new Row(e));
        }
        synchronized Claim claim(String id, long now, long lease) {
            if (lease <= 0) throw new IllegalArgumentException("lease");
            long expires = Math.addExact(now, lease);
            Row r = outbox.get(id);
            if (r == null || r.state == State.SENT
                    || (r.state == State.PROCESSING && now < r.until)) return null;
            r.state = State.PROCESSING;
            r.token = Math.incrementExact(r.token);
            r.until = expires;
            return new Claim(r.event, r.token);
        }
        synchronized boolean sent(Claim claim) {
            Row r = outbox.get(claim.event().id());
            if (r.state != State.PROCESSING || r.token != claim.token()) return false;
            r.state = State.SENT; return true;
        }
    }
    static final class Receiver {
        final Map<String, Long> inbox = new HashMap<>();
        long balance = 100;
        synchronized boolean apply(Event e) {
            Long old = inbox.get(e.id());
            if (old != null) {
                if (old != e.amount()) throw new IllegalStateException("identity conflict");
                return false;
            }
            if (balance < e.amount()) throw new IllegalStateException("insufficient balance");
            balance -= e.amount(); inbox.put(e.id(), e.amount()); return true;
        }
    }
    static void require(boolean ok) { if (!ok) throw new AssertionError(); }
    public static void main(String[] args) {
        Store store = new Store(); Receiver receiver = new Receiver();
        Event e = new Event("event-1", 7);
        try { store.accept(e, true); throw new AssertionError(); }
        catch (IllegalStateException expected) { require(store.orders.isEmpty() && store.outbox.isEmpty()); }
        store.accept(e, false);
        Claim a = store.claim(e.id(), 0, 10);
        require(receiver.apply(a.event())); // Publish succeeded; SENT update is lost.
        require(store.claim(e.id(), 9, 10) == null);
        Claim b = store.claim(e.id(), 10, 10); // Expired claim is recovered.
        require(!store.sent(a)); // Old owner cannot overwrite the new claim.
        require(!receiver.apply(b.event())); // Repeated delivery, one local effect.
        require(store.sent(b));
        require(receiver.balance == 93 && receiver.inbox.size() == 1);
        require(store.claim(e.id(), 100, 10) == null);
        System.out.println("OutboxModel OK");
    }
}

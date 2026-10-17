import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;

/** In-memory bounded replay, not durable storage or a concurrent subscriber service. */
public final class ReplayWindow {
    record Event(long id, String data) {
        Event { if (id <= 0 || data == null || data.length() > 256) throw new IllegalArgumentException("event"); }
    }
    private final int capacity;
    private final ArrayDeque<Event> events = new ArrayDeque<>();
    private long last;
    public ReplayWindow(int capacity) {
        if (capacity < 1 || capacity > 1024) throw new IllegalArgumentException("capacity");
        this.capacity = capacity;
    }
    public synchronized Event append(String data) {
        if (data == null || data.length() > 256) throw new IllegalArgumentException("data");
        if (last == Long.MAX_VALUE) throw new IllegalStateException("sequence exhausted");
        Event e = new Event(++last, data); events.addLast(e);
        if (events.size() > capacity) events.removeFirst();
        return e;
    }
    public synchronized List<Event> after(long cursor) {
        if (cursor < 0 || cursor > last) throw new IllegalArgumentException("invalid cursor");
        if (!events.isEmpty() && cursor < events.getFirst().id() - 1)
            throw new IllegalStateException("snapshot required");
        List<Event> result = new ArrayList<>();
        for (Event e : events) if (e.id() > cursor) result.add(e);
        return List.copyOf(result);
    }
    static final class Reducer {
        long last; final StringBuilder text = new StringBuilder();
        boolean apply(Event e) {
            if (e.id() <= last) return false;
            if (last == Long.MAX_VALUE || e.id() != last + 1) throw new IllegalStateException("gap");
            if (text.length() + e.data().length() > 8192) throw new IllegalStateException("view limit");
            text.append(e.data()); last = e.id(); return true;
        }
    }
    static int checks;
    static void check(boolean b) { if (!b) throw new AssertionError(); checks++; }
    static void bad(Runnable r, Class<? extends RuntimeException> type) {
        try { r.run(); throw new AssertionError("expected failure"); }
        catch (RuntimeException e) { if (!type.isInstance(e)) throw e; checks++; }
    }
    public static void main(String[] args) {
        for (int cut = 0; cut <= 20; cut++) {
            ReplayWindow log = new ReplayWindow(20); Reducer ui = new Reducer();
            StringBuilder expected = new StringBuilder();
            for (int i = 0; i < 20; i++) { Event e = log.append("甲" + i + "🙂"); expected.append(e.data()); if (i < cut) check(ui.apply(e)); }
            // Replay includes an optional duplicate of the last applied event.
            long cursor = Math.max(0, cut - 1);
            for (Event e : log.after(cursor)) ui.apply(e);
            check(ui.text.toString().equals(expected.toString())); check(ui.last == 20);
            check(log.after(20).isEmpty());
        }
        ReplayWindow shortLog = new ReplayWindow(2); shortLog.append("a"); shortLog.append("b"); shortLog.append("c");
        bad(() -> shortLog.after(0), IllegalStateException.class);
        check(shortLog.after(1).equals(List.of(new Event(2,"b"), new Event(3,"c"))));
        bad(() -> shortLog.after(-1), IllegalArgumentException.class); bad(() -> shortLog.after(4), IllegalArgumentException.class);
        bad(() -> shortLog.append("x".repeat(257)), IllegalArgumentException.class);
        bad(() -> new ReplayWindow(0), IllegalArgumentException.class);
        Reducer gap = new Reducer(); bad(() -> gap.apply(new Event(2,"b")), IllegalStateException.class);
        check(gap.apply(new Event(1,"a"))); check(!gap.apply(new Event(1,"a")));
        check(gap.text.toString().equals("a"));
        Reducer large = new Reducer(); for(int i=1;i<=32;i++) large.apply(new Event(i,"x".repeat(256)));
        bad(() -> large.apply(new Event(33,"x")), IllegalStateException.class);
        bad(() -> new Event(0,"x"), IllegalArgumentException.class);
        bad(() -> new Event(1,null), IllegalArgumentException.class);
        bad(() -> new Event(1,"x".repeat(257)), IllegalArgumentException.class);
        bad(() -> new ReplayWindow(1025), IllegalArgumentException.class);
        ReplayWindow exhausted = new ReplayWindow(1); exhausted.last = Long.MAX_VALUE;
        bad(() -> exhausted.append("x"), IllegalStateException.class);
        System.out.println("PASS " + checks + "; bounded replay/reducer only");
    }
}

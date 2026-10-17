import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

/** Bounded local permit/feedback core, not an HTTP client or production controller. */
public final class AdaptiveLimit {
    public enum Signal { HEALTHY, OVERLOADED, NEUTRAL }
    public static final class Permit {
        private final AdaptiveLimit owner;
        private final long epoch;
        private boolean ended;
        private Permit(AdaptiveLimit owner, long epoch) { this.owner = owner; this.epoch = epoch; }
    }
    private final int min, max, minSamples;
    private final long interval;
    private int limit, inFlight, samples;
    private boolean overloaded, saturated;
    private long epoch, lastUpdate, lastObserved;
    public AdaptiveLimit(int min, int initial, int max, int minSamples, long interval) {
        if (min < 1 || min > initial || initial > max || max > 100_000 ||
                minSamples < 1 || minSamples > 100_000 || interval < 1)
            throw new IllegalArgumentException();
        this.min = min; this.limit = initial; this.max = max;
        this.minSamples = minSamples; this.interval = interval;
    }
    public synchronized Permit tryAcquire() {
        if (inFlight >= limit) { saturated = true; return null; }
        inFlight++; saturated |= inFlight >= limit;
        return new Permit(this, epoch);
    }
    /** Invoke only when this attempt has actually released its tracked resource. */
    public synchronized boolean finish(Permit p, Signal signal) {
        if (p == null || p.owner != this || signal == null) throw new IllegalArgumentException();
        if (p.ended) return false;
        p.ended = true; inFlight--;
        if (p.epoch == epoch && signal != Signal.NEUTRAL) {
            if (samples < Integer.MAX_VALUE) samples++;
            overloaded |= signal == Signal.OVERLOADED;
        }
        return true;
    }
    /** Relative monotonic nanoseconds. The caller supplies the sampling clock. */
    public synchronized int update(long now) {
        if (now < lastObserved || now < 0) throw new IllegalArgumentException();
        lastObserved = now;
        if (now - lastUpdate < interval || samples < minSamples) return limit;
        if (epoch == Long.MAX_VALUE) throw new IllegalStateException("epoch exhausted");
        if (overloaded) limit = Math.max(min, limit / 2);
        else if (saturated && limit < max) limit++;
        epoch++; lastUpdate = now; samples = 0; overloaded = false;
        saturated = inFlight >= limit;
        return limit;
    }
    public synchronized int limit() { return limit; }
    public synchronized int inFlight() { return inFlight; }
    private static int checks;
    private static void check(boolean ok) { if (!ok) throw new AssertionError(); checks++; }
    private static List<Permit> fill(AdaptiveLimit c) {
        List<Permit> ps = new ArrayList<>(); Permit p;
        while ((p = c.tryAcquire()) != null) ps.add(p);
        return ps;
    }
    public static void main(String[] args) throws Exception {
        AdaptiveLimit c = new AdaptiveLimit(1, 4, 8, 1, 100);
        List<Permit> ps = fill(c); check(ps.size() == 4); check(c.inFlight() == 4);
        check(c.update(100) == 4); // no completion: no growth
        check(c.finish(ps.get(0), Signal.OVERLOADED));
        check(!c.finish(ps.get(0), Signal.HEALTHY));
        check(c.limit() == 4); check(c.update(100) == 2);
        check(c.inFlight() == 3); check(c.tryAcquire() == null);
        for (int i = 1; i < ps.size(); i++) check(c.finish(ps.get(i), Signal.HEALTHY));
        check(c.inFlight() == 0); check(c.update(200) == 2); // old epoch successes ignored
        for (int round = 0; round < 10; round++) {
            ps = fill(c); for (Permit p : ps) c.finish(p, Signal.HEALTHY);
            int before = c.limit(); check(c.update(300 + round * 100L) == Math.min(8, before + 1));
        }
        for (int round = 0; round < 10; round++) {
            ps = fill(c); for (Permit p : ps) c.finish(p, Signal.OVERLOADED);
            int before = c.limit(); check(c.update(1400 + round * 100L) == Math.max(1, before / 2));
        }
        c = new AdaptiveLimit(1, 4, 8, 2, 100);
        Permit p = c.tryAcquire(); c.finish(p, Signal.HEALTHY);
        check(c.update(100) == 4); // insufficient samples
        p = c.tryAcquire(); c.finish(p, Signal.HEALTHY); check(c.update(100) == 4); // app limited
        try { c.update(99); throw new AssertionError(); }
        catch (IllegalArgumentException expected) { checks++; }
        p = c.tryAcquire(); c.finish(p, Signal.NEUTRAL); check(c.update(200) == 4);
        try { c.finish(new AdaptiveLimit(1, 1, 1, 1, 1).tryAcquire(), Signal.HEALTHY); throw new AssertionError(); }
        catch (IllegalArgumentException expected) { checks++; }
        try { new AdaptiveLimit(0, 1, 2, 1, 1); throw new AssertionError(); }
        catch (IllegalArgumentException expected) { checks++; }
        AdaptiveLimit shared = new AdaptiveLimit(1, 7, 7, 4, 100);
        AtomicInteger active = new AtomicInteger(), peak = new AtomicInteger(), finished = new AtomicInteger();
        ExecutorService pool = Executors.newFixedThreadPool(16);
        try {
            List<Future<?>> fs = new ArrayList<>();
            for (int t = 0; t < 16; t++) fs.add(pool.submit(() -> {
                for (int n = 0; n < 2000; n++) {
                    Permit permit = shared.tryAcquire();
                    if (permit == null) { Thread.yield(); continue; }
                    int a = active.incrementAndGet(); peak.accumulateAndGet(a, Math::max);
                    if (a > 7) throw new AssertionError("capacity exceeded");
                    try { Thread.yield(); } finally {
                        active.decrementAndGet();
                        if (!shared.finish(permit, Signal.HEALTHY)) throw new AssertionError();
                        if (shared.finish(permit, Signal.HEALTHY)) throw new AssertionError();
                        finished.incrementAndGet();
                    }
                }
            }));
            for (Future<?> f : fs) f.get(10, TimeUnit.SECONDS);
        } finally {
            pool.shutdownNow(); if (!pool.awaitTermination(5, TimeUnit.SECONDS)) throw new AssertionError();
        }
        check(peak.get() >= 1 && peak.get() <= 7); check(finished.get() > 0);
        check(shared.inFlight() == 0); check(active.get() == 0);
        System.out.println("PASS " + checks + " deterministic assertions; " + finished.get() +
                " real concurrent permit lifecycles, peak=" + peak.get() + "; no downstream requests");
    }
}


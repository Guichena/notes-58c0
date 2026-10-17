import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

/** Pure in-memory protocol model. No JDBC, broker, network, disk or real provider. */
public final class ReliableDeliveryProtocol {
    enum State { READY, CREATING, OPEN, UNKNOWN, MANUAL }
    enum Result { ACCEPTED, REJECTED_NO_EFFECT, RETRYABLE_NO_EFFECT, PENDING, NOT_FOUND, UNKNOWN }
    record Key(long tenant, String businessKey) {}
    record RequestKey(long tenant, String requestId) {}
    record EventKey(long tenant, String eventId) {}
    record StableRequest(long tenant, String businessKey, String requestId,
                         String canonicalPayload, String payloadHash) {
        StableRequest {
            if (tenant <= 0 || blank(businessKey) || blank(requestId) ||
                blank(canonicalPayload) || !sha(canonicalPayload).equals(payloadHash))
                throw new IllegalArgumentException("invalid stable request");
        }
        Key key() { return new Key(tenant, businessKey); }
        RequestKey requestKey() { return new RequestKey(tenant, requestId); }
    }
    record Event(long tenant, String eventId, StableRequest request) {
        Event {
            if (blank(eventId) || tenant != request.tenant())
                throw new IllegalArgumentException("event identity");
        }
        EventKey key() { return new EventKey(tenant, eventId); }
    }
    record Ticket(Key key, long epoch) {}
    record View(StableRequest request, State state, long epoch, long leaseUntil,
                boolean reservationHeld, int sends, int queries, Result evidence) {}
    record Capability(boolean queryable, boolean atomicSameKeyReplay, long replayUntil) {}
    interface Channel {
        Capability capability();
        Result send(StableRequest request);
        Result query(StableRequest request);
    }
    /** Each method is one atomic storage contract, not an SQL implementation. */
    interface Ledger {
        void prepare(StableRequest request);
        Optional<Ticket> claim(Key key, long now, long lease);
        View view(Key key);
        boolean begin(Ticket ticket, long now, boolean authorizedSameKeyReplay);
        boolean resolve(Ticket ticket, long now, Result result);
        boolean queried(Ticket ticket, long now);
        boolean manual(Ticket ticket, long now);
    }
    static final class MemoryLedger implements Ledger {
        static final class Row {
            final StableRequest request;
            State state = State.READY;
            long epoch, leaseUntil;
            boolean held = true;
            int sends, queries;
            Result evidence;
            Row(StableRequest r) { request = r; }
        }
        final Map<Key,Row> rows = new HashMap<>();
        final Map<RequestKey,Key> requestIds = new HashMap<>();
        public synchronized void prepare(StableRequest r) {
            Row old = rows.get(r.key());
            if (old != null) {
                if (!old.request.equals(r)) throw new IllegalArgumentException("payload/id conflict");
                return;
            }
            Key bound = requestIds.get(r.requestKey());
            if (bound != null && !bound.equals(r.key()))
                throw new IllegalArgumentException("request id reused for another business action");
            rows.put(r.key(), new Row(r)); requestIds.put(r.requestKey(), r.key());
        }
        public synchronized Optional<Ticket> claim(Key k, long now, long lease) {
            if (now < 0 || lease <= 0) throw new IllegalArgumentException();
            Row r = required(k);
            if (r.state == State.OPEN || r.state == State.MANUAL || r.leaseUntil > now)
                return Optional.empty();
            long end = Math.addExact(now, lease);
            long epoch = Math.incrementExact(r.epoch);
            // Lease expiry never proves the previous external call stopped.
            if (r.state == State.CREATING) r.state = State.UNKNOWN;
            r.epoch = epoch; r.leaseUntil = end;
            return Optional.of(new Ticket(k, epoch));
        }
        public synchronized View view(Key k) {
            Row r=required(k);
            return new View(r.request,r.state,r.epoch,r.leaseUntil,r.held,r.sends,r.queries,r.evidence);
        }
        private Row required(Key k) {
            Row r=rows.get(k); if(r==null) throw new IllegalArgumentException("unknown action"); return r;
        }
        private boolean current(Row r, Ticket t, long now) {
            return r.epoch == t.epoch() && r.leaseUntil > now;
        }
        public synchronized boolean begin(Ticket t,long now,boolean replay) {
            Row r=required(t.key());
            if (!current(r,t,now) || !(r.state==State.READY || (replay && r.state==State.UNKNOWN)))
                return false;
            r.sends=Math.incrementExact(r.sends); r.state=State.CREATING; return true;
        }
        public synchronized boolean resolve(Ticket t,long now,Result result) {
            Row r=required(t.key());
            if (!current(r,t,now) || !(r.state==State.CREATING || r.state==State.UNKNOWN)) return false;
            r.evidence=Objects.requireNonNull(result);
            switch(result) {
                case ACCEPTED -> { r.state=State.OPEN; r.held=false; }
                case REJECTED_NO_EFFECT -> { r.state=State.MANUAL; r.held=false; }
                case RETRYABLE_NO_EFFECT -> r.state=State.READY;
                case PENDING,NOT_FOUND,UNKNOWN -> r.state=State.UNKNOWN;
            }
            return true;
        }
        public synchronized boolean queried(Ticket t,long now) {
            Row r=required(t.key());
            if(!current(r,t,now) || r.state!=State.UNKNOWN) return false;
            r.queries=Math.incrementExact(r.queries); return true;
        }
        public synchronized boolean manual(Ticket t,long now) {
            Row r=required(t.key());
            if(!current(r,t,now) || r.state==State.OPEN || r.state==State.MANUAL) return false;
            r.state=State.MANUAL; return true; // UNKNOWN keeps its reservation and evidence.
        }
    }
    static final class Driver {
        final Ledger ledger; final Channel channel;
        final int maxSends, maxQueries; final long deadline;
        Driver(Ledger l,Channel c,int s,int q,long d) {
            if(s<1||q<0||d<0) throw new IllegalArgumentException();
            ledger=l;channel=c;maxSends=s;maxQueries=q;deadline=d;
        }
        boolean send(Ticket t,long now,boolean sameKeyReplay) {
            View v=ledger.view(t.key()); Capability c=channel.capability();
            if(now>=deadline || v.sends()>=maxSends) {ledger.manual(t,now);return false;}
            if(sameKeyReplay && (!c.atomicSameKeyReplay() || now>=c.replayUntil())) return false;
            if(!ledger.begin(t,now,sameKeyReplay)) return false;
            Result result;
            try { result=Objects.requireNonNull(channel.send(v.request())); }
            catch(RuntimeException e) { result=Result.UNKNOWN; }
            ledger.resolve(t,now,result); return true;
        }
        void reconcile(Ticket t,long now) {
            View v=ledger.view(t.key()); if(v.state()!=State.UNKNOWN) return;
            if(!channel.capability().queryable() || v.queries()>=maxQueries) {
                ledger.manual(t,now); return;
            }
            if(!ledger.queried(t,now)) return;
            Result result;
            try {result=Objects.requireNonNull(channel.query(v.request()));}
            catch(RuntimeException e) {result=Result.UNKNOWN;}
            ledger.resolve(t,now,result);
        }
    }
    /** A scripted destination. Effects and HTTP-like attempts are counted separately. */
    static final class MockChannel implements Channel {
        final Capability cap;
        final Map<RequestKey,String> effects = new HashMap<>();
        int calls, effectCount, queries;
        boolean execute=true, loseReply=false;
        Result nextSend=Result.ACCEPTED, queryOverride;
        MockChannel(Capability c){cap=c;}
        public Capability capability(){return cap;}
        public Result send(StableRequest r) {
            calls++;
            if(execute && nextSend==Result.ACCEPTED) {
                String old=effects.get(r.requestKey());
                if(old!=null && !old.equals(r.payloadHash())) throw new IllegalArgumentException("remote conflict");
                if(!cap.atomicSameKeyReplay() || old==null) effectCount++;
                effects.put(r.requestKey(),r.payloadHash());
            }
            return loseReply?Result.UNKNOWN:nextSend;
        }
        public Result query(StableRequest r) {
            if(!cap.queryable()) throw new IllegalStateException("no query API");
            queries++;
            return queryOverride!=null?queryOverride:
                   effects.containsKey(r.requestKey())?Result.ACCEPTED:Result.NOT_FOUND;
        }
    }
    /** Models atomic event acceptance, outbox, and durable responsibility transfer only. */
    static final class Pipeline {
        final Ledger ledger;
        final Map<EventKey,Event> outbox=new LinkedHashMap<>();
        final Set<EventKey> published=new HashSet<>(), handedOff=new HashSet<>();
        final List<Event> brokerCopies=new ArrayList<>();
        final Set<Integer> ackedCopies=new HashSet<>();
        Pipeline(Ledger l){ledger=l;}
        synchronized void accept(Event e) {
            Event old=outbox.get(e.key());
            if(old!=null && !old.equals(e)) throw new IllegalArgumentException("event id conflict");
            ledger.prepare(e.request()); outbox.putIfAbsent(e.key(),e);
        }
        void publish(EventKey k,boolean loseConfirmOrCrashBeforeMark) {
            if(published.contains(k))return;
            brokerCopies.add(Objects.requireNonNull(outbox.get(k)));
            if(!loseConfirmOrCrashBeforeMark)published.add(k);
        }
        void consume(int index,boolean loseAck) {
            Event e=brokerCopies.get(index);
            // In production the inbox + action reference must commit atomically.
            ledger.prepare(e.request()); handedOff.add(e.key());
            if(!loseAck)ackedCopies.add(index);
        }
    }
    static String sha(String s) {
        try {return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(s.getBytes(StandardCharsets.UTF_8)));}
        catch(Exception e){throw new IllegalStateException(e);}
    }
    static boolean blank(String s){return s==null||s.isBlank();}
    static StableRequest request(String key){String payload="recipient=demo;template=1;amount=10";
        return new StableRequest(1,key,"request-"+key,payload,sha(payload));}
    static Ticket claim(Ledger l,StableRequest r,long now){return l.claim(r.key(),now,10).orElseThrow();}
    static void check(boolean x,String why){if(!x)throw new AssertionError(why);}
    static void conflict(Runnable r){try{r.run();throw new AssertionError("conflict missing");}
        catch(IllegalArgumentException expected){}}
    public static void main(String[] args) {
        MemoryLedger l=new MemoryLedger(); StableRequest r=request("outbox");
        Pipeline p=new Pipeline(l); Event e=new Event(1,"event-1",r);
        p.accept(e);p.accept(e);p.publish(e.key(),true);p.publish(e.key(),false);
        p.consume(0,true);p.consume(0,false);p.consume(1,false);
        check(p.outbox.size()==1&&p.brokerCopies.size()==2&&p.ackedCopies.size()==2,"outbox/ack");
        MockChannel c=new MockChannel(new Capability(true,true,100));
        Driver d=new Driver(l,c,3,3,100);Ticket t=claim(l,r,0);d.send(t,0,false);
        check(c.effectCount==1&&l.view(r.key()).state()==State.OPEN,"one effect");
        check(!d.send(t,1,false),"terminal cannot resend");
        final MemoryLedger firstLedger=l; final StableRequest firstRequest=r;
        conflict(()->firstLedger.prepare(new StableRequest(1,firstRequest.businessKey(),firstRequest.requestId(),"changed",sha("changed"))));
        conflict(()->firstLedger.prepare(new StableRequest(1,"other",firstRequest.requestId(),firstRequest.canonicalPayload(),firstRequest.payloadHash())));

        l=new MemoryLedger();r=request("lost-response");l.prepare(r);
        c=new MockChannel(new Capability(true,true,100));c.loseReply=true;
        d=new Driver(l,c,3,3,100);t=claim(l,r,0);d.send(t,0,false);
        check(l.view(r.key()).state()==State.UNKNOWN&&l.view(r.key()).reservationHeld(),"unknown held");
        d.reconcile(t,1);check(c.calls==1&&c.effectCount==1&&l.view(r.key()).state()==State.OPEN,"query repairs");

        l=new MemoryLedger();r=request("missing");l.prepare(r);
        c=new MockChannel(new Capability(true,true,100));c.execute=false;c.loseReply=true;
        d=new Driver(l,c,3,3,100);t=claim(l,r,0);d.send(t,0,false);d.reconcile(t,1);
        check(l.view(r.key()).state()==State.UNKNOWN&&l.view(r.key()).reservationHeld(),"not found is not failure");
        c.execute=true;c.loseReply=false;check(d.send(t,2,true),"authorized stable replay");
        check(c.calls==2&&c.effectCount==1,"attempts differ from effects");

        l=new MemoryLedger();r=request("no-capability");l.prepare(r);
        c=new MockChannel(new Capability(false,false,0));c.loseReply=true;
        d=new Driver(l,c,3,3,100);t=claim(l,r,0);d.send(t,0,false);d.reconcile(t,1);
        check(l.view(r.key()).state()==State.MANUAL&&l.view(r.key()).reservationHeld()&&c.calls==1,"manual preserves unknown");

        l=new MemoryLedger();r=request("stale-owner");l.prepare(r);
        c=new MockChannel(new Capability(true,true,100));Ticket a=claim(l,r,0);
        check(l.begin(a,0,false),"prepared before external call");c.send(r);
        Ticket b=claim(l,r,11);
        check(!l.resolve(a,11,Result.ACCEPTED),"old epoch rejected");
        d=new Driver(l,c,3,3,100);d.reconcile(b,12);
        check(l.view(r.key()).state()==State.OPEN&&c.effectCount==1,"new owner queries");
        c.send(r);check(c.calls==2&&c.effectCount==1,"only destination can suppress late physical send");

        l=new MemoryLedger();r=request("pending");l.prepare(r);
        c=new MockChannel(new Capability(true,true,2));c.loseReply=true;c.queryOverride=Result.PENDING;
        d=new Driver(l,c,3,1,100);t=claim(l,r,0);d.send(t,0,false);d.reconcile(t,1);
        check(!d.send(t,2,true)&&l.view(r.key()).reservationHeld(),"expired replay contract");
        d.reconcile(t,3);check(l.view(r.key()).state()==State.MANUAL&&l.view(r.key()).reservationHeld(),"query budget is not failure proof");

        l=new MemoryLedger();r=request("rejected");l.prepare(r);
        c=new MockChannel(new Capability(true,false,0));c.nextSend=Result.REJECTED_NO_EFFECT;
        d=new Driver(l,c,1,1,100);t=claim(l,r,0);d.send(t,0,false);
        check(!l.view(r.key()).reservationHeld()&&c.effectCount==0,"confirmed rejection releases model hold");
        System.out.println("PASS: 7 bounded scenarios; in-memory model only; calls and effects counted separately");
    }
}

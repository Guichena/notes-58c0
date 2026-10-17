import java.util.*;

/** In-process immutable-generation protocol model. No distributed database or ANN claim. */
public final class SnapshotCatalog {
    public record Doc(String tenant,String id) {
        public Doc { if(tenant==null||tenant.isBlank()||id==null||id.isBlank())throw new IllegalArgumentException(); }
    }
    public record Chunk(Doc doc,String id,long revision,String model,String text,
                        List<Double> vector,long validFrom,long validTo) {
        public Chunk {
            Objects.requireNonNull(doc);Objects.requireNonNull(text);
            if(id==null||id.isBlank()||model==null||model.isBlank()||revision<0||validFrom>=validTo)throw new IllegalArgumentException();
            vector=List.copyOf(vector);
            if(vector.isEmpty()||vector.stream().anyMatch(x->!Double.isFinite(x)))throw new IllegalArgumentException();
            double norm=0;for(double x:vector)norm+=x*x;
            if(!Double.isFinite(norm)||norm==0)throw new IllegalArgumentException("norm");
        }
    }
    private record Identity(Doc doc,String chunk) {}
    public record Generation(long id,long sourceWatermark,String model,int dimension,List<Chunk> chunks) {
        public Generation {
            if(id<1||sourceWatermark<0||dimension<1||model==null||model.isBlank())throw new IllegalArgumentException();
            chunks=List.copyOf(chunks);
            Map<Identity,List<Chunk>> grouped=new HashMap<>();
            for(Chunk c:chunks){
                if(!model.equals(c.model())||c.vector().size()!=dimension||c.revision()>sourceWatermark)throw new IllegalArgumentException("incompatible manifest");
                grouped.computeIfAbsent(new Identity(c.doc(),c.id()),x->new ArrayList<>()).add(c);
            }
            for(List<Chunk> history:grouped.values()){
                history.sort(Comparator.comparingLong(Chunk::validFrom));
                for(int i=1;i<history.size();i++)if(history.get(i-1).validTo()>history.get(i).validFrom())throw new IllegalArgumentException("overlapping versions");
            }
        }
    }
    public record Pin(Generation generation,long publishedAt) {}
    public record Hit(long generation,Doc doc,String chunk,long revision,String text,double score) {}
    private final NavigableMap<Long,Pin> history=new TreeMap<>();
    private Pin active;
    public SnapshotCatalog(Generation initial,long at){active=new Pin(initial,at);history.put(at,active);}
    /** Only a fully built/validated generation is eligible. expectedId is a CAS precondition. */
    public synchronized boolean publish(long expectedId,Generation next,long at){
        if(active.generation().id()!=expectedId)return false;
        if(next.id()<=expectedId||next.sourceWatermark()<active.generation().sourceWatermark()||at<=active.publishedAt())throw new IllegalArgumentException("publication regression");
        active=new Pin(next,at);history.put(at,active);return true;
    }
    public synchronized Pin pin(){return active;}
    public synchronized Pin asKnownAt(long at){
        Map.Entry<Long,Pin> e=history.floorEntry(at);
        if(e==null)throw new IllegalArgumentException("no retained published snapshot");
        return e.getValue();
    }
    /** Caller must supply its currently authorized document set, never historic ACL as authority. */
    public static List<Hit> search(Pin pin,String tenant,Set<Doc> currentlyAllowed,
                                   List<Double> query,long businessTime,int k){
        Generation g=pin.generation();
        if(k<1||query.size()!=g.dimension())throw new IllegalArgumentException();
        double qn=0;for(double q:query){if(!Double.isFinite(q))throw new IllegalArgumentException();qn+=q*q;}
        if(qn==0||!Double.isFinite(qn))throw new IllegalArgumentException();
        List<Hit> hits=new ArrayList<>();
        for(Chunk c:g.chunks()){
            if(!c.doc().tenant().equals(tenant)||!currentlyAllowed.contains(c.doc())||businessTime<c.validFrom()||businessTime>=c.validTo())continue;
            double dot=0,norm=0;for(int i=0;i<query.size();i++){dot+=query.get(i)*c.vector().get(i);norm+=c.vector().get(i)*c.vector().get(i);}
            hits.add(new Hit(g.id(),c.doc(),c.id(),c.revision(),c.text(),dot/(Math.sqrt(qn)*Math.sqrt(norm))));
        }
        hits.sort(Comparator.comparingDouble(Hit::score).reversed().thenComparing(h->h.doc().id()).thenComparing(Hit::chunk).thenComparingLong(Hit::revision));
        return List.copyOf(hits.subList(0,Math.min(k,hits.size())));
    }
}

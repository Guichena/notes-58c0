import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.LongPredicate;

/** Immutable bounded exact reference, not an ANN or a production authorization service. */
public final class ExactCosine {
    public record Hit(long id,double score) {}
    private final List<Long> ids;
    private final List<double[]> vectors;
    private final int dimension;
    public ExactCosine(List<Long> inputIds,List<double[]> inputVectors,int dimension) {
        if(dimension<1||dimension>4096||inputIds.size()!=inputVectors.size()||inputIds.size()>50000)
            throw new IllegalArgumentException("shape/budget");
        this.dimension=dimension;
        inputIds = new ArrayList<>(inputIds);
        inputVectors = new ArrayList<>(inputVectors);
        Set<Long> unique=new HashSet<>();List<double[]> copies=new ArrayList<>();
        for(int i=0;i<inputIds.size();i++) {
            Long id=inputIds.get(i);
            if(id==null||id<0||!unique.add(id)) throw new IllegalArgumentException("duplicate/invalid id");
            copies.add(unit(inputVectors.get(i),dimension));
        }
        ids=List.copyOf(inputIds);vectors=List.copyOf(copies);
    }
    /** Max-component scaling avoids squared-norm overflow and underflow for finite double inputs. */
    public static double[] unit(double[] vector,int dimension) {
        if(vector==null||vector.length!=dimension||dimension<1||dimension>4096)
            throw new IllegalArgumentException("dimension");
        double scale=0;
        for(double x:vector) {
            if(!Double.isFinite(x)) throw new IllegalArgumentException("non-finite");
            scale=Math.max(scale,Math.abs(x));
        }
        if(scale==0) throw new IllegalArgumentException("zero vector");
        double[] result=new double[dimension];double sum=0;
        for(int i=0;i<dimension;i++) {result[i]=vector[i]/scale;sum+=result[i]*result[i];}
        double norm=Math.sqrt(sum);
        for(int i=0;i<dimension;i++) result[i]/=norm;
        return result;
    }
    /** Predicate must be supplied by the trusted caller, never by untrusted query text. */
    public List<Hit> search(double[] query,int k,LongPredicate allowed) {
        if(k<0||k>50000||allowed==null) throw new IllegalArgumentException("budget/authorization");
        double[] q=unit(query,dimension);List<Hit> result=new ArrayList<>();
        if(k==0) return List.of();
        for(int row=0;row<ids.size();row++) {
            long id=ids.get(row);if(!allowed.test(id)) continue;
            double dot=0;double[] v=vectors.get(row);
            for(int i=0;i<dimension;i++) dot+=q[i]*v[i];
            result.add(new Hit(id,Math.max(-1,Math.min(1,dot))));
        }
        result.sort(Comparator.comparingDouble(Hit::score).reversed().thenComparingLong(Hit::id));
        return List.copyOf(result.subList(0,Math.min(k,result.size())));
    }
}

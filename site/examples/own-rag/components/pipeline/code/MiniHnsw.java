import java.util.*;

/** Single-threaded educational HNSW, squared L2, append-only IDs.
 * Geometric p=1/M levels capped at16; M links selected/new node,
 * caps 2M at level0 and M above; diversity selection with rejected refill.
 * No deletion, persistence, filters, concurrent mutation or production claims.
 */
public final class MiniHnsw {
    public record Neighbor(int id,double squaredDistance){}
    private static final Comparator<Neighbor> NEAR=Comparator.comparingDouble(Neighbor::squaredDistance).thenComparingInt(Neighbor::id);
    private static final class Node {
        final double[] vector;final List<List<Integer>> links=new ArrayList<>();
        Node(double[] v,int level){vector=v.clone();for(int i=0;i<=level;i++)links.add(new ArrayList<>());}
        int level(){return links.size()-1;}
    }
    private final int dimension,m,constructionEf;private final Random random;private final List<Node> nodes=new ArrayList<>();
    private int entry=-1,maxLevel=-1;
    public MiniHnsw(int dimension,int m,int constructionEf,long seed){
        if(dimension<1||dimension>1024||m<2||m>1_000_000||constructionEf<m)throw new IllegalArgumentException("invalid dimensions/M/efConstruction");
        this.dimension=dimension;this.m=m;this.constructionEf=constructionEf;random=new Random(seed);
    }
    private void validate(double[] vector){Objects.requireNonNull(vector);if(vector.length!=dimension)throw new IllegalArgumentException("dimension mismatch");for(double v:vector)if(!Double.isFinite(v)||Math.abs(v)>1e100)throw new IllegalArgumentException("nonfinite/out-of-range component");}
    private static double distance(double[] a,double[] b){double sum=0;for(int i=0;i<a.length;i++){double delta=a[i]-b[i];sum+=delta*delta;}return sum;}
    private Neighbor neighbor(double[] q,int id){return new Neighbor(id,distance(q,nodes.get(id).vector));}
    private List<Neighbor> searchLayer(double[] q,List<Integer> starts,int ef,int level){
        PriorityQueue<Neighbor> candidates=new PriorityQueue<>(NEAR),best=new PriorityQueue<>(NEAR.reversed());Set<Integer> visited=new HashSet<>();
        for(int id:starts)if(visited.add(id)){Neighbor n=neighbor(q,id);candidates.add(n);best.add(n);if(best.size()>ef)best.remove();}
        while(!candidates.isEmpty()){
            Neighbor current=candidates.remove();
            if(best.size()==ef && current.squaredDistance>best.peek().squaredDistance)break;
            for(int id:nodes.get(current.id).links.get(level))if(visited.add(id)){
                Neighbor candidate=neighbor(q,id);
                if(best.size()<ef||NEAR.compare(candidate,best.peek())<0){candidates.add(candidate);best.add(candidate);if(best.size()>ef)best.remove();}
            }
        }
        List<Neighbor> result=new ArrayList<>(best);result.sort(NEAR);return result;
    }
    /** Candidate extension disabled, keepPrunedConnections enabled. */
    private List<Integer> select(double[] center,List<Neighbor> candidates,int limit){
        List<Neighbor> sorted=new ArrayList<>(candidates);sorted.sort(NEAR);List<Integer> selected=new ArrayList<>(),discarded=new ArrayList<>();
        for(Neighbor c:sorted){
            if(selected.size()==limit)break;boolean diverse=true;
            for(int other:selected)if(distance(nodes.get(c.id).vector,nodes.get(other).vector)<c.squaredDistance){diverse=false;break;}
            if(diverse)selected.add(c.id);else discarded.add(c.id);
        }
        for(int id:discarded){if(selected.size()==limit)break;selected.add(id);}
        return selected;
    }
    private static List<Integer> ids(List<Neighbor> result){List<Integer> out=new ArrayList<>();for(Neighbor n:result)out.add(n.id);return out;}
    public int add(double[] vector){
        validate(vector);int level=0;while(level<16 && random.nextDouble()<1.0/m)level++;
        int id=nodes.size();nodes.add(new Node(vector,level));
        if(entry<0){entry=id;maxLevel=level;return id;}
        List<Integer> starts=List.of(entry);
        for(int l=maxLevel;l>level;l--)starts=List.of(searchLayer(vector,starts,1,l).get(0).id);
        for(int l=Math.min(level,maxLevel);l>=0;l--){
            List<Neighbor> candidates=searchLayer(vector,starts,constructionEf,l);List<Integer> chosen=select(vector,candidates,m);
            nodes.get(id).links.get(l).addAll(chosen);
            for(int other:chosen){
                List<Integer> links=nodes.get(other).links.get(l);links.add(id);int cap=l==0?2*m:m;
                if(links.size()>cap){List<Neighbor> options=new ArrayList<>();for(int target:links)options.add(neighbor(nodes.get(other).vector,target));List<Integer> kept=select(nodes.get(other).vector,options,cap);links.clear();links.addAll(kept);}
            }
            starts=ids(candidates);
        }
        if(level>maxLevel){entry=id;maxLevel=level;}
        return id;
    }
    public List<Neighbor> search(double[] query,int k,int efSearch){
        validate(query);if(k<0||efSearch<Math.max(1,k))throw new IllegalArgumentException("efSearch >= max(1,k)");
        if(k==0||entry<0)return List.of();List<Integer> starts=List.of(entry);
        for(int l=maxLevel;l>0;l--)starts=List.of(searchLayer(query,starts,1,l).get(0).id);
        List<Neighbor> result=searchLayer(query,starts,efSearch,0);return List.copyOf(result.subList(0,Math.min(k,result.size())));
    }
    private List<Neighbor> exact(double[] query,int k){List<Neighbor> out=new ArrayList<>();for(int i=0;i<nodes.size();i++)out.add(neighbor(query,i));out.sort(NEAR);return out.subList(0,Math.min(k,out.size()));}
    private void invariant(){
        int max=-1;for(int id=0;id<nodes.size();id++){Node n=nodes.get(id);max=Math.max(max,n.level());for(int l=0;l<=n.level();l++){List<Integer> links=n.links.get(l);if(links.size()>(l==0?2*m:m)||new HashSet<>(links).size()!=links.size())throw new AssertionError("degree/duplicate");for(int to:links)if(to==id||to<0||to>=nodes.size()||nodes.get(to).level()<l)throw new AssertionError("invalid edge");}}
        if(max!=maxLevel||(entry>=0&&nodes.get(entry).level()!=maxLevel))throw new AssertionError("entry level");
    }
    private static double[] vector(Random r,int d){double[] v=new double[d];for(int i=0;i<d;i++)v[i]=r.nextDouble()*2-1;return v;}
    public static void main(String[] args){
        Random r=new Random(965);int exactQueries=0;
        for(int repeat=0;repeat<20;repeat++){
            MiniHnsw index=new MiniHnsw(4,64,64,repeat);
            if(!index.search(new double[4],5,64).isEmpty())throw new AssertionError();
            for(int i=0;i<30;i++){double[] v=vector(r,4),saved=v.clone();int id=index.add(v);Arrays.fill(v,999);if(!Arrays.equals(saved,index.nodes.get(id).vector))throw new AssertionError("input copy");index.invariant();}
            // M exceeds data size: level0 is complete, high ef must match exhaustive L2.
            for(int j=0;j<100;j++){double[] q=vector(r,4);if(!index.search(q,10,64).equals(index.exact(q,10)))throw new AssertionError("exact complete-graph case");exactQueries++;}
        }
        MiniHnsw approximate=new MiniHnsw(8,6,30,123);for(int i=0;i<500;i++)approximate.add(vector(r,8));approximate.invariant();
        int recall10=0,recall40=0;
        for(int qn=0;qn<200;qn++){
            double[] q=vector(r,8);Set<Integer> truth=new HashSet<>(ids(approximate.exact(q,10)));
            List<Neighbor> low=approximate.search(q,10,10),high=approximate.search(q,10,40);
            for(Neighbor n:low)if(truth.contains(n.id))recall10++;for(Neighbor n:high)if(truth.contains(n.id))recall40++;
            for(List<Neighbor> result:List.of(low,high)){if(new HashSet<>(ids(result)).size()!=result.size())throw new AssertionError();for(int i=0;i<result.size();i++){Neighbor n=result.get(i);if(!n.equals(approximate.neighbor(q,n.id)))throw new AssertionError();if(i>0 && NEAR.compare(result.get(i-1),n)>0)throw new AssertionError();}}
        }
        MiniHnsw trap=new MiniHnsw(1,2,2,0);trap.nodes.add(new Node(new double[]{10},0));trap.nodes.add(new Node(new double[]{20},0));trap.nodes.add(new Node(new double[]{0},0));trap.nodes.get(0).links.get(0).add(1);trap.nodes.get(1).links.get(0).add(2);trap.entry=0;trap.maxLevel=0;
        if(trap.search(new double[]{0},1,1).get(0).id!=0||trap.search(new double[]{0},1,3).get(0).id!=2)throw new AssertionError("controlled local-minimum counterexample");
        try{approximate.search(new double[8],10,9);throw new AssertionError();}catch(IllegalArgumentException expected){}
        try{approximate.add(new double[]{Double.NaN});throw new AssertionError();}catch(IllegalArgumentException expected){}
        double[] nan=new double[8];nan[0]=Double.NaN;try{approximate.add(nan);throw new AssertionError();}catch(IllegalArgumentException expected){}
        MiniHnsw ties=new MiniHnsw(1,4,8,0);ties.add(new double[]{0});ties.add(new double[]{0});ties.add(new double[]{0});
        if(!ids(ties.search(new double[]{0},5,5)).equals(List.of(0,1,2)))throw new AssertionError("duplicate vectors/ties/k>N");
        System.out.println("PASS "+exactQueries+" complete-level0 queries vs exact L2;20 indexes/500-node graph invariants;input vector copies;valid distances/ordering;controlled low-ef miss;invalid contracts");
        System.out.println("Measured only this seeded 500-vector/200-query fixture: recall@10 ef10="+recall10+"/2000, ef40="+recall40+"/2000 (not a production benchmark or universal guarantee)");
    }
}

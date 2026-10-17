import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

/** Deterministic local contract checks only. No database, network, or model calls. */
public final class PipelineContractTest {
    private static final AtomicInteger checks=new AtomicInteger();
    private static void check(boolean ok){checks.incrementAndGet();if(!ok)throw new AssertionError();}
    private static void rejects(Runnable action){
        try{action.run();throw new AssertionError("expected rejection");}
        catch(IllegalArgumentException expected){checks.incrementAndGet();}
    }
    private static void exact(){
        Random random=new Random(2847);
        for(int trial=0;trial<200;trial++){
            int n=1+random.nextInt(50), d=1+random.nextInt(10), k=random.nextInt(60);
            List<Long> ids=new LinkedList<>();List<double[]> vectors=new LinkedList<>();
            for(long i=0;i<n;i++){
                ids.add(i);double[] v=new double[d];
                for(int j=0;j<d;j++)v[j]=random.nextDouble()*2-1;
                vectors.add(v);
            }
            double[] q=new double[d];for(int j=0;j<d;j++)q[j]=random.nextDouble()*2-1;
            ExactCosine index=new ExactCosine(ids,vectors,d);
            List<ExactCosine.Hit> expected=new ArrayList<>();
            for(int i=0;i<n;i++)if(i%3!=0){
                double dot=0,a=0,b=0;double[] v=vectors.get(i);
                for(int j=0;j<d;j++){dot+=q[j]*v[j];a+=q[j]*q[j];b+=v[j]*v[j];}
                expected.add(new ExactCosine.Hit(i,dot/Math.sqrt(a*b)));
            }
            expected.sort(Comparator.comparingDouble(ExactCosine.Hit::score).reversed().thenComparingLong(ExactCosine.Hit::id));
            List<ExactCosine.Hit> result=index.search(q,k,id->id%3!=0);
            check(result.size()==Math.min(k,expected.size()));
            for(var h:result){
                var e=expected.stream().filter(x->x.id()==h.id()).findFirst().orElseThrow();
                check(Math.abs(h.score()-e.score())<1e-12);
            }
            if(!result.isEmpty()){
                double cut=result.get(result.size()-1).score();Set<Long> got=new HashSet<>();
                for(var h:result)got.add(h.id());
                for(var e:expected)if(e.score()>cut+1e-12)check(got.contains(e.id()));
            }
            for(double[] v:vectors)Arrays.fill(v,0);
            check(index.search(q,k,id->id%3!=0).equals(result));
        }
        check(Math.abs(ExactCosine.unit(new double[]{Double.MAX_VALUE,Double.MAX_VALUE},2)[0]-1/Math.sqrt(2))<1e-15);
        check(ExactCosine.unit(new double[]{Double.MIN_VALUE},1)[0]==1);
        rejects(()->ExactCosine.unit(new double[]{0},1));
        rejects(()->ExactCosine.unit(new double[]{Double.NaN},1));
        rejects(()->new ExactCosine(List.of(1L,1L),List.of(new double[]{1},new double[]{2}),1));
        ExactCosine x=new ExactCosine(List.of(2L,1L),List.of(new double[]{1,0},new double[]{1,0}),2);
        check(x.search(new double[]{1,0},2,id->true).get(0).id()==1);
        check(x.search(new double[]{1,0},2,id->false).isEmpty());
    }
    private static SnapshotCatalog.Generation generation(long id){
        var a=new SnapshotCatalog.Doc("a","doc");
        var b=new SnapshotCatalog.Doc("b","doc");
        return new SnapshotCatalog.Generation(id,id,"space-v1",2,List.of(
            new SnapshotCatalog.Chunk(a,"c",id,"space-v1","text-"+id,List.of(1.,0.),0,100),
            new SnapshotCatalog.Chunk(b,"c",id,"space-v1","secret",List.of(1.,0.),0,100)));
    }
    private static void snapshots() throws Exception {
        var doc=new SnapshotCatalog.Doc("a","doc");
        SnapshotCatalog catalog=new SnapshotCatalog(generation(1),10);
        var pin=catalog.pin();
        check(catalog.publish(1,generation(2),20));
        check(!catalog.publish(1,generation(3),30));
        check(catalog.asKnownAt(19).generation().id()==1);
        check(catalog.asKnownAt(20).generation().id()==2);
        rejects(()->catalog.asKnownAt(9));
        check(SnapshotCatalog.search(pin,"a",Set.of(doc),List.of(1.,0.),0,5).get(0).text().equals("text-1"));
        check(SnapshotCatalog.search(pin,"a",Set.of(doc),List.of(1.,0.),100,5).isEmpty());
        check(SnapshotCatalog.search(pin,"a",Set.of(),List.of(1.,0.),0,5).isEmpty());
        check(SnapshotCatalog.search(pin,"b",Set.of(doc),List.of(1.,0.),0,5).isEmpty());
        rejects(()->new SnapshotCatalog.Generation(3,0,"space-v1",2,generation(3).chunks()));
        rejects(()->new SnapshotCatalog.Generation(3,3,"other",2,generation(3).chunks()));
        rejects(()->new SnapshotCatalog.Generation(3,3,"space-v1",1,generation(3).chunks()));
        var chunk=generation(3).chunks().get(0);
        rejects(()->new SnapshotCatalog.Generation(3,3,"space-v1",2,List.of(chunk,chunk)));
        ExecutorService pool=Executors.newFixedThreadPool(3);
        try{
            Future<?> writer=pool.submit(()->{
                for(long i=3;i<=1002;i++)check(catalog.publish(i-1,generation(i),i*10));
            });
            List<Future<?>> readers=new ArrayList<>();
            for(int t=0;t<2;t++)readers.add(pool.submit(()->{
                for(int i=0;i<2000;i++){
                    var p=catalog.pin();long id=p.generation().id();
                    var result=SnapshotCatalog.search(p,"a",Set.of(doc),List.of(1.,0.),50,2);
                    check(result.size()==1&&result.get(0).generation()==id&&result.get(0).text().equals("text-"+id));
                    check(p.generation().id()==id);
                }
            }));
            writer.get();for(var r:readers)r.get();
        }finally{pool.shutdownNow();}
        check(pin.generation().id()==1);
        check(catalog.pin().generation().id()==1002);
    }
    public static void main(String[] args) throws Exception{
        exact();snapshots();System.out.println("PASS "+checks.get()+" additional ExactCosine/SnapshotCatalog local checks");
    }
}

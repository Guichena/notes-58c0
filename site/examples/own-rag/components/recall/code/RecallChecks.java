import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;

public final class RecallChecks {
    private static int checks;
    private static void check(boolean ok) {
        checks++;
        if (!ok) throw new AssertionError("check " + checks);
    }
    private static void close(double actual, double expected) {
        check(Double.isFinite(actual) && Math.abs(actual - expected)
                <= Math.max(1e-12 * Math.abs(expected), 1e-320));
    }
    private static void rejects(Class<? extends Throwable> type, Runnable run) {
        checks++;
        try { run.run(); }
        catch (Throwable e) {
            if (type.isInstance(e)) return;
            throw new AssertionError("unexpected exception", e);
        }
        throw new AssertionError("expected " + type.getSimpleName());
    }
    private static double score(int tf, int len, long df, double avg, double k, double b) {
        return Bm25.score(1000, new long[]{df}, new int[]{tf}, len, avg, k, b);
    }
    private static void bm25() {
        double idf = Math.log1p(990.5 / 10.5);
        close(BM25Score.term(1,100,1000,10,100,1.2,.75), idf);
        close(score(2,100,10,100,1.2,.75), 1.375 * idf);
        for (int df = 1; df < 100; df++) {
            double previous = 0;
            for (int tf = 1; tf <= 100; tf++) {
                double s = BM25Score.term(tf,100,1000,df,100,1.2,.75);
                check(s > previous && s < Math.log1p((1000-df+.5)/(df+.5))*2.2);
                close(s,score(tf,100,df,100,1.2,.75));
                previous = s;
            }
        }
        close(score(0,100,10,100,0,.75),0);
        close(score(2,100,10,100,0,.75),idf);
        close(score(1,100,10,100,1.2,0),score(1,400,10,100,1.2,0));
        check(score(1,100,10,100,1.2,.75)>score(1,400,10,100,1.2,.75));
        check(score(1,100,10,100,1.2,.75)>score(1,100,20,100,1.2,.75));
        close(Bm25.score(1000,new long[0],new int[0],0,1,1.2,.75),0);
        close(Bm25.score(1000,new long[]{10,20,0},new int[]{2,1,0},100,100,1.2,.75),
                score(2,100,10,100,1.2,.75)+score(1,100,20,100,1.2,.75));
        close(BM25Score.term(0,0,1,0,1,0,1),0);
        close(Bm25.score(1,new long[]{0},new int[]{0},0,.1,0,1),0);
        rejects(IllegalArgumentException.class,()->Bm25.score(0,new long[0],new int[0],0,1,1,.5));
        rejects(IllegalArgumentException.class,()->score(-1,1,1,1,1,.5));
        rejects(IllegalArgumentException.class,()->score(0,1,-1,1,1,.5));
        rejects(IllegalArgumentException.class,()->score(1,1,1,Double.POSITIVE_INFINITY,1,.5));
        rejects(IllegalArgumentException.class,()->score(1,1,1,1,1,Double.NaN));
        rejects(IllegalArgumentException.class,()->score(1,1,1,1,-1,.5));
        rejects(IllegalArgumentException.class,()->Bm25.score(1000,new long[]{10,0},new int[]{1,1},2,2,1,.5));
        Random random = new Random(9283);
        for (int i=0;i<2000;i++) {
            int n=1+random.nextInt(10000), df=1+random.nextInt(n);
            int len=1+random.nextInt(500), tf=1+random.nextInt(len);
            double avg=.01+random.nextDouble()*1000, k=random.nextDouble()*1000;
            double b=random.nextDouble();
            double expected=Math.log1p((n-df+.5)/(df+.5))
                *tf*(k+1)/(tf+k*(1-b+b*len/avg));
            close(Bm25.score(n,new long[]{df},new int[]{tf},len,avg,k,b),expected);
        }
        // normalization 有限，但旧的 k1*normalization 会溢出。
        double extreme=score(1,1,10,1e-308,1000,1);
        check(extreme > 0);
        close(extreme,idf*1.001e-308);
        double rare=Bm25.score(Long.MAX_VALUE,new long[]{Long.MAX_VALUE},new int[]{1},1,1,0,1);
        close(rare,Math.log1p(.5/(Long.MAX_VALUE+.5)));
        rejects(IllegalArgumentException.class,()->BM25Score.term(1,1,1,0,1,1,.5));
        rejects(IllegalArgumentException.class,()->BM25Score.term(0,-1,1,0,1,1,.5));
        rejects(IllegalArgumentException.class,()->BM25Score.term(1,1,1,1,.5,1,.5));
        rejects(IllegalArgumentException.class,()->BM25Score.term(1,1,1,1,1,11,.5));
        rejects(IllegalArgumentException.class,()->score(1,0,1,1,1,.5));
        rejects(IllegalArgumentException.class,()->score(1,1,0,1,1,.5));
        rejects(IllegalArgumentException.class,()->score(0,1,1001,1,1,.5));
        rejects(IllegalArgumentException.class,()->score(1,1,1,Double.MIN_VALUE,1,.5));
        rejects(IllegalArgumentException.class,()->score(1,1,1,1,Double.NaN,.5));
        rejects(IllegalArgumentException.class,()->score(1,1,1,1,1001,.5));
        rejects(IllegalArgumentException.class,()->score(1,1,1,1,1,1.1));
        rejects(IllegalArgumentException.class,()->Bm25.score(1,new long[]{1},new int[0],1,1,1,.5));
        rejects(NullPointerException.class,()->Bm25.score(1,null,new int[0],1,1,1,.5));
    }
    private static void graph() {
        List<EvidenceGraph.Edge> edges=List.of(
            new EvidenceGraph.Edge(2,0,1,"R","a"),
            new EvidenceGraph.Edge(1,0,2,"R","b"),
            new EvidenceGraph.Edge(3,1,3,"R","a"),
            new EvidenceGraph.Edge(4,2,3,"R","b"),
            new EvidenceGraph.Edge(5,3,0,"R","a"));
        Set<Long> all=Set.of(0L,1L,2L,3L);
        EvidenceGraph g=new EvidenceGraph(1,7,all,edges);
        var result=g.reach(1,7,0,all,Set.of("a","b"),Set.of("R"),3,10,50);
        check(result.size()==4);
        check(result.get(3).edgeIds().equals(List.of(1L,4L)));
        check(g.reach(1,7,0,all,Set.of("a"),Set.of("R"),3,10,50).size()==3);
        check(g.reach(1,7,0,Set.of(0L,3L),Set.of("a","b"),Set.of("R"),3,10,50).size()==1);
        check(g.reach(1,7,0,all,Set.of("a","b"),Set.of("R"),0,1,0).size()==1);
        check(g.reach(1,7,0,Set.of(),Set.of(),Set.of(),1,1,0).isEmpty());
        rejects(EvidenceGraph.BudgetExceeded.class,()->g.reach(1,7,0,all,Set.of("a","b"),Set.of("R"),3,1,50));
        rejects(EvidenceGraph.BudgetExceeded.class,()->g.reach(1,7,0,all,Set.of(),Set.of(),3,10,0));
        rejects(IllegalArgumentException.class,()->g.reach(2,7,0,all,Set.of(),Set.of(),1,1,0));
        rejects(IllegalArgumentException.class,()->g.reach(1,8,0,all,Set.of(),Set.of(),1,1,0));
        rejects(IllegalArgumentException.class,()->new EvidenceGraph(1,1,all,List.of(edges.get(0),edges.get(0))));
        rejects(IllegalArgumentException.class,()->new EvidenceGraph(1,1,Set.of(0L),edges));
        rejects(UnsupportedOperationException.class,()->result.add(result.get(0)));
        rejects(UnsupportedOperationException.class,()->result.get(3).edgeIds().add(9L));
        EvidenceGraph directed=new EvidenceGraph(1,0,Set.of(0L,1L),List.of(edges.get(0)));
        check(directed.reach(1,0,1,all,Set.of("a"),Set.of("R"),3,10,50).size()==1);
        check(g.reach(1,7,99,all,Set.of("a"),Set.of("R"),1,10,10).isEmpty());
        check(g.reach(1,7,0,all,Set.of("a","b"),Set.of("R"),32,10000,50000).size()==4);
        rejects(IllegalArgumentException.class,()->g.reach(1,7,0,all,Set.of(),Set.of(),33,10,50));
        rejects(IllegalArgumentException.class,()->g.reach(1,7,0,all,Set.of(),Set.of(),1,0,50));
        rejects(IllegalArgumentException.class,()->g.reach(1,7,0,all,Set.of(),Set.of(),1,10001,50));
        rejects(IllegalArgumentException.class,()->g.reach(1,7,0,all,Set.of(),Set.of(),1,10,50001));
        rejects(IllegalArgumentException.class,()->new EvidenceGraph(0,1,all,edges));
        rejects(IllegalArgumentException.class,()->new EvidenceGraph(1,-1,all,edges));
        rejects(IllegalArgumentException.class,()->new EvidenceGraph.Edge(1,0,1," ","a"));
        rejects(IllegalArgumentException.class,()->new EvidenceGraph.Step(1,2,List.of(1L)));
        rejects(NullPointerException.class,()->new EvidenceGraph(1,1,null,edges));
        Set<Long> mutableNodes=new HashSet<>(all);
        List<EvidenceGraph.Edge> mutableEdges=new ArrayList<>(edges);
        EvidenceGraph immutable=new EvidenceGraph(1,7,mutableNodes,mutableEdges);
        mutableNodes.clear();mutableEdges.clear();
        check(immutable.reach(1,7,0,all,Set.of("a","b"),Set.of("R"),3,10,50).size()==4);
        Random random=new Random(861);
        for(int trial=0;trial<500;trial++) {
            int n=1+random.nextInt(25), depth=random.nextInt(6);
            Set<Long> nodes=new HashSet<>(), allowed=new HashSet<>();
            for(long i=0;i<n;i++){nodes.add(i);if(random.nextBoolean())allowed.add(i);}
            List<EvidenceGraph.Edge> es=new ArrayList<>();
            for(long id=0,count=random.nextInt(90);id<count;id++)
                es.add(new EvidenceGraph.Edge(id,random.nextInt(n),random.nextInt(n),
                    random.nextBoolean()?"R":"X",random.nextBoolean()?"a":"b"));
            long start=random.nextInt(n);
            var actual=new EvidenceGraph(1,0,nodes,es).reach(1,0,start,allowed,Set.of("a"),Set.of("R"),depth,100,1000);
            // 独立的逐层全边松弛，不使用队列或邻接表。
            Map<Long,Integer> distance=new HashMap<>();
            if(allowed.contains(start))distance.put(start,0);
            for(int step=0;step<depth;step++) {
                Map<Long,Integer> next=new HashMap<>(distance);
                for(var e:es) if(distance.containsKey(e.from()) && allowed.contains(e.to())
                        && e.relation().equals("R") && e.evidence().equals("a"))
                    next.merge(e.to(),distance.get(e.from())+1,Math::min);
                distance=next;
            }
            check(actual.size()==distance.size());
            Map<Long,EvidenceGraph.Edge> byId=new HashMap<>();
            for(var e:es)byId.put(e.id(),e);
            for(var s:actual) {
                check(distance.get(s.node())==s.depth());
                long at=start;
                for(long id:s.edgeIds()) {
                    var e=byId.get(id);
                    check(e.from()==at && allowed.contains(e.to()) && e.relation().equals("R") && e.evidence().equals("a"));
                    at=e.to();
                }
                check(at==s.node());
            }
        }
    }
    public static void main(String[] args) {
        bm25(); graph();
        System.out.println("PASS " + checks + " local deterministic checks");
    }
}

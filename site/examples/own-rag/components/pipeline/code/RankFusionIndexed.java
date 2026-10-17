import java.math.*;
import java.util.*;

/** ArrayList snapshot adapter around RankFusion. */
public final class RankFusionIndexed {
    public static List<RankFusion.Hit> rrf(List<List<String>> rankings,double[] weights,double c,int topK){
        Objects.requireNonNull(rankings);Objects.requireNonNull(weights);
        List<List<String>> indexed=new ArrayList<>();
        for(List<String> row:rankings)indexed.add(new ArrayList<>(Objects.requireNonNull(row)));
        return RankFusion.rrf(indexed,weights.clone(),c,topK);
    }
    private static List<RankFusion.Hit> oracle(List<List<String>> rankings,double[] weights,int c,int k){
        Set<String> ids=new TreeSet<>();for(List<String> row:rankings)ids.addAll(row);List<RankFusion.Hit> out=new ArrayList<>();
        for(String id:ids){BigDecimal score=BigDecimal.ZERO;for(int ch=0;ch<rankings.size();ch++){int pos=rankings.get(ch).indexOf(id);if(pos>=0)score=score.add(BigDecimal.valueOf(weights[ch]).divide(BigDecimal.valueOf((long)c+pos+1),MathContext.DECIMAL128));}out.add(new RankFusion.Hit(id,score.doubleValue()));}
        out.sort(Comparator.comparingDouble(RankFusion.Hit::score).reversed().thenComparing(RankFusion.Hit::id));return out.subList(0,Math.min(k,out.size()));
    }
    public static void main(String[] args){
        Random r=new Random(2418);int checks=0;
        for(int test=0;test<5000;test++){
            int channels=r.nextInt(5),k=r.nextInt(15),c=1+r.nextInt(100);double[] w=new double[channels];List<List<String>> input=new LinkedList<>();
            for(int ch=0;ch<channels;ch++){w[ch]=r.nextInt(4);List<String> row=new LinkedList<>();for(int i=0,n=r.nextInt(20);i<n;i++)row.add("d"+r.nextInt(10));input.add(row);}
            List<List<String>> snapshot=new ArrayList<>();for(List<String> row:input)snapshot.add(List.copyOf(row));double[] weights=w.clone();
            List<RankFusion.Hit> expected=oracle(input,w,c,k),got=rrf(input,w,c,k);
            if(got.size()!=expected.size())throw new AssertionError();
            // Near-equal floating totals may exchange positions: verify by per-ID score and tolerance order.
            Map<String,Double> allScores=new HashMap<>();for(RankFusion.Hit h:oracle(input,w,c,Integer.MAX_VALUE))allScores.put(h.id(),h.score());
            double last=Double.POSITIVE_INFINITY;for(RankFusion.Hit h:got){if(Math.abs(h.score()-allScores.get(h.id()))>1e-12 || h.score()>last+1e-12)throw new AssertionError();last=h.score();}
            if(!got.isEmpty())for(RankFusion.Hit h:expected)if(h.score()>last+1e-12 && got.stream().noneMatch(g->g.id().equals(h.id())))throw new AssertionError();
            if(!input.equals(snapshot)||!Arrays.equals(w,weights))throw new AssertionError("input changed");checks++;
        }
        List<RankFusion.Hit> sample=rrf(List.of(List.of("A","B"),List.of("B","C")),new double[]{1,1},1,3);
        if(!sample.get(0).id().equals("B")||Math.abs(sample.get(0).score()-5.0/6)>1e-15)throw new AssertionError();
        if(!rrf(List.of(List.of("b","a"),List.of("a","b")),new double[]{1,1},60,2).get(0).id().equals("a"))throw new AssertionError("exact tie");
        if(rrf(List.of(List.of("a","a","b")),new double[]{1},1,2).get(1).score()!=.25)throw new AssertionError("original duplicate slots");
        if(!rrf(List.of(List.of("b","a")),new double[]{0},1,2).get(0).id().equals("a"))throw new AssertionError("zero-score IDs");
        try{rrf(List.of(),new double[0],0,1);throw new AssertionError();}catch(IllegalArgumentException expected){}
        try{rrf(List.of(List.of("x")),new double[]{-1},1,1);throw new AssertionError();}catch(IllegalArgumentException expected){}
        try{rrf(List.of(List.of("x")),new double[]{Double.NaN},1,1);throw new AssertionError();}catch(IllegalArgumentException expected){}
        System.out.println("PASS "+checks+" LinkedList-backed RRF cases vs independent per-ID BigDecimal formula; original-position duplicate handling/exact ties/zero-weight IDs/input preservation/invalid parameters; core implementation reused");
    }
}

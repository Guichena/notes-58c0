import java.util.*;

/** Exact token-offset planner AFTER real Markdown parsing and tokenization.
 * This class does not equate characters/words with model tokens and is not a Markdown parser. */
public final class TokenChunkPlan {
    public record Parent(String document,String version,String id,String headingPath,int tokens) {
        public Parent { Objects.requireNonNull(document);Objects.requireNonNull(version);Objects.requireNonNull(id);Objects.requireNonNull(headingPath);if(tokens<0)throw new IllegalArgumentException("tokens"); }
    }
    public record Chunk(Parent parent,int ordinal,int start,int end,int coreStart,int coreEnd) {}
    public record Span(Parent parent,int start,int end) {}
    private record ParentKey(String document,String version,String id) {}
    private TokenChunkPlan() {}
    public static List<Chunk> split(Parent parent,int capacity,int overlap,boolean backfillTail) {
        Objects.requireNonNull(parent);if(capacity<=0||overlap<0||overlap>=capacity)throw new IllegalArgumentException("0 <= overlap < capacity");
        List<Chunk> out=new ArrayList<>();int start=0,covered=0,n=parent.tokens;
        while(start<n){
            int end=start+(int)Math.min((long)capacity,(long)n-start);
            int visibleStart=backfillTail&&end==n&&n>capacity?n-capacity:start;
            out.add(new Chunk(parent,out.size(),visibleStart,end,covered,end));covered=end;
            if(end==n)break;
            start=end-overlap;
        }
        return List.copyOf(out);
    }
    // Merge only within one exact parent/doc/version key. Never concatenate overlapping text twice.
    public static List<Span> merge(List<Span> spans) {
        Objects.requireNonNull(spans);Map<Parent,List<Span>> grouped=new LinkedHashMap<>();Map<ParentKey,Parent> identities=new HashMap<>();
        for(Span s:spans){Objects.requireNonNull(s);Objects.requireNonNull(s.parent);if(s.start<0||s.start>s.end||s.end>s.parent.tokens)throw new IllegalArgumentException("span");ParentKey key=new ParentKey(s.parent.document,s.parent.version,s.parent.id);Parent previous=identities.putIfAbsent(key,s.parent);if(previous!=null&&!previous.equals(s.parent))throw new IllegalArgumentException("conflicting parent metadata");if(s.start==s.end)continue;grouped.computeIfAbsent(s.parent,k->new ArrayList<>()).add(s);}
        List<Span> out=new ArrayList<>();
        for(var entry:grouped.entrySet()){
            List<Span> group=entry.getValue();group.sort(Comparator.comparingInt(Span::start).thenComparingInt(Span::end));
            int start=group.get(0).start,end=group.get(0).end;
            for(int i=1;i<group.size();i++){Span x=group.get(i);if(x.start<=end)end=Math.max(end,x.end);else{out.add(new Span(entry.getKey(),start,end));start=x.start;end=x.end;}}
            out.add(new Span(entry.getKey(),start,end));
        }
        return List.copyOf(out);
    }
    public static Span fullParent(Chunk chunk){Objects.requireNonNull(chunk);return new Span(chunk.parent,0,chunk.parent.tokens);}
    private static void require(boolean yes){if(!yes)throw new AssertionError();}
    public static void main(String[] args){
        int plans=0;
        for(int n=0;n<=300;n++)for(int c=1;c<=30;c++)for(int overlap:new int[]{0,c/2,c-1})for(boolean fill:new boolean[]{false,true}){
            Parent p=new Parent("d","v1","module","A/B",n);List<Chunk> chunks=split(p,c,overlap,fill);int[] cover=new int[n],core=new int[n];int previousEnd=0,previousStart=-1;List<Span> spans=new ArrayList<>();
            for(int i=0;i<chunks.size();i++){Chunk x=chunks.get(i);require(x.ordinal==i&&x.parent.equals(p)&&x.start>=0&&x.end<=n&&x.end-x.start<=c&&x.start>previousStart&&x.end>previousEnd&&x.coreStart==previousEnd&&x.coreEnd==x.end&&x.start<=x.coreStart);for(int j=x.start;j<x.end;j++)cover[j]++;for(int j=x.coreStart;j<x.coreEnd;j++)core[j]++;previousEnd=x.end;previousStart=x.start;spans.add(new Span(p,x.start,x.end));}
            require(previousEnd==n);for(int i=0;i<n;i++)require(cover[i]>=1&&core[i]==1);
            List<Span> merged=merge(spans);require(n==0?merged.isEmpty():merged.equals(List.of(new Span(p,0,n))));
            if(fill&&n>c)require(chunks.get(chunks.size()-1).end-chunks.get(chunks.size()-1).start==c);plans++;
        }
        Parent p=new Parent("d","v1","section","Top/Sub",1000);
        require(split(p,400,0,false).stream().map(c->new Span(c.parent,c.start,c.end)).toList().equals(List.of(new Span(p,0,400),new Span(p,400,800),new Span(p,800,1000))));
        require(split(p,400,0,true).stream().map(c->new Span(c.parent,c.start,c.end)).toList().equals(List.of(new Span(p,0,400),new Span(p,400,800),new Span(p,600,1000))));
        Parent other=new Parent("d","v2","section","Top/Sub",1000);
        require(merge(List.of(new Span(p,0,400),new Span(p,200,600),new Span(p,800,1000),new Span(other,0,400))).equals(List.of(new Span(p,0,600),new Span(p,800,1000),new Span(other,0,400))));
        for(int bad:new int[]{-1,400,401})try{split(p,400,bad,false);throw new AssertionError();}catch(IllegalArgumentException expected){}
        for(Parent bad:List.of(new Parent("d","v1","section","Other",1000),new Parent("d","v1","section","Top/Sub",999)))try{merge(List.of(new Span(p,0,10),new Span(bad,5,15)));throw new AssertionError();}catch(IllegalArgumentException expected){}
        System.out.println("PASS: "+plans+" exact token-offset plans; capacity/coverage/core ownership/overlap/tail invariants; source1000/400/200 examples; overlap union, parent metadata conflicts and version/parent isolation. No model tokenizer or Markdown parser run.");
    }
}

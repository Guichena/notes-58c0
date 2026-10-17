import java.util.*;

public final class ProtocolAndGraphTest {
    static int passed;
    @FunctionalInterface interface Test {void run();}
    static void check(boolean ok){if(!ok)throw new AssertionError();}
    static void test(String name,Test t){t.run();passed++;System.out.println("PASS "+name);}
    static void rejects(Test t){try{t.run();}catch(IllegalArgumentException|IllegalStateException|ArithmeticException e){return;}throw new AssertionError("expected rejection");}
    static AgentEventState.Event e(long seq,AgentEventState.Type type,String id,String text){return new AgentEventState.Event(seq,type,id,text,Map.of(),List.of());}
    public static void main(String[] args) {
        test("Claude input components and cumulative output",()->{
            UsageLedger l=new UsageLedger();l.begin("a",UsageLedger.Provider.CLAUDE);
            l.accept("a",UsageLedger.Provider.CLAUDE,1,Map.of("input_tokens",10L,"cache_read_input_tokens",100L,"cache_creation_input_tokens",20L,"output_tokens",1L),false);
            l.accept("a",UsageLedger.Provider.CLAUDE,2,Map.of("output_tokens",5L),false);
            var s=l.accept("a",UsageLedger.Provider.CLAUDE,3,Map.of("output_tokens",8L),true);
            check(s.input()==130&&s.output()==8&&s.cachedRead()==100&&s.complete());
        });
        test("OpenAI cached and reasoning are subsets",()->{
            UsageLedger l=new UsageLedger();var s=l.accept("a",UsageLedger.Provider.OPENAI_RESPONSES,1,Map.of("input_tokens",100L,"output_tokens",40L,"cached_tokens",80L,"reasoning_tokens",30L),true);
            check(s.input()+s.output()==140);check(s.reasoning()==30);
        });
        test("DeepSeek cache partition checked",()->{
            UsageLedger l=new UsageLedger();rejects(()->l.accept("a",UsageLedger.Provider.DEEPSEEK,1,Map.of("prompt_tokens",100L,"completion_tokens",1L,"prompt_cache_hit_tokens",90L,"prompt_cache_miss_tokens",20L),true));
            check(l.accept("a",UsageLedger.Provider.DEEPSEEK,1,Map.of("prompt_tokens",100L,"completion_tokens",1L,"prompt_cache_hit_tokens",90L,"prompt_cache_miss_tokens",10L),true).input()==100);
        });
        test("missing final usage is unknown not zero",()->{
            UsageLedger l=new UsageLedger();l.begin("lost",UsageLedger.Provider.OPENAI_CHAT);
            l.accept("ok",UsageLedger.Provider.OPENAI_CHAT,1,Map.of("prompt_tokens",2L,"completion_tokens",0L),true);check(!l.total().complete());
        });
        test("retry attempts billed separately duplicate frames not summed",()->{
            UsageLedger l=new UsageLedger();Map<String,Long> f=Map.of("prompt_tokens",3L,"completion_tokens",4L);
            l.accept("a",UsageLedger.Provider.OPENAI_CHAT,1,f,true);l.accept("a",UsageLedger.Provider.OPENAI_CHAT,1,f,true);
            l.accept("b",UsageLedger.Provider.OPENAI_CHAT,1,f,true);check(l.total().input()==6&&l.total().output()==8);
            rejects(()->l.accept("a",UsageLedger.Provider.OPENAI_CHAT,1,Map.of("prompt_tokens",4L,"completion_tokens",4L),true));
        });
        test("usage rejects decreasing count and incomplete final",()->{
            UsageLedger l=new UsageLedger();l.accept("a",UsageLedger.Provider.CLAUDE,1,Map.of("input_tokens",5L,"output_tokens",4L),false);
            rejects(()->l.accept("a",UsageLedger.Provider.CLAUDE,2,Map.of("output_tokens",3L),false));
            rejects(()->l.accept("b",UsageLedger.Provider.OPENAI_CHAT,1,Map.of("prompt_tokens",1L),true));
        });
        test("reported provider total must equal input plus output",()->{
            for(var provider:List.of(UsageLedger.Provider.OPENAI_CHAT,UsageLedger.Provider.OPENAI_RESPONSES,UsageLedger.Provider.DEEPSEEK)) {
                UsageLedger l=new UsageLedger();String in=provider==UsageLedger.Provider.OPENAI_RESPONSES?"input_tokens":"prompt_tokens";
                String out=provider==UsageLedger.Provider.OPENAI_RESPONSES?"output_tokens":"completion_tokens";
                rejects(()->l.accept("a",provider,1,Map.of(in,100L,out,40L,"total_tokens",1L),true));
                check(l.accept("a",provider,1,Map.of(in,100L,out,40L,"total_tokens",140L),true).complete());
            }
            UsageLedger overflow=new UsageLedger();
            rejects(()->overflow.accept("a",UsageLedger.Provider.OPENAI_CHAT,1,Map.of("prompt_tokens",Long.MAX_VALUE,"completion_tokens",1L,"total_tokens",Long.MAX_VALUE),true));
        });
        test("DeepSeek misses and cache aliases remain consistent",()->{
            UsageLedger l=new UsageLedger();
            rejects(()->l.accept("a",UsageLedger.Provider.DEEPSEEK,1,Map.of("prompt_tokens",100L,"completion_tokens",1L,"prompt_cache_miss_tokens",101L),true));
            rejects(()->l.accept("a",UsageLedger.Provider.DEEPSEEK,1,Map.of("prompt_tokens",100L,"completion_tokens",1L,"prompt_cache_hit_tokens",10L,"cached_tokens",11L,"prompt_cache_miss_tokens",90L),true));
            check(l.accept("a",UsageLedger.Provider.DEEPSEEK,1,Map.of("prompt_tokens",100L,"completion_tokens",1L,"cached_tokens",10L,"prompt_cache_miss_tokens",90L),true).cachedRead()==10);
        });
        test("partial total validation defers missing operands and rejects atomically",()->{
            UsageLedger l=new UsageLedger();
            l.accept("a",UsageLedger.Provider.OPENAI_CHAT,1,Map.of("prompt_tokens",100L,"total_tokens",140L),false);
            rejects(()->l.accept("a",UsageLedger.Provider.OPENAI_CHAT,2,Map.of("completion_tokens",39L),true));
            check(l.total().input()==100&&l.total().output()==0&&!l.total().complete());
            check(l.accept("a",UsageLedger.Provider.OPENAI_CHAT,2,Map.of("completion_tokens",40L),true).complete());
        });
        test("DAG batches preserve fork and join",()->{
            Map<String,Set<String>> g=Map.of("a",Set.of("b","c"),"b",Set.of("d"),"c",Set.of("d"),"d",Set.of(),"x",Set.of());
            check(DagAlgorithms.batches(g).equals(List.of(List.of("a","x"),List.of("b","c"),List.of("d"))));
            check(DagAlgorithms.prune(g,Set.of("a"),Set.of("d")).keySet().equals(Set.of("a","b","c","d")));
            check(DagAlgorithms.prune(g,Set.of("d"),Set.of("a")).isEmpty());
        });
        test("DAG isolated zero-edge path and cycle",()->{
            check(DagAlgorithms.prune(Map.of("a",Set.of()),Set.of("a"),Set.of("a")).size()==1);
            rejects(()->DagAlgorithms.batches(Map.of("a",Set.of("b"),"b",Set.of("a"))));
        });
        test("200 random DAGs versus independent Floyd oracle",()->{
            Random r=new Random(82617);
            for(int round=0;round<200;round++) {
                int n=2+r.nextInt(12);boolean[][] reach=new boolean[n][n];Map<String,Set<String>> g=new HashMap<>();
                for(int i=0;i<n;i++){Set<String> to=new HashSet<>();reach[i][i]=true;for(int j=i+1;j<n;j++)if(r.nextBoolean()){to.add("n"+j);reach[i][j]=true;}g.put("n"+i,to);}
                for(int k=0;k<n;k++)for(int i=0;i<n;i++)for(int j=0;j<n;j++)reach[i][j]|=reach[i][k]&&reach[k][j];
                int start=r.nextInt(n),end=r.nextInt(n);Set<String> expected=new HashSet<>();
                for(int i=0;i<n;i++)if(reach[start][i]&&reach[i][end])expected.add("n"+i);
                check(DagAlgorithms.prune(g,Set.of("n"+start),Set.of("n"+end)).keySet().equals(expected));
                Map<String,Integer> batch=new HashMap<>();var bs=DagAlgorithms.batches(g);for(int b=0;b<bs.size();b++)for(String node:bs.get(b))batch.put(node,b);
                g.forEach((from,tos)->tos.forEach(to->check(batch.get(from)<batch.get(to))));
            }
        });
        test("AGUI message deltas and terminal state",()->{
            AgentEventState s=new AgentEventState();s.accept(e(1,AgentEventState.Type.RUN_STARTED,"r",""));s.accept(e(2,AgentEventState.Type.TEXT_MESSAGE_START,"m",""));
            var d=e(3,AgentEventState.Type.TEXT_MESSAGE_CONTENT,"m","你");s.accept(d);s.accept(d);s.accept(e(4,AgentEventState.Type.TEXT_MESSAGE_END,"m",""));
            s.accept(e(5,AgentEventState.Type.RUN_FINISHED,"r","success"));check(s.message("m").equals("你"));check(s.outcome().equals("SUCCESS"));
            rejects(()->s.accept(e(6,AgentEventState.Type.TEXT_MESSAGE_CONTENT,"m","late")));
        });
        test("state patch is atomic and snapshot replaces",()->{
            AgentEventState s=new AgentEventState();s.accept(e(1,AgentEventState.Type.RUN_STARTED,"r",""));
            s.accept(new AgentEventState.Event(2,AgentEventState.Type.STATE_SNAPSHOT,"","",Map.of("stage","read","old","yes"),List.of()));
            rejects(()->s.accept(new AgentEventState.Event(3,AgentEventState.Type.STATE_DELTA,"","",Map.of(),List.of(new AgentEventState.Change(AgentEventState.Op.PUT,"stage","write"),new AgentEventState.Change(AgentEventState.Op.TEST,"old","no")))));
            check(s.cursor()==2&&s.state().get("stage").equals("read"));
            s.accept(new AgentEventState.Event(3,AgentEventState.Type.STATE_SNAPSHOT,"","",Map.of("stage","done"),List.of()));check(!s.state().containsKey("old"));
        });
        test("tool args end does not mean operation success",()->{
            AgentEventState s=new AgentEventState();s.accept(e(1,AgentEventState.Type.RUN_STARTED,"r",""));s.accept(e(2,AgentEventState.Type.TOOL_CALL_START,"c","lookup"));
            s.accept(e(3,AgentEventState.Type.TOOL_CALL_ARGS,"c","{}"));s.accept(e(4,AgentEventState.Type.TOOL_CALL_END,"c",""));
            rejects(()->s.accept(e(5,AgentEventState.Type.RUN_FINISHED,"r","success")));s.accept(e(5,AgentEventState.Type.RUN_FINISHED,"r","interrupt"));check(s.outcome().equals("INTERRUPTED"));
        });
        test("orphan message and ID collision rejected",()->{
            AgentEventState s=new AgentEventState();s.accept(e(1,AgentEventState.Type.RUN_STARTED,"r",""));rejects(()->s.accept(e(2,AgentEventState.Type.TEXT_MESSAGE_CONTENT,"m","x")));
            s.accept(e(2,AgentEventState.Type.TEXT_MESSAGE_START,"m",""));rejects(()->s.accept(e(3,AgentEventState.Type.TOOL_CALL_START,"m","")));
        });
        System.out.println("TOTAL "+passed+" passed; random graph fixtures=200");
    }
}

import java.math.BigDecimal;
import java.util.*;

/** Complete local teaching contract. No model, JSON parser, semantic entailment or device control. */
public final class DiagnosisContract {
    private DiagnosisContract() {}
    public enum Kind { SOP, CASE }
    public enum Likelihood { POSSIBLE, MORE_LIKELY }
    public record Fact(String id, BigDecimal value, String unit) {
        public Fact { text(id); Objects.requireNonNull(value); text(unit); }
    }
    public record Evidence(String id, String tenant, String snapshot, String source,
                           String revision, String position, String hash, Kind kind) {
        public Evidence { text(id);text(tenant);text(snapshot);text(source);text(revision);
            text(position);text(hash);Objects.requireNonNull(kind); }
    }
    public record Check(String id, String approvedText) {
        public Check { text(id);text(approvedText); }
    }
    public record Cause(String text, Likelihood likelihood, List<String> evidence) {
        public Cause { DiagnosisContract.text(text);Objects.requireNonNull(likelihood);
            evidence=ids(evidence,8,true); }
    }
    public record RecommendedCheck(String checkId, List<String> evidence) {
        public RecommendedCheck { text(checkId);evidence=ids(evidence,8,true); }
    }
    public record DiagnosisDraft(List<Cause> possibleCauses,
                                 List<RecommendedCheck> recommendedChecks,
                                 List<String> factRefs, List<String> pendingConfirmations,
                                 boolean insufficientEvidence) {
        public DiagnosisDraft {
            possibleCauses=List.copyOf(possibleCauses);
            recommendedChecks=List.copyOf(recommendedChecks);
            if(possibleCauses.size()>8||recommendedChecks.size()>8)fail("draft budget");
            factRefs=ids(factRefs,32,false);
            pendingConfirmations=ids(pendingConfirmations,16,false);
        }
    }
    public record Snapshot(String tenant, String id, Map<String,Fact> facts,
                           Map<String,Evidence> shownEvidence, Map<String,Check> allowedChecks) {
        public Snapshot {
            text(tenant);text(id);facts=Map.copyOf(facts);shownEvidence=Map.copyOf(shownEvidence);
            allowedChecks=Map.copyOf(allowedChecks);
            facts.forEach((k,v)->{if(!k.equals(v.id()))fail("fact identity");});
            allowedChecks.forEach((k,v)->{if(!k.equals(v.id()))fail("check identity");});
            for(var e:shownEvidence.entrySet()) {
                Evidence v=e.getValue();
                if(!e.getKey().equals(v.id())||!tenant.equals(v.tenant())||!id.equals(v.snapshot()))
                    fail("evidence identity/snapshot");
            }
        }
    }
    /** Caller has freshly re-read current grants, source eligibility, check applicability and alarm epoch. */
    public record CurrentView(boolean sameAlarmEpoch, Set<String> eligibleEvidence,
                              Set<String> applicableChecks) {
        public CurrentView { eligibleEvidence=Set.copyOf(eligibleEvidence);
            applicableChecks=Set.copyOf(applicableChecks); }
    }
    public record Checked(List<Cause> hypotheses, List<Check> checks, List<Fact> facts,
                          List<String> pending, boolean insufficient, boolean requiresHumanReview) {}
    private static void text(String s) { if(s==null||s.isBlank()||s.length()>2000)fail("text"); }
    private static void fail(String s) { throw new IllegalArgumentException(s); }
    private static List<String> ids(List<String> values,int max,boolean nonempty) {
        List<String> copy=List.copyOf(values);
        if(copy.size()>max||(nonempty&&copy.isEmpty()))fail("list budget");
        Set<String> seen=new HashSet<>();
        for(String s:copy){text(s);if(!seen.add(s))fail("duplicate identity");}
        return copy;
    }
    private static void noGeneratedNumbers(String s) {
        if(s.codePoints().anyMatch(Character::isDigit))fail("numbers must come from fact references");
    }
    private static boolean evidence(List<String> refs,Snapshot s,CurrentView now) {
        boolean sop=false;
        for(String id:refs) {
            Evidence e=s.shownEvidence().get(id);
            if(e==null||!now.eligibleEvidence().contains(id))fail("unseen, revoked or stale evidence");
            sop |= e.kind()==Kind.SOP;
        }
        return sop;
    }
    public static Checked verify(DiagnosisDraft draft, Snapshot s, CurrentView now) {
        Objects.requireNonNull(draft);Objects.requireNonNull(s);Objects.requireNonNull(now);
        if(!now.sameAlarmEpoch())fail("alarm changed; re-evaluate publication");
        if(draft.insufficientEvidence()&&(!draft.recommendedChecks().isEmpty()
                ||draft.pendingConfirmations().isEmpty()))fail("insufficient evidence must be actionable only as clarification");
        List<Fact> facts=new ArrayList<>();
        for(String id:draft.factRefs()) {
            Fact f=s.facts().get(id);if(f==null)fail("unknown measurement");facts.add(f);
        }
        for(Cause c:draft.possibleCauses()) {
            noGeneratedNumbers(c.text());evidence(c.evidence(),s,now);
        }
        List<Check> checks=new ArrayList<>();Set<String> selected=new HashSet<>();
        for(RecommendedCheck c:draft.recommendedChecks()) {
            Check approved=s.allowedChecks().get(c.checkId());
            if(approved==null||!now.applicableChecks().contains(c.checkId())||!selected.add(c.checkId()))
                fail("unknown, duplicate or inapplicable check");
            if(!evidence(c.evidence(),s,now))fail("a historical case alone cannot authorize an operational check");
            checks.add(approved);
        }
        // IDs, eligibility and literal numbers cannot establish semantic support or engineering safety.
        return new Checked(draft.possibleCauses(),List.copyOf(checks),List.copyOf(facts),
                draft.pendingConfirmations(),draft.insufficientEvidence(),true);
    }
    private static int passed;
    private static void rejects(Runnable r) {
        try {r.run();throw new AssertionError("expected rejection");}
        catch(IllegalArgumentException expected){passed++;}
    }
    public static void main(String[] args) {
        // Entirely synthetic data. Hash strings identify fixtures; they are not real document hashes.
        var e1=new Evidence("E1","tenant-a","snap-7","sop-a","v2","section-4.3","fixture-hash-1",Kind.SOP);
        var c1=new Evidence("C1","tenant-a","snap-7","case-a","v1","paragraph-2","fixture-hash-2",Kind.CASE);
        var s=new Snapshot("tenant-a","snap-7",Map.of("M1",new Fact("M1",new BigDecimal("89.0"),"degC")),
                Map.of("E1",e1,"C1",c1),Map.of("CHK-A",new Check("CHK-A","仅提交有权限工程师复核，当前程序不操作设备")));
        var now=new CurrentView(true,Set.of("E1","C1"),Set.of("CHK-A"));
        var cause=new Cause("可能存在换热异常，尚需核实",Likelihood.POSSIBLE,List.of("E1","C1"));
        var good=new DiagnosisDraft(List.of(cause),List.of(new RecommendedCheck("CHK-A",List.of("E1"))),
                List.of("M1"),List.of("由工程师确认适用工况与证据支持"),false);
        Checked result=verify(good,s,now);
        if(!result.facts().get(0).value().equals(new BigDecimal("89.0"))||!result.requiresHumanReview())
            throw new AssertionError();passed++;
        rejects(()->verify(good,s,new CurrentView(true,Set.of("C1"),Set.of("CHK-A"))));
        rejects(()->verify(good,s,new CurrentView(false,Set.of("E1","C1"),Set.of("CHK-A"))));
        rejects(()->verify(good,s,new CurrentView(true,Set.of("E1","C1"),Set.of())));
        rejects(()->verify(new DiagnosisDraft(List.of(cause),List.of(new RecommendedCheck("CHK-A",List.of("C1"))),
                List.of(),List.of(),false),s,now));
        rejects(()->verify(new DiagnosisDraft(List.of(new Cause("当前温度93度",Likelihood.POSSIBLE,List.of("E1"))),
                List.of(),List.of(),List.of(),false),s,now));
        rejects(()->verify(new DiagnosisDraft(List.of(),List.of(),List.of("M2"),List.of(),false),s,now));
        rejects(()->new Cause("未知",Likelihood.POSSIBLE,List.of("E1","E1")));
        rejects(()->verify(new DiagnosisDraft(List.of(),List.of(),List.of(),List.of(),true),s,now));
        var empty=new DiagnosisDraft(List.of(),List.of(),List.of("M1"),List.of("缺少当前适用的正式依据"),true);
        if(!verify(empty,s,new CurrentView(true,Set.of(),Set.of())).insufficient())throw new AssertionError();passed++;
        System.out.println("PASS: "+passed+" diagnosis structural/current-eligibility checks; no JSON parser, LLM, semantic entailment or production safety test.");
    }
}

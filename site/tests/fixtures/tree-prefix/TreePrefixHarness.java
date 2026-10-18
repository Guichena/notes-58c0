// Independent oracles only. LC437 and TreeNode are extracted/supplied by the runner.
// No replacement production solution is embedded in this fixture.
import java.util.*;
import java.lang.reflect.*;

class TreePrefixHarness {
    static int functionalChecks, lifecycleChecks, preservationChecks;
    static final Field PREFIX;
    static {
        try { PREFIX = LC437.class.getDeclaredField("prefixCount"); PREFIX.setAccessible(true); }
        catch (ReflectiveOperationException e) { throw new ExceptionInInitializerError(e); }
    }
    static void require(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
    static void expect(LC437 solver, TreeNode root, int target, long expected, String label) {
        int actual = solver.pathSum(root, target);
        functionalChecks++;
        require(actual == expected, label + ": expected=" + expected + ", actual=" + actual);
    }
    @SuppressWarnings("unchecked")
    static Map<Long,Integer> map(LC437 solver) throws IllegalAccessException {
        return (Map<Long,Integer>) PREFIX.get(solver);
    }
    static TreeNode node(int value, TreeNode left, TreeNode right) {
        TreeNode n = new TreeNode(value); n.left = left; n.right = right; return n;
    }
    static TreeNode chain(int[] values) {
        TreeNode root = null;
        for (int i = values.length - 1; i >= 0; i--) root = node(values[i], root, null);
        return root;
    }
    static TreeNode constantChain(int length, int value) {
        int[] values = new int[length]; Arrays.fill(values, value); return chain(values);
    }
    record Visit(TreeNode node, long sum) {}
    record Snapshot(TreeNode node, int value, TreeNode left, TreeNode right) {}
    static List<Snapshot> snapshot(TreeNode root) {
        List<Snapshot> out = new ArrayList<>(); Deque<TreeNode> pending = new ArrayDeque<>();
        if (root != null) pending.push(root);
        while (!pending.isEmpty()) {
            TreeNode n = pending.pop(); out.add(new Snapshot(n, n.val, n.left, n.right));
            if (n.left != null) pending.push(n.left);
            if (n.right != null) pending.push(n.right);
        }
        return out;
    }
    // Explicitly enumerate every start node and every descendant path. No prefix map.
    static long oracle(TreeNode root, int target) {
        long answer = 0;
        for (Snapshot start : snapshot(root)) {
            Deque<Visit> pending = new ArrayDeque<>(); pending.push(new Visit(start.node, 0));
            while (!pending.isEmpty()) {
                Visit v = pending.pop(); long sum = v.sum + v.node.val;
                if (sum == target) answer++;
                if (v.node.left != null) pending.push(new Visit(v.node.left, sum));
                if (v.node.right != null) pending.push(new Visit(v.node.right, sum));
            }
        }
        return answer;
    }
    static TreeNode randomTree(Random random, int size, boolean wide) {
        if (size == 0) return null;
        TreeNode root = new TreeNode(wide ? random.nextInt(2_000_000_001)-1_000_000_000 : random.nextInt(7)-3);
        List<TreeNode> available = new ArrayList<>(); available.add(root);
        for (int i = 1; i < size; i++) {
            TreeNode n = new TreeNode(wide ? random.nextInt(2_000_000_001)-1_000_000_000 : random.nextInt(7)-3);
            int index = random.nextInt(available.size()); TreeNode parent = available.get(index);
            if (parent.left == null && (parent.right != null || random.nextBoolean())) parent.left = n;
            else parent.right = n;
            if (parent.left != null && parent.right != null) available.remove(index);
            available.add(n);
        }
        return root;
    }
    static void functional(LC437 solver) {
        expect(solver, null, 0, 0, "empty zero");
        expect(solver, null, 1000, 0, "empty nonzero");
        expect(solver, node(0,null,null), 0, 1, "single zero has one nonempty path");
        expect(solver, node(1,null,null), 1, 1, "single matching node");
        expect(solver, node(1,null,null), 0, 0, "single nonmatching node");
        TreeNode example = node(10, node(5, node(3,node(3,null,null),node(-2,null,null)),
            node(2,null,node(1,null,null))), node(-3,null,node(11,null,null)));
        expect(solver, example, 8, 3, "official example");
        TreeNode siblings = node(1,node(1,null,null),node(1,null,null));
        expect(solver, siblings, 0, 0, "siblings cannot form a downward path");
        expect(solver, siblings, 1, 3, "distinct matching single-node paths");
        expect(solver, constantChain(1000,0), 0, 500_500, "official maximum zero-chain count");
        expect(solver, constantChain(1000,1), 1, 1000, "1000-height positive chain");
        expect(solver, constantChain(1000,1), 1000, 1, "entire long path matches");
        expect(solver, constantChain(1000,1), 0, 0, "no zero-sum positive path");
        expect(solver, constantChain(1000,1_000_000_000), 0, 0, "long prefixes exceed int");
        int[] alternating = new int[1000];
        for (int i=0;i<alternating.length;i++) alternating[i]=(i%2==0?1:-1)*1_000_000_000;
        expect(solver, chain(alternating), 0, 250_000, "repeated long prefixes");
        expect(solver, chain(new int[]{1_000_000_000,1_000_000_000,1_000_000_000,1_000_000_000,294_967_296}),
            0, 0, "2^32 must not wrap into a zero-sum path");
        expect(solver, chain(new int[]{-1_000_000_000,-1_000_000_000,-1_000_000_000,-1_000_000_000,-294_967_296}),
            0, 0, "negative 2^32 must not wrap into a zero-sum path");
        Random random = new Random(437_20261017L);
        for (int test=0;test<2000;test++) {
            TreeNode root=randomTree(random,random.nextInt(81),test%7==0);
            List<Snapshot> before=snapshot(root);
            int[] targets={random.nextInt(41)-20,0,1000,-1000,random.nextInt(11)-5};
            for (int target:targets) expect(solver,root,target,oracle(root,target),"enumerated tree "+test+" target "+target);
            for (Snapshot s:before) require(s.node.val==s.value && s.node.left==s.left && s.node.right==s.right,
                "input tree was mutated at case "+test);
            preservationChecks++;
        }
        require(functionalChecks==10016,"functional case count changed");
        System.out.println("FUNCTIONAL_BASE_CHECKS="+functionalChecks);
        System.out.println("INPUT_PRESERVATION_CHECKS="+preservationChecks);
    }
    static void lifecycle(LC437 solver) throws Exception {
        TreeNode large=constantChain(1000,1_000_000_000);
        TreeNode small=node(1,null,null), pair=node(-1,node(1,null,null),null);
        TreeNode[] roots={large,small,null,pair,null}; int[] targets={0,1,0,0,-1000}; long[] answers={0,1,0,1,0};
        Map<Long,Integer> previous=map(solver);
        for (int round=0;round<48;round++) for (int i=0;i<roots.length;i++) {
            expect(solver,roots[i],targets[i],answers[i],"reuse round "+round+" case "+i);
            Map<Long,Integer> current=map(solver);
            require(current!=previous,"retained-prefix-map: every invocation must allocate a fresh map"); lifecycleChecks++;
            require(current.size()==1,"completed DFS must delete zero-frequency nonempty prefixes"); lifecycleChecks++;
            require(Objects.equals(current.get(0L),1),"completed DFS must leave precisely one empty-prefix count"); lifecycleChecks++;
            previous=current;
        }
        require(functionalChecks==10256 && lifecycleChecks==720,"reuse case count changed");
        System.out.println("FUNCTIONAL_TOTAL_CHECKS="+functionalChecks);
        System.out.println("LIFECYCLE_CHECKS="+lifecycleChecks);
    }
    // Local diagnostic only. The runner adds opens to this test JVM, never to the site or OS.
    static int capacity(Map<Long,Integer> map) throws Exception {
        Field table=HashMap.class.getDeclaredField("table"); table.setAccessible(true);
        Object[] array=(Object[])table.get(map); return array==null?0:array.length;
    }
    static void capacityProbe(boolean retainedExpected) throws Exception {
        LC437 solver=new LC437(); TreeNode large=constantChain(1000,1_000_000_000);
        require(solver.pathSum(large,0)==0,"large capacity witness answer");
        Map<Long,Integer> largeMap=map(solver); int largeCapacity=capacity(largeMap);
        require(solver.pathSum(node(1,null,null),1)==1,"small capacity witness answer");
        Map<Long,Integer> smallMap=map(solver); int smallCapacity=capacity(smallMap);
        require(solver.pathSum(null,0)==0,"empty capacity witness answer");
        Map<Long,Integer> emptyMap=map(solver); int emptyCapacity=capacity(emptyMap);
        HashMap<Long,Integer> fresh=new HashMap<>(); fresh.put(0L,1); fresh.put(1L,1); fresh.remove(1L);
        int freshCapacity=capacity(fresh);
        if (retainedExpected) {
            require(largeMap==smallMap && smallMap==emptyMap,"baseline should reuse its map");
            require(largeCapacity>freshCapacity && smallCapacity==largeCapacity && emptyCapacity==largeCapacity,
                "baseline capacity-retention witness not reproduced");
        } else {
            require(largeMap!=smallMap && smallMap!=emptyMap,"candidate map identities must change");
            require(largeCapacity>freshCapacity && smallCapacity==freshCapacity && emptyCapacity==freshCapacity,
                "candidate should return to fresh-map capacity on small and empty calls");
        }
        System.out.printf(Locale.ROOT,"CAPACITY %s large=%d small=%d empty=%d fresh=%d mapReused=%s%n",
            retainedExpected?"before":"after",largeCapacity,smallCapacity,emptyCapacity,freshCapacity,largeMap==smallMap);
    }
    public static void main(String[] args) throws Exception {
        if (args.length==1 && args[0].equals("capacity-before")) {capacityProbe(true);return;}
        if (args.length==1 && args[0].equals("capacity-after")) {capacityProbe(false);return;}
        require(args.length==0,"unknown harness mode");
        LC437 solver=new LC437(); functional(solver); lifecycle(solver);
        System.out.println("PASS tree-prefix lifecycle and independent downward-path oracle");
    }
}

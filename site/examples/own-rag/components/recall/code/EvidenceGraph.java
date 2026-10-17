import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/** 单租户、单代次有向图快照；不实现实体抽取、推理或真实授权服务。 */
public final class EvidenceGraph {
    public record Edge(long id, long from, long to, String relation, String evidence) {
        public Edge {
            if (id < 0 || from < 0 || to < 0 || relation == null || relation.isBlank()
                    || evidence == null || evidence.isBlank())
                throw new IllegalArgumentException("edge");
        }
    }
    public record Step(long node, int depth, List<Long> edgeIds) {
        public Step {
            edgeIds = List.copyOf(edgeIds);
            if (node < 0 || depth < 0 || depth > 32 || edgeIds.size() != depth
                    || edgeIds.stream().anyMatch(id -> id < 0))
                throw new IllegalArgumentException("step");
        }
    }
    public static final class BudgetExceeded extends RuntimeException {
        private static final long serialVersionUID = 1L;
        BudgetExceeded() { super("Traversal budget exceeded; no partial result returned"); }
    }
    private final long tenant, generation;
    private final Set<Long> nodes;
    private final Map<Long, List<Edge>> adjacency;

    public EvidenceGraph(long tenant, long generation, Set<Long> nodes, List<Edge> edges) {
        Objects.requireNonNull(nodes, "nodes");
        Objects.requireNonNull(edges, "edges");
        if (tenant <= 0 || generation < 0 || nodes.size() > 10000 || edges.size() > 50000)
            throw new IllegalArgumentException("snapshot/budget");
        for (Long id : nodes)
            if (id == null || id < 0) throw new IllegalArgumentException("node");
        this.tenant = tenant;
        this.generation = generation;
        this.nodes = Set.copyOf(nodes);
        Set<Long> edgeIds = new HashSet<>();
        Map<Long, List<Edge>> temporary = new HashMap<>();
        for (Edge e : edges) {
            Objects.requireNonNull(e, "edge");
            if (!this.nodes.contains(e.from()) || !this.nodes.contains(e.to())
                    || !edgeIds.add(e.id()))
                throw new IllegalArgumentException("missing node/duplicate edge id");
            temporary.computeIfAbsent(e.from(), key -> new ArrayList<>()).add(e);
        }
        Map<Long, List<Edge>> built = new HashMap<>();
        temporary.forEach((key, value) -> {
            value.sort(Comparator.comparingLong(Edge::id));
            built.put(key, List.copyOf(value));
        });
        adjacency = Map.copyOf(built);
    }

    /** 权限集合必须来自可信的当前鉴权结果；关系和时间等条件在建快照时限定。 */
    public List<Step> reach(long tenant, long generation, long start,
                            Set<Long> authorizedNodes, Set<String> authorizedEvidence,
                            Set<String> relations, int maxDepth, int maxVisited,
                            int maxScannedEdges) {
        if (tenant != this.tenant || generation != this.generation)
            throw new IllegalArgumentException("wrong snapshot");
        Set<Long> allowed = Set.copyOf(authorizedNodes);
        Set<String> evidence = Set.copyOf(authorizedEvidence);
        Set<String> types = Set.copyOf(relations);
        if (maxDepth < 0 || maxDepth > 32 || maxVisited < 1 || maxVisited > 10000
                || maxScannedEdges < 0 || maxScannedEdges > 50000)
            throw new IllegalArgumentException("budget");
        if (!nodes.contains(start) || !allowed.contains(start)) return List.of();
        List<Step> result = new ArrayList<>();
        Set<Long> seen = new HashSet<>();
        ArrayDeque<Step> queue = new ArrayDeque<>();
        queue.add(new Step(start, 0, List.of()));
        seen.add(start);
        int scanned = 0;
        while (!queue.isEmpty()) {
            Step s = queue.removeFirst();
            result.add(s);
            if (s.depth() == maxDepth) continue;
            for (Edge edge : adjacency.getOrDefault(s.node(), List.of())) {
                if (++scanned > maxScannedEdges) throw new BudgetExceeded();
                if (!types.contains(edge.relation()) || !evidence.contains(edge.evidence())
                        || !allowed.contains(edge.to()) || seen.contains(edge.to())) continue;
                if (seen.size() == maxVisited) throw new BudgetExceeded();
                seen.add(edge.to());
                List<Long> path = new ArrayList<>(s.edgeIds());
                path.add(edge.id());
                queue.addLast(new Step(edge.to(), s.depth() + 1, path));
            }
        }
        return List.copyOf(result);
    }
}

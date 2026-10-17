import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;

/** Builds an immutable forest index from one authorized, consistent source snapshot. */
public final class OrganizationIndex {
    public record Department(String id, String parentId, String name) { }
    public record Person(String id, String departmentId, String name) { }
    public record Node(String id, String parentId, String name,
                       List<String> children, List<String> people) { }
    private final Map<String, Node> departments;
    private final Map<String, Person> people;
    private final List<String> roots;

    private OrganizationIndex(Map<String, Node> departments, Map<String, Person> people,
                              List<String> roots) {
        this.departments = Collections.unmodifiableMap(new TreeMap<>(departments));
        this.people = Collections.unmodifiableMap(new TreeMap<>(people));
        this.roots = List.copyOf(roots);
    }
    public static OrganizationIndex build(List<Department> inputDepartments,
                                           List<Person> inputPeople,
                                           int maxDepartments, int maxPeople) {
        Objects.requireNonNull(inputDepartments); Objects.requireNonNull(inputPeople);
        if (maxDepartments < 0 || maxPeople < 0
                || inputDepartments.size() > maxDepartments || inputPeople.size() > maxPeople)
            throw new IllegalArgumentException("snapshot limit");
        Map<String, Department> source = new TreeMap<>();
        Map<String, List<String>> children = new HashMap<>();
        Map<String, List<String>> members = new HashMap<>();
        for (Department d : inputDepartments) {
            Objects.requireNonNull(d); checkId(d.id()); checkName(d.name());
            if (d.parentId() != null) checkId(d.parentId());
            if (source.putIfAbsent(d.id(), d) != null)
                throw new IllegalArgumentException("duplicate department");
            children.put(d.id(), new ArrayList<>()); members.put(d.id(), new ArrayList<>());
        }
        List<String> roots = new ArrayList<>();
        for (Department d : source.values()) {
            if (d.parentId() == null) roots.add(d.id());
            else {
                List<String> siblings = children.get(d.parentId());
                if (siblings == null) throw new IllegalArgumentException("missing parent");
                siblings.add(d.id()); // source is ID-sorted, so each child list is sorted.
            }
        }
        ArrayDeque<String> queue = new ArrayDeque<>(roots);
        int visited = 0;
        while (!queue.isEmpty()) {
            String id = queue.removeFirst(); visited++;
            queue.addAll(children.get(id));
        }
        // Each department has at most one parent. Unreached components are cycles.
        if (visited != source.size()) throw new IllegalArgumentException("department cycle");
        Map<String, Person> persons = new TreeMap<>();
        for (Person p : inputPeople) {
            Objects.requireNonNull(p); checkId(p.id()); checkId(p.departmentId());
            checkName(p.name());
            if (!source.containsKey(p.departmentId()))
                throw new IllegalArgumentException("missing department");
            if (persons.putIfAbsent(p.id(), p) != null)
                throw new IllegalArgumentException("duplicate person");
        }
        for (Person p : persons.values()) members.get(p.departmentId()).add(p.id());
        Map<String, Node> nodes = new TreeMap<>();
        for (Department d : source.values())
            nodes.put(d.id(), new Node(d.id(), d.parentId(), d.name(),
                    List.copyOf(children.get(d.id())), List.copyOf(members.get(d.id()))));
        return new OrganizationIndex(nodes, persons, roots);
    }
    public Map<String, Node> departments() { return departments; }
    public Map<String, Person> people() { return people; }
    public List<String> roots() { return roots; }
    public List<String> preorder(String root, int limit) {
        Objects.requireNonNull(root);
        if (limit <= 0 || !departments.containsKey(root))
            throw new IllegalArgumentException("root or limit");
        List<String> result = new ArrayList<>();
        ArrayDeque<String> stack = new ArrayDeque<>(); stack.push(root);
        while (!stack.isEmpty()) {
            if (result.size() == limit) throw new IllegalArgumentException("result limit");
            String id = stack.pop(); result.add(id);
            List<String> next = departments.get(id).children();
            for (int i = next.size() - 1; i >= 0; i--) stack.push(next.get(i));
        }
        return List.copyOf(result);
    }
    private static void checkId(String id) {
        if (id == null || id.isBlank() || id.length() > 128)
            throw new IllegalArgumentException("identifier");
    }
    private static void checkName(String name) {
        if (name == null || name.length() > 256) throw new IllegalArgumentException("name");
    }
}

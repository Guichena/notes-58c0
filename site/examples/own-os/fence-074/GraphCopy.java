import java.util.*;
/** Explicit object-graph copy: preserves cycles and repeated references.
 * Nodes are not mutated concurrently. Null roots and null edges are allowed.
 * Strings are immutable; external resources and arbitrary reflection excluded.
 */
public final class GraphCopy {
    public static final class Node {
        public String name;
        public final List<Node> edges=new ArrayList<>();
        public Node(String name) { this.name=name; }
    }
    public static Node copy(Node root) {
        if(root==null) return null;
        IdentityHashMap<Node,Node> copies=new IdentityHashMap<>();
        ArrayDeque<Node> todo=new ArrayDeque<>();
        copies.put(root,new Node(root.name)); todo.add(root);
        while(!todo.isEmpty()) {
            Node src=todo.remove(); Node dst=copies.get(src);
            for(Node next:src.edges) {
                if(next==null) { dst.edges.add(null); continue; }
                Node clone=copies.get(next);
                if(clone==null) { clone=new Node(next.name); copies.put(next,clone); todo.add(next); }
                dst.edges.add(clone);
            }
        }
        return copies.get(root);
    }
}


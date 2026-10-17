import java.util.*;
public final class RbacPolicy {
    public record Principal(String id,String tenant,Set<String> activeRoles) {
        public Principal {activeRoles=Set.copyOf(activeRoles);}
    }
    public record Resource(String tenant,String owner) {}
    private final Map<String,Set<String>> rolePermissions;
    public RbacPolicy(Map<String,Set<String>> input) {
        Map<String,Set<String>> copy=new HashMap<>();
        input.forEach((k,v)->copy.put(k,Set.copyOf(v)));rolePermissions=Map.copyOf(copy);
    }
    // The principal and active roles must come from trusted server-side state.
    public boolean allows(Principal p,String permission,Resource resource,boolean ownerOnly) {
        if(p==null || resource==null || !p.tenant().equals(resource.tenant()))return false;
        if(ownerOnly && !p.id().equals(resource.owner()))return false;
        return p.activeRoles().stream().anyMatch(role->rolePermissions.getOrDefault(role,Set.of()).contains(permission));
    }
    public static void main(String[] args) {
        var policy=new RbacPolicy(Map.of("reader",Set.of("post:read"),"editor",Set.of("post:read","post:edit")));
        var editor=new Principal("u1","t1",Set.of("editor"));
        var reader=new Principal("u1","t1",Set.of("reader"));
        var own=new Resource("t1","u1");
        boolean[] checks={policy.allows(editor,"post:edit",own,true),
          !policy.allows(reader,"post:edit",own,true),policy.allows(reader,"post:read",own,false),
          !policy.allows(editor,"post:delete",own,false),!policy.allows(null,"post:read",own,false),
          !policy.allows(editor,"post:edit",new Resource("t2","u1"),false),
          !policy.allows(editor,"post:edit",new Resource("t1","u2"),true),
          !policy.allows(new Principal("u1","t1",Set.of("unknown")),"post:read",own,false)};
        for(boolean c:checks)if(!c)throw new AssertionError();
        System.out.println("RbacPolicy: 8 checks passed; flat RBAC plus explicit tenant/owner constraints; no database/cache or role-administration integration.");
    }
}

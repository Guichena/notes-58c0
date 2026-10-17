import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** One bounded, local, read-only demonstration. No provider or database. */
public final class MemoryFlowDemo {
    public static void main(String[] args) throws InterruptedException {
        MemoryStoreLesson store = new MemoryStoreLesson();
        MemoryStoreLesson.Scope scope = new MemoryStoreLesson.Scope("tenant1", "user1", "project1");
        MemoryStoreLesson.Auth auth = store.grant(scope); // Trusted application boundary.
        store.propose(auth, "style1", "技术问题先给结论，再解释前提",
                MemoryStoreLesson.Origin.USER_EXPLICIT, null, "event:user1");
        store.approve(auth, "style1", 1);
        List<MemoryStoreLesson.Ref> index = store.indexSnapshot(auth);
        String contextScope = scope.tenant() + "/" + scope.user() + "/" + scope.project();
        ContextCompilerLesson.Conversation conversation = new ContextCompilerLesson.Conversation(
                contextScope, "只检查模块 C 的引用，不修改配置",
                Map.of("mode", "READ_ONLY", "manufacturer", "X", "schema", "v2"));
        conversation.append("e1", List.of("user: 继续上次调查，今天只检查。"));
        conversation.append("e2", List.of("assistant call=read1: 读取 schema 版本",
                "tool call=read1: schema v2，来源 artifact:a1"));
        conversation.append("e3", List.of("user: 重点看模块 C 的引用缺失。"));
        ContextCompilerLesson.Snapshot frozen = conversation.snapshot();
        ContextCompilerLesson.Summary candidate = new ContextCompilerLesson.Summary(
                2, Set.of("e1", "e2"), frozen.protectedFacts(),
                "用户限定只读；工具确认 schema v2。尚未完成引用诊断。来源 e1、e2。");
        if (!conversation.publish(frozen.revision(), candidate)) {
            throw new IllegalStateException("snapshot changed; regenerate summary");
        }
        List<ContextCompilerLesson.MemoryView> memories = store.resolve(auth, index,
                Instant.parse("2026-10-11T00:00:00Z")).stream()
                .map(item -> new ContextCompilerLesson.MemoryView(contextScope, item.id(),
                        item.revision(), item.text())).toList();
        ContextCompilerLesson.Compiled compiled = ContextCompilerLesson.compile(
                conversation.snapshot(), new ContextCompilerLesson.Budget(4096, 512, 256),
                memories, text -> text.codePointCount(0, text.length()));
        System.out.println(compiled.request());
        System.out.println("Measured code points, not provider tokens: " + compiled.inputUnits());
        System.out.println("Raw units: " + compiled.rawUnitIds());
        store.retire(auth, "style1", 2, MemoryStoreLesson.Status.REVOKED);
        if (!store.resolve(auth, index, Instant.parse("2026-10-11T00:00:00Z")).isEmpty()) {
            throw new AssertionError("old index must not revive revoked memory");
        }
        System.out.println("Old index after revoke: empty");
    }
}

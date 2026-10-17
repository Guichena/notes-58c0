import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;

/** Frozen snapshots and atomic protocol units, with an injectable token counter. */
public final class ContextCompilerLesson {
    @FunctionalInterface
    public interface TokenCounter { long count(String serializedRequest); }

    public record Budget(long window, long output, long margin) {
        public Budget {
            if (window < 1 || window > 1_000_000 || output < 0 || margin < 0
                    || output > window || margin > window - output) {
                throw new IllegalArgumentException("invalid budget");
            }
        }
        long inputLimit() { return window - output - margin; }
    }

    /** The caller builds one complete user exchange or tool call/result group. */
    public record Unit(long sequence, String id, List<String> messages) {
        public Unit {
            if (sequence < 1) throw new IllegalArgumentException("sequence");
            requireText(id, 64);
            messages = List.copyOf(messages);
            if (messages.isEmpty() || messages.size() > 16) {
                throw new IllegalArgumentException("messages");
            }
            for (String message : messages) requireText(message, 8192);
        }
    }

    public record Summary(long through, Set<String> sourceIds,
                          Map<String, String> protectedFacts, String text) {
        public Summary {
            if (through < 1) throw new IllegalArgumentException("summary range");
            sourceIds = Set.copyOf(sourceIds);
            protectedFacts = Map.copyOf(protectedFacts);
            requireText(text, 8192);
        }
    }

    public record Snapshot(String scope, long revision, String goal,
                           Map<String, String> protectedFacts, List<Unit> units,
                           Summary summary) {
        public Snapshot {
            requireText(scope, 128); requireText(goal, 8192);
            if (revision < 1) throw new IllegalArgumentException("revision");
            protectedFacts = Map.copyOf(protectedFacts);
            units = List.copyOf(units);
            if (protectedFacts.size() > 32 || units.size() > 128) {
                throw new IllegalArgumentException("capacity");
            }
            for (Map.Entry<String, String> entry : protectedFacts.entrySet()) {
                requireText(entry.getKey(), 64); requireText(entry.getValue(), 1024);
            }
            long previous = 0;
            Set<String> ids = new HashSet<>();
            for (Unit unit : units) {
                if (unit.sequence() != previous + 1 || !ids.add(unit.id())) {
                    throw new IllegalArgumentException("noncontiguous or duplicate units");
                }
                previous = unit.sequence();
            }
            if (summary != null) validateSummary(units, protectedFacts, summary);
        }
    }

    /** Already-authorized, current memory projection, not a new instruction authority. */
    public record MemoryView(String scope, String id, long revision, String text) {
        public MemoryView {
            requireText(scope, 128); requireText(id, 64); requireText(text, 4096);
            if (revision < 1) throw new IllegalArgumentException("revision");
        }
    }

    public record Compiled(String request, long inputUnits, long snapshotRevision,
                           List<String> rawUnitIds, List<String> memoryIds) {
        public Compiled {
            rawUnitIds = List.copyOf(rawUnitIds);
            memoryIds = List.copyOf(memoryIds);
        }
    }

    public static final class Conversation {
        private final String scope;
        private String goal;
        private Map<String, String> facts;
        private long revision = 1;
        private final List<Unit> units = new ArrayList<>();
        private Summary summary;

        public Conversation(String scope, String goal, Map<String, String> facts) {
            Snapshot initial = new Snapshot(scope, revision, goal, facts, List.of(), null);
            this.scope = initial.scope(); this.goal = initial.goal();
            this.facts = initial.protectedFacts();
        }

        public synchronized void append(String id, List<String> messages) {
            if (units.size() >= 128) throw new IllegalStateException("CAPACITY");
            if (units.stream().anyMatch(unit -> unit.id().equals(id))) {
                throw new IllegalArgumentException("duplicate id");
            }
            Unit unit = new Unit(units.size() + 1L, id, messages);
            units.add(unit);
            revision = Math.addExact(revision, 1);
        }

        public synchronized void changeGoal(String next, Map<String, String> newFacts) {
            Snapshot validated = new Snapshot(scope, revision, next, newFacts, units, null);
            goal = validated.goal(); facts = validated.protectedFacts();
            summary = null; // Rebuild when protected meaning changes.
            revision = Math.addExact(revision, 1);
        }

        public synchronized Snapshot snapshot() {
            return new Snapshot(scope, revision, goal, facts, units, summary);
        }

        public synchronized boolean publish(long expectedRevision, Summary candidate) {
            if (revision != expectedRevision) return false;
            validateSummary(units, facts, candidate);
            if (summary != null && candidate.through() <= summary.through()) return false;
            summary = candidate;
            revision = Math.addExact(revision, 1);
            return true;
        }
    }

    public static Compiled compile(Snapshot snapshot, Budget budget,
                                   List<MemoryView> rankedMemories, TokenCounter counter) {
        Objects.requireNonNull(snapshot); Objects.requireNonNull(budget);
        Objects.requireNonNull(counter);
        List<MemoryView> candidates = List.copyOf(rankedMemories);
        if (candidates.size() > 128) throw new IllegalArgumentException("capacity");
        Set<String> candidateIds = new HashSet<>();
        for (MemoryView view : candidates) {
            if (!snapshot.scope().equals(view.scope())) throw new SecurityException("scope");
            if (!candidateIds.add(view.id())) throw new IllegalArgumentException("duplicate memory");
        }
        long through = snapshot.summary() == null ? 0 : snapshot.summary().through();
        List<Unit> raw = snapshot.units().stream().filter(unit -> unit.sequence() > through).toList();
        List<MemoryView> selected = new ArrayList<>();
        String request = render(snapshot, raw, selected);
        long used = checkedCount(counter, request);
        if (used > budget.inputLimit()) throw new IllegalStateException("BUDGET_EXCEEDED");
        for (MemoryView view : candidates) {
            selected.add(view);
            String trial = render(snapshot, raw, selected);
            long cost = checkedCount(counter, trial);
            if (cost > budget.inputLimit()) {
                selected.remove(selected.size() - 1);
            } else {
                request = trial;
                used = cost;
            }
        }
        return new Compiled(request, used, snapshot.revision(),
                raw.stream().map(Unit::id).toList(), selected.stream().map(MemoryView::id).toList());
    }

    private static String render(Snapshot snapshot, List<Unit> raw, List<MemoryView> memories) {
        StringBuilder result = new StringBuilder();
        result.append("[goal]\n").append(snapshot.goal()).append('\n');
        result.append("[protected facts]\n");
        new TreeMap<>(snapshot.protectedFacts()).forEach((key, value) ->
                result.append(key).append('=').append(value).append('\n'));
        if (snapshot.summary() != null) {
            result.append("[derived summary through=").append(snapshot.summary().through())
                    .append("]\n").append(snapshot.summary().text()).append('\n');
        }
        for (MemoryView view : memories) {
            result.append("[memory data ").append(view.id()).append(" revision=")
                    .append(view.revision()).append("]\n").append(view.text()).append('\n');
        }
        for (Unit unit : raw) {
            result.append("[unit ").append(unit.id()).append("]\n");
            for (String message : unit.messages()) result.append(message).append('\n');
        }
        return result.toString();
    }

    private static void validateSummary(List<Unit> units, Map<String, String> facts,
                                        Summary summary) {
        Objects.requireNonNull(summary);
        if (summary.through() >= units.size()) {
            throw new IllegalArgumentException("keep at least one complete recent unit");
        }
        if (!summary.protectedFacts().equals(facts)) {
            throw new IllegalArgumentException("protected facts changed");
        }
        Set<String> expected = new HashSet<>();
        for (Unit unit : units) if (unit.sequence() <= summary.through()) expected.add(unit.id());
        if (expected.size() != summary.through() || !expected.equals(summary.sourceIds())) {
            throw new IllegalArgumentException("coverage mismatch");
        }
    }

    private static long checkedCount(TokenCounter counter, String request) {
        long count = counter.count(request);
        if (count < 0) throw new IllegalArgumentException("negative count");
        return count;
    }

    private static void requireText(String text, int maximum) {
        if (text == null || text.isBlank() || text.length() > maximum) {
            throw new IllegalArgumentException("invalid bounded text");
        }
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (Character.isHighSurrogate(c)) {
                if (i + 1 >= text.length() || !Character.isLowSurrogate(text.charAt(i + 1))) {
                    throw new IllegalArgumentException("invalid Unicode");
                }
                i++;
            } else if (Character.isLowSurrogate(c)) {
                throw new IllegalArgumentException("invalid Unicode");
            }
        }
    }

    @FunctionalInterface public interface Work<T> { T run() throws Throwable; }
    @FunctionalInterface public interface Cleanup { void run() throws Throwable; }

    /** Exception-safe cleanup; does not claim to cancel arbitrary blocking I/O. */
    public static <T> T withCleanup(Work<T> work, Cleanup cleanup) throws Throwable {
        Objects.requireNonNull(work); Objects.requireNonNull(cleanup);
        Throwable primary = null;
        try {
            return work.run();
        } catch (Throwable failure) {
            primary = failure;
            if (failure instanceof InterruptedException) Thread.currentThread().interrupt();
            throw failure;
        } finally {
            try {
                cleanup.run();
            } catch (Throwable closing) {
                if (closing instanceof InterruptedException) Thread.currentThread().interrupt();
                if (primary == null) throw closing;
                if (closing != primary) primary.addSuppressed(closing);
            }
        }
    }
}

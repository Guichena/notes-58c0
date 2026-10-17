import java.io.*;
import java.nio.*;
import java.nio.charset.*;
import java.nio.file.*;
import java.security.*;
import java.time.*;
import java.util.*;

/** Deterministic work-log aggregation. No LLM, network, scheduler or message delivery. */
public final class WeeklyReport {
    public static final String HEADER = "event_id\ttask_id\tproject\towner\tat\tstatus\tminutes\tsummary\tnext_step";
    public enum Status { IN_PROGRESS, DONE, BLOCKED }
    public record Worklog(String eventId, String taskId, String project, String owner,
                          Instant at, Status status, int minutes, String summary, String nextStep) {
        public Worklog {
            id(eventId); id(taskId); field(project, 80, false); field(owner, 80, false);
            Objects.requireNonNull(at); Objects.requireNonNull(status);
            if (minutes < 0 || minutes > 1440) throw new IllegalArgumentException("MINUTES");
            field(summary, 300, false); field(nextStep, 300, true);
        }
    }
    public record Window(LocalDate monday, ZoneId zone, Instant start, Instant end) {
        public Window(LocalDate monday, ZoneId zone) {
            this(monday, zone, monday.atStartOfDay(zone).toInstant(), monday.plusDays(7).atStartOfDay(zone).toInstant());
        }
        public Window {
            Objects.requireNonNull(monday); Objects.requireNonNull(zone);
            if (monday.getDayOfWeek() != DayOfWeek.MONDAY || !start.equals(monday.atStartOfDay(zone).toInstant())
                    || !end.equals(monday.plusDays(7).atStartOfDay(zone).toInstant()) || !start.isBefore(end))
                throw new IllegalArgumentException("WINDOW");
        }
        boolean contains(Instant t) { return !t.isBefore(start) && t.isBefore(end); }
    }
    public record Task(String id, String project, String owner, Status status,
                       int minutes, String summary, String nextStep, String latestEvent, List<String> eventIds) { }
    public record Report(Window window, int inputRows, int uniqueRows, int duplicateRows,
                         int includedRows, int excludedRows, int totalMinutes,
                         List<Task> tasks, SortedMap<String, Integer> ownerMinutes,
                         SortedMap<String, Integer> projectMinutes, String snapshotSha256) { }
    private static final Comparator<Worklog> ORDER = Comparator.comparing(Worklog::at).thenComparing(Worklog::eventId);
    public static List<Worklog> parse(byte[] bytes) throws CharacterCodingException {
        if (bytes.length > 1_048_576) throw new IllegalArgumentException("BYTE_LIMIT");
        String text = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(bytes)).toString();
        String[] lines = text.split("\n", -1);
        if (lines.length == 0 || !stripCR(lines[0]).equals(HEADER)) throw new IllegalArgumentException("HEADER");
        List<Worklog> result = new ArrayList<>();
        for (int i = 1; i < lines.length; i++) {
            String line = stripCR(lines[i]);
            if (i == lines.length - 1 && line.isEmpty()) continue;
            if (result.size() >= 10000) throw new IllegalArgumentException("ROW_LIMIT");
            String[] p = line.split("\t", -1);
            if (p.length != 9) throw new IllegalArgumentException("COLUMNS:" + (i + 1));
            try {
                // An explicit offset is mandatory. Canonical storage/comparison uses Instant.
                Instant at = OffsetDateTime.parse(p[4]).toInstant();
                if (!p[6].matches("0|[1-9][0-9]{0,3}")) throw new IllegalArgumentException("MINUTES_FORMAT");
                result.add(new Worklog(p[0], p[1], p[2], p[3], at, Status.valueOf(p[5]),
                        Integer.parseInt(p[6]), p[7], p[8]));
            } catch (RuntimeException e) { throw new IllegalArgumentException("ROW:" + (i + 1), e); }
        }
        return List.copyOf(result);
    }
    private static String stripCR(String s) { return s.endsWith("\r") ? s.substring(0, s.length() - 1) : s; }
    static void id(String s) {
        if (s == null || !s.matches("[A-Za-z0-9_-]{1,64}")) throw new IllegalArgumentException("ID");
    }
    static void field(String s, int max, boolean allowEmpty) {
        if (s == null || !allowEmpty && s.isBlank() || s.codePointCount(0, s.length()) > max)
            throw new IllegalArgumentException("FIELD");
        if (allowEmpty && !s.isEmpty() && s.isBlank()) throw new IllegalArgumentException("BLANK_FIELD");
        for (int i = 0; i < s.length(); ) {
            int cp = s.codePointAt(i);
            int type = Character.getType(cp);
            if (Character.isISOControl(cp) || type == Character.FORMAT || type == Character.LINE_SEPARATOR
                    || type == Character.PARAGRAPH_SEPARATOR || cp >= 0xD800 && cp <= 0xDFFF)
                throw new IllegalArgumentException("CONTROL");
            i += Character.charCount(cp);
        }
    }
    public static Report aggregate(List<Worklog> input, Window window) {
        Objects.requireNonNull(input); Objects.requireNonNull(window);
        if (input.size() > 10000) throw new IllegalArgumentException("ROW_LIMIT");
        SortedMap<String, Worklog> unique = new TreeMap<>();
        for (Worklog log : input) {
            Objects.requireNonNull(log);
            Worklog old = unique.putIfAbsent(log.eventId(), log);
            if (old != null && !old.equals(log)) throw new IllegalArgumentException("EVENT_CONFLICT:" + log.eventId());
        }
        // Metadata consistency applies to the entire supplied snapshot, including excluded rows.
        Map<String, Worklog> identity = new HashMap<>();
        for (Worklog log : unique.values()) {
            Worklog old = identity.putIfAbsent(log.taskId(), log);
            if (old != null && (!old.project().equals(log.project()) || !old.owner().equals(log.owner())))
                throw new IllegalArgumentException("TASK_IDENTITY_CONFLICT:" + log.taskId());
        }
        SortedMap<String, List<Worklog>> grouped = new TreeMap<>();
        SortedMap<String, Integer> owners = new TreeMap<>(), projects = new TreeMap<>();
        int included = 0, total = 0;
        for (Worklog log : unique.values()) {
            if (!window.contains(log.at())) continue;
            included++; total = Math.addExact(total, log.minutes());
            owners.merge(log.owner(), log.minutes(), Math::addExact);
            projects.merge(log.project(), log.minutes(), Math::addExact);
            grouped.computeIfAbsent(log.taskId(), k -> new ArrayList<>()).add(log);
        }
        List<Task> tasks = new ArrayList<>();
        for (var group : grouped.entrySet()) {
            List<Worklog> logs = group.getValue(); logs.sort(ORDER);
            Worklog last = logs.getLast(); int minutes = 0;
            for (Worklog log : logs) minutes = Math.addExact(minutes, log.minutes());
            tasks.add(new Task(group.getKey(), last.project(), last.owner(), last.status(), minutes,
                    last.summary(), last.nextStep(), last.eventId(), logs.stream().map(Worklog::eventId).toList()));
        }
        return new Report(window, input.size(), unique.size(), input.size() - unique.size(), included,
                unique.size() - included, total, List.copyOf(tasks),
                Collections.unmodifiableSortedMap(owners), Collections.unmodifiableSortedMap(projects), digest(unique));
    }
    private static String digest(SortedMap<String, Worklog> logs) {
        try {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            try (DataOutputStream out = new DataOutputStream(bytes)) {
                out.writeUTF("worklog-snapshot-v1"); out.writeInt(logs.size());
                for (Worklog l : logs.values()) {
                    out.writeUTF(l.eventId()); out.writeUTF(l.taskId()); out.writeUTF(l.project()); out.writeUTF(l.owner());
                    out.writeUTF(l.at().toString()); out.writeUTF(l.status().name()); out.writeInt(l.minutes());
                    out.writeUTF(l.summary()); out.writeUTF(l.nextStep());
                }
            }
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes.toByteArray()));
        } catch (IOException | NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    // User text stays literal Markdown text; it never selects headings or runs as HTML/instructions.
    static String escape(String s) {
        StringBuilder out = new StringBuilder();
        for (char c : s.toCharArray()) {
            if (c == '&') out.append("&amp;"); else if (c == '<') out.append("&lt;");
            else if (c == '>') out.append("&gt;");
            else { if ("\\`*_{}[]()#+-.!|".indexOf(c) >= 0) out.append('\\'); out.append(c); }
        }
        return out.toString();
    }
    static String status(Status status) {
        return switch (status) { case DONE -> "已完成"; case BLOCKED -> "阻塞"; case IN_PROGRESS -> "进行中"; };
    }
    public static String render(Report r) {
        StringBuilder b = new StringBuilder(); Window w = r.window();
        b.append("# 周报：").append(w.monday()).append(" 至 ").append(w.monday().plusDays(6)).append('\n');
        b.append("\n时区：").append(w.zone().getId()).append("；区间：[").append(w.start()).append(", ").append(w.end()).append(")。\n");
        b.append("\n口径：仅统计区间内的增量工作记录；任务状态取本周最后一条记录，同一时刻按事件 ID 升序取最后一条。\n");
        b.append("\n输入 ").append(r.inputRows()).append(" 行；唯一事件 ").append(r.uniqueRows())
                .append("；完全重复 ").append(r.duplicateRows()).append("；纳入 ").append(r.includedRows())
                .append("；区间外 ").append(r.excludedRows()).append("。\n");
        b.append("\n## 概览\n\n");
        for (Status s : List.of(Status.DONE, Status.IN_PROGRESS, Status.BLOCKED)) {
            long n = r.tasks().stream().filter(t -> t.status() == s).count();
            b.append("- ").append(status(s)).append("任务：").append(n).append('\n');
        }
        b.append("- 记录工时：").append(r.totalMinutes()).append(" 分钟（自报增量之和，不代表产出或在线时长）\n");
        b.append("\n## 按负责人汇总\n\n");
        if (r.ownerMinutes().isEmpty()) b.append("本周无记录。\n");
        r.ownerMinutes().forEach((k, v) -> b.append("- ").append(escape(k)).append("：").append(v).append(" 分钟\n"));
        b.append("\n## 按项目汇总\n\n");
        if (r.projectMinutes().isEmpty()) b.append("本周无记录。\n");
        r.projectMinutes().forEach((k, v) -> b.append("- ").append(escape(k)).append("：").append(v).append(" 分钟\n"));
        b.append("\n## 任务进展\n\n");
        if (r.tasks().isEmpty()) b.append("本周无记录；不能由此推断所有任务已完成或没有阻塞。\n");
        for (Task t : r.tasks()) {
            b.append("- ").append(escape(t.id())).append("｜").append(escape(t.project())).append("｜")
                    .append(escape(t.owner())).append("｜").append(status(t.status())).append("｜")
                    .append(t.minutes()).append(" 分钟：").append(escape(t.summary())).append('\n');
            b.append("  - 依据事件：").append(escape(String.join(", ", t.eventIds())))
                    .append("；最后事件：").append(escape(t.latestEvent())).append('\n');
        }
        b.append("\n## 阻塞与后续计划\n\n");
        boolean any = false;
        for (Task t : r.tasks()) {
            if (t.status() != Status.BLOCKED && t.nextStep().isEmpty()) continue;
            any = true;
            b.append("- ").append(escape(t.id())).append("：")
                    .append(t.status() == Status.BLOCKED ? "阻塞；" : "")
                    .append(t.nextStep().isEmpty() ? "后续计划未提供，待负责人补充" : escape(t.nextStep())).append('\n');
        }
        if (!any) b.append("未提供后续计划；不能推断下周没有任务。\n");
        b.append("\n数据快照 SHA-256：").append(r.snapshotSha256()).append('\n');
        b.append("\n本文由确定性模板生成；摘要与后续计划保留输入含义，未调用模型，未自动发送。\n");
        return b.toString();
    }
    public static String generate(Path input, String monday, String zone) throws IOException {
        byte[] bytes;
        try (InputStream in = Files.newInputStream(input)) { bytes = in.readNBytes(1_048_577); }
        Window window = new Window(LocalDate.parse(monday), ZoneId.of(zone));
        return render(aggregate(parse(bytes), window));
    }
    public static void main(String[] args) {
        if (args.length != 3) { System.err.println("Usage: WeeklyReport input.tsv YYYY-MM-DD ZoneId"); System.exit(2); }
        try { System.out.print(generate(Path.of(args[0]), args[1], args[2])); }
        catch (Exception e) { System.err.println("ERROR: invalid configuration, input or I/O"); System.exit(2); }
    }
}

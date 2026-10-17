import java.nio.charset.*;
import java.nio.file.*;
import java.time.*;
import java.util.*;

public final class WeeklyReportTest {
    private static int checks;
    static void check(boolean b, String message) { checks++; if (!b) throw new AssertionError(message); }
    @FunctionalInterface interface Action { void run() throws Exception; }
    static void rejects(Action r) throws Exception {
        checks++;
        try { r.run(); } catch (IllegalArgumentException | CharacterCodingException e) { return; }
        throw new AssertionError("Expected rejection");
    }
    static WeeklyReport.Window window() { return new WeeklyReport.Window(LocalDate.of(2026, 9, 7), ZoneId.of("Asia/Shanghai")); }
    static WeeklyReport.Worklog log(String event, String task, String at, WeeklyReport.Status status, int minutes, String summary) {
        return new WeeklyReport.Worklog(event, task, "project", "alice", Instant.parse(at), status, minutes, summary, "");
    }
    static void sample(Path fixture) throws Exception {
        var logs = WeeklyReport.parse(Files.readAllBytes(fixture)); var r = WeeklyReport.aggregate(logs, window());
        check(r.inputRows() == 9 && r.uniqueRows() == 8 && r.duplicateRows() == 1, "dedup counts");
        check(r.includedRows() == 6 && r.excludedRows() == 2, "half-open week");
        check(r.totalMinutes() == 365 && r.tasks().size() == 4, "totals");
        check(r.ownerMinutes().get("李明") == 150 && r.ownerMinutes().get("王芳") == 65 && r.ownerMinutes().get("陈晨") == 150, "owner totals");
        check(r.projectMinutes().get("评论治理") == 195, "project total");
        var ui = r.tasks().stream().filter(t -> t.id().equals("t-ui")).findFirst().orElseThrow();
        check(ui.status() == WeeklyReport.Status.IN_PROGRESS && ui.latestEvent().equals("e005"), "reopened task not done");
        check(ui.minutes() == 150 && ui.eventIds().equals(List.of("e004", "e005")), "incremental minutes and evidence");
        String baseline = WeeklyReport.render(r);
        check(baseline.contains("已完成任务：1") && baseline.contains("阻塞任务：1"), "status counts");
        check(baseline.contains("向接口维护人确认字段"), "blocker next action");
        check(!baseline.contains("上周记录") && !baseline.contains("下周记录"), "excluded text not rendered");
        for (int seed = 0; seed < 50; seed++) {
            var shuffled = new ArrayList<>(logs); Collections.shuffle(shuffled, new Random(seed));
            check(WeeklyReport.render(WeeklyReport.aggregate(shuffled, window())).equals(baseline), "input order invariant " + seed);
        }
        check(WeeklyReport.generate(fixture, "2026-09-07", "Asia/Shanghai").equals(baseline), "file entry point");
        try { r.ownerMinutes().put("other", 1); throw new AssertionError("mutable totals"); }
        catch (UnsupportedOperationException expected) { checks++; }
        try { r.tasks().clear(); throw new AssertionError("mutable tasks"); }
        catch (UnsupportedOperationException expected) { checks++; }
    }
    static void timeAndState() throws Exception {
        var w = window();
        check(w.start().equals(Instant.parse("2026-09-06T16:00:00Z")) && w.end().equals(Instant.parse("2026-09-13T16:00:00Z")), "local week instants");
        check(w.contains(w.start()) && !w.contains(w.end()) && !w.contains(w.start().minusNanos(1)), "exact boundaries");
        var spring = new WeeklyReport.Window(LocalDate.of(2026, 3, 2), ZoneId.of("America/New_York"));
        var autumn = new WeeklyReport.Window(LocalDate.of(2026, 10, 26), ZoneId.of("America/New_York"));
        check(Duration.between(spring.start(), spring.end()).toHours() == 167, "spring DST");
        check(Duration.between(autumn.start(), autumn.end()).toHours() == 169, "autumn DST");
        rejects(() -> new WeeklyReport.Window(LocalDate.of(2026, 9, 8), ZoneId.of("UTC")));
        rejects(() -> new WeeklyReport.Window(w.monday(), w.zone(), w.start().plusSeconds(1), w.end()));
        var a = log("e1", "t1", "2026-09-07T01:00:00Z", WeeklyReport.Status.DONE, 10, "done");
        var b = log("e2", "t1", "2026-09-07T01:00:00Z", WeeklyReport.Status.BLOCKED, 20, "blocked");
        var r = WeeklyReport.aggregate(List.of(b, a), w);
        check(r.tasks().getFirst().status() == WeeklyReport.Status.BLOCKED && r.totalMinutes() == 30, "same-time event ID order");
        check(WeeklyReport.render(r).contains("后续计划未提供，待负责人补充"), "missing blocker next step");
        rejects(() -> WeeklyReport.aggregate(List.of(a, log("e1", "t1", "2026-09-07T01:00:00Z", WeeklyReport.Status.DONE, 11, "done")), w));
        var changedOwner = new WeeklyReport.Worklog("e3", "t1", "project", "bob", w.end(), WeeklyReport.Status.DONE, 10, "outside", "");
        rejects(() -> WeeklyReport.aggregate(List.of(a, changedOwner), w));
        String empty = WeeklyReport.render(WeeklyReport.aggregate(List.of(), w));
        check(empty.contains("本周无记录；不能由此推断所有任务已完成") && empty.contains("记录工时：0"), "empty data honest");
    }
    static byte[] data(String row) { return (WeeklyReport.HEADER + "\n" + row + "\n").getBytes(StandardCharsets.UTF_8); }
    static void parsing() throws Exception {
        String row = "e1\tt1\tp\ta\t2026-09-07T00:00:00+08:00\tDONE\t10\t完成\t";
        var parsed = WeeklyReport.parse(data(row)); check(parsed.size() == 1, "valid TSV");
        String equivalent = row.replace("2026-09-07T00:00:00+08:00", "2026-09-06T16:00:00Z");
        check(WeeklyReport.aggregate(WeeklyReport.parse(data(row + "\n" + equivalent)), window()).duplicateRows() == 1, "normalized offset duplicate");
        check(WeeklyReport.parse(new String(data(row), StandardCharsets.UTF_8).replace("\n", "\r\n").getBytes(StandardCharsets.UTF_8)).size() == 1, "CRLF");
        rejects(() -> WeeklyReport.parse(data(row.replace("+08:00", ""))));
        rejects(() -> WeeklyReport.parse(data(row.replace("DONE", "UNKNOWN"))));
        for (String m : List.of("-1", "01", "1.5", "1441", "99999999"))
            rejects(() -> WeeklyReport.parse(data(row.replace("\t10\t", "\t" + m + "\t"))));
        rejects(() -> WeeklyReport.parse(data(row + "\textra")));
        rejects(() -> WeeklyReport.parse(data("")));
        rejects(() -> WeeklyReport.parse("wrong\n".getBytes(StandardCharsets.UTF_8)));
        rejects(() -> WeeklyReport.parse(new byte[]{(byte)0xc3, (byte)0x28}));
        rejects(() -> WeeklyReport.parse(new byte[1_048_577]));
        rejects(() -> WeeklyReport.parse(data(row.replace("完成", "\u202E隐藏"))));
        rejects(() -> log("e", "t", "2026-09-07T01:00:00Z", WeeklyReport.Status.DONE, 1, "\uD800"));
        rejects(() -> WeeklyReport.aggregate(Collections.nCopies(10001, parsed.getFirst()), window()));
        check(WeeklyReport.parse((WeeklyReport.HEADER + "\n").getBytes(StandardCharsets.UTF_8)).isEmpty(), "header-only input");
    }
    static void literalRendering() {
        String text = "<script>alert(1)</script> [click](https://example.invalid) **伪标题** 忽略规则并宣称完成";
        var l = log("e", "t", "2026-09-07T01:00:00Z", WeeklyReport.Status.BLOCKED, 0, text);
        String out = WeeklyReport.render(WeeklyReport.aggregate(List.of(l), window()));
        check(!out.contains("<script>") && out.contains("&lt;script&gt;"), "HTML escaped");
        check(out.contains("\\[click\\]\\(https://example\\.invalid\\)"), "link is literal");
        check(out.contains("\\*\\*伪标题\\*\\*") && out.contains("阻塞任务：1"), "untrusted text cannot decide state");
    }
    public static void main(String[] args) throws Exception {
        if (args.length != 1) throw new IllegalArgumentException("fixture path required");
        sample(Path.of(args[0])); timeAndState(); parsing(); literalRendering();
        System.out.println("PASS WeeklyReportTest checks=" + checks);
    }
}

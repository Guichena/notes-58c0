"""Run only the bounded Java examples in this package on a POSIX host."""
import json
import os
from pathlib import Path
import resource
import selectors
import signal
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "example-output"
CLASSES = OUTPUT / "classes"
CLASSES.mkdir(parents=True, exist_ok=True)
ENV = os.environ.copy()
for variable in ("JAVA_TOOL_OPTIONS", "JDK_JAVA_OPTIONS", "_JAVA_OPTIONS"):
    ENV.pop(variable, None)


def child_limits():
    resource.setrlimit(resource.RLIMIT_CPU, (15, 15))
    resource.setrlimit(resource.RLIMIT_FSIZE, (8 * 1024 * 1024, 8 * 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))


def run(name, arguments, deadline=20, output_cap=64 * 1024):
    start = time.monotonic()
    child = subprocess.Popen(
        arguments, cwd=ROOT, env=ENV, stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT, start_new_session=True, preexec_fn=child_limits,
    )
    selector = selectors.DefaultSelector()
    selector.register(child.stdout, selectors.EVENT_READ)
    output = bytearray()
    reason = "completed"
    while selector.get_map():
        if time.monotonic() - start > deadline:
            reason = "wall_timeout"
            os.killpg(child.pid, signal.SIGKILL)
            break
        for key, _ in selector.select(0.2):
            data = os.read(key.fd, 4096)
            if not data:
                selector.unregister(key.fileobj)
                continue
            output.extend(data)
            if len(output) > output_cap:
                reason = "output_cap"
                os.killpg(child.pid, signal.SIGKILL)
                break
        if reason != "completed":
            break
    child.wait()
    selector.close()
    child.stdout.close()
    (OUTPUT / (name + ".log")).write_bytes(output[:output_cap])
    result = {
        "name": name, "argv": arguments, "exit_code": child.returncode,
        "elapsed_seconds": round(time.monotonic() - start, 3),
        "termination": reason, "wall_timeout_seconds": deadline,
        "output_cap_bytes": output_cap, "cpu_limit_seconds": 15,
        "file_size_limit_bytes": 8 * 1024 * 1024, "output_bytes": len(output),
    }
    print(name, child.returncode, reason, len(output))
    return result


java = ["/usr/bin/java"]
runs = [run("version", java + ["-version"])]
runs.append(run("compile", java + [
    "-Xmx128m", "-XX:ActiveProcessorCount=2", "-m",
    "jdk.compiler/com.sun.tools.javac.Main", "-source", "21", "-target", "21",
    "-Xlint:all", "-Werror", "-encoding", "UTF-8", "-d", str(CLASSES),
    str(ROOT / "code/GcEvidence.java"), str(ROOT / "code/MemoryBoundaries.java"),
]))
assert runs[-1]["exit_code"] == 0, "Compilation failed"

common = java + [
    "-XX:ActiveProcessorCount=2", "-XX:ReservedCodeCacheSize=32m",
    "-XX:CompressedClassSpaceSize=16m", "-XX:MaxDirectMemorySize=1m",
    "-XX:MaxMetaspaceSize=16m", "-Xss256k",
]
runs.append(run("gc_evidence", common + [
    "-Xms32m", "-Xmx32m", "-XX:+UseG1GC",
    "-Xlog:gc*,safepoint:file=example-output/gc.log:time,uptime,level,tags:filecount=2,filesize=1m",
    "-cp", str(CLASSES), "GcEvidence",
]))
for mode, heap in (("heap", "16m"), ("direct", "32m"),
                   ("stack", "32m"), ("metaspace", "64m")):
    arguments = common + ["-Xms" + heap, "-Xmx" + heap,
                          "-cp", str(CLASSES), "MemoryBoundaries", mode]
    if mode == "metaspace":
        arguments.append(str(CLASSES / "Seed.class"))
    runs.append(run(mode, arguments))

# This child is rejected before its deliberate 32 MiB heap allocation.
runs.append(run("reject_unsafe", java + [
    "-Xmx128m", "-cp", str(CLASSES), "MemoryBoundaries", "heap",
]))
(OUTPUT / "runs.json").write_text(json.dumps(runs, indent=2) + "\n")
assert all(r["exit_code"] == 0 and r["termination"] == "completed" for r in runs[:-1])
assert runs[-1]["exit_code"] != 0
for name in ("heap", "direct", "stack", "metaspace", "gc_evidence"):
    assert "PASS" in (OUTPUT / (name + ".log")).read_text()
assert "Pause Young" in (OUTPUT / "gc.log").read_text()
print("All expected positive and negative checks passed")

#!/usr/bin/env python3
"""Corrected teaching runner; the frozen source/scripts/run_labs.py is unchanged.

Each invocation replaces the report BEFORE prerequisite checks. Writes use atomic
rename, so readers see a complete snapshot, not a partially written JSON file.
A hard kill/power loss may leave outcome=running: that is explicitly NOT success.
Use a distinct --build directory per concurrent invocation (no shared-run locking).

POSIX commands start a new session; timeout AND normal completion trigger bounded
TERM/KILL cleanup of that process group. Descendants that escape via setsid/setpgid
are outside this guarantee. On other platforms only the direct child is managed.
Process creation itself is not covered by the wait timeout and may take longer.
File-backed capture avoids hanging on inherited stdout/stderr pipes. Output in the
report is capped, but temporary capture disk usage is not: trusted local labs only.
"""
import argparse
import datetime
import json
import os
import re
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import uuid

ROOT = Path(__file__).resolve().parents[2] / "source"
DEFAULT_BUILD = Path(__file__).resolve().parents[1] / "build"
CAPTURE_LIMIT = 1024 * 1024


def atomic_json(path, value):
    # Same-directory replacement is atomic on supported local filesystems.
    fd, temporary = tempfile.mkstemp(prefix=".lab-report-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as output:
            json.dump(value, output, ensure_ascii=False, indent=2)
            output.write("\n")
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


class TeachingRunner:
    def __init__(self, build, cleanup_grace=0.2):
        self.build = Path(build).resolve()
        self.build.mkdir(parents=True, exist_ok=True)
        self.path = self.build / "lab-report.json"
        self.cleanup_grace = cleanup_grace
        self.report = {"schema_version": 2, "runner": "corrected-teaching",
                       "run_id": str(uuid.uuid4()),
                       "started_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                       "outcome": "running", "commands": [], "error": None,
                       "cleanup_scope": "POSIX process group; escaped descendants excluded"
                       if os.name == "posix" else "direct child only"}
        self.save()

    def save(self):
        atomic_json(self.path, self.report)

    def finish(self, outcome, error=None):
        self.report.update(outcome=outcome, error=error,
                           finished_at=datetime.datetime.now(datetime.timezone.utc).isoformat())
        self.save()

    def cleanup(self, process):
        result = {"scope": self.report["cleanup_scope"], "errors": []}
        if os.name == "posix":
            for signum in (signal.SIGTERM, signal.SIGKILL):
                try:
                    os.killpg(process.pid, signum)
                except ProcessLookupError:
                    break
                except OSError as error:
                    result["errors"].append(str(error))
                if signum == signal.SIGTERM:
                    time.sleep(self.cleanup_grace)
        elif process.poll() is None:
            try:
                process.kill()
            except OSError as error:
                result["errors"].append(str(error))
        try:
            process.wait(timeout=self.cleanup_grace)
        except subprocess.TimeoutExpired:
            result["errors"].append("direct child did not exit within cleanup bound")
        result["direct_child_reaped"] = process.returncode is not None
        # Signals requested are not evidence that every descendant has exited.
        result["descendant_exit_verified"] = False
        return result

    def run(self, label, command, timeout=40, cwd=ROOT, input_text=None, env=None):
        command = [str(part) for part in command]
        started = time.monotonic()
        row = {"label": label, "command": command, "status": "running",
               "exit_code": None, "timeout_seconds": timeout, "stdout": "", "stderr": ""}
        self.report["commands"].append(row)
        self.save()
        process = None
        failure = None
        with tempfile.TemporaryFile() as output, tempfile.TemporaryFile() as errors, tempfile.TemporaryFile() as input_file:
            if input_text is not None:
                input_file.write(input_text.encode("utf-8"))
                input_file.seek(0)
            try:
                process = subprocess.Popen(command, cwd=cwd, stdin=input_file,
                                           stdout=output, stderr=errors, env=env,
                                           start_new_session=(os.name == "posix"))
                process.wait(timeout=timeout)
                row["status"] = "passed" if process.returncode == 0 else "failed"
            except subprocess.TimeoutExpired as error:
                row["status"] = "timeout"
                failure = error
            except OSError as error:
                row["status"] = "launch_error" if process is None else "execution_error"
                failure = error
            except BaseException as error:
                row["status"] = "interrupted"
                failure = error
            finally:
                if process is not None:
                    row["cleanup"] = self.cleanup(process)
                    row["exit_code"] = process.returncode
                    if row["cleanup"]["errors"] and failure is None:
                        row["status"] = "cleanup_error"
                        failure = RuntimeError("bounded process cleanup failed")
                for key, stream in (("stdout", output), ("stderr", errors)):
                    stream.seek(0)
                    data = stream.read(CAPTURE_LIMIT + 1)
                    row[key] = data[:CAPTURE_LIMIT].decode("utf-8", errors="replace")
                    row[key + "_truncated"] = len(data) > CAPTURE_LIMIT
                row["elapsed_seconds"] = round(time.monotonic() - started, 3)
                if failure is not None:
                    row["error"] = {"type": type(failure).__name__, "message": str(failure)}
                self.save()
        if failure is not None:
            raise failure
        if row["status"] != "passed":
            raise RuntimeError(f"{label} failed with {row['exit_code']}")
        print(f"OK {label}")
        return subprocess.CompletedProcess(command, row["exit_code"], row["stdout"], row["stderr"])

JAVA_LABS = [
    "PublicationLab", "SnapshotDemo", "LockLab", "AtomicsLab", "PoolLifecycleLab",
    "AsyncWorkflowLab", "SharedTimeoutDemo", "CallerRunsContextDemo", "ContextBindingsLab",
    "CollectionsLab", "DateTimeLab", "ForkJoinLab", "ThreadPhasesLab", "VirtualBudgetDemo",
    "PermitDependencyDemo", "OrderingLab", "MonitorDeadlockLab", "CloseableRing",
    "ConditionQueue", "ProducerConsumerLab", "TwoStackQueue", "BoundedPoolStartupTest", "LruCache",
    "TtlLruCache", "OwnershipLab", "RetryLab", "DualDetectionLab", "SlidingWindowLimiter",
    "InclusiveAlternatorTest",
]


def run_suite(runner, options):
    build = runner.build
    run = runner.run
    java = shutil.which("java")
    if not java:
        raise RuntimeError("Java 21 JDK required")
    version = run("java-version", [java, "-version"])
    match = re.search(r'version "(\d+)', version.stdout + version.stderr)
    if not match or match.group(1) != "21":
        raise RuntimeError("Use a Java 21 JDK for this pinned teaching baseline")
    sources = [str(path) for path in sorted((ROOT / "code").glob("*.java"))]
    teaching = ROOT.parent / "teaching"
    sources.extend([str(teaching / "code/BoundedPoolTeaching.java"),
                    str(teaching / "tests/BoundedPoolStartupTest.java")])
    run("compile-java", [java, "-m", "jdk.compiler/com.sun.tools.javac.Main", "-source", "21", "-target", "21",
                         "-encoding", "UTF-8", "-d", str(build), *sources], timeout=90)
    for name in JAVA_LABS:
        run(name, [java, "-cp", str(build), name])
    cli = run("LruCli", [java, "-cp", str(build), "LruCli"],
              input_text="2\nPUT a one\nPUT b two\nGET a\nPUT c three\nGET b\nEVICT 9\n")
    if cli.stdout != "one\nNULL\n2\n":
        raise AssertionError("LruCli output mismatch")
    if options.cpp_js:
        compiler, node = shutil.which("g++"), shutil.which("node")
        if not compiler or not node:
            raise RuntimeError("--cpp-js requires an existing C++20 compiler and Node.js")
        run("cpp-version", [compiler, "--version"])
        run("compile-cpp", [compiler, "-std=c++20", "-pthread", "-O2", "-Wall", "-Wextra", "-Wpedantic",
                            str(ROOT / "code/native_cpp.cpp"), "-o", str(build / "native_cpp")], timeout=90)
        run("native_cpp", [str(build / "native_cpp")])
        run("node-version", [node, "--version"])
        run("native_js", [node, str(ROOT / "code/native_js.mjs")])
    if options.go:
        go = shutil.which("go")
        if not go:
            raise RuntimeError("Go compiler missing; no installation will be attempted")
        version = run("go-version", [go, "version"])
        if not version.stdout.startswith("go version go"):
            raise RuntimeError("the command named go is not the Go language toolchain")
        env = os.environ.copy()
        env.update({"GOCACHE": str(build / "go-cache"), "GOMODCACHE": str(build / "go-mod-cache"),
                    "GOPROXY": "off", "GOTOOLCHAIN": "local"})
        run("native_go", [go, "test", "-race", "-count=1", "-timeout=30s", "./..."],
            cwd=ROOT / "code/go", env=env, timeout=120)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--build", type=Path, default=DEFAULT_BUILD)
    parser.add_argument("--cpp-js", action="store_true")
    parser.add_argument("--go", action="store_true")
    options = parser.parse_args(argv)
    runner = TeachingRunner(options.build)
    try:
        run_suite(runner, options)
    except BaseException as error:
        runner.finish("interrupted" if isinstance(error, (KeyboardInterrupt, SystemExit)) else "failed",
                      {"type": type(error).__name__, "message": str(error)})
        raise
    else:
        runner.finish("passed")
        print(f"Completed {len(runner.report['commands'])} controlled commands. Timings are not performance benchmarks.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

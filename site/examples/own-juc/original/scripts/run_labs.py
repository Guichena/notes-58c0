#!/usr/bin/env python3
"""Compile and run controlled local examples. No services, downloads or package installation."""
import argparse
import json
import os
import re
from pathlib import Path
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
JAVA_LABS = [
    "PublicationLab", "SnapshotDemo", "LockLab", "AtomicsLab", "PoolLifecycleLab",
    "AsyncWorkflowLab", "SharedTimeoutDemo", "CallerRunsContextDemo", "ContextBindingsLab",
    "CollectionsLab", "DateTimeLab", "ForkJoinLab", "ThreadPhasesLab", "VirtualBudgetDemo",
    "PermitDependencyDemo", "OrderingLab", "MonitorDeadlockLab", "CloseableRing",
    "ConditionQueue", "ProducerConsumerLab", "TwoStackQueue", "BoundedPool", "LruCache",
    "TtlLruCache", "OwnershipLab", "RetryLab", "DualDetectionLab", "SlidingWindowLimiter",
    "InclusiveAlternatorTest",
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--build", type=Path, default=ROOT / "build")
    parser.add_argument("--cpp-js", action="store_true", help="also require and run C++20 and Node.js")
    parser.add_argument("--go", action="store_true", help="also require Go 1.21+ and run its race-enabled tests")
    options = parser.parse_args()
    build = options.build.resolve()
    build.mkdir(parents=True, exist_ok=True)
    report = []

    def run(label, command, timeout=40, cwd=ROOT, input_text=None, env=None):
        started = time.monotonic()
        result = subprocess.run(command, cwd=cwd, input=input_text, text=True,
                                capture_output=True, timeout=timeout, env=env)
        report.append({"label": label, "command": command, "exit_code": result.returncode,
                       "elapsed_seconds": round(time.monotonic() - started, 3),
                       "stdout": result.stdout, "stderr": result.stderr})
        (build / "lab-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
        if result.returncode:
            sys.stderr.write(result.stdout + result.stderr)
            raise RuntimeError(f"{label} failed with {result.returncode}")
        print(f"OK {label}")
        return result

    java = shutil.which("java")
    if not java:
        raise RuntimeError("Java 21 JDK required")
    version = run("java-version", [java, "-version"])
    match = re.search(r'version "(\d+)', version.stdout + version.stderr)
    if not match or match.group(1) != "21":
        raise RuntimeError("Use a Java 21 JDK for this pinned teaching baseline")
    sources = [str(path) for path in sorted((ROOT / "code").glob("*.java"))]
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
    print(f"Completed {len(report)} controlled commands. Timings are not performance benchmarks.")


if __name__ == "__main__":
    main()

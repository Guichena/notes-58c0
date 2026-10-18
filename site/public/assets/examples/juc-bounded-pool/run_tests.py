#!/usr/bin/env python3
"""Run only the bounded-pool exercises, with an existing Java 21+ JDK."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile


def main():
    root = Path(__file__).resolve().parent
    java_home = os.environ.get("JAVA_HOME")
    java = str(Path(java_home) / "bin" / ("java.exe" if os.name == "nt" else "java")) if java_home else shutil.which("java")
    if not java:
        raise SystemExit("Java is unavailable. Use an installed Java 21+ JDK.")
    def run(arguments, timeout=30):
        command = [java, *arguments]
        result = subprocess.run(command, text=True, encoding="utf-8", errors="replace",
                                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=timeout)
        print(result.stdout, end="", flush=True)
        if result.returncode:
            raise SystemExit(result.returncode)
        return result.stdout
    run(["-version"])
    with tempfile.TemporaryDirectory(prefix="bounded-pool-tests-") as build:
        sources = [root / name for name in (
            "Checks.java", "BoundedPoolTeaching.java", "BoundedPoolStartupTest.java",
            "BoundedPoolContractTest.java")]
        run(["-m", "jdk.compiler/com.sun.tools.javac.Main", "-source", "21", "-target", "21",
             "-encoding", "UTF-8", "-d", build, *map(str, sources)])
        for test, marker in [
                ("BoundedPoolStartupTest", "BoundedPoolStartupTest OK: registration/start/post-start"),
                ("BoundedPoolContractTest", "BoundedPoolContractTest OK: interrupt/await/dequeue/TPE/CallerRuns")]:
            output = run(["-cp", build, test])
            if marker not in output:
                raise AssertionError("Required success marker missing: " + marker)
    print("Bounded-pool tests passed.", flush=True)


if __name__ == "__main__":
    main()

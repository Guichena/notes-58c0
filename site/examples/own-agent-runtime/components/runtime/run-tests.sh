#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
build="$(mktemp -d "${TMPDIR:-/tmp}/agent-runtime-classes.XXXXXX")"
trap 'rm -rf "$build"' EXIT
if command -v javac >/dev/null 2>&1; then
  javac -encoding UTF-8 --release 17 -d "$build" src/*.java tests/*.java
else
  # Minimal JDK images may include the compiler module but no javac/ct.sym.
  # This fallback checks Java 17 syntax and class format, NOT Java 17 API availability.
  java -m jdk.compiler/com.sun.tools.javac.Main -encoding UTF-8 \
    -source 17 -target 17 -d "$build" src/*.java tests/*.java
fi
java -ea -cp "$build" RuntimeAdversarialTest
java -ea -cp "$build" ProtocolAndGraphTest
java -ea -cp "$build" ApiLogCliTest
(cd validator-example && sh test.sh)

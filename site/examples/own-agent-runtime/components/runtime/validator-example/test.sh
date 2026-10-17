#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
mkdir -p build
# This uses the installed JDK compiler module; javac need not be on PATH.
java -m jdk.compiler/com.sun.tools.javac.Main -encoding UTF-8 -source 17 -target 17 -d build Validator.java ValidatorTest.java
java -Xmx256m -cp build ValidatorTest

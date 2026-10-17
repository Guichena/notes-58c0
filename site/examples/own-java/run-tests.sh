#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C.UTF-8
cd "$(dirname "$0")"
mkdir -p build/classes build/logs build/native build/negative
java -version 2> build/logs/java-version.txt
java -m jdk.compiler/com.sun.tools.javac.Main -version > build/logs/compiler-version.txt
mapfile -t sources < <(find code/java -name '*.java' -type f | sort)
java -m jdk.compiler/com.sun.tools.javac.Main -encoding UTF-8 -Xlint:all -Werror     -d build/classes "${sources[@]}" 2> build/logs/compile.txt
cp -R code/resources/. build/classes/
: > build/logs/java-tests.txt
for suite in FoundationsLab ApiCookbook MiniHashMap LockedValueMap ResourceLab     FrameDecoder RuntimeLab SerializationLab ModernJavaLab ApiQuickReference demo.ServiceLoaderLab; do
    java -cp build/classes "$suite" | tee -a build/logs/java-tests.txt
done
: > build/logs/negative-java.txt
for source in code/negative-java/*.java; do
    log="build/logs/negative-$(basename "$source" .java).txt"
    if java -m jdk.compiler/com.sun.tools.javac.Main -encoding UTF-8 -d build/negative "$source" >"$log" 2>&1; then
        echo "FAIL unexpectedly compiled: $source" >&2
        exit 1
    fi
    if ! grep -q 'error:' "$log"; then
        echo "FAIL no compiler diagnostic: $source" >&2
        exit 1
    fi
    echo "PASS expected compile failure: $source" | tee -a build/logs/negative-java.txt
done
g++ --version | head -n 1 > build/logs/cpp-version.txt
gcc --version | head -n 1 > build/logs/c-version.txt
g++ -std=c++20 -Wall -Wextra -Werror -pedantic -pthread code/native/qualifiers.cpp     -o build/native/qualifiers 2> build/logs/cpp-compile.txt
gcc -std=c23 -Wall -Wextra -Werror -pedantic code/native/typeof.c     -o build/native/typeof 2> build/logs/c-compile.txt
build/native/qualifiers | tee build/logs/cpp-tests.txt
build/native/typeof | tee build/logs/c-tests.txt
: > build/logs/negative-native.txt
for source in code/negative-native/*.cpp; do
    log="build/logs/negative-$(basename "$source" .cpp).txt"
    if g++ -std=c++20 -Wall -Wextra -pedantic "$source" -o build/negative/native >"$log" 2>&1; then
        echo "FAIL unexpectedly compiled: $source" >&2
        exit 1
    fi
    if ! grep -q 'error:' "$log"; then
        echo "FAIL no compiler diagnostic: $source" >&2
        exit 1
    fi
    echo "PASS expected compile failure: $source" | tee -a build/logs/negative-native.txt
done
echo "All teaching suites completed."

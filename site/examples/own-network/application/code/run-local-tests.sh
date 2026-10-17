#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p ../private/build
if command -v javac >/dev/null 2>&1; then
  javac -encoding UTF-8 -d ../private/build ./*.java
else
  java -m jdk.compiler/com.sun.tools.javac.Main -encoding UTF-8 -d ../private/build ./*.java
fi
for main in SseCodecDemo AuthDecision JsonByteSize RbacPolicy ProtobufVarint SseIncremental ReplayWindow CancelGeneration RefreshFamily AdaptiveLimit HttpStreamClientDemo; do
  java -cp ../private/build "$main"
done
for f in ./*.mjs; do node --check "$f"; done
node test-native.mjs
python3 test_trusted_client.py
# No package installation or outbound services are required by this runner.
g++ -std=c++17 -Wall -Wextra -Werror https_client.cpp $(pkg-config --cflags --libs libcurl) -o ../private/build/https_client
python3 test_https_local.py ../private/build/https_client

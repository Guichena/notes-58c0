#!/bin/sh
set -eu
cd "$(dirname "$0")"
mkdir -p build
if command -v javac >/dev/null 2>&1; then
  javac -encoding UTF-8 -d build LruCache.java LruCacheTest.java
else
  java -m jdk.compiler/com.sun.tools.javac.Main -encoding UTF-8 -d build LruCache.java LruCacheTest.java
fi
java -cp build LruCacheTest

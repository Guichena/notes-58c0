#!/bin/sh
set -eu
# Run from the directory containing pom.xml. Needs a JDK 21 and the pinned JARs.
mkdir -p build/classes
java com.sun.tools.javac.Main -source 21 -target 21 -encoding UTF-8 -cp 'build/amqp-client-5.26.0.jar:build/slf4j-api-2.0.17.jar' -d build/classes src/*.java
timeout 15s java -ea -cp 'build/classes:build/*' RabbitLabTest

timeout 15s java -ea -cp 'build/classes:build/*' RabbitFailureTests

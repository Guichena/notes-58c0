#!/bin/sh
set -eu
# Run this administrator-owned script on an already exported immutable commit tree.
# It is not an installed Git hook and does not export, push, modify or execute repository code.
if [ "$#" -ne 1 ]; then
    printf 'Usage: run-gate.sh IMMUTABLE_SOURCE_TREE\n' >&2
    exit 2
fi
# env -i also removes JAVA_TOOL_OPTIONS/JDK_JAVA_OPTIONS before the coordinator starts.
exec /usr/bin/env -i LANG=C.UTF-8 HOME=/tmp PATH=/usr/bin:/bin \
    /opt/runtime-validator/jdk/bin/java -Xmx256m \
    -cp /opt/runtime-validator/classes Validator "$1"

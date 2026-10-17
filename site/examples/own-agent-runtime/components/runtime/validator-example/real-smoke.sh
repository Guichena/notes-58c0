#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
# Administrator-provisioned, read-only validator and PMD installation required.
# This script only scans the three included fixture directories. It installs nothing.
JAVA=/opt/runtime-validator/jdk/bin/java
CLASSES=/opt/runtime-validator/classes
expect() {
    expected=$1
    module=$2
    input=$3
    status=0
    output=$(/usr/bin/env -i LANG=C.UTF-8 HOME=/tmp PATH=/usr/bin:/bin \
        "$JAVA" -Xmx256m -cp "$CLASSES" Validator "$PWD/$input") || status=$?
    printf '%s\n' "$output"
    if [ "$status" -ne "$expected" ]; then
        printf 'Unexpected exit: %s, wanted %s for %s\n' "$status" "$expected" "$input" >&2
        exit 2
    fi
    if [ "$module" != clean ]; then
        tab=$(printf '\t')
        printf '%s\n' "$output" | grep -F "${module}${tab}FAIL${tab}" >/dev/null || exit 2
    fi
}
expect 0 clean real-fixtures/clean
expect 1 style real-fixtures/style-fail
expect 1 security real-fixtures/security-fail
printf 'Real PMD smoke tests passed\n'

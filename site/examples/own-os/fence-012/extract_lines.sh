#!/usr/bin/env bash
set -eu
if [ "$#" -ne 1 ]; then
    printf '%s\n' 'usage: extract_lines.sh FILE' >&2
    exit 2
fi
# Inclusive, one-based interval: 20000 - 10000 + 1 = 10001 lines.
# GNU sed Q quits without adding a missing final newline.
# Redirect stdin so a filename beginning with '-' is not an option to sed.
sed -n '10000,20000p;20000Q' < "$1"


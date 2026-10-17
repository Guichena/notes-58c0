#!/usr/bin/env bash
# Isolated Bash teaching fixture; does not inspect the caller's environment.
set -u
checks=0
expect() {
  if [[ $1 != "$2" ]]; then printf 'FAIL %s != %s\n' "$1" "$2" >&2; exit 1; fi
  checks=$((checks + 1))
}
false
rc=$?
expect "$rc" 1
if bash -c 'exit 7'; then
  exit 1
else
  rc=$?
fi
expect "$rc" 7
if ! false; then
  # This is the inverted compound status, not the original false status.
  expect "$?" 0
fi
false
printf ''
expect "$?" 0  # printf overwrote false's status.
set +o pipefail
bash -c 'exit 7' | cat
snapshot=( "$?" "${PIPESTATUS[@]}" )
expect "${snapshot[*]}" '0 7 0'
set -o pipefail
bash -c 'exit 7' | cat
snapshot=( "$?" "${PIPESTATUS[@]}" )
expect "${snapshot[*]}" '7 7 0'
printf '%s\n' abc | grep -q missing
rc=$?
expect "$rc" 1  # grep: no match, different from error status 2.
UNEXPORTED_OS009=local
expect "$(bash -c 'printf %s "${UNEXPORTED_OS009-unset}"')" unset
export EXPORTED_OS009=parent
expect "$(bash -c 'printf %s "$EXPORTED_OS009"')" parent
EXPORTED_OS009=one_command bash -c '[[ $EXPORTED_OS009 == one_command ]]'
expect "$?" 0
expect "$EXPORTED_OS009" parent
bash -c 'export EXPORTED_OS009=child'
expect "$EXPORTED_OS009" parent
printf 'PASS Bash status/environment %s checks\n' "$checks"


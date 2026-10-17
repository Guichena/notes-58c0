#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
export PYTHONDONTWRITEBYTECODE=1
mkdir -p java/classes work logs
exec > >(tee logs/latest.log) 2>&1
printf 'Environment\n'
java -version
python3 --version
H2=deps/h2-2.3.232.jar
python3 - "$H2" <<'PY'
import hashlib,pathlib,sys
p=pathlib.Path(sys.argv[1])
expected = '8dae62d22db8982c3dcb3826edb9c727c5d302063a67eef7d63d82de401f07d3'
try:
    actual = hashlib.sha256(p.read_bytes()).hexdigest()
except OSError as error:
    raise SystemExit(f'H2 dependency unavailable: {p}: {error.strerror}') from error
if actual != expected:
    raise SystemExit(f'H2 SHA-256 mismatch: {p}')
PY
java -m jdk.compiler/com.sun.tools.javac.Main -source 21 -target 21 -Xlint:all -Werror \
  -cp "$H2" -d java/classes java/src/interview/tools/*.java legacy/*.java
CP="java/classes:$H2"
java -ea -cp "$CP" interview.tools.ToolExecutorTest
java -ea -cp "$CP" interview.tools.DemoBackend
java -ea -cp "$CP" ToolWrapper
java -ea -cp "$CP" FieldPlanTest
run=$(mktemp -d "$PWD/work/recovery-XXXXXX")
java -ea -cp "$CP" OperationRecovery "$run/operations" "$run/receipt.txt"
python3 python/agent_runtime_demo.py
java -ea -cp "$CP" interview.tools.McpResponseGuard
java -ea -cp "$CP" interview.tools.McpInteropTest "$PWD/mcp/modern_server.py"
python3 mcp/test_modern.py
python3 mcp/http_contract.py
python3 mcp/test_dynamic.py
printf '\nALL LOCAL CONTRACT TESTS PASSED\n'
printf 'Retained local recovery evidence: %s\n' "$run"

#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
mkdir -p build test-results
{
 date -u +'%Y-%m-%dT%H:%M:%SZ'
 java -version 2>&1
 python --version
 python -B -c 'import numpy, sqlite3; print("NumPy",numpy.__version__); print("SQLite",sqlite3.sqlite_version)'
} > test-results/environment.txt
# Use the JDK compiler module; this also works if javac is not separately on PATH.
java com.sun.tools.javac.Main -Xlint:all -Werror -d build code/*.java
{
 for main in SimilarityMath MiniHnsw TokenChunkPlan RankFusionIndexed RetrievalSelection DeadlineBudget; do
  echo "== $main =="
  java -ea -cp build "$main"
 done
} > test-results/java-selftests.txt
{
 for main in PipelineContractTest DiagnosisContract BoundedWorkerDemo; do
  echo "== $main =="
  java -ea -cp build "$main"
 done
} > test-results/java-additional.txt
python -B code/test_pipeline.py > test-results/python-tests.txt 2>&1
python -B - <<'PY' > test-results/static-checks.txt
import ast,json,pathlib
p=pathlib.Path('.')
for f in p.glob('code/*.py'): ast.parse(f.read_text(),filename=str(f))
for f in p.glob('examples/diagnosis/*.json'): json.loads(f.read_text())
print('PASS: owned Python syntax; diagnosis JSON syntax only. No JSON Schema engine or Java JSON binding executed.')
print('NOT RUN: PostgreSQL, pgvector, MySQL, H2, FAISS search/train, models, OCR, Spring AI, LangGraph, Redis, ES, vector services or production traffic.')
PY
cat test-results/environment.txt test-results/java-selftests.txt test-results/java-additional.txt test-results/python-tests.txt test-results/static-checks.txt

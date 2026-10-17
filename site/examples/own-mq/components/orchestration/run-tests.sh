#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
# bash, Python 3, JDK 21. No broker, database server or credentials.
DEPS="${MQ_LAB_DEPS:-$PWD/.lab-deps}"
export DEPS
python3 - <<'PY'
import hashlib,json,os,pathlib,urllib.request
p=pathlib.Path(os.environ['DEPS']);p.mkdir(parents=True,exist_ok=True)
for row in json.load(open('dependencies.lock.json')):
 target=p/row['name']
 if not target.exists():
  with urllib.request.urlopen(row['url'],timeout=25) as response: b=response.read(8*1024*1024+1)
  if len(b)>8*1024*1024 or hashlib.sha256(b).hexdigest()!=row['sha256']:raise SystemExit('dependency verification failed')
  tmp=p/(row['name']+'.part');tmp.write_bytes(b);tmp.replace(target)
 if hashlib.sha256(target.read_bytes()).hexdigest()!=row['sha256']:raise SystemExit('cached dependency verification failed')
PY
BUILD="$(mktemp -d "${TMPDIR:-/tmp}/mq-manual-build.XXXXXXXX")"
trap 'rm -rf -- "$BUILD"' EXIT
CP="$DEPS/xxl-job-core-3.3.1.jar:$DEPS/slf4j-api-2.0.17.jar:$DEPS/h2-2.3.232.jar"
# This uses the exact JDK 21 system API, including stripped images without ct.sym.
java -Xmx128m -m jdk.compiler/com.sun.tools.javac.Main -source 21 -target 21 -encoding UTF-8 -Xlint:all -Werror -cp "$CP" -d "$BUILD" code/*.java tests/*.java
python3 - "$BUILD:$CP" <<'PY'
import subprocess,sys
for main,seconds,heap in [('JournalTests',45,'256m'),('TaskTests',30,'128m'),('BusinessTests',30,'128m'),('H2Tests',45,'192m'),('JdbcSafetyTests',10,'64m')]:
 subprocess.run(['java','-Xmx'+heap,'-cp',sys.argv[1],main],check=True,timeout=seconds)
PY

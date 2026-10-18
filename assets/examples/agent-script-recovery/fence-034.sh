mkdir -p classes
WORK=$(mktemp -d)
java com.sun.tools.javac.Main -Xlint:all -Werror -d classes src/*.java tests/*.java
java -cp classes ScriptCoreTests "$WORK/core"
java -cp classes LockLifecycleTests "$WORK/locks"
python tests/http_integration.py "$WORK/network"

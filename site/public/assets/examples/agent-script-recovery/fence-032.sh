mkdir -p classes
java com.sun.tools.javac.Main -Xlint:all -Werror -d classes src/*.java
java -cp classes ScriptService server jobs.json 0

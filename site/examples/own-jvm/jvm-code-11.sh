mkdir -p classes logs
java -Xmx128m -m jdk.compiler/com.sun.tools.javac.Main \
  -source 21 -target 21 -Xlint:all -Werror -encoding UTF-8 \
  -d classes GcEvidence.java
java -Xms32m -Xmx32m -XX:+UseG1GC \
  '-Xlog:gc*,safepoint:file=logs/gc.log:time,uptime,level,tags:filecount=2,filesize=1m' \
  -cp classes GcEvidence

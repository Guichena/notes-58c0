javac G1RegionEvidence.java
java -Xms16m -Xmx64m -XX:+UseG1GC -XX:G1HeapRegionSize=1m -Xlog:gc* G1RegionEvidence 1048576
java -Xms16m -Xmx64m -XX:+UseG1GC -XX:G1HeapRegionSize=2m -Xlog:gc* G1RegionEvidence 2097152

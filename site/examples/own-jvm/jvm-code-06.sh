javac TenuringEvidence.java
java -Xms16m -Xmx64m -XX:+UseG1GC -XX:MaxTenuringThreshold=1 TenuringEvidence 1
java -Xms16m -Xmx64m -XX:+UseG1GC -XX:MaxTenuringThreshold=8 TenuringEvidence 8

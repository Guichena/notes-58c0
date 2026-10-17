mkdir -p classes
java -Xmx128m -m jdk.compiler/com.sun.tools.javac.Main -source 21 -target 21 -d classes ShardTopK.java ShardTopKChecks.java
java -Xmx128m -cp classes ShardTopKChecks

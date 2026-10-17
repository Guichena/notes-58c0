mkdir -p classes
java -Xmx128m -m jdk.compiler/com.sun.tools.javac.Main -source 21 -target 21 -d classes AdRecall.java AdInvertedIndex.java AdIndexChecks.java
java -Xmx128m -cp classes AdIndexChecks

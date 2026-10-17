javac --release 17 -encoding UTF-8 -Xlint:all -d out *.java
java -ea -cp out MemoryLessonsTest
java -cp out MemoryFlowDemo

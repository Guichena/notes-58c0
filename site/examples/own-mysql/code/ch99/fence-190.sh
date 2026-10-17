cd components/data
mkdir -p build/classes
java -m jdk.compiler/com.sun.tools.javac.Main -source 21 -target 21 -Xlint:all -Werror -d build/classes code/*.java tests/ArchitectureTest.java tests/JdbcBoundaryTest.java
java -ea -cp build/classes ArchitectureTest
java -ea -cp build/classes JdbcBoundaryTest
python3 tests/test_values.py

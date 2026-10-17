mkdir -p build
java com.sun.tools.javac.Main -source 21 -target 21 -Xlint:all -Werror -d build *.java
java -cp build LocalChecks
python3 state_cas.py

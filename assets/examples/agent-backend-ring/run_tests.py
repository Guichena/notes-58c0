#!/usr/bin/env python3
"""Compile and test the adjacent Java sources in an owned temporary directory."""
import os,pathlib,shutil,subprocess,tempfile
root=pathlib.Path(__file__).resolve().parent
java=pathlib.Path(os.environ['JAVA_HOME'])/'bin'/('java.exe' if os.name=='nt' else 'java') if os.environ.get('JAVA_HOME') else shutil.which('java')
if not java:raise SystemExit('A complete JDK 21 or newer is required.')
with tempfile.TemporaryDirectory(prefix='closeable-ring-contract-') as d:
 cmd=[str(java),'-m','jdk.compiler/com.sun.tools.javac.Main','--source','21','--target','21','-encoding','UTF-8','-d',d,*map(str,[root/'Checks.java',root/'CloseableRing.java',root/'RingContractTest.java'])]
 subprocess.run(cmd,check=True,timeout=30)
 subprocess.run([str(java),'-cp',d,'RingContractTest'],check=True,timeout=40)

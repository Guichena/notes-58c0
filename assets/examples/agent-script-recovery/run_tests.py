#!/usr/bin/env python3
"""Run the unchanged teaching sources in a fresh local directory. Linux/macOS; JDK 21+."""
import os, pathlib, shutil, subprocess, sys, tempfile
ROOT = pathlib.Path(__file__).resolve().parent
java = str(pathlib.Path(os.environ['JAVA_HOME'])/'bin'/'java') if os.environ.get('JAVA_HOME') else shutil.which('java')
if not java: raise SystemExit('A complete JDK 21+ with jdk.compiler is required')
java = str(pathlib.Path(java).resolve())
env = dict(os.environ); env['PATH'] = str(pathlib.Path(java).parent)+os.pathsep+env.get('PATH','')
# Original HTTP test uses select on pipe FDs and is intended for POSIX, not Windows.
if os.name != 'posix': raise SystemExit('Original HTTP test requires Linux/macOS (POSIX pipes); no tests marked passed')
with tempfile.TemporaryDirectory(prefix='script-recovery-', dir=ROOT) as tmp:
    root=pathlib.Path(tmp); src=root/'src'; classes=root/'classes'; src.mkdir(); classes.mkdir()
    for file in ROOT.glob('*.java'): shutil.copyfile(file,src/file.name)
    shutil.copyfile(ROOT/'http_integration.py',src/'http_integration.py')
    def run(args, timeout=90):
        print('+ '+' '.join(map(str,args)),flush=True)
        subprocess.run(list(map(str,args)),cwd=root,env=env,check=True,timeout=timeout)
    run([java,'-m','jdk.compiler/com.sun.tools.javac.Main','-source','21','-target','21','-encoding','UTF-8','-d',classes,*sorted(src.glob('*.java'))])
    run([java,'-cp',classes,'ScriptControl'])
    run([java,'-cp',classes,'ScriptCoreTests',root/'core'])
    run([java,'-cp',classes,'LockLifecycleTests',root/'locks'])
    run([sys.executable,src/'http_integration.py',root/'http'],120)
print('PASS unchanged-source local experiment; no container, microVM, commercial sandbox, power-loss or production validation')

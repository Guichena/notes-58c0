#!/usr/bin/env python3
"""Test Java extracted from an explicitly supplied built dist, never a substitute implementation."""
import argparse,hashlib,html,json,os,pathlib,re,shutil,subprocess,tempfile
p=argparse.ArgumentParser();p.add_argument('--dist',required=True);p.add_argument('--fixtures',required=True);a=p.parse_args()
D=pathlib.Path(a.dist).resolve();F=pathlib.Path(a.fixtures).resolve()
entries={e['id']:e for f in (D/'data/chapters').glob('*.json') for e in json.load(open(f))['entries']}
source=entries['handwrite-56']['supplementHtml'];pre=[html.unescape(x) for x in re.findall(r'<pre\b[^>]*>([\s\S]*?)</pre>',source)]
contracts=json.load(open(F/'code-contract.json'))
transition=json.load(open(F/'remaining-practice-reconciliation.json'))
assert transition['schemaVersion']==1
for change in transition['sources']:
 c=next(c for c in contracts['sources'] if c['name']==change['name'])
 assert c['sha256']==change['beforeSha256'], 'historical source contract drift'
 c['sha256']=change['afterSha256']
java=pathlib.Path(os.environ['JAVA_HOME'])/'bin'/('java.exe'if os.name=='nt'else'java') if os.environ.get('JAVA_HOME') else shutil.which('java')
if not java:raise SystemExit('JDK 21+ required; runtime test not run.')
with tempfile.TemporaryDirectory(prefix='final-dist-ring-') as tmp:
 T=pathlib.Path(tmp)
 for c in contracts['sources']:
  match=[s for s in pre if c['classDeclaration'] in s];assert len(match)==1,(c['name'],'ambiguous/missing final-dist source')
  s=match[0];assert hashlib.sha256(s.encode()).hexdigest()==c['sha256'],c['name']+' final-dist implementation changed'
  (T/c['name']).write_text(s)
 test=(F/'RingContractTest.java').read_bytes();assert hashlib.sha256(test).hexdigest()==contracts['testSha256'],'test bytes changed';(T/'RingContractTest.java').write_bytes(test)
 subprocess.run([str(java),'-m','jdk.compiler/com.sun.tools.javac.Main','-source','21','-target','21','-encoding','UTF-8','-d',str(T),str(T/'Checks.java'),str(T/'CloseableRing.java'),str(T/'RingContractTest.java')],check=True,timeout=30)
 subprocess.run([str(java),'-cp',str(T),'RingContractTest'],check=True,timeout=40)
print(json.dumps({'status':'PASS_CURRENT_BUILT_JAVA_ONLY','dist':str(D),'sources':'handwrite-56.supplementHtml pre blocks','contentRelocationAccepted':False,'scope':'The same existing Java source is tested. Proposed answer relocation requires the separate actual-final verifier.'}))

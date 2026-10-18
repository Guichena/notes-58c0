#!/usr/bin/env python3
"""Read explicit built dist, execute only extracted current Java, and reject interrupt-swallowing mutants."""
import argparse,concurrent.futures,hashlib,html.parser,json,pathlib,re,shutil,subprocess,tempfile,zipfile
from bridge import PROOF,sha
class Parser(html.parser.HTMLParser):
 def __init__(self,text):super().__init__(convert_charrefs=True);self.active=False;self.blocks=[];self.feed(text)
 def handle_starttag(self,tag,attrs):
  if tag=='pre':assert not self.active;self.active=True;self.blocks.append('')
 def handle_endtag(self,tag):
  if tag=='pre':self.active=False
 def handle_data(self,text):
  if self.active:self.blocks[-1]+=text

def verify(dist,negative=True):
 dist=pathlib.Path(dist).resolve();assert (dist/'data/chapters').is_dir(),str(dist)
 entries={}
 for p in (dist/'data/chapters').glob('*.json'):
  for e in json.loads(p.read_text())['entries']:assert e['id'] not in entries;entries[e['id']]=e
 for eid,expected in PROOF['afterEntries'].items():assert entries[eid]==expected,('exact current entire entry',eid)
 sources={}
 for record in PROOF['sources']:
  name=record['class'];blocks=Parser(entries[record['entryId']][record['path'][0]]).blocks
  found=[b for b in blocks if re.search(r'\bclass\s+'+name+r'\b',b)];assert len(found)==1
  assert sha(found[0])==record['afterSha256'];sources[name]=found[0]
 checks=[b for b in Parser(entries['handwrite-56']['supplementHtml']).blocks if 'public final class Checks' in b];assert len(checks)==1;sources['Checks']=checks[0]
 for row in PROOF['assets']:assert sha((dist/row['distRelativePath']).read_bytes())==row['afterSha256'],('current asset',row['distRelativePath'])
 assert (dist/'assets/examples/agent-backend-ring/CloseableRing.java').read_text()==sources['CloseableRing']
 with zipfile.ZipFile(dist/'assets/examples/agent-backend-ring/closeable-ring-contract.zip') as z:assert z.read('CloseableRing.java').decode()==sources['CloseableRing']
 spec={
 'CloseableRing':('                notEmpty.awaitNanos(remaining);','                try { notEmpty.awaitNanos(remaining); } catch (InterruptedException swallowed) { BODY }','return new Pop<>(Status.TIMEOUT, null);'),
 'ConditionQueue':('            while (!closed && size == 0) notEmpty.await();','            while (!closed && size == 0) { try { notEmpty.await(); } catch (InterruptedException swallowed) { BODY } }','return null;'),
 'MonitorStack':('try{wait();}finally{waitingPoppers--;}','try{wait();}catch(InterruptedException swallowed){BODY}finally{waitingPoppers--;}','return Optional.empty();'),
 'TicketParking':('try{TimeUnit.NANOSECONDS.timedWait(this,left);}finally{waiting--;}','try{TimeUnit.NANOSECONDS.timedWait(this,left);}catch(InterruptedException swallowed){BODY}finally{waiting--;}','return false;')}
 java=shutil.which('java');assert java,'JDK required; runtime not run'
 def execute(directory,codes,name):
  directory.mkdir();paths=[]
  for k,v in codes.items():p=directory/(k+'.java');p.write_text(v);paths.append(str(p))
  c=subprocess.run([java,'-Xmx128m','-m','jdk.compiler/com.sun.tools.javac.Main','-encoding','UTF-8','-d',str(directory),*paths],text=True,capture_output=True,timeout=45);assert c.returncode==0,c.stderr
  r=subprocess.run([java,'-Xmx128m','-cp',str(directory),name],text=True,capture_output=True,timeout=20)
  return {'exitCode':r.returncode,'stdout':r.stdout,'stderr':r.stderr}
 runs=[]
 with tempfile.TemporaryDirectory(prefix='interruption-current-') as tmp:
  t=pathlib.Path(tmp)
  def task(row):
   name,mode=row;code=sources[name]
   if mode!='original':
    old,template,normal=spec[name];assert code.count(old)==1
    body={'swallow-return':normal,'wrong-exception':'throw new IllegalStateException("mutant wrong exception", swallowed);','worker-assertion':'throw new AssertionError("mutant worker assertion", swallowed);'}[mode]
    code=code.replace(old,template.replace('BODY',body),1)
   result=execute(t/(name+'-'+mode),{name:code,'Checks':sources['Checks']},name)
   if mode=='original':assert result['exitCode']==0,result
   else:
    assert result['exitCode']!=0,result
    assert 'Exception in thread "main" java.lang.AssertionError:' in result['stderr'] and 'must throw InterruptedException' in result['stderr'],result
    assert 'PASS:' not in result['stdout'] and ' OK' not in result['stdout'],result
    if mode=='wrong-exception':assert 'Caused by: java.lang.IllegalStateException: mutant wrong exception' in result['stderr']
    if mode=='worker-assertion':assert 'Caused by: java.lang.AssertionError: mutant worker assertion' in result['stderr']
   return dict(name=name,mode=mode,extractedSourceSha256=sha(sources[name]),executedSourceSha256=sha(code),**result)
  tasks=[(name,mode) for name in spec for mode in (['original','swallow-return','wrong-exception','worker-assertion'] if negative else ['original'])]
  with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:runs=list(pool.map(task,tasks))
 return {'status':'PASS_EXPLICIT_CURRENT_DIST','dist':str(dist),'currentSourceOnly':True,'positiveRuns':4,'mutantsRejectedOnMain':12 if negative else 0,'exactLeaves':2,'exactSources':4,'siteWrites':0,'runs':runs}
if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--dist',required=True);args=ap.parse_args();print(json.dumps(verify(args.dist),ensure_ascii=False,indent=2))

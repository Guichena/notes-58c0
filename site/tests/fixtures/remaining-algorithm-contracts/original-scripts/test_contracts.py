import pathlib,json,re,html,subprocess,hashlib,argparse,copy,sys
P=pathlib.Path(__file__).resolve().parent
p=argparse.ArgumentParser();p.add_argument('--site',type=pathlib.Path);p.add_argument('--negative-proofs',action='store_true');p.add_argument('--output',type=pathlib.Path,default=P/'evidence');a=p.parse_args();OUT=a.output;OUT.mkdir(parents=True,exist_ok=True)
R=json.load(open(P/'records.json'))['records'];E=json.load(open(P/'candidate-entries.json'))
if a.site:
 E={e['id']:e for f in (a.site/'dist/data/chapters').glob('*.json') for e in json.load(open(f))['entries']}
 for r in R:
  v=E[r['entryId']]
  for k in r['path']:v=v[k]
  assert v==r['after'],('actual dist does not contain exact candidate after',r['entryId'],r['path'])
ids=['42','125','977','15','lc-face-extra-8','lc-face-extra-7','76','560','8','165','73','54','240','lc-face-extra-18','64','155','208','138','nonlc-5-1']
names={'lc-face-extra-8':'KDistinct','lc-face-extra-7':'Permutation','lc-face-extra-18':'Bouquets','nonlc-5-1':'BasicParse','155':'MainMinStack','208':'MainTrie'}
F=[(r['entryId'],r['path'][1]) for r in R if r['path'][0]=='folds']
def clean(code):return re.sub(r'^import [^;]+;[^\n]*\n','',code,flags=re.M)
def build_source(es):
 chunks=['import java.util.*;\nimport java.math.*;\nimport java.io.*;\nclass Node {int val;Node next,random;Node(int x){val=x;}}']
 for eid in ids:
  code=clean(es[eid]['code']);name=names.get(eid,'LC'+eid)
  if eid in ['155','208']:code=re.sub(r'\b'+('MinStack' if eid=='155' else 'Trie')+r'\b',name,code)
  else:code=code.replace('class Solution {','class '+name+' {',1)
  chunks.append(code)
 for eid,i in F:
  codes=re.findall(r'<pre class="md-pre" data-lang="java">(.*?)</pre>',es[eid]['folds'][i]['html'],re.S)
  if not codes:continue
  assert len(codes)==1,(eid,i,len(codes))
  name='F_'+eid.replace('-','_')+'_'+str(i)
  chunks.append(clean(html.unescape(codes[0])).replace('public class Main {','class '+name+' {',1))
 for eid,i,name in [('p-twoptr',0,'Area'),('p-twoptr',1,'Triple'),('p-array',2,'Rotate'),('p-heap',3,'Sort'),('p-design',3,'Design')]:chunks.append('class '+name+' {\n'+es[eid]['templates'][i]['java']+'\n}')
 # Scalar arithmetic boundary probes come from exact current code expressions, not a hand-written substitute.
 rotate=re.search(r'k = ([^;]+);\n    reverseRange',es['p-array']['templates'][2]['java'])[1]
 midpoint=re.search(r'int mid = ([^;]+);',html.unescape(es['p-dp']['folds'][8]['html']))[1]
 loop=re.search(r'static void siftDown.*?while \((.*?)\) \{',es['p-heap']['templates'][3]['java'],re.S)[1]
 chunks.append('class Scalar {static int rotate(int k,int n){return '+rotate+';} static int mid(int lo,int hi){return '+midpoint+';} static boolean enterHeap(int i,int n){return '+loop+';}}')
 chunks.append((P/'Harness.java.txt').read_text())
 return '\n\n'.join(chunks)
def run(es,label='candidate',args=[]):
 d=OUT/label;d.mkdir(exist_ok=True);src=build_source(es);(d/'RemainingContractHarness.java').write_text(src)
 comp=subprocess.run(['java','-m','jdk.compiler/com.sun.tools.javac.Main','-encoding','UTF-8','-d',str(d),str(d/'RemainingContractHarness.java')],capture_output=True,text=True)
 (d/'javac.log').write_text(comp.stdout+comp.stderr);assert comp.returncode==0,comp.stderr
 r=subprocess.run(['java','-cp',str(d),'RemainingContractHarness',*args],capture_output=True,text=True,timeout=120)
 (d/'java-output.txt').write_text(r.stdout+r.stderr)
 return r,hashlib.sha256(src.encode()).hexdigest()
r,h=run(E,'actual-dist' if a.site else 'candidate');print(r.stdout+r.stderr);assert r.returncode==0
negative=[]
if a.negative_proofs:
 for fid,eid,path,probe in [('8','8',['code'],'atoi'),('8','p-array',['folds',2,'html'],'atoi-fold2'),('8','p-array',['folds',3,'html'],'atoi-fold3'),('p-array','p-array',['templates',2,'java'],'rotate'),('p-heap','p-heap',['templates',3,'java'],'heap'),('p-dp','p-dp',['folds',8,'html'],'mid')]:
  M=copy.deepcopy(E);record=next(r for r in R if r['entryId']==eid and r['path']==path);node=M[eid]
  for k in path[:-1]:node=node[k]
  node[path[-1]]=record['before'];mr,mh=run(M,'negative-'+probe,[probe]);assert mr.returncode!=0 and 'AssertionError' in mr.stderr,(probe,mr.stdout,mr.stderr)
  negative.append({'finding':fid,'mutation':'restore exact original executable leaf','probe':probe,'caught':True,'sourceSha256':mh,'log':'negative-'+probe+'/java-output.txt'})

report={'status':'passed','mode':'actual-dist' if a.site else 'isolated-candidate','sourceSha256':h,'checks':int(re.search(r'TOTAL=(\d+)',r.stdout)[1]),'groups':r.stdout.splitlines(),'judgeClasses':len(ids),'legacyJavaBlocks':sum(bool(re.findall(r'<pre class="md-pre" data-lang="java">',E[eid]['folds'][i]['html'])) for eid,i in F),'templates':5,'negativeProofs':negative,'limitations':['Large-index rotation/LIS/heap counterexamples execute extracted scalar predicates/formulas only; no billion-element arrays were allocated.','Contract-only changes preserve algorithms; outside-domain behavior is observed solely to show why the contract matters, not to claim failures on original LeetCode inputs.','No browser/layout or whole-site acceptance is claimed.']}
(OUT/'tests.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))

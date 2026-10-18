#!/usr/bin/env python3
"""Portable, read-only final-dist verifier. No authoring, candidate overlays, JVMs, or staging fallback."""
import argparse,hashlib,json,pathlib,re,sys,zipfile,copy
from html.parser import HTMLParser

def require(ok,message):
 if not ok: raise AssertionError(message)
def sha(x):return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
def at(x,path):
 for k in path:x=x[k]
 return x
def without_variants(s):return re.sub(r'<details\b.*?</details>','',s,flags=re.S)
class Balanced(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=True);self.stack=[]
 def handle_starttag(self,tag,attrs):
  require(tag not in ('script','iframe','object','embed'),f'active tag {tag}')
  require(not any(k.lower().startswith('on') for k,v in attrs),f'event attribute {tag}')
  if tag not in ('area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'):self.stack.append(tag)
 def handle_startendtag(self,tag,attrs):pass
 def handle_endtag(self,tag):
  require(bool(self.stack) and self.stack[-1]==tag,f'HTML nesting {tag}; open={self.stack[-5:]}')
  self.stack.pop()
def verify(dist,fixtures):
 require(dist.is_dir(),'final dist directory absent')
 F=json.loads(fixtures.read_text()); E={}
 for f in sorted((dist/'data/chapters').glob('*.json')):
  for e in json.loads(f.read_text())['entries']:
   require(e['id'] not in E,'duplicate entry '+e['id']);E[e['id']]=e
 require(bool(E),'final dist has no chapter entries')
 EIGHTH_RAW=(fixtures.parent/'eighth-reconciliation/transition-proof.json').read_bytes();require(sha(EIGHTH_RAW)=='57e5b4d787636574823ca61a1d2c7f893900fdbf81ed3cb835aff0ce48a3b04c','eighth exact transition proof changed')
 EIGHTH=json.loads(EIGHTH_RAW)
 NINTH=json.loads((fixtures.parent/'ninth-small-repairs/transition-proof.json').read_text())
 def ninth_entry(old):
  expected=copy.deepcopy(old)
  for r in NINTH['records']:
   if r['entryId']==old['id']:
    x=expected
    for k in r['path'][:-1]:x=x[k]
    if x[r['path'][-1]]==r['before']:x[r['path'][-1]]=r['after']
  return expected
 def ninth_item(eid,index,old):
  expected=copy.deepcopy(old)
  for r in NINTH['records']:
   if r['entryId']==eid and r['path'][:2]==['items',index]:
    x=expected
    for k in r['path'][2:-1]:x=x[k]
    if x[r['path'][-1]]==r['before']:x[r['path'][-1]]=r['after']
  return expected
 require(E['own-os-sandbox']==NINTH['finalEntries']['own-os-sandbox'],'ninth exact entire current sandbox before legacy equations')
 def accepted_question(eid,index,old):
  matches=[r for r in EIGHTH['records'] if r['entryId']==eid and r['path']==['items',index,'q'] and r['before']==old]
  if not matches:return old
  require(len(matches)==1,'duplicate display-title transition');r=matches[0]
  require(sha(r['before'])==r['beforeSha256'] and sha(r['after'])==r['afterSha256'],'display-title transition hash')
  return r['after']
 def accepted_metadata(eid,index,old):
  expected=copy.deepcopy(old)
  if 'q' in expected:expected['q']=accepted_question(eid,index,expected['q'])
  if (eid,index)==('ai-agent-8',3):
   tenth=json.loads((fixtures.parent/'tenth-low-coupling/transition-proof.json').read_text())
   rows=[r for r in tenth['records'] if r['entryId']==eid and r['path']==['items',index,'lead']]
   require(len(rows)==1,'exact tenth permission lead transition required');r=rows[0]
   require(sha(r['before'])==r['beforeSha256'] and sha(r['after'])==r['afterSha256'],'tenth lead transition hashes')
   require(expected['lead']==r['before'],'old safety lead must exactly match tenth before')
   require(E[eid]==tenth['finalEntries'][eid],'complete actual current permission entry required')
   expected['lead']=r['after']
  return expected
 Praw=(fixtures.parent/'sixth-capacity-prefix-reconciliation.json').read_bytes();require(sha(Praw)=='e7dc30ecdb15bc1bd00ebe66e20ddbd2a961d86e1f54764da988336cfe0a6b98','capacity reconciliation proof changed')
 P=json.loads(Praw);require(sha(fixtures.read_bytes())==P['originalFiles']['tests/fixtures/agent-execution-safety.json'],'old safety fixture changed')
 sr=next(r for r in P['records'] if r['entryId']=='own-os-sandbox');require(sr['path']==['items',4,'a'],'capacity path changed')
 require(sha(sr['before'])==sr['beforeSha256'] and sha(sr['after'])==sr['afterSha256'],'capacity hashes changed')
 require(sr['after']==sr['before']+sr['exactAppendHtml'] and sha(sr['exactAppendHtml'])==sr['appendSha256'],'capacity entire old answer prefix changed')
 composed=copy.deepcopy(P['sandboxBeforeEntry']);require(composed['items'][4]['a']==sr['before'],'old compiled capacity answer changed');composed['items'][4]['a']=sr['after']
 require(composed==P['sandboxAfterEntry'] and E['own-os-sandbox']==ninth_entry(composed) and len(composed['items'])==6,'capacity exact six full objects changed')
 for b in sr['sourceBlocks']:require(sha(b['html'])==b['sha256'] and b['html'] in sr['before'] and b['html'] in sr['after'],'old capacity source paragraph lost')
 # Check owned after leaves FIRST. An unapplied dist must fail, even if stale copies exist elsewhere.
 owned=[]
 for r in F['records']:
  e=E.get(r['entryId']);require(e is not None,'missing owned entry '+r['entryId'])
  q=e['items'][r['itemIndex']]
  require(sha(r['questionGuard'])==r['questionSha256'],'original question evidence changed');require(q['q']==accepted_question(r['entryId'],r['itemIndex'],r['questionGuard']),'question changed '+r['entryId'])
  require(q.get('id')==r['questionId'],'question stable ID changed '+r['entryId'])
  v=at(e,r['path']);require(v==r['after'] and sha(v)==r['afterSha256'],'unapplied or drifted after leaf '+r['entryId']+'#'+str(r['itemIndex']))
  require(sha(r['before'])==r['beforeSha256'],'before fixture corrupt')
  if r['mode']=='append-only-unique-detail':require(v.startswith(r['before']),'incident original prefix changed')
  owned.append(v)
 for b in F['identityBaseline']['entries']:
  e=E[b['id']];require(e['kind']==b['kind'],'entry kind changed');require(e.get('progressKey',e['id'])==b['progressKey'],'progressKey changed')
  for q in b['items']:require({k:v for k,v in e['items'][q['index']].items() if k!='a'}==accepted_metadata(b['id'],q['index'],q['unchangedFields']),'existing question metadata changed '+b['id'])
 A=F['appendManifest'];e=E[A['entryId']];before=A['beforeEntry']
 require(e['items'][:len(before['items'])]==before['items'],'existing reset/replay altered')
 for q in A['appends']:
  expected=copy.deepcopy(q['expectedItem'])
  if q['questionId']=='q-agent-sandbox-capacity':
   require(q['expectedIndex']==4 and expected==P['sandboxBeforeEntry']['items'][4] and expected['a']==sr['before'],'original safety full compiled capacity object changed');expected['a']=sr['after']
  require(e['items'][q['expectedIndex']]==ninth_item(A['entryId'],q['expectedIndex'],expected),'appended question missing/drifted '+q['questionId']);owned.append(e['items'][q['expectedIndex']]['a'])
 n=A['newEntry'];require(E.get(n['id'])==n,'standalone experiment missing/drifted');owned.append(n['html'])
 require(len({q['id'] for q in e['items']})==len(e['items']),'duplicate stable OS question ID')
 for q,anchors in F['legacyAnchors'].items():
  v=E['ai-agent-8']['items'][int(q)]['a'];require(all('id="'+x+'"' in v for x in anchors),'legacy section anchor lost')
 rows=F['sourceBlockMap']['rows'];require(len(rows)==367,'source mapping count'); seen=set();variants=0
 for r in rows:
  key=(r['sourceItemIndex'],r['sourceBlockIndex']);require(key not in seen,'duplicate source block');seen.add(key)
  require(sha(r['sourceHtml'])==r['sourceSha256'],'source block SHA mismatch')
  require(r['targets'] or r['disposition']=='excluded-pure-frontend','unmapped source block '+str(key))
  for t in r['targets']:
   require(t['entryId'] in E,'missing semantic destination '+t['entryId'])
   leaf=at(E[t['entryId']],t['path']);w=t['witnessHtml']
   require(sha(w)==t['witnessSha256'],'witness SHA mismatch')
   require(w in without_variants(leaf),'substantive destination missing '+str(key)+' => '+t['entryId']+'/'+t['semanticKey'])
   require(bool(re.search(r'<(?:p|li)\b',w)) and len(re.sub('<[^>]+>','',w).strip())>=8,'non-substantive witness')
   require('qa-variant-wording' not in w,'wording alias counted as substantive answer')
  if 'wordingDestination' in r:
   v=r['wordingDestination'];require(v['exactWordingHtml'] in at(E[v['entryId']],v['path']),'exact wording missing '+str(key));require(sha(v['exactWordingHtml'])==v['sha256'],'wording SHA');variants+=1
 require(seen=={(q,i) for q,n in ((2,197),(6,170)) for i in range(n)},'source block range incomplete')
 require(variants==101,'wording count')
 require([r['sourceBlockIndex'] for r in rows if r['disposition']=='excluded-pure-frontend']==[90,91,92],'frontend exclusion drift')
 for s in owned:
  parser=Balanced();parser.feed(s);parser.close();require(not parser.stack,'unclosed HTML '+str(parser.stack))
  require('原题与其他问法' not in s,'editorial wording leaked')
  for eid,qid in re.findall(r'href="#/e/([^"/]+)(?:/([^"/]+))?"',s):
   require(eid in E,'broken entry link '+eid)
   if qid:
    qe=E[eid];require(any(x.get('id',str(i))==qid for i,x in enumerate(qe.get('items',[]))),'broken stable question link '+eid+'/'+qid)
  for rel in re.findall(r'href="(assets/[^"#?]+)"',s):require((dist/rel).is_file(),'missing public asset '+rel)
 for q in (2,6):
  body=without_variants(E['ai-agent-8']['items'][q]['a']);require(not re.search(r'/submit|DurableFile|ScriptControl|47 个明确断言|40 个 HTTP',body),'code-lab detail leaked into main answer')
 critical={
 'q-agent-command-workspace':['TOCTOU','结构化 argv','fixed-strings','stdio','hooks'],
 'q-agent-sandbox-lifecycle':['pause/resume/kill','快照','CANCEL' if False else '取消','共享线程池'],
 'q-agent-sandbox-build-test':['解压膨胀','安装脚本和编译插件','readiness','副作用','0.0.0.0'],
 'q-agent-sandbox-capacity':['24GiB','1.5GiB','16','8','memory.max','pids.max','高分位'],
 'q-agent-executor-recovery':['UNKNOWN','epoch','operationId','CANCEL_REQUESTED','可信证据','幂等保证']}
 for q in e['items']:
  for text in critical.get(q.get('id'),[]):require(text in q['a'],'critical boundary lost '+text)
 risk=E['ai-agent-8']['items'][2]['a'];require(all(x in risk for x in ['第一阶段直接放行','错误率简单相乘','最终执行记录','真实副作用','分类器不能授予额外权限']),'two-stage/effect assertion coverage')
 ex=n['html'];require(all(x in ex for x in ['/submit','/claim','/complete','/get','8192','4096','128','1000','251','TLS','目录 fsync','多ClassLoader','可规划 47','可规划 40','upper-v1','sum-v1','1,048,576','50,000']),'exact experiment contract missing')
 for a in F['assets']['files']:
  f=dist/a['path'];require(f.is_file(),'missing asset '+a['path']);b=f.read_bytes();require(sha(b)==a['sha256'] and len(b)==a['bytes'],'asset bytes changed '+a['path'])
 ap=dist/'assets/examples/agent-script-recovery'
 with zipfile.ZipFile(ap/'agent-script-recovery.zip') as z:
  require(sorted(z.namelist())==sorted(F['assets']['zipMembers']),'zip members drift')
  for name in z.namelist():require(z.read(name)==(ap/name).read_bytes(),'zip differs from downloadable source '+name)
 for c in F['assets']['originalCodeBlocks']:require(sha((ap/pathlib.Path(c['label']).name).read_bytes())==c['sha256'],'original code mutated')
 print('PASS final-dist-only agent execution safety: 3 guarded leaves, 5 append questions, 1 practice doc, 367 blocks, 101 wordings, 11 unchanged source blocks. Static artifact verification only; no runtime rerun.')
if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--dist',type=pathlib.Path,required=True);ap.add_argument('--fixtures',type=pathlib.Path,default=pathlib.Path(__file__).resolve().parent/'fixtures/agent-execution-safety.json');a=ap.parse_args()
 try:verify(a.dist.resolve(),a.fixtures.resolve())
 except (AssertionError,KeyError,IndexError,OSError,ValueError) as e:print('FAIL final-dist-only agent execution safety: '+str(e),file=sys.stderr);sys.exit(1)

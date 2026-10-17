import json,hashlib,re,copy,difflib
from pathlib import Path
P=Path(__file__).parent
h=lambda s:hashlib.sha256(s.encode() if isinstance(s,str) else s).hexdigest()
js=lambda x:json.dumps(x,ensure_ascii=False,separators=(',',':'))
load=lambda n:json.loads((P/n).read_text())
b=load('input/live-base.json');out=load('input/staged-leaf-replacements.json');changes=[]
for f in load('input/frozen-manifest.json')['files']:assert h((P/'input'/Path(f['path']).name).read_bytes())==f['sha256'],f['path']
def get(v,p):
 for k in p:v=v[k]
 return v
def put(v,p,a):
 for k in p[:-1]:v=v[k]
 v[p[-1]]=a
def fix(id,path,old,new,reason):
 x=next((x for x in out if x['entryId']==id and x['path']==path),None)
 if x is None:
  before=get(b[id]['entry'],path);x=dict(entryId=id,sourcePath=b[id]['source'],path=path,before=before,after=before,beforeSha256=h(before),afterSha256=h(before),entryBeforeSha256=h(js(b[id]['entry'])),reasons=[]);out.append(x)
 assert x['after'].count(old)==1,(id,old);x['after']=x['after'].replace(old,new);x['afterSha256']=h(x['after']);x['reasons'].append('Independent: '+reason);changes.append(dict(entryId=id,path=path,before=old,after=new,reason=reason))
p=['readingNotesHtml'];id='own-os-memory'
fix(id,p,'完整例子把独立状态和覆盖方法放在一起','独立状态与覆盖方法的验证合同','Do not imply missing complete Lua program is supplied.')
fix(id,p,'一个有限示例检查强引用 弱引用和环','强引用 弱引用和环的有限验证目标','Qualify absent Lua fixture.')
fix(id,p,'Lua 可达性实验分别选择两种收集模式，检查','Lua 可达性验证应分别选择两种收集模式，检查','Proposed validation, not execution receipt.')
fix(id,p,'它通过显式完整收集观察可达性语义','验证应通过显式完整收集观察可达性语义','No fabricated experiment receipt.')
fix(id,p,'示例没有终结器复活和C宿主引用，不能用它替代这两类集成测试。','上述验证范围没有终结器复活和C宿主引用，不能用它替代这两类集成测试。','Preserve explicit excluded variants without asserting supplied fixture.')
fix(id,p,'它只在明确的CPython 3.12.14环境运行','验证应固定在明确的CPython 3.12.14环境运行','Keep exact patch and finite bounds without execution claim.')
fix('own-os-process',p,'一项普通失败会取消其他任务并等待它们收尾，通常以ExceptionGroup呈现；','一项普通失败会取消其他任务并等待它们收尾，普通异常汇入ExceptionGroup；若包含其他BaseException则按适用情况形成BaseExceptionGroup。CancelledError不作为触发这种失败合并的普通异常；KeyboardInterrupt和SystemExit会在取消并等待其余任务后重新抛出原异常；','Clarify TaskGroup exception scope and special base exceptions from Python 3.12 docs.')
for id,i,old,new in [
 ('own-os-process',3,'Linux的PID 0、1、2对应不同启动与内核任务概念，且PID命名空间会改变用户看到的编号。','Linux启动口径中，PID 0是启动任务并进入idle路径，PID 1由kernel_init继续初始化并执行用户态init，PID 2是管理内核线程创建的kthreadd；PID命名空间会改变用户看到的编号。'),
 ('own-os-memory',4,'页面置换在可回收驻留页中选择牺牲页，目标是在回收成本与未来缺页之间取舍；OPT、FIFO、LRU与Clock描述不同信息和实现预算，不能都当Linux的精确实现。','页面置换在可回收驻留页中选择牺牲页，权衡回收成本与未来缺页；FIFO可能出现增加页框反而增加缺页的Belady异常，理想LRU的栈性质排除这种异常。OPT、FIFO、LRU与Clock的信息和实现预算不同，不能都当Linux的精确实现。')]:
 for field in ['lead','a']:fix(id,['items',i,field],old,new,'Make first answer directly answer the question; retain full following mechanism.')
composed={k:copy.deepcopy(v['entry']) for k,v in b.items()};checks=[];spans=[]
for x in out:
 assert get(b[x['entryId']]['entry'],x['path'])==x['before'];assert h(x['before'])==x['beforeSha256'];assert h(js(b[x['entryId']]['entry']))==x['entryBeforeSha256'];assert h(x['after'])==x['afterSha256']
 retention={}
 for name,pat in [('links',r'href="[^"]+"'),('anchors',r'id="[^"]+"'),('images',r'<img\b[^>]*>'),('code',r'<(?:pre|code)\b.*?</(?:pre|code)>')]:
  aa=re.findall(pat,x['before'],re.S);zz=re.findall(pat,x['after'],re.S);assert aa==zz,(x['entryId'],name);retention[name]=len(aa)
 nums=lambda s:set(re.findall(r'(?<!\w)\d+(?:\.\d+)*',s))
 checks.append(dict(entryId=x['entryId'],path=x['path'],guards=True,retained=retention,numericRemoved=sorted(nums(x['before'])-nums(x['after']))))
 put(composed[x['entryId']],x['path'],x['after'])
 for tag,a,z,c,d in difflib.SequenceMatcher(None,x['before'],x['after'],autojunk=False).get_opcodes():
  if tag!='equal':spans.append(dict(entryId=x['entryId'],path=x['path'],type=tag,beforeSpan=[a,z],afterSpan=[c,d],before=x['before'][a:z],after=x['after'][c:d]))
entries=[];catalog=json.loads(Path('site/notes-58c0-refactor/dist/data/catalog.json').read_text());ids={c['id']for c in catalog['entries']};links=[]
for k,a in composed.items():
 old=b[k]['entry'];assert len(a.get('items',[]))==len(old.get('items',[]))
 for q,q0 in zip(a.get('items',[]),old.get('items',[])):
  for f in q0:
   if f not in ['a','lead']:assert q[f]==q0[f]
  if q.get('leadType')=='authored':assert q['a'].startswith(q['lead'])
 live=next(e for e in json.loads(Path(b[k]['source']).read_text())['entries'] if e['id']==k);assert live==old,k
 for ref in re.findall(r'href="([^"]+)"',js(a).replace('\\"','"')):
  if ref.startswith('#/e/'):
   target=ref[4:].split('?')[0].split('#')[0].split('/')[0];assert target in ids,(k,ref);links.append(dict(entryId=k,href=ref,targetExists=True))
 entries.append(dict(entryId=k,questions=len(a.get('items',[])),liveMatchesFrozen=live==old,preflightMatches=b[k]['preflightMatches'],identityAndQuestionOrder=True,authoredPrefixes=True,beforeSha256=h(js(old)),afterSha256=h(js(a))))
archives=[]
for a in load('input/primary-source-audit.json')['localArchives']:
 assert h(Path(a['path']).read_bytes())==a['sha256'];archives.append(a)
for n,d in [('approved-leaves.json',out),('additional-composition.json',changes),('composed-entries.json',composed),('mechanical-checks.json',checks),('entry-retention-proof.json',entries),('composed-source-span-map.json',spans),('link-checks.json',links),('archive-checks.json',archives)]: (P/n).write_text(json.dumps(d,ensure_ascii=False,indent=2))
print('Validated',len(out),'leaves',len(changes),'extra edits',len(links),'internal links',sum(e['questions']for e in entries),'questions')

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
fix('own-network-web',['items',0,'a'],'ssr_state.mjs 给出小型边界示例。','原资料将小型边界示例命名为 ssr_state.mjs；本页保留安全序列化契约，未附完整可运行实现。','Qualify source-index reference without removing filename or mechanism.')
fix('own-network-web',['items',1,'a'],'伴读 trusted_client.py 将信任跳数与地址解析显式化。','原资料以 trusted_client.py 命名伴读模型，要求把信任跳数与地址解析显式化；本页说明协议，不据名称承诺完整源码已交付。','Qualify missing companion source receipt.')
fix('own-network-web',['items',2,'a'],'伴读 SseIncremental.java 把增量 UTF-8 解码、逐行解析和事件提交分开；SseCodecDemo.java 展示事件编码的基本规则。','可按 SseIncremental.java 这一模型名，将增量 UTF-8 解码、逐行解析和事件提交分开；按 SseCodecDemo.java 这一模型名验证事件编码规则。本页给出实现契约，未附齐这两个完整程序或当前执行结果。','Preserve both filenames and responsibilities without phantom runnable implementations.')
fix('own-os-files',['items',1,'a'],'可设计 SparseFileWindow 验证：','可设计 SparseFileWindow.java 验证：','Restore original exact filename while retaining proposed-test boundary.')
fix('own-os-foundations',['readingNotesHtml'],'原始程序留在来源归档。','原始资料与其中的代码片段留在来源归档；本页不承诺附齐所有独立程序、依赖与测试驱动。','Distinguish preserved archive from complete runnable delivery.')
fix('own-os-foundations',['readingNotesHtml'],'C/C++示例含自包含测试，必须启用assert，编译时不能定义NDEBUG；部分assert表达式包含write、read、waitpid等实验操作，禁用断言会连操作一起删掉。','原资料说明 C/C++ 示例带自包含测试；取到完整代码后仍须核验，不能由本页文字推定已经运行。依赖 assert 的练习必须启用断言，编译时不能定义 NDEBUG；若 assert 表达式包含 write、read、waitpid 等实验操作，禁用断言会连操作一起删掉。','Keep assert side-effect caveat while separating source statement from execution receipt.')
fix('own-os-foundations',['readingNotesHtml'],'全套编译以JDK21为基线。','准备完整实验时以 JDK21 为编译基线；这不是本页已完成全套编译的回执。','Preserve baseline without claiming complete compilation.')
fix('own-os-io',['readingNotesHtml'],'单独提供实际演示。','单独说明对应运行语义与验证边界。','Cross-link does not certify an executable demonstration.')
fix('own-os-java-process',['readingNotesHtml'],'操作系统教学验证分别使用安全性枚举、队列并发不变量与逻辑时间模型；','操作系统教学验证可分别设计安全性枚举、队列并发不变量与逻辑时间模型；','Supplement describes validation methods, not a performed suite.')
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

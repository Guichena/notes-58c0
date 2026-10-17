import json,hashlib,re,copy,shutil,difflib
from pathlib import Path
R=Path.cwd();D=R/'site/notes-58c0-refactor/dist';C=json.load(open(D/'data/catalog.json'));cat={e['id']:e for e in C['entries']}
js=lambda x:json.dumps(x,ensure_ascii=False,separators=(',',':'));h=lambda x:hashlib.sha256(js(x).encode()).hexdigest();fh=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
def get(x,p):
 for k in p.strip('/').split('/'):x=x[int(k)] if isinstance(x,list) else x[k]
 return x
def put(x,p,v):
 ks=p.strip('/').split('/');a=x
 for k in ks[:-1]:a=a[int(k)] if isinstance(a,list) else a[k]
 a[int(ks[-1]) if isinstance(a,list) else ks[-1]]=v
def leaves(x,p=''):
 if isinstance(x,dict):
  for k,v in x.items():yield from leaves(v,p+'/'+k)
 elif isinstance(x,list):
  for k,v in enumerate(x):yield from leaves(v,p+'/'+str(k))
 else:yield p,x
for n in ['07','08','09']:
 A=R/'reviews/final-document-review'/('scenario-'+n);P=R/'reviews/remaining-independent'/('scenario-'+n);P.mkdir(exist_ok=True);shutil.copytree(A,P/'input',dirs_exist_ok=True);m=json.load(open(A/'frozen-manifest.json'))
 for f,s in m['files'].items():assert fh(A/f)==s,f
 b={f.name[:-14]:json.load(open(f)) for f in A.glob('*-baseline.json') if f.name.startswith('own-')};b={e['id']:e for e in b.values()};stage={e:json.load(open(A/(e+'-staged.json'))) for e in b};out=copy.deepcopy(json.load(open(A/'exact-guarded-leaf-replacements.json')));author=copy.deepcopy(b);checks=[];current=[];changes=[]
 for e in b:
  chunk=cat[e]['_chunk'];live=next(x for x in json.load(open(D/chunk))['entries'] if x['id']==e);assert live==b[e],e
  current.append({'entryId':e,'currentChunk':chunk,'currentSHA256':h(live),'frozenBaselineSHA256':h(b[e]),'equal':True})
 for x in out:
  assert h(b[x['entryId']])==x['entrySHA256'] and get(b[x['entryId']],x['path'])==x['before'] and h(x['before'])==x['beforeSHA256'] and h(x['after'])==x['afterSHA256'];put(author[x['entryId']],x['path'],x['after'])
 assert author==stage
 def fix(e,p,old,new):
  x=next((x for x in out if (x['entryId'],x['path'])==(e,p)),None)
  if x is None:
   v=get(b[e],p);x={'entryId':e,'path':p,'entrySHA256':h(b[e]),'before':v,'after':v,'beforeSHA256':h(v)};out.append(x)
  assert old in x['after'],(e,old);count=x['after'].count(old);x['after']=x['after'].replace(old,new);x['afterSHA256']=h(x['after']);changes.append({'entryId':e,'path':p,'old':old,'new':new,'occurrences':count})
 if n=='07':
  e='own-mq-noteweave';p='/html'
  fix(e,p,'未独立核全这些默认配置：：','未独立核全这些默认配置：')
  fix(e,p,'必须同时交代 Kafka 通知与任务表的分工、单 broker/单副本限制、实际消费确认和 Outbox 回调；','必须同时交代 Kafka 通知与任务表的分工、原资料所报单 broker/单副本条件、需按实际配置核验的消费确认和 Outbox 回调；')
  fix(e,p,'声明的研究任务 topic 默认三分区，但 replicas(1)；代码中其他显式声明的相关 topic 也有单副本。Compose 只有一个 broker/controller。','原资料报告研究任务 topic 默认三分区、replicas(1)，其他显式声明的相关 topic 也有单副本，Compose 只有一个 broker/controller；本轮未独立核全这些配置，以下可靠性判断以该报告条件成立为前提。')
  fix(e,p,'代码还区分 SENT 与 LEASED_UNTIL_CALLBACK：Artifact 最多批量 20，采用 70 分钟租约并等待回调责任完成，','原资料还区分 SENT 与 LEASED_UNTIL_CALLBACK：Artifact 最多批量 20、采用 70 分钟租约并等待回调责任完成；这些参数仍待对应固定配置核验，')
  fix('own-mq-operations','/items/1/a','或在同一受控写路径查询权威版本并拒绝复活。','或让权威校验与目标写入由可证明的串行/条件提交协议衔接；单独先查版本再写仍可能与删除竞争，不能据此证明不会复活。')
 if n=='08':
  fix('own-practice-av-sync-latency','/items/0/a','编码/解码累计时间也要结合处理帧数。','编码/解码累计时间也要结合处理帧数。区间抖动缓冲均值可用ΔjitterBufferDelay/ΔjitterBufferEmittedCount，仅在同一对象且分母大于0、计数未回退时计算，单位为秒；无输出时标无样本而非零延迟。')
 if n=='09':
  fix('own-practice-python-data-processing','/items/0/a','源输入冻结版本和内容身份，每块记录行范围、处理规则版本、校验和及提交状态。','源输入冻结版本和内容身份，每块记录行范围、处理规则版本、校验和及提交状态。恢复还要求源可重放：一次性生成器或不可回放网络流须先可靠暂存，不能只保存行号就承诺重启续跑。')
  fix('own-practice-python-data-processing','/items/0/a','再发布带版本的清单，崩溃留下的孤儿受控回收。','再按当前作业代次和预期发布版本条件提交清单，防旧worker覆盖新结果；崩溃留下的孤儿受控回收。')
 composed=copy.deepcopy(b)
 for x in out:put(composed[x['entryId']],x['path'],x['after']);checks.append({'entryId':x['entryId'],'path':x['path'],'originalEntryGuard':True,'originalBeforeGuard':True,'afterGuard':h(x['after'])==x['afterSHA256']})
 retention=[];diffs=[];ordered=[]
 for e in b:
  for p,v in leaves(b[e]):
   z=get(composed[e],p);a=get(author[e],p)
   if isinstance(v,str):
    for pat in [r'id="([^"]+)"',r'<pre\b.*?</pre>',r'<img\b[^>]*>',r'href="([^"]+)"']:
     assert re.findall(pat,v,re.S)==re.findall(pat,z,re.S),(e,p,pat)
    if v!=z:
     for tag,i,j,k,l in difflib.SequenceMatcher(None,v,z,autojunk=False).get_opcodes():
      if tag!='equal':diffs.append({'entryId':e,'path':p,'kind':tag,'originalStart':i,'originalEnd':j,'original':v[i:j],'composedStart':k,'composedEnd':l,'composed':z[k:l]})
    transformed=a
    for c in changes:
     if (c['entryId'],c['path'])==(e,p):transformed=transformed.replace(c['old'],c['new'])
    assert transformed==z
    # Every authored HTML span is retained in original order after the explicitly listed narrow substitutions.
    pos=0
    for match in re.finditer(r'<(?:p|h[1-6]|li|pre|table|blockquote)\b[^>]*>.*?</(?:p|h[1-6]|li|pre|table|blockquote)>',a,re.S):
     span=match.group()
     for c in changes:
      if (c['entryId'],c['path'])==(e,p):span=span.replace(c['old'],c['new'])
     at=z.find(span,pos);assert at>=0,(e,p,span[:40]);pos=at+len(span);ordered.append({'entryId':e,'path':p,'sourceStart':match.start(),'sourceEnd':match.end(),'composedStart':at,'composedEnd':pos,'spanSHA256':hashlib.sha256(span.encode()).hexdigest()})
   retention.append({'entryId':e,'path':p,'unchanged':v==z,'idsLinksImagesCodeRetained':True})
 ledger=json.load(open(A/'all-html-span-retention.json'))
 for r in ledger:assert get(b[r['entryId']],r['path'])[r['start']:r['end']]==r['before']
 files={'approved-leaves.json':out,'additional-composition.json':changes,'composed-entries.json':list(composed.values()),'baseline.json':list(b.values()),'mechanical-checks.json':checks,'current-baseline-reconciliation.json':current,'original-composed-full-diff.json':diffs,'ordered-composed-span-retention.json':ordered,'retention-report.json':{'originalSpansVerified':len(ledger),'authorComposedSpansVerified':len(ordered),'allScalarLeaves':retention},'composition-manifest.json':{'batch':'scenario-'+n,'status':'approved-with-narrow-composition','frozenAuthorManifestSHA256':fh(A/'frozen-manifest.json'),'entries':len(b),'authorLeaves':len(json.load(open(A/'exact-guarded-leaf-replacements.json'))),'approvedLeaves':len(out),'additionalTextCorrections':len(changes),'approvedArtifact':'approved-leaves.json','baseline':'Frozen catalog-selected original, independently reconciled against live catalog-selected chunks; not stale preflight.','limits':['No live edits, JVM execution, full build or external mutations.','No browser pixel or integrated regression proof.','Inherited source receipts retained; independent source checks separately identified.']}}
 for f,x in files.items():(P/f).write_text(json.dumps(x,ensure_ascii=False,indent=2))
 print(n,len(b),len(out),len(changes),len(ledger),len(ordered))

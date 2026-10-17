import json,hashlib,re,copy,difflib,shutil
from pathlib import Path
h=lambda s:hashlib.sha256(s.encode() if isinstance(s,str) else s).hexdigest()
js=lambda v:json.dumps(v,ensure_ascii=False,separators=(',',':'))
r=Path('reviews/remaining-independent');author=Path('reviews/final-document-review/plan-01-rest/resume-addendum-v2')
for id in ['doc-02','doc-03']:
 old=r/('strategy-'+id);p=r/('strategy-'+id+'-addendum-v2');p.mkdir(exist_ok=True);(p/'input').mkdir(exist_ok=True)
 load=lambda path:json.loads(path.read_text())
 for f in author.glob(id+'-*'):shutil.copy2(f,p/'input'/f.name)
 for f,sha in load(p/'input'/f'{id}-manifest.json')['files'].items():assert h((p/'input'/f).read_bytes())==sha
 base=load(old/'input'/f'{id}-baseline.json');v1=load(old/'input'/f'{id}-staged.json');v2base=load(p/'input'/f'{id}-baseline.json');stage=load(p/'input'/f'{id}-staged.json');assert v1==v2base
 v2leaves=load(p/'input'/f'{id}-guarded-leaves.json');replay=copy.deepcopy(v1)
 for x in v2leaves:
  field=x['path'][0];assert replay[field]==x['before'];assert h(x['before'])==x['beforeSha256'];assert h(x['after'])==x['afterSha256']
  for s in x['spans']:
   assert replay[field].count(s['before'])==s['occurrences'];replay[field]=replay[field].replace(s['before'],s['after'])
  assert replay[field]==x['after']
 assert replay==stage
 changes=[]
 for edit in load(old/'additional-composition.json'):
  f,a,z=edit['field'],edit['before'],edit['after']
  if a in stage[f]:assert stage[f].count(a)==1;stage[f]=stage[f].replace(a,z);changes.append({**edit,'resolution':'reapplied unchanged'})
  else:
   matching=[s for x in v2leaves for s in x['spans'] if s['before']==a];assert len(matching)==1 and matching[0]['after'] in stage[f]
   assert a in ['这样能保证单订单维度有序，但不是全局有序。','必要时把热点 key 拆成多个子 key，或者单独拆 topic 处理。']
   changes.append({**edit,'resolution':'author v2 equivalent retained: stable mapping/retries/serial effects and split-key ordering boundary','authorAfter':matching[0]['after']})
 if id=='doc-03':
  a='举例：假设联合索引按姓名、年龄排列，姓名做带前导通配符的包含匹配，年龄等于 18。姓名条件不能形成有效前缀定位，但若选择扫描该二级索引，索引中的年龄仍可能用于 ICP。需在对应版本与执行计划中验证。'
  z='举例：假设联合索引按姓名、年龄排列，姓名做带前导通配符的包含匹配，年龄等于 18。姓名条件不能形成有效前缀定位；若执行计划仅为 index 全索引扫描，不能因此声称使用 ICP。MySQL 8.4 的 ICP 要求 range、ref、eq_ref 或 ref_or_null 等受支持访问方式，InnoDB 还限于需要访问整行的二级索引。可另用姓名前缀匹配形成 range，再讨论年龄等于 18 的索引内过滤；原包含匹配与这一前缀匹配是两个不同条件，均须检查实际 EXPLAIN 的 Using index condition。'
  assert stage['html'].count(a)==1;stage['html']=stage['html'].replace(a,z);changes.append(dict(field='html',before=a,after=z,reason='MySQL8.4 official ICP applicability excludes a plain index scan; preserve original name/age/18 scenario and distinguish corrected prefix-range example.'))
 out=[];spans=[]
 for f in base:
  if base[f]==stage[f]:continue
  a,z=base[f],stage[f];assert f in ['html','supplementHtml'];orig=next((x for x in load(old/'approved-leaves.json') if x['path']==[f]),None);assert orig
  leaf={k:v for k,v in orig.items() if k not in ['spans','reasons']};leaf.update(after=z,afterSha256=h(z),reasons=['Sequential author v1/v2 plus reconciled independent corrections; original-live guards retained.']);out.append(leaf)
  for tag,i,j,k,l in difflib.SequenceMatcher(None,a,z,autojunk=False).get_opcodes():
   if tag!='equal':spans.append(dict(entryId=id,path=[f],type=tag,beforeSpan=[i,j],afterSpan=[k,l],before=a[i:j],after=z[k:l]))
 for f,v in base.items():
  if f not in ['html','supplementHtml']:assert stage[f]==v
  if isinstance(v,str):
   for pat in [r'id="[^"]*"',r'href="[^"]*"',r'<img\b[^>]*>']:assert re.findall(pat,v)==re.findall(pat,stage[f])
 for x in out:
  assert x['before']==base[x['path'][0]] and h(x['before'])==x['beforeSha256'] and x['entryBeforeSha256']==h(js(base))
 live=next(e for e in load(Path(out[0]['sourcePath']))['entries'] if e['id']==id);assert live==base
 checks=dict(originalGuards=True,liveMatchesFrozen=True,authorV1ToV2ExactReplay=True,allV2SpansReviewed=sum(len(x['spans'])for x in v2leaves),originalMetadataLeadImagesAnchorsLinksUnchanged=True,previousApprovalUnmodified=True,previousIndependentCorrectionsReconciled=len(changes),originalRetentionMap=str(old/'retention-map.json'),authorCompleteDispositionMap=str(author/(id+'-complete-dispositions.json')))
 for name,v in [('approved-leaves.json',out),('composed-entry.json',stage),('reconciliation.json',changes),('composed-source-span-map.json',spans),('mechanical-checks.json',checks)]: (p/name).write_text(json.dumps(v,ensure_ascii=False,indent=2))
 print(id,len(out),checks)

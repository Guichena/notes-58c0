from pathlib import Path
import json,re,html,hashlib,copy,sys
b=sys.argv[1];D=Path('reviews/final-document-review/handwrite-'+b);P=Path('reviews/remaining-independent/handwrite-'+b);P.mkdir(exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest();j=lambda v:json.dumps(v,ensure_ascii=False,separators=(',',':'));hv=lambda v:sha(j(v).encode());out=lambda n,v:(P/n).write_text(json.dumps(v,ensure_ascii=False,indent=2))
expected={'03':'c6e559353f22d88945c52be3cbbf34fcae8ef993bfa5755c49784608cbe5e18b','04':'f12d66d9c57cbce0dffae7f97b88b1973e80f17a2c84078b4ff3c54663bf24bc'}
assert sha((D/'frozen-manifest.json').read_bytes())==expected[b]
for r in json.load(open(D/'frozen-manifest.json'))['files']:assert sha((D/r['path']).read_bytes())==r['sha256'],r['path']
base={r['entryId']:r for r in json.load(open(D/'current-entries.json'))};staged={e['id']:e for e in json.load(open(D/'staged-entries.json'))};final=copy.deepcopy(staged);patch=json.load(open(D/'staged-leaf-patches.json'))['patches'];add=[]
for p in patch:assert hv(p['original'])==p['originalValueSha256'] and hv(p['replacement'])==p['replacementValueSha256'];assert base[p['entryId']]['entry'][p['path']]==p['original'];assert staged[p['entryId']][p['path']]==p['replacement']
def fix(id,k,fn,reason):
 a=final[id][k];z=fn(a);assert a!=z,(id,k);final[id][k]=z;add.append(dict(entryId=id,field=[k],before=a,after=z,beforeSha256=hv(a),afterSha256=hv(z),reason=reason))
def append(id,k,s,reason):fix(id,k,lambda a:a+'<p class="md-p">'+s+'</p>',reason)
if b=='03':
 fix('handwrite-59','answerHtml',lambda a:a.replace('最多等待两秒','join 最多等待两秒，整个 close 不具有两秒硬期限'),'Distinguish bounded join from whole shutdown duration.')
 append('handwrite-59','answerHtml','返回的 CompletableFuture 只供观察结果与 cancel；调用方不得主动 complete、obtrude 或以超时 API 改写其完成状态。非 async 依赖动作可能在完成/取消线程同步执行；这里取消排队结果时还持有队列监视器，因此依赖动作必须短小、无阻塞、无重入，不能等待调度器或其他任务。耗时依赖请交给独立、受控执行器。close 获取锁、逐项取消与依赖动作的耗时不包含在两秒 join 内；仅中断不能保证回调停止。依据 <a href="https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/CompletableFuture.html">JDK 21 CompletableFuture 完成策略</a>。','Expose mutable result and synchronous dependent execution contract; code preserved.')
 fix('handwrite-60','relatedHtml',lambda a:a.replace('登录/支付风控倾向 fail-close 或本地严格限流','登录/支付风控倾向 fail-close；若降级为本地限流，必须接受多副本总额度扩大或预分配总预算'),'Local limiter cannot preserve global strict budget on Redis failure.')
 fix('handwrite-62','answerHtml',lambda a:a.replace('资源侧只接受更大的 token，拒绝过期持有者的写入。','资源侧原子拒绝小于已见最高代际的 token；相同代际的合法多次写入与幂等去重另定，不能简单要求每次写入 token 都更大。'),'Carry equal-generation fencing semantics into primary summary.')
 fix('handwrite-65','relatedHtml',lambda a:a.replace('dedupKey 要包含业务类型、设备、规则、严重程度','聚合键要包含受信租户、业务类型、设备、规则、告警轮次、状态、严重程度；eventId 幂等另行处理'),'Preserve tenant/round/state partition conditions in variant summary.')
 fix('handwrite-66','knowledge',lambda a:[x.replace('秒传：用文件内容哈希判断文件是否已存在，存在则只建立用户文件引用。','秒传：内容哈希仅用于定位已校验、已发布的候选；当前用户获准引用后才能建立文件引用，不泄露跨租户存在性。').replace('Redis Bitmap：适合记录分片是否上传，空间小，','Redis Bitmap：仅作可重建的上传进度提示，完整性以权威 manifest 校验为准；空间小，') for x in a],'Align compressed upload summary with authorization and authoritative manifest contracts.')
 fix('handwrite-64','answerHtml',lambda a:a.replace('确认成功后把状态改为','确认还须合并 Return 与预期拓扑的路由结果，满足发送责任合同后才把状态改为'),'Publisher confirmation alone does not prove intended routing.')
 append('handwrite-61','supplementHtml','两个 Lua key 必须互不相同并由本协议独占；输入版本字符串长度、payload 字节数与实体 key 总量需在适配器限制。脚本没有自动完成这些接入预算。','Make distinct-key and byte-budget assumptions explicit for unchanged original Lua.')
# Optional batch04 amendments are loaded from a separately reviewed local script.
if b=='04':exec((P/'composition-rules.py').read_text())
by={(p['entryId'],p['path']):p for p in patch}
for id,e in final.items():
 for k,v in e.items():
  old=base[id]['entry'][k]
  if old==v:continue
  p=by.get((id,k))
  if p is None:p=dict(entryId=id,path=k,jsonPointer='/'+k,sourceEntrySha256=base[id]['currentSha'],original=old,originalValueSha256=hv(old),reason='Independent sibling-contract correction.');patch.append(p)
  p['replacement']=v;p['replacementValueSha256']=hv(v)
  if any(a['entryId']==id and a['field']==[k] for a in add):p['reason']+=' Independent composition: '+'; '.join(a['reason'] for a in add if a['entryId']==id and a['field']==[k])
ret=[]
for id,e in final.items():
 old=base[id]['entry'];codes=[]
 for k,v in e.items():
  if isinstance(v,str):
   assert set(re.findall(r'\bid="([^"]+)"',old[k]))<=set(re.findall(r'\bid="([^"]+)"',v))
   assert re.findall(r'<pre\b[^>]*>.*?</pre>',staged[id][k],re.S)==re.findall(r'<pre\b[^>]*>.*?</pre>',v,re.S)
   codes += [dict(field=k,index=i,sha256=sha(html.unescape(c).encode()),characters=len(html.unescape(c))) for i,c in enumerate(re.findall(r'<pre\b[^>]*>(.*?)</pre>',v,re.S))]
 ret.append(dict(entryId=id,fieldsRead=list(e),allStagedCodePreserved=True,allOriginalAnchorsPreserved=True,codeBlocks=codes,originalEntrySha256=hv(old),composedEntrySha256=hv(e)))
prov=[]
for r in json.load(open(D/'recovered/manifest.json')):
 src=Path(r['source']);f=D/'recovered'/r['file'];assert sha(src.read_bytes())==r['sourceSha256'];assert sha(f.read_bytes())==r['sha256'];assert ''.join(src.read_text().splitlines(keepends=True)[r['startLine']-1:r['endLine']])==f.read_text()
 targets=[id for id,e in final.items() if any(f.read_text() in html.unescape(v) for v in e.values() if isinstance(v,str))];assert len(targets)==1,(r['file'],targets);prov.append(dict(**r,canonicalEntry=targets[0],exactSourceLinesVerified=True))
# Catalog-selected compiled content, overlaid with existing approved alternatives and this composition.
dist=Path('site/notes-58c0-refactor/dist');cat=json.load(open(dist/'data/catalog.json'));meta={e['id']:e for e in cat['entries']};projection={}
for c in {e['_chunk'] for e in cat['entries']}:
 for e in json.load(open(dist/c))['entries']:projection[e['id']]=e
for q in [Path('reviews/remaining-independent/handwrite-01/approved-alternative.json'),Path('reviews/remaining-independent/handwrite-02/approved-alternative.json')]:
 if q.exists():
  for p in json.load(open(q))['patches']:projection[p['entryId']][p['path']]=p['replacement']
projection.update(final);routes=[]
for id,e in final.items():
 for k,v in e.items():
  if not isinstance(v,str):continue
  for href in re.findall('href="([^"]+)"',v):
   if href.startswith('#/e/'):
    target=href[4:].split('#')[0].split('/')[0];assert target in projection,(id,href)
    routes.append(dict(entryId=id,field=k,href=href,targetEntrySha256=hv(projection[target]),catalogChunk=meta[target]['_chunk']))
   elif href.startswith('#'):
    assert 'id="'+href[1:]+'"' in ''.join(v for v in e.values() if isinstance(v,str)),href
    routes.append(dict(entryId=id,field=k,href=href,localAnchorExists=True))
if b=='03':assert any('class InterviewCaches' in html.unescape(v) for v in projection['155'].values() if isinstance(v,str))
out('approved-alternative.json',dict(hashConvention='sha256 of UTF-8 compact JSON value, ensure_ascii=false',patches=patch));out('additional-composition.json',add);out('preservation-and-source-audit.json',dict(entries=ret,restorations=prov,routes=routes,catalogSha256=sha((dist/'data/catalog.json').read_bytes()),scope='Compiled-content projection only; final integrated render/navigation remains.'))
out('composition-manifest.json',dict(batch='handwrite-'+b,status='approved-with-narrow-sibling-compositions',entries=len(final),originalLeaves=25,approvedLeaves=len(patch),additionalCompositions=len(add),approvedArtifact='approved-alternative.json',approvedArtifactSha256=sha((P/'approved-alternative.json').read_bytes()),inputManifestSha256=expected[b],composition='Apply approved alternative instead of original batch; do not apply both. No live edits.',testScope='Frozen author receipts/source identities inspected; bounded Java21 128MB and focused cache receipts verified, no JVM rerun. Redis/Spring adapter, H2/MySQL/JDBC and real service behavior not certified. SQL models and controlled JS are not database/browser integration.',remaining='Final integrated guards, renderer and navigation verification.'))
print(b,len(final),len(patch),len(add),sha((P/'approved-alternative.json').read_bytes()))

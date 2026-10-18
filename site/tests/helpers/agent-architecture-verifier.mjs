import assert from 'node:assert/strict';
import {eighthLeaf} from '../fixtures/ninth-small-repairs/bridged/tests/fixtures/eighth-reconciliation/verify-dependencies.mjs';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const sha=s=>createHash('sha256').update(s).digest('hex');
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const blocks=s=>[...s.matchAll(/<(p|h2|h3|h4|li|summary|pre|tr)\b[^>]*>[\s\S]*?<\/\1>/g)].map(m=>m[0]);
export async function verifyFinal({dist,fixtures}){
 assert.ok(dist&&fixtures,'Actual dist and fixture paths are required.');
 const rs=(await read(join(fixtures,'records.json'))).records;
 const ms=(await read(join(fixtures,'paragraph-destinations.json'))).maps;
 const vs=(await read(join(fixtures,'variant-destinations.json'))).variants;
 const ids=(await read(join(fixtures,'identity-baseline.json'))).items;
 const ar=(await read(join(fixtures,'out-of-scope-archive.json'))).archives;
 const all=new Map(),catalog=await read(join(dist,'data/catalog.json'));
 for(const f of await readdir(join(dist,'data/chapters'))){if(!f.endsWith('.json'))continue;for(const e of (await read(join(dist,'data/chapters',f))).entries){assert.ok(!all.has(e.id),'duplicate route '+e.id);all.set(e.id,e);}}
 const allowed=new Set(['ai-agent-4:1','ai-agent-4:2','own-distributed-ch11:1','own-os-containers:11','own-agent-runtime-design:3','own-rag-ingestion:1','own-theory-rl-advanced:3']);
 assert.equal(rs.length,7);assert.equal(new Set(rs.map(r=>r.entryId+':'+r.itemIndex)).size,7);
 const item=(id,i)=>{const it=all.get(id)?.items?.[i];assert.ok(it,'missing route '+id+'/'+i);return it;};
 for(const r of rs){
  assert.ok(allowed.has(r.entryId+':'+r.itemIndex));assert.deepEqual(r.path,['items',r.itemIndex,'a']);
  assert.equal(sha(r.before),r.beforeSha256);assert.equal(sha(r.after),r.afterSha256);assert.equal(sha(r.questionGuard),r.questionSha256);
  const it=item(r.entryId,r.itemIndex);assert.equal(it.q,r.questionGuard);assert.equal(it.id??null,r.questionId??null);
  assert.ok(it.a===eighthLeaf(r.entryId,r.path,r.after),'UNAPPLIED_OR_CHANGED '+r.entryId+'/'+r.itemIndex);
  assert.ok(catalog.entries.some(e=>e.id===r.entryId),'missing catalog route '+r.entryId);
  if(r.mode==='append-only-unique-detail')assert.ok(r.after.startsWith(r.before),'canonical prefix changed');
  for(const m of r.before.matchAll(/\bid="([^"]+)"/g))assert.ok(r.after.includes('id="'+m[1]+'"'),'original anchor lost');
  if(r.entryId==='ai-agent-4')assert.doesNotMatch(r.after,/<pre\b/,'large code block reintroduced');
  for(const m of r.after.matchAll(/href="#\/e\/([^"/]+)(?:\/([^"]+))?"/g)){
   const id=decodeURIComponent(m[1]),e=all.get(id);assert.ok(e||catalog.archivedRoutes?.[id],'broken entry route '+id);
   if(m[2]&&e){const q=decodeURIComponent(m[2]);assert.ok(/^\d+$/.test(q)?e.items?.[Number(q)]:e.items?.some(it=>it.id===q),'broken question route '+m[0]);}
  }
 }
 for(const x of ids){const it=item(x.entryId,x.itemIndex);for(const [k,v]of Object.entries(x.unchangedFields))assert.deepEqual(it[k],v,'unapproved metadata change '+x.entryId+'/'+x.itemIndex+':'+k);}
 const archive=new Map(ar.map(x=>[x.archiveId,x]));
 for(const a of ar){const file=await readFile(join(dist,a.publicRelativePath),'utf8');assert.equal(sha(file),a.archiveSha256,'public archive bytes changed or missing');assert.ok(file.includes(a.sourceHtml),'public archive source block missing');assert.equal(sha(a.sourceHtml),a.sourceSha256);}
 const checkDest=d=>{assert.equal(sha(d.html),d.sha256);if(d.archiveId){const a=archive.get(d.archiveId);assert.ok(a);assert.equal(a.sourceHtml,d.html);assert.equal(a.sourceSha256,d.sha256);}else assert.ok(item(d.entryId,d.itemIndex).a.includes(d.html),'missing exact destination '+d.entryId+'/'+d.itemIndex+' '+d.key);};
 assert.equal(ms.length,381);assert.equal(vs.length,141);assert.equal(ar.length,1);
 for(const i of [1,2]){
  const r=rs.find(r=>r.entryId==='ai-agent-4'&&r.itemIndex===i),bs=blocks(r.before),sub=ms.filter(m=>m.sourceItemIndex===i);
  assert.equal(sub.length,bs.length);assert.deepEqual([...sub.map(m=>m.sourceBlockIndex)].sort((a,b)=>a-b),bs.map((_,j)=>j));
  for(const m of sub){assert.equal(m.sourceHtml,bs[m.sourceBlockIndex]);assert.equal(sha(m.sourceHtml),m.sourceSha256);assert.ok(m.destinations.length);for(const d of m.destinations)checkDest(d);}
 }
 for(const v of vs){const r=rs.find(r=>r.entryId===v.sourceEntryId&&r.itemIndex===v.sourceItemIndex);assert.equal(blocks(r.before)[v.sourceBlockIndex],v.sourceHtml);assert.equal(sha(v.sourceHtml),v.sourceSha256);assert.equal(v.destination.html,v.sourceHtml);checkDest(v.destination);}
 const arch=item('ai-agent-4',1).a,state=item('ai-agent-4',2).a;
 for(const x of ['5.79','首条有效内容','六层','正常路径','全局上限','物理隔离','UNKNOWN','半个工具 JSON','本次选择的附件范围','提示重复内容'])assert.ok(arch.includes(x),'architecture boundary lost '+x);
 for(const x of ['SessionCAS','1 成功、29 冲突','未同步本地文件','WAITING_ENV','取消或过期审批','只读回查原不可变 receipt','不恢复旧执行写权','机器 A','机器 B','Handoff','无损可搬','假设案例','不能用此推演补成仓库事实','LRU','过程重放','模型重跑'])assert.ok(state.includes(x),'recovery boundary lost '+x);
 assert.ok(item('own-agent-runtime-design',3).a.includes('time-travel replay'));
 return {status:'PASS_ACTUAL_FINAL_DIST',dist:resolve(dist),changedLeaves:rs.length,sourceBlocks:ms.length,variantOccurrences:vs.length,archiveBlocks:ar.length,appendOnlyCanonicals:rs.filter(r=>r.mode==='append-only-unique-detail').length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2),get=k=>{const i=args.indexOf(k);return i<0?null:args[i+1];};
 const dist=get('--dist');if(!dist)throw Error('An explicit actual built --dist is required; no overlay/synthetic final mode exists.');
 try{console.log(JSON.stringify(await verifyFinal({dist:resolve(dist),fixtures:resolve(get('--fixtures')||fileURLToPath(new URL('.',import.meta.url)))}),null,2));}catch(e){console.error(e.stack);process.exitCode=1;}
}

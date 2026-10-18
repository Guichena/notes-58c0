import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const catalog=JSON.parse(await readFile(new URL('../dist/data/catalog.json',import.meta.url),'utf8')),entries=new Map();
for(const chunk of new Set(catalog.entries.map(e=>e._chunk)))for(const e of JSON.parse(await readFile(new URL('../dist/'+chunk,import.meta.url),'utf8')).entries)entries.set(e.id,e);
test('Serving canonical answer preserves request, lifecycle, transport and version boundaries',()=>{
 const canonical=entries.get('own-theory-serving').items[0],alias=entries.get('own-distributed-ch14').items[0];
 assert.equal(canonical.id,'q-own-theory-pd-mooncake');assert.equal(alias.id,'q-own-distributed-pd-disaggregation');
 for(const fragment of ['requestId','READY','背压','引用计数或租约','已经交付给用户的 token','模型/权重与 adapter 版本','1,342,177,280','1.25 GiB','CPU offloading','磁盘层','vLLM V1','V0','不提高吞吐','TTFT','ITL/TPOT','chunked prefill','租户隔离'])assert.ok(canonical.a.includes(fragment),fragment);
 assert.equal(2*80*8*128*4096*2,1.25*1024**3);
 assert.ok(alias.a.includes('#/e/own-theory-serving/q-own-theory-pd-mooncake'));
 assert.ok(alias.a.length<canonical.a.length/3);
 assert.ok(!alias.a.includes('1,342,177,280'));
 for(const entry of [canonical,alias])for(const [,raw]of entry.a.matchAll(/href="#\/e\/([^\"]+)"/g)){
  const [entryId,qId]=raw.split('/').map(decodeURIComponent),target=entries.get(entryId);assert.ok(target,entryId);
  if(qId!==undefined)assert.ok((target.items||[]).some((q,i)=>q.id===qId||String(i)===qId),raw);
 }
});
test('Redis cache reconciliation does not masquerade as an authoritative oversell barrier',()=>{
 const html=entries.get('doc-21').html;
 assert.ok(!html.includes('通过对账保证最终正确'));
 for(const fragment of ['对账','Lua','回滚','超卖'])assert.ok(html.includes(fragment),fragment);
});
test('arbitrary flower coverage is classified under dynamic programming with stable progress',()=>{
 const e=entries.get('nonlc-1-10');assert.equal(e.cat,'动态规划');assert.equal(e.part,'贪心与动态规划');assert.equal(e.simple.topic,'p-dp');assert.equal(e.progressKey,'nonlc-1#10');assert.equal(e.faceIdx,10);
 assert.ok(entries.get('p-dp').supplementHtml.includes('#/e/nonlc-1-10'));
 assert.ok(JSON.stringify(entries.get('p-window').groups).includes('不能要求购买连续段'));
 assert.ok(e.idea.includes('不能直接用滑动窗口'));
});
test('emitted runtime and reviewed display order agree while stored question identity stays stable',async()=>{
 const {projectFinalAuditOrderRegistry,projectFinalAuditOrderRuntime}=await import('../scripts/final-audit-order.mjs');
 const original=JSON.parse(await readFile(new URL('../content/interview-learning-order.json',import.meta.url),'utf8')),snapshot=JSON.stringify(original),changed=projectFinalAuditOrderRegistry(original);
 assert.equal(JSON.stringify(original),snapshot);
 const flatten=r=>r.modules.flatMap(m=>m.parts.flatMap(p=>p.categories.flatMap(c=>c.entryIds)));
 assert.deepEqual([...flatten(changed)].sort(),[...flatten(original)].sort());
 const groupFor=(r,id)=>r.modules.flatMap(m=>m.parts.flatMap(p=>p.categories)).find(c=>c.entryIds.includes(id));
 assert.notEqual(groupFor(original,'nonlc-1-10').groupId,groupFor(original,'p-dp').groupId);
 assert.equal(groupFor(changed,'nonlc-1-10').groupId,groupFor(changed,'p-dp').groupId);
 const app=await readFile(new URL('../dist/assets/app.js',import.meta.url),'utf8');
 const encoded=JSON.stringify(changed).replaceAll('<','\\u003c');
 assert.ok(app.includes('const LEARNING_ORDER_REGISTRY = '+encoded+';'));
 assert.throws(()=>projectFinalAuditOrderRuntime('src/app/structure.js','bad source',original),/anchor drift/);
 assert.throws(()=>projectFinalAuditOrderRegistry(changed),/source\/target drift/);
});

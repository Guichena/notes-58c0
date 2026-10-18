import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {projectFinalAuditCorrections as project} from '../scripts/final-audit-corrections.mjs';
const allRegistry=JSON.parse(await readFile(new URL('../content/final-audit-corrections.json',import.meta.url),'utf8'));
const registry={schemaVersion:1,records:allRegistry.records.filter(r=>r.entryId==='own-java-strings-generics'&&JSON.stringify(r.path)===JSON.stringify(['items',2,'a']))};
const r=registry.records[0];
function fixture(){return [{id:r.entryId,items:[{id:'a'},{id:'b'},{id:'q-own-java-generics-pecs',a:r.before}]}];}
test('exact Java wildcard escaping fixes heading without losing substantive text or IDs',()=>{
 const input=fixture(),output=project(input,registry);
 assert.equal(input[0].items[2].a,r.before);
 assert.equal(output[0].items[2].a,r.after);
 assert.ok(r.before.includes('List<?> 为什么仍然可以删除元素？'));
 assert.ok(r.after.includes('List&lt;?&gt; 为什么仍然可以删除元素？'));
 assert.equal(r.after.replace('List&lt;?&gt; 为什么仍然可以删除元素？','List<?> 为什么仍然可以删除元素？'),r.before);
 assert.deepEqual(output[0].items.map(q=>q.id),input[0].items.map(q=>q.id));
});
test('final audit exact reversal reproduces original fields and baseline remains untouched',()=>{
 const input=fixture();assert.deepEqual(project(project(input,registry),registry,{reverse:true}),input);
 assert.equal(project(input,null,{baselineTest:true}),input);
});
test('source drift, corrupted hashes and protected identity paths fail closed',()=>{
 const changed=fixture();changed[0].items[2].a+='drift';assert.throws(()=>project(changed,registry),/source drift/);
 const broken=structuredClone(registry);broken.records[0].after+='x';assert.throws(()=>project(fixture(),broken),/hashes/);
 const identity=structuredClone(registry);identity.records[0].path=['id'];assert.throws(()=>project(fixture(),identity),/unsafe/);
});

test('all final-audit fields match the built corpus and reverse/reapply without stable identity changes',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../dist/data/catalog.json',import.meta.url),'utf8'));
 const entries=[];for(const chunk of new Set(catalog.entries.map(e=>e._chunk)))entries.push(...JSON.parse(await readFile(new URL('../dist/'+chunk,import.meta.url),'utf8')).entries);
 const original=project(entries,allRegistry,{reverse:true});
 assert.deepEqual(project(original,allRegistry),entries);
 assert.deepEqual(original.map(e=>[e.id,(e.items||[]).map(q=>q.id)]),entries.map(e=>[e.id,(e.items||[]).map(q=>q.id)]));
 // A field can be revised again; reverse/reapply above validates every intermediate transition.
 const finalByPath=new Map(allRegistry.records.map(r=>[JSON.stringify([r.entryId,r.path]),r]));
 for(const r of finalByPath.values()){let x=entries.find(e=>e.id===r.entryId);for(const k of r.path)x=x[k];assert.equal(x,r.after);}
 assert.ok(finalByPath.size<=allRegistry.records.length);
});

test('displayed corrected cleanup sources equal downloadable sources and retain explicit failure boundaries',async()=>{
 const record=allRegistry.records.find(r=>r.entryId==='handwrite-46');assert.ok(record);
 const decode=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#x27;/g,"'").replace(/&amp;/g,'&');
 for(const name of ['ExternalIntTop','ExternalStringCounts']){
  const source=await readFile(new URL('../public/assets/examples/final-cleanup/'+name+'.java',import.meta.url),'utf8');
  const blocks=[...record.after.matchAll(/<pre[^>]*>([\s\S]*?)<\/pre>/g)].map(m=>decode(m[1]));
  assert.equal(blocks.filter(code=>code.includes('public final class '+name+' {')).length,1);
  assert.ok(blocks.includes(source));
  assert.ok(source.includes('try(WorkCleanup cleanup=new WorkCleanup('));
  assert.ok(source.includes('if(first!=next) first.addSuppressed(next);'));
  assert.equal(await readFile(new URL('../dist/assets/examples/final-cleanup/'+name+'.java',import.meta.url),'utf8'),source);
 }
 assert.ok(record.after.includes('不等于已经通过 10TB、4TB 数据量或 10MB 总进程内存验收'));
 assert.ok(!record.after.includes('上述旧版仍保留以比较算法'));
});

test('budget contract retains used amounts, atomic settlement and unknown-risk reservations',()=>{
 const r=allRegistry.records.find(r=>r.entryId==='ai-agent-5'&&r.path[1]===7);assert.ok(r);
 assert.ok(r.after.includes('保存limit、used、reserved、deadline、state'));
 assert.ok(r.after.includes('以及used+reserved+need≤limit'));
 assert.ok(!r.after.includes('以及reserved+need≤limit'));
 for(const fragment of ['幂等结算','实际费用加入 used','同一预留再次结算出不同金额','实际费用超出预留','响应未知时保留风险预留'])assert.ok(r.after.includes(fragment),fragment);
 // Arithmetic witnesses, not a Redis implementation or persistence claim.
 const canReserve=(used,reserved,need,limit)=>used+reserved+need<=limit;
 assert.equal(canReserve(70,20,10,100),true);
 assert.equal(canReserve(70,20,11,100),false);
 assert.equal(canReserve(90,0,11,100),false);
 const before={used:40,reserved:30},actual=20;
 const after={used:before.used+actual,reserved:before.reserved-30};
 assert.equal(after.used+after.reserved,60);
 assert.equal(canReserve(after.used,after.reserved,41,100),false);
});

test('out-of-scope specialist answers remain byte-preserved in accessible static archives',async()=>{
 const records=allRegistry.records.filter(r=>typeof r.reason === 'string' && r.reason.startsWith('Move pure specialist')&&r.path.at(-1)==='a');
 assert.equal(records.length,5);
 for(const r of records){
  const archive=r.after.match(/href="(assets\/archive\/specialist\/[^"]+)"/)[1];
  const page=await readFile(new URL('../public/'+archive,import.meta.url),'utf8');
  assert.ok(page.includes('<main>'+r.before+'</main>'));
  assert.ok(page.includes('<base href="../../../">'));
  assert.ok(page.includes('#/e/'+r.entryId+'/'));
  assert.ok(!/<script\b/i.test(page));
  assert.equal(await readFile(new URL('../dist/'+archive,import.meta.url),'utf8'),page);
 }
 assert.ok(!records.some(r=>r.entryId==='own-theory-kernels'),'CUDA resource fundamentals remain in main scope');
 assert.ok(!records.some(r=>r.entryId==='own-theory-media'),'document and multimodal Agent ingestion remain in main scope');
});

test('current catalog remains compatible with display-only learning order after archival grouping',async()=>{
 const {buildLearningOrder}=await import('../scripts/interview-learning-order.mjs');
 const catalog=JSON.parse(await readFile(new URL('../dist/data/catalog.json',import.meta.url),'utf8'));
 const order=JSON.parse(await readFile(new URL('../content/interview-learning-order.json',import.meta.url),'utf8'));
 const {projectFinalAuditOrderRegistry}=await import('../scripts/final-audit-order.mjs');
 const warnings=[],view=buildLearningOrder(catalog.entries,projectFinalAuditOrderRegistry(order),s=>warnings.push(s));
 assert.equal(view.order.length,catalog.entries.length);
 assert.equal(new Set(view.order.map(e=>e.id)).size,catalog.entries.length);
 assert.equal(view.order.find(e=>e.id==='own-theory-embodied').cat,'专项资料归档');
});
test('visual-prototyping record is archived intact with stable numeric entry point',async()=>{
 const r=allRegistry.records.find(r=>r.entryId==='plan-日常与ai使用-2'&&r.path[1]===6&&r.path[2]==='a');assert.ok(r);
 const rel='assets/archive/specialist/plan-visual-prototyping.html',page=await readFile(new URL('../public/'+rel,import.meta.url),'utf8');
 assert.ok(page.includes('<main>'+r.before+'</main>'));assert.ok(page.includes('#/e/plan-日常与ai使用-2/6'));
 assert.ok(r.after.includes(rel));assert.equal(await readFile(new URL('../dist/'+rel,import.meta.url),'utf8'),page);
});

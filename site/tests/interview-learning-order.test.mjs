import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {buildLearningOrder,projectLearningOrderRuntime} from '../scripts/interview-learning-order.mjs';
const read = file => readFile(new URL('../'+file,import.meta.url),'utf8');
const registry = JSON.parse(await read('content/interview-learning-order.json'));
const snapshot = JSON.parse(await read('tests/fixtures/interview-learning-order-identities.json'));
const priorityChanges = JSON.parse(await read('tests/fixtures/interview-priority-entry-order.json')).changes;
// Keep the immutable original identity fixture; apply only separately reviewed group permutations.
const expectedPriorityIds = [...snapshot.displayIds];
for (const change of priorityChanges) {
 const oldIds = new Set(change.before), slots = expectedPriorityIds.flatMap((id,i)=>oldIds.has(id)?[i]:[]);
 const oldProtected = new Set(slots.map(i=>expectedPriorityIds[i]));
 const replacement = change.after.filter(id=>oldProtected.has(id));
 assert.equal(slots.length,replacement.length);
 slots.forEach((slot,i)=>{expectedPriorityIds[slot]=replacement[i];});
}
const catalog = JSON.parse(await read('dist/data/catalog.json'));
const entries = catalog.entries;
const source = await read('src/app/structure.js');
const ids = xs => xs.map(e=>e.id);
const warnings = [];
const view = buildLearningOrder(entries,registry,m=>warnings.push(m));
const freeze = x => {if(x && typeof x==='object') {Object.values(x).forEach(freeze);Object.freeze(x);}return x;};

test('reviewed identities retain order and groups while every current input stays reachable',()=>{
 assert.equal(snapshot.entries.length,767);
 assert.equal(new Set(snapshot.entries.map(e=>e.chunk)).size,197);
 const protectedIds=new Set(snapshot.displayIds);
 assert.deepEqual(ids(view.order).filter(id=>protectedIds.has(id)),expectedPriorityIds);
 assert.equal(view.order.length,entries.length);
 assert.equal(new Set(ids(view.order)).size,entries.length);
 assert.deepEqual([...ids(view.order)].sort(),[...ids(entries)].sort());
 const actualGroups=Object.values(view.tree).flatMap(m=>m.parts.flatMap(p=>p.cats));
 assert.equal(actualGroups.length,new Set(entries.map(e=>JSON.stringify([e.mod,e.part,e.cat]))).size);
 assert.deepEqual(registry.moduleOrder,['algo','code','design','bagu','ai','syntax','plan']);
 for(const s of snapshot.entries) {
  const e=entries.find(e=>e.id===s.entryId);
  assert.deepEqual([e.mod,e.part,e.cat,e._chunk,e.progressKey||e.id],[s.mod,s.part,s.category,s.chunk,s.entryProgressKey]);
 }
});
test('all reviewed question identities remain an unchanged prefix; current additions retain their identities',()=>{
 assert.equal(snapshot.entries.reduce((n,e)=>n+e.questionsInUnchangedOrder.length,0),1134);
 assert.equal(snapshot.entries.reduce((n,e)=>n+(e.questionsInUnchangedOrder.length||1),0),1584);
 let questions=0,units=0;
 for(const s of snapshot.entries) {
  const e=entries.find(e=>e.id===s.entryId);
  units+=e.kind==='qa'?e.items.length:1;
  const qs=(e.items||[]).map((q,i)=>({originalIndex:i,stableId:q.id||null,anchor:q.id||i,domId:'q-'+(q.id||i),route:'#/e/'+e.id+'/'+(q.id||i),progressKey:e.id+'#'+(q.id||i)}));
  assert.deepEqual(qs.slice(0,s.questionsInUnchangedOrder.length),s.questionsInUnchangedOrder); questions+=qs.length;
  assert.equal(view.order.find(x=>x.id===e.id).items,e.items);
 }
 assert.ok(questions>=1134);assert.ok(units>=1584);
 const unitsOf=xs=>xs.reduce((n,e)=>n+(e.kind==='qa'?e.items.length:1),0);
 assert.equal(unitsOf(view.order),unitsOf(entries));
});
test('projection is deterministic, never mutates frozen input or QA arrays, and preserves object identity',()=>{
 const copy=freeze(structuredClone(entries)), rules=freeze(structuredClone(registry));
 const before=JSON.stringify(copy), a=buildLearningOrder(copy,rules),b=buildLearningOrder(copy,rules);
 assert.deepEqual(ids(a.order),ids(b.order));assert.equal(JSON.stringify(copy),before);
 for(const e of a.order) assert.equal(e,copy.find(x=>x.id===e.id));
});
test('algorithm pattern and syntax grouped order remains baseline grouped order',()=>{
 for(const mod of ['algo','syntax']) {
  const groups=new Map(); for(const e of entries.filter(e=>e.mod===mod && snapshot.displayIds.includes(e.id))) {const k=JSON.stringify([e.part,e.cat]);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(e.id);}
  assert.deepEqual(ids(view.tree[mod].all).filter(id=>snapshot.displayIds.includes(id)),[...groups.values()].flat());
 }
});
test('new entries append stably in existing group, new categories and parts append stably',()=>{
 const ref=entries.find(e=>e.id===snapshot.entries[0].entryId); const add=(id,part=ref.part,cat=ref.cat)=>({...ref,id,part,cat});
 const extra=[add('new-a'),add('new-b'),add('new-cat-a',ref.part,'new-cat'),add('new-cat-b',ref.part,'new-cat'),add('new-cat2',ref.part,'new-cat2'),add('new-part-a','new-part','category'),add('new-part-b','new-part2','category')];
 const messages=[];const v=buildLearningOrder([...extra,...entries],registry,m=>messages.push(m));
 const p=v.tree.algo.parts.find(p=>p.name===ref.part);
 assert.deepEqual(ids(p.cats.find(c=>c.name===ref.cat).items).slice(-2),['new-a','new-b']);
 assert.deepEqual(p.cats.slice(-2).map(c=>c.name),['new-cat','new-cat2']);
 assert.deepEqual(v.tree.algo.parts.slice(-2).map(p=>p.name),['new-part','new-part2']);
 assert.equal(v.order.length,entries.length+extra.length);assert.equal(new Set(ids(v.order)).size,entries.length+extra.length);
 assert.equal(messages.length,1);for(const e of extra) assert.ok(messages[0].includes(e.id));
});
test('missing reviewed entries warn and are omitted without fabricating content',()=>{
 const missingId=snapshot.entries[0].entryId;const messages=[];const v=buildLearningOrder(entries.filter(e=>e.id!==missingId),registry,m=>messages.push(m));
 assert.equal(v.order.length,entries.length-1);assert.equal(v.order.some(e=>e.id===missingId),false);assert.ok(messages[0].includes(missingId));
});
test('duplicate IDs, duplicate ranks, malformed ranks and cross-group movement reject',()=>{
 assert.throws(()=>buildLearningOrder([...entries,entries[0]],registry),/duplicate/);
 const bad=structuredClone(registry);bad.modules[0].parts[0].categories[0].entryIds.push(snapshot.entries[0].entryId);
 assert.throws(()=>buildLearningOrder(entries,bad),/duplicate/);
 const bad2=structuredClone(registry);bad2.modules[0].parts[0].categories[0].entryIds[0]=NaN;
 assert.throws(()=>buildLearningOrder(entries,bad2),/malformed/);
 const moved=structuredClone(entries);moved.find(e=>e.id===snapshot.entries[0].entryId).cat='unreviewed relocation';
 assert.throws(()=>buildLearningOrder(moved,registry),/split or merged/);
});
test('membership resolution tolerates display renames without changing structural parentage',()=>{
 const renamed=entries.map(e=>({...e,part:'renamed '+e.part,cat:'renamed '+e.cat}));
 assert.deepEqual(ids(buildLearningOrder(renamed,registry).order),ids(view.order));
});
test('runtime guard rejects source and manifest drift and baseline bypass returns exact original',()=>{
 assert.equal(projectLearningOrderRuntime('src/app/structure.js',source,null,{baselineTest:true}),source);
 assert.equal(projectLearningOrderRuntime('src/app/events.js','anything',null),'anything');
 assert.throws(()=>projectLearningOrderRuntime('src/app/structure.js',source+' ',registry),/source drift/);
 const changed=structuredClone(registry);changed.modules[0].parts.reverse();
 assert.throws(()=>projectLearningOrderRuntime('src/app/structure.js',source,changed),/registry drift/);
});
test('actual generated structure gives one consistent sidebar/card/map/pager graph and canonical indexes',async()=>{
 const data=structuredClone(entries), context=vm.createContext({ENTRIES:data,store:{get:(_,d)=>d},console});
 vm.runInContext(projectLearningOrderRuntime('src/app/structure.js',source,registry),context);
 assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(ORDER.map(e=>e.id))',context)),ids(view.order));
 const fragments=await read('src/app/fragments.js');
 const pager=fragments.slice(fragments.indexOf('function pager(e)'),fragments.indexOf('function relatedLinks'));
 vm.runInContext("const h=x=>x;const href=e=>'#/e/'+e.id;"+pager,context);
 for(const m of Object.values(view.tree)) for(let i=0;i<m.all.length;i++) {
  context.id=m.all[i].id;
  const html=vm.runInContext('pager(ENTRIES.find(e=>e.id===id))',context);
  const links=[...html.matchAll(/href="([^\"]+)"/g)].map(x=>x[1]);
  assert.deepEqual(links,[m.all[i-1],m.all[i+1]].filter(Boolean).map(e=>'#/e/'+e.id));
 }
 for(const file of ['navigation','dashboard','highlight-map']) assert.match(await read('src/app/'+file+'.js'),/\.parts/);
 assert.deepEqual(ids(data),ids(entries));
});
test('actual J/K and arrow-key handler consumes same per-module traversal; QA movement stays distinct',async()=>{
 const events=await read('src/app/events.js');
 const block=events.slice(events.indexOf('  const stepEntry ='),events.indexOf('  if (hasQA &&'));
 for(const m of Object.values(view.tree)) for(let i=0;i<m.all.length;i++) for(const [key,d] of [['j',1],['k',-1],['ArrowRight',1],['ArrowLeft',-1]]) {
  const ctx={TREE:view.tree,cur:m.all[i],hasQA:false,key,location:{hash:''},href:e=>'#/e/'+e.id,ev:{preventDefault(){}},moveQuestion:()=>assert.fail('unexpected QA move')};
  vm.runInNewContext('(function(){'+block+'})()',ctx);
  assert.equal(ctx.location.hash,m.all[i+d]?'#/e/'+m.all[i+d].id:'');
 }
 const ctx={TREE:view.tree,cur:entries[0],hasQA:true,key:'j',location:{hash:''},href:e=>'#/e/'+e.id,ev:{preventDefault(){}},moveQuestion:d=>{ctx.moved=d;}};
 vm.runInNewContext('(function(){'+block+'})()',ctx);assert.equal(ctx.moved,1);assert.equal(ctx.location.hash,'');
});

test('new canonical questions preserve numeric and stable identities without requiring rank changes',()=>{
 const extended=structuredClone(entries);
 const e=extended.find(e=>e.kind==='qa');
 const before=structuredClone(e.items);
 e.items.push({mk:'appended numeric question'},{id:'future-stable-question',mk:'appended stable question'});
 const v=buildLearningOrder(freeze(extended),registry,()=>{});
 const actual=v.order.find(x=>x.id===e.id);
 assert.equal(actual,e);assert.equal(actual.items,e.items);
 assert.deepEqual(actual.items.slice(0,before.length),before);
 assert.equal(actual.items.length,before.length+2);
 const anchors=actual.items.map((q,i)=>q.id||i);
 assert.deepEqual(anchors.slice(-2),[before.length,'future-stable-question']);
 assert.deepEqual(anchors.slice(-2).map(a=>e.id+'#'+a),[e.id+'#'+before.length,e.id+'#future-stable-question']);
 assert.deepEqual(ids(v.order),ids(view.order));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {projectInterviewReading,projectInterviewRuntime} from '../scripts/interview-reading.mjs';
const json=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
const policy=await json('content/interview-reading-policy.json');
const original=await json('dist/data/archives/source-entries.json');
const reading=projectInterviewReading(original,policy);
const catalog=await json('dist/data/catalog.json');
const archived=new Set(policy.archivedEntries.map(x=>x.id));
const protectedSourceIds=(await json('tests/fixtures/protected-source-entry-ids.json')).ids;
function assertSourceInventory(entries){
 const ids=entries.map(e=>e.id),set=new Set(ids);
 assert.equal(set.size,ids.length,'Duplicate source entry IDs');
 for(const id of protectedSourceIds)assert.ok(set.has(id),'Missing protected source entry '+id);
}
const scan=(v,fn,path=[])=>{if(typeof v==='string')fn(v,path);else if(v&&typeof v==='object')for(const [k,x] of Object.entries(v))scan(x,fn,[...path,k]);};
test('all four theory modules are code-card-free while inline terms, prose and IDs remain',()=>{
 for(const e of reading.entries.filter(e=>policy.theoryModules.includes(e.mod)))scan(e,(s,p)=>{assert.ok(!/<pre\b|class="[^"]*\bcode-card\b/.test(s),e.id+'/'+p.join('/'));});
 const restored=structuredClone(reading.entries);for(const e of restored)delete e.readingNotesHtml;const byId=new Map(restored.map(e=>[e.id,e]));
 for(const f of policy.fields){let v=byId.get(f.entryId);for(const p of f.path.slice(0,-1))v=v[p];v[f.path.at(-1)]=f.before;}
 assert.deepEqual(restored,original.filter(e=>!archived.has(e.id)),'Only finite reviewed fields changed; all unlisted knowledge and question identities survive');
 for(const e of reading.entries.filter(e=>e.kind==='qa')){assert.deepEqual(e.items.map(q=>[q.id,q.mk]),original.find(x=>x.id===e.id).items.map(q=>[q.id,q.mk]));for(const [i,q]of e.items.entries()){const label=policy.fields.find(f=>f.entryId===e.id&&JSON.stringify(f.path)===JSON.stringify(['items',i,'q']));assert.equal(q.q,label?label.after:original.find(x=>x.id===e.id).items[i].q);}}
});
test('archived companions are absent from navigation/search, with owner fallbacks and complete source archive',async()=>{
 assertSourceInventory(original);assert.equal(archived.size,54);
 for(const id of archived){assert.ok(!catalog.entries.some(e=>e.id===id));assert.ok(!(await json('dist/data/search.json')).some(e=>e.id===id));assert.ok(original.some(e=>e.id===id));assert.ok(catalog.entries.some(e=>e.id===catalog.archivedRoutes[id].ownerId));}
 for(const e of reading.entries)scan(e,s=>{for(const id of archived)assert.ok(!s.includes('href="#/e/'+id+'"'),e.id+' links archived '+id);});
});
test('algorithm, actual handwrite/SQL and concise syntax content is preserved except links to archived companions',()=>{
 assert.equal(reading.entries.filter(e=>e.kind==='syntax').length,44);
 for(const e of reading.entries.filter(e=>['algo','handwrite','database','syntax'].includes(e.kind))){const before=original.find(x=>x.id===e.id);const changes=policy.fields.filter(f=>f.entryId===e.id);for(const change of changes){if(['handwrite-46','handwrite-68'].includes(e.id)){assert.ok(change.before.includes('add-own-practice-'));assert.deepEqual(change.before.match(/<pre[^>]*data-lang="java"[^>]*>[\s\S]*?<\/pre>/g)||[],change.after.match(/<pre[^>]*data-lang="java"[^>]*>[\s\S]*?<\/pre>/g)||[]);}else{assert.ok(change.before.includes('#/e/own-'));assert.equal((change.before.match(/<pre\b/g)||[]).length,(change.after.match(/<pre\b/g)||[]).length);}}assert.equal(e.code,before.code);}
});
test('baseline bypass is exact, source mutation and manifest corruption fail closed',()=>{
 assert.equal(projectInterviewReading(original,null,{baselineTest:true}).entries,original);
 const f=policy.fields[0],bad=structuredClone(policy);bad.fields[0].after+='!';assert.throws(()=>projectInterviewReading(original,bad),/hash mismatch/);
 const duplicate=structuredClone(policy);duplicate.fields.push(f);assert.throws(()=>projectInterviewReading(original,duplicate),/Duplicate/);
});
test('both archived URL formats resolve without exposing code titles or changing saved progress',async()=>{
 const source=await readFile(new URL('../src/app/routing.js',import.meta.url),'utf8');
 const text=projectInterviewRuntime('src/app/routing.js',source);
 const context={location:{hash:''},TREE:{},HL_MODS:[],ALGO_ALIAS:{},DATA:{archivedRoutes:catalog.archivedRoutes},byId:new Map(catalog.entries.map(e=>[e.id,e]))};vm.createContext(context);vm.runInContext(text,context);
 for(const id of archived)for(const hash of ['#/e/'+id,'#'+id]){context.location.hash=hash;const r=vm.runInContext('parseHash()',context);assert.equal(r.view,'archived');assert.equal(r.id,id);}
 assert.ok(text.includes('历史进度已保留'));assert.ok(!text.includes('store.remove'));
 assert.equal(projectInterviewRuntime('src/app/routing.js',source,{baselineTest:true}),source);
});
test('archived companion concepts remain readable and searchable under stable knowledge owners',async()=>{
 const search=await json('dist/data/search.json');
 for(const t of policy.knowledgeTransfers){const owner=reading.entries.find(e=>e.id===t.ownerId);assert.ok(owner.readingNotesHtml.includes(t.html));assert.deepEqual(t.ownerIdentity,{id:owner.id,kind:owner.kind,mod:owner.mod});assert.ok(search.find(r=>r.id===owner.id&&r.qi==null).text.length>0);assert.ok(!/<pre\b|class="[^"]*\bcode-card\b/.test(t.html));}
 const duplicate=structuredClone(policy);duplicate.knowledgeTransfers.push(duplicate.knowledgeTransfers[0]);assert.throws(()=>projectInterviewReading(original,duplicate),/Duplicate knowledge transfer/);
 const bad=structuredClone(policy);bad.knowledgeTransfers[0].ownerIdentity.mod='other';assert.throws(()=>projectInterviewReading(original,bad),/owner identity mismatch/);
});

test('unregistered theory listings and missing archive source/owner fail before publication',()=>{
 const unseen=structuredClone(original);unseen.push({id:'unreviewed-theory',kind:'doc',mod:'ai',html:'<pre>never publish</pre>'});assert.throws(()=>projectInterviewReading(unseen,policy),/Unprojected theory listing/);
 const missing=original.filter(e=>e.id!==policy.archivedEntries[0].id);assert.throws(()=>projectInterviewReading(missing,policy),/Invalid archive owner/);
 const broken=structuredClone(policy);broken.archivedEntries[0].ownerId='missing-owner';assert.throws(()=>projectInterviewReading(original,broken),/Invalid archive owner/);
});

test('unreviewed code companions and missing reviewed code documents fail closed',()=>{
 const unseen=[...original,{id:'new-program-book',kind:'doc',mod:'code',html:'<pre>program</pre>'}];assert.throws(()=>projectInterviewReading(unseen,policy),/Unreviewed code companion/);
 const missing=original.filter(e=>e.id!=='own-algo-manual-guide');assert.throws(()=>projectInterviewReading(missing,policy),/Missing reviewed code document/);
});

test('fenced non-executable knowledge is restored under guarded owners and non-QA owners render notes',async()=>{
 assert.equal(policy.knowledgeRestorations.length,68);
 for(const rule of policy.knowledgeRestorations){let owner=reading.entries.find(e=>e.id===rule.ownerId);if(rule.destinationPath){for(const key of rule.destinationPath)owner=owner[key];assert.ok(owner.includes(rule.html));}else assert.ok(owner.readingNotesHtml.includes(rule.html));}
 const corrupt=structuredClone(policy);corrupt.knowledgeRestorations[0].sourceBlock+='changed';assert.throws(()=>projectInterviewReading(original,corrupt),/restoration source mismatch/);
 const missing=structuredClone(policy);missing.knowledgeRestorations[0].ownerId='missing';assert.throws(()=>projectInterviewReading(original,missing),/restoration owner mismatch/);
 const src=await readFile(new URL('../src/app/fragments.js',import.meta.url),'utf8');assert.ok(projectInterviewRuntime('src/app/fragments.js',src).includes("e.kind!=='qa'&&e.readingNotesHtml"));const entry=reading.entries.find(e=>e.kind!=='qa'&&e.readingNotesHtml);const context={TREE:{[entry.mod]:{all:[entry]}},entry};vm.createContext(context);vm.runInContext(projectInterviewRuntime('src/app/fragments.js',src),context);assert.ok(vm.runInContext('pager(entry)',context).includes(entry.readingNotesHtml));assert.equal(projectInterviewRuntime('src/app/fragments.js',src,{baselineTest:true}),src);
});

test('reviewed native programs cannot leak through nested supplement headings',()=>{
 for(const [id,language]of [['handwrite-46','python'],['handwrite-68','javascript']]){const e=reading.entries.find(e=>e.id===id);assert.ok(!e.supplementHtml.includes('data-lang="'+language+'"'));}
 for(const id of ['own-practice-javascript-async-contracts','own-practice-native-cpp-mpmc','own-practice-mini-promise','own-practice-worker-lifecycle'])assert.ok(!reading.entries.some(e=>e.id===id));
 for(const id of ['own-practice-gift-receipt-contract','own-practice-purchase-preflight-parser']){const e=reading.entries.find(e=>e.id===id);assert.ok(!/<pre\b/.test(JSON.stringify(e)));assert.ok(!/完整前后端|在示例根目录运行：|将程序和自测保存/.test(JSON.stringify(e)));}
});

test('home copy and algorithm label use precise scope without source chatter',async()=>{
 const app=await readFile(new URL('../dist/assets/app.js',import.meta.url),'utf8');
 for(const old of ['单线程无锁','每个知识点都准备一句项目落地，证明不是背题。','来自《春招准备总规划》第 6 节',"full: '算法手撕'"])assert.ok(!app.includes(old),old);
 for(const expected of ['多数命令串行执行以减少锁竞争','有真实经历就联系项目；没有则说明设计思路，不虚构落地。',"full: '算法与数据结构'"])assert.ok(app.includes(expected),expected);
 for(const file of ['catalog','dashboard']){const source=await readFile(new URL('../src/app/'+file+'.js',import.meta.url),'utf8');assert.equal(projectInterviewRuntime('src/app/'+file+'.js',source,{baselineTest:true}),source);}
});

test('same-owner restored knowledge stays inside its question answer and archived examples are collapsed',()=>{
 const rule=policy.knowledgeRestorations.find(r=>r.id==='field-412'),entry=reading.entries.find(e=>e.id===rule.ownerId);assert.deepEqual(rule.destinationPath,['items',0,'a']);assert.ok(entry.items[0].a.includes(rule.html));assert.ok(!(entry.readingNotesHtml||'').includes(rule.html));
 for(const r of policy.knowledgeRestorations.filter(r=>!r.destinationPath)){const e=reading.entries.find(e=>e.id===r.ownerId);assert.ok(e.readingNotesHtml.includes('<details class="reading-example"><summary>'));assert.ok(!e.readingNotesHtml.includes('<details open'));}
});

test('source inventory protects every existing ID while allowing ordinary new entries',()=>{
 assert.equal(protectedSourceIds.length,821);assert.equal(new Set(protectedSourceIds).size,821);
 const future={id:'future-source-inventory-test',kind:'doc',mod:'bagu',part:'Future',cat:'Future',title:'Future addition',html:'<p>Additional knowledge.</p>'};
 const extended=[...original,future];assertSourceInventory(extended);
 assert.deepEqual(projectInterviewReading(extended,policy).entries.find(e=>e.id===future.id),future);
 assert.throws(()=>assertSourceInventory(original.filter(e=>e.id!==protectedSourceIds[0])),/Missing protected/);
 assert.throws(()=>assertSourceInventory([...original,original[0]]),/Duplicate source/);
});

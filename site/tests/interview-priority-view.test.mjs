import {removeExactIntroRepeat} from '../scripts/remove-exact-intro.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {priorityQuestionView,validatePriorityView,projectPriorityViewRuntime} from '../scripts/interview-priority-view.mjs';
import {projectSource} from '../scripts/display-projection.mjs';
import {projectInterviewRuntime} from '../scripts/interview-reading.mjs';
import {projectLearnerReadingRuntime} from '../scripts/learner-reading-runtime.mjs';
import {projectNoteDisplayRuntime} from '../scripts/note-display-cleanup.mjs';
import {projectExactIntroRuntime} from '../scripts/exact-intro-runtime.mjs';
import {projectCapacityPitfallsRuntime} from '../scripts/capacity-pitfalls-runtime.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const registry=JSON.parse(await read('content/interview-priority-view.json'));
const catalog=JSON.parse(await read('dist/data/catalog.json'));
const chunks=await Promise.all([...new Set(catalog.entries.map(e=>e._chunk))].map(p=>read('dist/'+p).then(JSON.parse)));
const entries=chunks.flatMap(c=>c.entries), byId=new Map(entries.map(e=>[e.id,e]));
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const display=JSON.parse(await read('content/display-projection.json'));
async function projected(file) {
 let text=await read(file);
 text=projectSource(file,text,display);
 text=projectInterviewRuntime(file,text);
 text=projectLearnerReadingRuntime(file,text);
 text=projectNoteDisplayRuntime(file,text);
 text=projectExactIntroRuntime(file,text);
 text=projectCapacityPitfallsRuntime(file,text);
 return projectPriorityViewRuntime(file,text,registry);
}
const renderer=await projected('src/app/renderers.js');
const highlight=await projected('src/app/highlight-map.js');
const helper=projectPriorityViewRuntime('src/app/structure.js','',registry);
test('reviewed finite registry resolves every key against current hydrated entries',()=>{
 assert.equal(validatePriorityView(entries,registry),true);
 assert.equal(registry.records.length,29);
 assert.equal(registry.records.reduce((n,r)=>n+r.emphasis.length,0),51);
 // Loaded from every actual dist catalog chunk above, not a reduced compiler fixture.
 assert.equal(new Set(registry.records.map(r=>r.entryId)).size,29);
 for(const rule of registry.records){const e=byId.get(rule.entryId), view=priorityQuestionView(e,registry);assert.equal(view.length,e.items.length);assert.equal(new Set(view.map(r=>r.key)).size,e.items.length);assert.deepEqual(view.slice(0,rule.order.length).map(r=>r.key),rule.order);}
});
test('frozen canonical arrays, question identity, original routes and progress keys survive sorting',()=>{
 const all=freeze(structuredClone(entries)), rules=freeze(structuredClone(registry)), before=JSON.stringify(all);
 for(const e of all){const view=priorityQuestionView(e,rules);for(const row of view){assert.equal(row.item,e.items[row.canonicalIndex]);assert.equal(row.anchor,row.item.id||row.canonicalIndex);assert.equal(row.key,e.id+'#'+row.anchor);assert.equal(row.originalNo,row.canonicalIndex+1);}assert.deepEqual(view,priorityQuestionView(e,rules));}
 assert.equal(JSON.stringify(all),before);
});
test('new questions append stably and hydration is re-read instead of caching stale item objects',()=>{
 const e=structuredClone(byId.get('bg-mysql-5')), before=priorityQuestionView(e,registry).map(r=>r.key), n=e.items.length;
 e.items.push({q:'future numeric'},{id:'future-stable',q:'future stable'});
 const view=priorityQuestionView(e,registry);assert.deepEqual(view.map(r=>r.key),[...before,e.id+'#'+n,e.id+'#future-stable']);
 e.items=e.items.map(q=>({...q,a:'hydrated'}));assert.ok(priorityQuestionView(e,registry).every(r=>r.item.a==='hydrated'));
});
test('reject duplicate/missing targets and preserve coherent sub sections',()=>{
 for(const edit of [r=>r.records.push(r.records[0]),r=>r.records[0].order.push(r.records[0].order[0]),r=>r.records[0].emphasis.push('missing#0')]){const r=structuredClone(registry);edit(r);assert.throws(()=>validatePriorityView(entries,r),/Priority view/);}
 const e={id:'x',kind:'qa',items:[{sub:'a'},{sub:'a'},{sub:'b'},{sub:'b'}]};
 const r={schemaVersion:1,records:[{entryId:'x',order:['x#1','x#0','x#3','x#2'],emphasis:[]}]};
 assert.equal(validatePriorityView([e],r),true);assert.deepEqual(priorityQuestionView(e,r).map(r=>r.canonicalIndex),[1,0,3,2]);
 r.records[0].order=['x#2','x#0'];assert.throws(()=>validatePriorityView([e],r),/section/);assert.deepEqual(priorityQuestionView(e,r).map(r=>r.block),[0,0,1,1]);
});
test('projection guards drift and leaves baseline plus unrelated files exact',()=>{
 for(const file of ['structure','renderers','highlight-map'])assert.equal(projectPriorityViewRuntime('src/app/'+file+'.js','raw',null,{baselineTest:true}),'raw');
 assert.equal(projectPriorityViewRuntime('src/app/events.js','raw',registry),'raw');
 assert.throws(()=>projectPriorityViewRuntime('src/app/structure.js','',{}),/registry drift/);
 assert.throws(()=>projectPriorityViewRuntime('src/app/renderers.js','',registry),/exactly one/);
 assert.ok(renderer.includes('removeExactIntroRepeat'));assert.ok(renderer.includes("it.leadType === 'authored'"));
});
function contextFor(e) {
 const qAnchor=(id,i)=>byId.get(id).items[i].id||i;
 const h=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 const c=vm.createContext({removeExactIntroRepeat,DATA:{HL:{cards:{},core:{}}},MODS:[{id:e.mod}],MOD:{[e.mod]:{full:'Module'}},TREE:{[e.mod]:{all:[e],parts:[{name:e.part,cats:[{name:e.cat,items:[e]}]}]}},h,stripTags:s=>String(s||'').replace(/<[^>]*>/g,''),qAnchor,qKey:(id,i)=>id+'#'+qAnchor(id,i),href:(x,i)=>'#/e/'+encodeURIComponent(x.id)+(i===undefined?'':'/'+qAnchor(x.id,i)),statusOf:key=>key===e.id+'#0'?2:0,store:{get:(_,d)=>d},unitsOf:es=>({ok:1,fuzzy:0,total:es.reduce((n,x)=>n+(x.items?.length||1),0)}),learnerLabel:(_,s)=>s,state:{qaMode:'lead'},pageHead:()=>'',qaToolbar:()=>'',sec:()=>'',relatedLinks:()=>'',pager:()=>'',crumbs:()=>'',e});
 vm.runInContext(helper+'\n'+highlight,c);
 const start=renderer.indexOf('function qaCardHtml('), end=renderer.indexOf('function qaToolbar(');
 vm.runInContext(renderer.slice(start,end),c);
 const qaStart=renderer.indexOf('function renderQA('), qaEnd=renderer.indexOf('\nfunction ',qaStart+1);
 vm.runInContext(renderer.slice(qaStart,qaEnd<0?undefined:qaEnd),c);
 // Rendered corpus has lead fields; splitLead is retained for legacy/no-lead questions.
 c.splitLead=a=>['',a||''];c.readingNotesHtml=()=>'';
 return c;
}
test('actual projected QA, key card and map agree on sorted keys and original links',()=>{
 for(const id of ['bg-mysql-5','ai-agent-9','own-juc-coordination','ai-模型与评测-6']){
 const e=byId.get(id),c=contextFor(e),expected=priorityQuestionView(e,registry).map(r=>r.key);
 const qa=vm.runInContext('renderQA(e)',c),card=vm.runInContext('keyCard(e)',c),map=vm.runInContext('renderMap(e.mod)',c);
 assert.deepEqual([...qa.matchAll(/class="qa s\d" id="q-[^"]+" data-key="([^"]+)"/g)].map(m=>m[1]),expected);
 for(const html of [card,map])assert.deepEqual([...html.matchAll(/<li class="(?:hm-q )?s\d" data-k="([^"]+)"/g)].map(m=>m[1]),expected);
 for(const row of priorityQuestionView(e,registry)){assert.ok(qa.includes('id="q-'+row.anchor+'"'));assert.ok(card.includes('#/e/'+encodeURIComponent(id)+'/'+row.anchor));assert.ok(map.includes('#/e/'+encodeURIComponent(id)+'/'+row.anchor));}
 const n=registry.records.find(r=>r.entryId===id).emphasis.length;
 // renderQA includes its keyCard too.
 assert.equal((qa.match(/priority-tag/g)||[]).length,n*2);assert.equal((card.match(/priority-tag/g)||[]).length,n);assert.equal((map.match(/priority-tag/g)||[]).length,n);
 }
});
test('numeric and stable deep links focus original DOM IDs while J/K follows display order',async()=>{
 const source=await read('src/app/questions.js');
 for(const id of ['bg-mysql-5','ai-agent-9']){
 const rows=priorityQuestionView(byId.get(id),registry);const cards=rows.map(r=>({id:'q-'+r.anchor,classList:{add(){},remove(){}},scrollIntoView(){}}));
 const c=vm.createContext({document:{getElementById:id=>cards.find(c=>c.id===id)},$$:()=>cards,state:{curQ:-1},requestAnimationFrame:fn=>fn()});vm.runInContext(source,c);
 for(const row of rows){c.anchor=row.anchor;vm.runInContext('focusQuestion(anchor,true)',c);assert.equal(c.state.curQ,rows.indexOf(row));}
 c.state.curQ=0;vm.runInContext('moveQuestion(1)',c);assert.equal(c.state.curQ,1);
 }
});

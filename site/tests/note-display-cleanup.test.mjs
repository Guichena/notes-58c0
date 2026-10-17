import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {projectNoteDisplay, projectNoteDisplayRuntime} from '../scripts/note-display-cleanup.mjs';
const fixtures = JSON.parse(await readFile(new URL('./fixtures/note-display-live220.json',import.meta.url)));
const source = "function renderPTopic(e){return e.folds.map(f=>fold(f.title,f.html,false,'')).join('');}";
const htmlEscape = s => String(s).replace(/[&<>\"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const listeners = [];
const context = vm.createContext({h:htmlEscape,document:{addEventListener:(...a)=>listeners.push(a)}});
// Same fold helper as src/app/fragments.js; no app boot, build or full graph load.
vm.runInContext("const fold = (title, body, open, note) => body ? `<details class=\"fold\"${open ? ' open' : ''}><summary>${h(title)}${note ? `<span class=\"note\">${h(note)}</span>` : ''}</summary><div class=\"fold-body md\">${body}</div></details>` : '';",context);
vm.runInContext(projectNoteDisplayRuntime('src/app/renderers.js',source),context);
const render=e=>context.renderPTopic(e);
test('count is derived, preserves questions, metadata and source graph',()=>{
 const before=JSON.stringify(fixtures),out=projectNoteDisplay(fixtures);
 for(let i=0;i<out.length;i++){
  assert.strictEqual(out[i].items,fixtures[i].items);
  assert.deepEqual({...out[i],number:fixtures[i].number},fixtures[i]);
 }
 assert.equal(out.find(e=>e.id==='bg-redis-3').number,'8 问');
 assert.equal(out.find(e=>e.id==='ai-agent-1').number,'6 问');
 assert.equal(JSON.stringify(fixtures),before);
});
test('future additions and explicit count labels only; formatting preserved',()=>{
 const q={kind:'qa',number:' 5  问 ',items:[{id:'one',mk:1},{id:'new',mk:0}]};
 assert.equal(projectNoteDisplay([q])[0].number,' 2  问 ');
 for(const number of ['LC 5','5问拓展','专题','5 问（附录）',5,null,undefined]) {
  const e={...q,number};assert.strictEqual(projectNoteDisplay([e])[0],e);
 }
 const e={...q,kind:'algo'};assert.strictEqual(projectNoteDisplay([e])[0],e);
 assert.equal(projectNoteDisplay([{...q,items:[]}])[0].number,' 0  问 ');
});
test('baseline bypasses both entry and runtime projection byte-for-byte',()=>{
 assert.strictEqual(projectNoteDisplay(fixtures,{baselineTest:true}),fixtures);
 assert.equal(projectNoteDisplayRuntime('src/app/renderers.js',source,{baselineTest:true}),source);
 assert.equal(projectNoteDisplayRuntime('src/app/routing.js',source),source);
});
test('admitted live220 exact duplicate bodies render once; summaries/order retained, source unchanged',()=>{
 for(const e of fixtures.filter(e=>e.folds)){
  const before=JSON.stringify(e),html=render(e);
  assert.equal((html.match(/<details /g)||[]).length,e.folds.length);
  for(const body of new Set(e.folds.map(f=>f.html)))assert.equal(html.split(body).length-1,1);
  const summaries=[...html.matchAll(/<summary>(.*?)<\/summary>/gs)].map(m=>m[1]);
  assert.deepEqual(summaries,e.folds.map(f=>htmlEscape(f.title.replace(/（保留原稿版本 \d+）$/,''))));
  assert.ok(!html.includes('保留原稿版本'));
  assert.equal(JSON.stringify(e),before);
 }
});
test('new distinct details automatically stop sharing; reordered folds do not use frozen indexes',()=>{
 const e={id:'p-list',folds:[{title:'First',html:'<p id="h-detail">body</p>'},{title:'Different question',html:'<p id="h-detail">body</p>'}]};
 const before=JSON.stringify(e),html=render(e);
 assert.equal(html.split('id="h-detail"').length-1,1);
 assert.ok(html.includes('<summary>Different question</summary>'));
 assert.ok(html.includes('data-note-fold-ref="0"'));
 const changed=structuredClone(e);changed.folds[1].html+='<pre>new code</pre>';
 assert.ok(!render(changed).includes('data-note-fold-ref='));
 const reordered={...e,folds:[{title:'Other',html:'<p>unique</p>'},...e.folds]};
 assert.ok(render(reordered).includes('data-note-fold-ref="1"'));
 assert.equal(JSON.stringify(e),before);
});
test('all other topics remain byte-identical',()=>{
 const e={id:'p-heap',folds:[{title:'T',html:'<p>B</p>'},{title:'T',html:'<p>B</p>'}]};
 assert.equal(render(e),vm.runInContext("e=>e.folds.map(f=>fold(f.title,f.html,false,'')).join('')",context)(e));
});
test('canonical button opens, focuses and scrolls; repeat activation is safe; no hash change',()=>{
 assert.equal(listeners.length,1);assert.equal(listeners[0][0],'click');
 let focused=0,scrolled=0;
 const canonical={open:false,querySelector:s=>{assert.equal(s,'summary');return {focus:()=>focused++};},scrollIntoView:()=>scrolled++};
 const root={querySelector:s=>{assert.equal(s,'[data-note-fold="6"]');return canonical;}};
 const button={dataset:{noteFoldRef:'6'},closest:s=>{assert.equal(s,'[data-note-topic-folds]');return root;}};
 const event={target:{closest:s=>{assert.equal(s,'[data-note-fold-ref]');return button;}}};
 for(let i=0;i<2;i++)listeners[0][1](event);
 assert.equal(canonical.open,true);assert.equal(focused,2);assert.equal(scrolled,2);
 for(const target of [null,undefined,{}, {nodeType:3}, {nodeType:9}])assert.doesNotThrow(()=>listeners[0][1]({target}));
 listeners[0][1]({target:{closest:()=>null}});
 button.dataset.noteFoldRef='bad';listeners[0][1](event);assert.equal(scrolled,2);
 assert.ok(!projectNoteDisplayRuntime('src/app/renderers.js',source).includes('location.hash'));
});
test('upstream render-site drift fails closed, unrelated authoring is not hash-locked',()=>{
 assert.throws(()=>projectNoteDisplayRuntime('src/app/renderers.js','changed renderer'),/exactly one/);
 assert.throws(()=>projectNoteDisplayRuntime('src/app/renderers.js',source+source),/exactly one/);
});
test('projection applies to actual current final bundle, and compiles',async()=>{
 const actual=await readFile(new URL('../dist/assets/app.js',import.meta.url),'utf8');
 const result=actual;
 assert.ok(result.includes('renderNoteTopicFolds(e)'));
 new vm.Script(result);
});

// Reconstruct the final content independently of build.mjs, before deriving display.
import {upstream} from './helpers/editorial-upstream.mjs';
import {projectInterviewEditorial} from '../scripts/interview-editorial-projection.mjs';
import {projectReviewedContent} from '../scripts/reviewed-content-projection.mjs';
import {projectAlgorithmCorrections} from '../scripts/algorithm-corrections.mjs';
import {expectedNoteDisplay,restoreExpectedNoteDisplay} from './helpers/note-display-oracle.mjs';
import {compileAuthoring,readAuthoring} from '../scripts/authoring.mjs';
import {ContentRepository} from '../src/runtime/content-repository.js';
const json=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
const beforeDisplay=projectAlgorithmCorrections(projectReviewedContent(projectInterviewEditorial(upstream.claimEntries,await json('content/interview-editorial-projection.json')),await json('content/reviewed-content-projection.json')),await json('content/algorithm-corrections.json'));
const catalog=await json('dist/data/catalog.json'),chunks=new Map(await Promise.all([...new Set(catalog.entries.map(e=>e._chunk))].map(async p=>[p,await json('dist/'+p)])));
const byId=new Map([...chunks.values()].flatMap(c=>c.entries).map(e=>[e.id,e]));
const published=catalog.entries.map(e=>byId.get(e.id));
test('final full graph matches independent display oracle with every other field retained',()=>{
 assert.deepEqual(published,expectedNoteDisplay(beforeDisplay));
 assert.deepEqual(projectNoteDisplay(beforeDisplay),published);
 for(let i=0;i<published.length;i++){
  assert.deepEqual({...published[i],number:beforeDisplay[i].number},beforeDisplay[i]);
  assert.deepEqual(published[i].items?.map(({id,mk})=>({id,mk})),beforeDisplay[i].items?.map(({id,mk})=>({id,mk})));
  assert.equal(published[i].progressKey,beforeDisplay[i].progressKey);
 }
});
test('all 18 previously identified count fixes and every actual final explicit QA count agree',async()=>{
 const fixes=await json('tests/fixtures/note-display-count-fixes.json');assert.equal(fixes.length,18);
 for(const fix of fixes){const prior=beforeDisplay.find(e=>e.id===fix.id);assert.equal(prior.number,fix.before);assert.equal(byId.get(fix.id).number,fix.after);}
 const actual=beforeDisplay.filter((e,i)=>e.number!==published[i].number).map(e=>e.id).sort();
 assert.deepEqual(actual,fixes.map(f=>f.id).sort());
 for(const entry of published)if(entry.kind==='qa'&&typeof entry.number==='string'&&/^\s*\d+\s*问\s*$/.test(entry.number))assert.equal(Number(entry.number.match(/\d+/)[0]),entry.items.length);
});
test('catalog and lazy-loaded chapter counts agree without restoring stale metadata',async()=>{
 for(const e of catalog.entries)assert.equal(e.number,byId.get(e.id).number);
 // The repository test below exercises its actual Object.assign hydration path.
 const repository=new ContentRepository({baseURL:'https://notes.test/',fetcher:async url=>({ok:true,json:async()=>structuredClone(url.pathname==='/data/catalog.json'?catalog:chunks.get(url.pathname.slice(1)))})});
 await repository.loadCatalog();
 for(const fix of await json('tests/fixtures/note-display-count-fixes.json')){
  const e=repository.byId.get(fix.id);assert.equal(e.number,fix.after);
  await repository.loadEntry(fix.id);assert.equal(e.number,fix.after);assert.equal(e.items.length,byId.get(e.id).items.length);
 }
});
test('future actually compiled authored questions update badges and preserve existing progress identities',async()=>{
 const target=upstream.base.find(e=>e.id==='ai-agent-1');
 const docs=await readAuthoring(new URL('../',import.meta.url).pathname);
 const added={file:'authoring/questions/future-count.json',type:'questions',data:{schemaVersion:1,entryId:target.id,id:'q-future-display-count',question:'A future count question?',shortAnswer:'New answer.',explanation:'New independent detail.'}};
 const compiled=compileAuthoring(upstream.base,[...docs,added],upstream.identity);
 const e=compiled.find(e=>e.id===target.id),final={...beforeDisplay.find(e=>e.id===target.id),items:[...byId.get(target.id).items,e.items.find(q=>q.id===added.data.id)]};
 const result=projectNoteDisplay([final])[0];assert.equal(result.number,'7 问');assert.strictEqual(result.items,final.items);
 assert.deepEqual(result.items.slice(0,-1),byId.get(target.id).items);assert.equal(result.items.at(-1).id,added.data.id);
});
test('final exact-body groups are dynamically identified with every distinct explanation and title',()=>{
 const expected={'p-list':[[6,8],[7,9],[10,20]],'p-tree':[[2,5,16]]};
 for(const id of Object.keys(expected)){
  const e=byId.get(id),groups=new Map();e.folds.forEach((f,i)=>groups.set(f.html,[...(groups.get(f.html)||[]),i]));
  assert.deepEqual([...groups.values()].filter(g=>g.length>1),expected[id]);
  const html=render(e),summaries=[...html.matchAll(/<summary>(.*?)<\/summary>/gs)].map(m=>m[1]);
  assert.deepEqual(summaries,e.folds.map(f=>htmlEscape(f.title.replace(/（保留原稿版本 \d+）$/,''))));
  for(const body of groups.keys())if(body)assert.equal(html.split(body).length-1,1);
 }
});

test('upstream count oracle restores only independently verified values and rejects wrong badges',()=>{
 const input=[{id:'count-oracle',kind:'qa',number:'1 问',items:[{id:'q1'},{id:'q2'}],progressKey:'stable'}];
 const projected=projectNoteDisplay(input),snapshot=JSON.stringify(projected);
 assert.deepEqual(restoreExpectedNoteDisplay(projected,input),input);
 assert.equal(JSON.stringify(projected),snapshot);
 assert.throws(()=>restoreExpectedNoteDisplay([{...projected[0],number:'99 问'}],input),/derived QA count/);
 assert.throws(()=>restoreExpectedNoteDisplay(projected,[]),/independent upstream entry/);
 const extra=[{...projected[0],otherField:'retained'}];
 assert.equal(restoreExpectedNoteDisplay(extra,input)[0].otherField,'retained');
});

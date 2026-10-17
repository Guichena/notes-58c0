import test from 'node:test';
import assert from 'node:assert/strict';
import {projectQuestionBankMerge as merge,readQuestionBankMerge,questionBankBaselineShape,prepareQuestionBankAuthoring} from '../scripts/question-bank-merge.mjs';
import {sha256,entryIdentity,questionIdentity} from '../scripts/interview-voice-review.mjs';
const hash=v=>sha256(JSON.stringify(v));
const original=[{id:'old',kind:'qa',mod:'bagu',part:'Part',cat:'Category',title:'Title',items:[{q:'Old question?',a:'Old answer.',mk:true}]}];
const question={id:'q-new',q:'New question?',a:'New answer.',mk:false};
const entry={id:'new-doc',kind:'doc',mod:'bagu',part:'Part',cat:'Category',title:'New title',html:'<p>New details.</p>'};
const replace={id:'replace-old',type:'replaceField',entryId:'old',path:['items',0,'a'],entryIdentity:entryIdentity(original[0]),questionIdentity:questionIdentity(original[0],['items',0,'a']),before:'Old answer.',after:'Old answer. More details.',beforeSha256:sha256('Old answer.'),afterSha256:sha256('Old answer. More details.'),review:{rationale:'Reviewed addition'},sourceRecordIds:['source-one'],rationale:'Add omitted detail'};
const registry=records=>({schemaVersion:1,baseEntriesSha256:hash(original),records,coverage:records.map(r=>({sourceRecordId:r.sourceRecordIds[0],entryId:r.entry?.id||r.entryId,rationale:'Reviewed source coverage'}))});
const append={id:'append-question',type:'appendQuestions',entryId:'old',beforeItemsSha256:hash(original[0].items),items:[question],sourceRecordIds:['source-two'],rationale:'New subject'};
const add={id:'append-entry',type:'appendEntry',entry,sourceRecordIds:['source-three'],rationale:'New subject'};
test('empty registry is an exact identity, including baseline mode',async()=>{
 const checked=await readQuestionBankMerge();assert.equal(checked.schemaVersion,1);
 const r={schemaVersion:1,baseEntriesSha256:null,records:[],coverage:[]};
 assert.equal(merge(original,r),original);assert.equal(merge(original,null,{baselineTest:true}),original);
});
test('mixed operations round-trip exactly, preserving old positions and source isolation',()=>{
 const r=registry([replace,append,add]);
 r.records[1]={...append,beforeItemsSha256:hash([{...original[0].items[0],a:replace.after}])};
 const before=JSON.stringify(original),out=merge(original,r);
 assert.equal(out[0].id,'old');assert.equal(out[0].items[0].id,undefined);assert.equal(out[0].items[0].q,original[0].items[0].q);
 assert.deepEqual(out[0].items[1],question);assert.deepEqual(out[1],entry);
 assert.deepEqual(merge(out,r,{reverse:true}),original);assert.equal(JSON.stringify(original),before);
 assert.ok(!JSON.stringify(out).includes('sourceRecordId'));assert.ok(!JSON.stringify(out).includes('source-one'));
 out[1].html='changed';assert.equal(entry.html,'<p>New details.</p>');
 assert.throws(()=>merge(out,r,{reverse:true}),/appended entry changed/);
});
test('old question indexes, IDs and all unchanged values survive appending',()=>{
 const out=merge(original,registry([append]));assert.deepEqual(out[0].items.slice(0,1),original[0].items);
 assert.equal(out[0].items[0],original[0].items[0]);assert.deepEqual(merge(out,registry([append]),{reverse:true}),original);
});
test('rejects stale baseline, stale fields, stale append hash and unsafe identity edits',()=>{
 const stale=structuredClone(original);stale[0].title='Different';assert.throws(()=>merge(stale,registry([append])),/baseline hash/);
 assert.throws(()=>merge(original,registry([{...replace,before:'Wrong'}])),/hash\/type mismatch/);
 assert.throws(()=>merge(original,registry([{...append,beforeItemsSha256:'0'.repeat(64)}])),/stale append/);
 for(const path of [['id'],['items',0,'q'],['__proto__','a']])assert.throws(()=>merge(original,registry([{...replace,path}])),/non-answer|unsafe path/);
});
test('rejects duplicate entry, progress, stable question, operation and target identities',()=>{
 assert.throws(()=>merge(original,registry([{...add,entry:{...entry,id:'old'}}])),/duplicate entry/);
 assert.throws(()=>merge(original,registry([{...add,entry:{...entry,progressKey:'old'}}])),/duplicate progress/);
 assert.throws(()=>merge(original,registry([{...append,items:[question,question]}])),/duplicate question/);
 assert.throws(()=>merge(original,registry([append,append])),/duplicate operation/);
 assert.throws(()=>merge(original,registry([replace,{...replace,id:'second'}])),/duplicate replacement/);
 assert.throws(()=>merge(original,registry([{...append,items:[{...question,id:'0'}]}])),/stable q-/);
});
test('requires external source coverage and refuses unsupported metadata or active markup',()=>{
 const r=registry([append]);r.coverage=[];assert.throws(()=>merge(original,r),/source coverage/);
 for(const change of [{items:[{...question,sourceRecordIds:['leak']}]},{items:[{...question,a:'<script>alert(1)</script>'}]}])assert.throws(()=>merge(original,registry([{...append,...change}])),/unknown field|unsafe/);
 assert.throws(()=>merge(original,{...registry([]),path:'/tmp/source.json'}),/unknown field/);
 assert.throws(()=>merge(original,registry([{...add,type:'deleteEntry'}])),/unsupported operation/);
 const bad=registry([append]);bad.coverage[0].questionId='missing';assert.throws(()=>merge(original,bad),/coverage question/);
});
test('reverse fails if appended questions or original entries were modified',()=>{
 const r=registry([append]),out=merge(original,r);out[0].items[1].a='changed';assert.throws(()=>merge(out,r,{reverse:true}),/appended questions changed/);
 const out2=merge(original,r);out2[0].title='changed';assert.throws(()=>merge(out2,r,{reverse:true}),/reversed baseline/);
});
test('supports dedicated handwrite, database, scenario and algorithm renderers',()=>{
 const bodies={handwrite:{questionHtml:'Question',analysisHtml:'Analysis',answerHtml:'Answer'},database:{questionHtml:'Question',analysisHtml:'Analysis',answerHtml:'SQL answer'},scenario:{idea:'Idea',description:'Description',interviewAnswer:'Answer',requirements:['Requirement'],architecture:['Architecture']},algo:{idea:'Idea',description:'Description',code:'return a < b;',time:'O(1)',space:'O(1)'}};
 for(const [kind,body]of Object.entries(bodies)){
  const {html,...identity}=entry;const r=registry([{...add,entry:{...identity,kind,...body}}]);
  const out=merge(original,r);assert.equal(out[1].kind,kind);assert.deepEqual(merge(out,r,{reverse:true}),original);
 }
});
test('safe encoded apostrophes survive but entity-obfuscated active content is rejected',()=>{
 const safe={...append,items:[{...question,a:'<p>WHERE username=&#39;value&#39; demonstrates quoting.</p>'}]};
 assert.equal(merge(original,registry([safe]))[0].items[1].a,safe.items[0].a);
 for(const a of ['<a href="java&#115;cript:alert(1)">bad</a>','<a href="javascript&colon;alert(1)">bad</a>','&#60;script>alert(1)</script>'])assert.throws(()=>merge(original,registry([{...append,items:[{...question,a}]}])),/unsafe/);
});
test('adds a formerly absent supplement with exact whole-entry guard and reverses it',()=>{
 const addition={id:'add-supplement',type:'addSupplement',entryId:'old',beforeEntrySha256:hash(original[0]),html:'<p>Reviewed variant details.</p>',sourceRecordIds:['source-one'],rationale:'New variant on existing topic'};
 const r=registry([addition]),out=merge(original,r);assert.equal(out[0].supplementHtml,addition.html);assert.deepEqual(merge(out,r,{reverse:true}),original);
 assert.throws(()=>merge(original,registry([{...addition,beforeEntrySha256:'0'.repeat(64)}])),/stale supplement/);
 const changed=structuredClone(out);changed[0].supplementHtml+='drift';assert.throws(()=>merge(changed,r,{reverse:true}),/supplement changed/);
 assert.throws(()=>merge(original,registry([addition,{...addition,id:'other'}])),/duplicate supplement/);
});
test('preserves guarded legacy copy buttons but rejects newly introduced controls',()=>{
 const button='<button class="copy-button md-copy" type="button">Copy</button>';
 const base=structuredClone(original);base[0].items[0].a=button+'Old answer.';
 const before=base[0].items[0].a,after=before+'<p>Added.</p>';
 const change={...replace,before,after,beforeSha256:sha256(before),afterSha256:sha256(after)};
 const r={...registry([change]),baseEntriesSha256:hash(base)};
 assert.equal(merge(base,r)[0].items[0].a,after);
 for(const unsafe of [after+button,after.replace('type="button"','type="button" onclick="alert(1)"')]){
  assert.throws(()=>merge(base,{...r,records:[{...change,after:unsafe,afterSha256:sha256(unsafe)}]}),/unsafe/);
 }
 assert.throws(()=>merge(original,registry([{...append,items:[{...question,a:button}]}])),/unsafe/);
});

test('source-code data labels are inert while event attributes remain rejected',()=>{
 const code='<pre><code>q := &amp;CondQueue[T]{data: make([]T, capacity)}</code></pre>';
 assert.doesNotThrow(()=>merge(original,registry([{...append,items:[{...question,a:code}]}])));
 for(const a of ['<div onclick="alert(1)">x</div>','<img onerror="alert(1)">','<a href="d a t a:text/html,x">x</a>'])assert.throws(()=>merge(original,registry([{...append,items:[{...question,a}]}])),/unsafe/);
});

test('runtime code hydration preserves dollar selectors and stays off in baseline mode',async()=>{
 const {projectQuestionBankRuntime}=await import('../scripts/question-bank-merge.mjs');
 const source="function hydrateCode(root) {\n}\n";
 const result=projectQuestionBankRuntime('src/app/fragments.js',source);
 assert.ok(result.includes("$$('pre', root).forEach"));
 assert.equal(projectQuestionBankRuntime('src/app/fragments.js',source,{baselineTest:true}),source);
 assert.throws(()=>projectQuestionBankRuntime('src/app/fragments.js','wrong'),/anchor drift/);
});

test('scenario runtime counts rendered dimensions and omits empty summary rows',async()=>{
 const {projectQuestionBankRuntime}=await import('../scripts/question-bank-merge.mjs');
 const {readFile}=await import('node:fs/promises');
 const source=await readFile(new URL('../src/app/renderers.js',import.meta.url),'utf8');
 const result=projectQuestionBankRuntime('src/app/renderers.js',source);
 assert.ok(result.includes('`${DIMS.filter(([k]) => e[k] && e[k].length).length} 个维度`'));
 assert.ok(result.includes('${e.metrics ? `<div'));
 assert.ok(result.includes('${e.components ? `<div'));
 assert.equal(projectQuestionBankRuntime('src/app/renderers.js',source,{baselineTest:true}),source);
 assert.throws(()=>projectQuestionBankRuntime('src/app/renderers.js','wrong'),/anchor drift/);
});

const countedBase=[{...original[0],number:' 1 问 '}];
const independentQuestion={...question,id:'q-future-independent',q:'Future question?',a:'Future answer.'};
const independentEntry={...entry,id:'future-independent-entry',title:'Future entry',source:'自建知识库'};
const shapedRegistry=(records,base=countedBase)=>({
 ...registry(records),baseEntriesSha256:hash(base),baselineShape:questionBankBaselineShape(base)
});
const countedAppend={...append,beforeItemsSha256:hash(countedBase[0].items)};
const futureInput=()=>[{...countedBase[0],number:' 2 问 ',items:[...countedBase[0].items,independentQuestion]},independentEntry];
test('shape-isolated independent authoring preserves all current indexes and exact baseline reversal',()=>{
 const r=shapedRegistry([countedAppend,add]),input=futureInput(),before=JSON.stringify(input);
 const current=merge(countedBase,r),out=merge(input,r);
 assert.equal(current[0].number,' 2 问 ');assert.equal(out[0].number,' 3 问 ');
 assert.deepEqual(out.map(e=>e.id),['old','new-doc','future-independent-entry']);
 assert.deepEqual(out[0].items.slice(0,2),current[0].items);
 assert.equal(out[0].items[2],independentQuestion);
 assert.deepEqual(merge(out,r,{reverse:true}),input);
 assert.deepEqual(merge(current,r,{reverse:true}),countedBase);
 assert.equal(JSON.stringify(input),before);
});
test('future entries may be sorted between known upstream entries, but cannot reorder them',()=>{
 const base=[...countedBase,{...entry,id:'old-doc'}],r=shapedRegistry([countedAppend,add],base);
 const input=[futureInput()[0],independentEntry,base[1]],out=merge(input,r);
 assert.deepEqual(out.map(e=>e.id),['old','old-doc','new-doc','future-independent-entry']);
 assert.deepEqual(merge(out,r,{reverse:true}),[input[0],base[1],independentEntry]);
 assert.throws(()=>merge([base[1],input[0],independentEntry],r),/order changed/);
 assert.throws(()=>merge([out[0],out.at(-1),...out.slice(1,-1)],r,{reverse:true}),/reordered/);
});
test('independent additions never excuse a changed original field, question, number, or position',()=>{
 const r=shapedRegistry([countedAppend,add]);
 for(const change of [
  e=>{e.title='Changed';},e=>{e.items[0].q='Changed';},e=>{e.items[0].a='Changed';},
  e=>{e.items[0].mk=false;},e=>{e.items.reverse();},e=>{e.number=' 1 问 ';},
  e=>{e.number=' 999 问 ';},e=>{e.number='2 问';},e=>{e.items.pop();}
 ]){
  const input=structuredClone(futureInput());change(input[0]);
  assert.throws(()=>merge(input,r),/baseline hash|derived question count|stable q-/);
 }
 const noCount=[{...original[0],number:'Chapter 1'}],noCountRegistry=shapedRegistry([append],noCount);
 const input=[{...noCount[0],number:'Chapter 2',items:[...noCount[0].items,independentQuestion]}];
 assert.throws(()=>merge(input,noCountRegistry),/baseline hash/);
 const dishonestShape=structuredClone(r);dishonestShape.baselineShape[0].questionCount=0;
 assert.throws(()=>merge(futureInput(),dishonestShape),/baseline count label/);
});
test('stale replacement, item and whole-entry supplement guards survive future-tail isolation',()=>{
 const countedReplace={...replace,entryIdentity:entryIdentity(countedBase[0])};
 assert.equal(merge(futureInput(),shapedRegistry([countedReplace]))[0].items[0].a,replace.after);
 assert.throws(()=>merge(futureInput(),shapedRegistry([{...countedReplace,entryIdentity:{...countedReplace.entryIdentity,title:'Stale'}}])),/identity drift/);
 assert.throws(()=>merge(futureInput(),shapedRegistry([{...countedReplace,before:'Wrong',beforeSha256:sha256('Wrong')}])),/stale input/);
 assert.throws(()=>merge(futureInput(),shapedRegistry([{...countedAppend,beforeItemsSha256:'0'.repeat(64)}])),/stale append/);
 const supplement={id:'add-supplement',type:'addSupplement',entryId:'old',beforeEntrySha256:hash(countedBase[0]),html:'<p>Added detail.</p>',sourceRecordIds:['source-one'],rationale:'Reviewed detail'};
 const r=shapedRegistry([supplement]),out=merge(futureInput(),r);
 assert.equal(out[0].supplementHtml,supplement.html);assert.deepEqual(merge(out,r,{reverse:true}),futureInput());
 assert.throws(()=>merge(futureInput(),shapedRegistry([{...supplement,beforeEntrySha256:'0'.repeat(64)}])),/stale supplement/);
});
test('future-tail reversal rejects changed current content, invented counts and identity collisions',()=>{
 const r=shapedRegistry([countedAppend,add]),out=merge(futureInput(),r);
 for(const change of [e=>{e.items[0].a='Changed';},e=>{e.items[1].a='Changed';},e=>{e.title='Changed';},e=>{e.number=' 2 问 ';},e=>{e.number=' 4 问 ';}]){
  const changed=structuredClone(out);change(changed[0]);
  assert.throws(()=>merge(changed,r,{reverse:true}),/original items changed|appended questions changed|reversed baseline|derived question count/);
 }
 const duplicateQuestion=futureInput();duplicateQuestion[0].items[1]={...independentQuestion,id:question.id};
 assert.throws(()=>merge(duplicateQuestion,r),/duplicate question/);
 const duplicateEntry=futureInput();duplicateEntry[1]={...independentEntry,id:entry.id};
 assert.throws(()=>merge(duplicateEntry,r),/duplicate entry/);
 const missingId=futureInput();missingId[0].items[1]={...independentQuestion,id:undefined};
 assert.throws(()=>merge(missingId,r),/stable q-/);
 const active=futureInput();active[0].items[1]={...independentQuestion,a:'<script>bad()</script>'};
 assert.throws(()=>merge(active,r),/unsafe/);
});
test('pre-voice isolation preserves exact identity validation and validates all old fields at final merge',()=>{
 const r=shapedRegistry([countedAppend,add]),input=futureInput();
 const prepared=prepareQuestionBankAuthoring(input,r);
 assert.deepEqual(prepared.entries,countedBase);
 assert.deepEqual(prepared.restore(merge(prepared.entries,r)),merge(input,r));
 const changed=structuredClone(input);changed[0].title='Changed';
 const stale=prepareQuestionBankAuthoring(changed,r);
 assert.throws(()=>merge(stale.entries,r),/baseline hash/);
 changed[0].number=' 999 问 ';
 assert.throws(()=>prepareQuestionBankAuthoring(changed,r),/derived question count/);
 assert.equal(prepareQuestionBankAuthoring(input,null,{baselineTest:true}).entries,input);
});
test('reverse cannot silently discard future questions attached to an entry absent upstream',()=>{
 const newQA={...add,entry:{...entry,kind:'qa',number:'1 问',items:[question]}};delete newQA.entry.html;
 const r=shapedRegistry([newQA]),current=merge(countedBase,r);
 assert.deepEqual(merge(current,r,{reverse:true}),countedBase);
 const changed=structuredClone(current);changed[1].items.push(independentQuestion);changed[1].number='2 问';
 assert.throws(()=>merge(changed,r,{reverse:true}),/future questions target a merge-created entry/);
});
test('empty, edited or reordered shape metadata cannot turn a changed original into independent content',()=>{
 const r=shapedRegistry([countedAppend,add]);
 for(const shape of [[],[{id:'old',questionCount:0,countLabel:' 0 问 '}],[{id:'missing',questionCount:1,countLabel:' 1 问 '}]]){
  assert.throws(()=>merge(futureInput(),{...r,baselineShape:shape}),/baseline shape|baseline hash|stable q-|entries missing|invalid new entry/);
 }
 const bad=structuredClone(r);bad.baselineShape[0].unexpected=true;
 assert.throws(()=>merge(futureInput(),bad),/unknown field/);
 assert.throws(()=>merge(futureInput(),{...shapedRegistry([]),baseEntriesSha256:null}),/baseline SHA required/);
});

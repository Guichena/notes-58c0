import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {compileAuthoring,prepareMergedQuestionAuthoring} from '../scripts/authoring.mjs';
import {projectNoteDisplay} from '../scripts/note-display-cleanup.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>JSON.parse(readFileSync(path.join(root,p),'utf8'));
assert.equal(createHash('sha256').update(readFileSync(path.join(root,'tests/fixtures/merged-question-authoring/expected.json'))).digest('hex'),'45fab257e45b2d3cfd3d3ce08e24364e2236e279755ea0575aba51d432597f01');
const proof=read('tests/fixtures/merged-question-authoring/expected.json');
const clone=x=>structuredClone(x),sha=x=>createHash('sha256').update(x).digest('hex');
const doc=()=>({type:'questions',file:proof.sourcePath,data:clone(proof.sourceDocument)});
const registry=()=>({records:[{type:'appendEntry',entry:clone(proof.beforeEntry)}]});
const base=()=>[clone(proof.beforeEntry)];
const run=(docs=[doc()],entries=base(),r=registry())=>prepareMergedQuestionAuthoring(docs,r).compile(entries);

test('merged authoring source file remains exactly the approved document',()=>{
 assert.equal(sha(readFileSync(path.join(root,proof.sourcePath))),proof.sourceSha256);
 assert.deepEqual(read(proof.sourcePath),proof.sourceDocument);
});
test('late compile preserves all eight complete objects, metadata, input and exact approved ninth question',()=>{
 const input=base(),before=clone(input),prepared=prepareMergedQuestionAuthoring([doc()],registry());
 assert.deepEqual(prepared.documents,[]);const out=prepared.compile(input);
 assert.deepEqual(input,before);assert.equal(out.length,1);assert.equal(out[0].items.length,9);
 assert.deepEqual(out[0].items.slice(0,8),before[0].items);
 assert.deepEqual({...out[0],items:before[0].items},before[0]);
 assert.deepEqual(out[0].items[8],proof.expectedItem);
 assert.deepEqual(prepared.compile(input),out);
});
test('early compile still rejects unknown merged targets and legacy insertion',()=>{
 const original={id:'original-entry',kind:'qa',items:[{q:'old',a:'old'}]};
 const identity={entries:[{id:original.id,kind:original.kind,progressKey:original.id,questions:[sha('old')]}]};
 assert.throws(()=>compileAuthoring([original],[doc()],identity),/unknown or draft target/);
 const bad=clone(original);bad.items.push({q:'inserted',a:'x'});
 assert.throws(()=>compileAuthoring([bad],[],identity),/original questions cannot/);
});
test('unknown targets are never silently deferred and non-QA targets fail',()=>{
 const unknown=doc();unknown.data.entryId='unknown-target';
 const prepared=prepareMergedQuestionAuthoring([unknown],registry());assert.deepEqual(prepared.documents,[unknown]);
 assert.throws(()=>compileAuthoring([],prepared.documents,{entries:[]}),/unknown or draft target/);
 const r=registry();r.records[0].entry.kind='doc';assert.throws(()=>prepareMergedQuestionAuthoring([doc()],r),/registered QA target/);
});
for(const [name,change,pattern]of [
 ['draft',d=>d.data.draft=true,/must not be draft/],
 ['numeric ID',d=>d.data.id='8',/stable lowercase ID|new question IDs/],
 ['unknown field',d=>d.data.unapproved='x',/unknown field/],
 ['missing short answer',d=>d.data.shortAnswer='',/non-empty/],
 ['active rich markup',d=>d.data.explanation.value='<script>alert(1)</script>',/unsafe rich HTML/],
 ['event handler',d=>d.data.explanation.value='<img src=x onerror="x()">',/unsafe rich HTML/],
 ['active URL',d=>d.data.explanation.value='<a href="javascript:alert(1)">x</a>',/unsafe rich HTML/],
 ['unknown related entry',d=>d.data.related=[{entryId:'unknown-entry'}],/unknown related entry/],
 ['unknown related question',d=>d.data.related=[{entryId:proof.beforeEntry.id,questionId:'q-missing'}],/unknown related question/]
])test('late compiler rejects '+name,()=>{const d=doc();change(d);assert.throws(()=>run([d]),pattern);});
test('duplicate new IDs, existing stable IDs and duplicate entry IDs fail',()=>{
 assert.throws(()=>run([doc(),doc()]),/duplicate question ID/);
 const existing=doc();existing.data.id=proof.beforeEntry.items[0].id;assert.throws(()=>run([existing]),/duplicate question ID/);
 assert.throws(()=>run([doc()],[...base(),...base()]),/duplicate entry ID/);
 const r=registry();r.records.push(clone(r.records[0]));assert.throws(()=>prepareMergedQuestionAuthoring([doc()],r),/duplicate registered target/);
});
for(const [name,change]of [
 ['missing target',e=>e.pop()],['old question removed',e=>e[0].items.pop()],
 ['old answer changed',e=>e[0].items[0].a+='drift'],['old stable ID changed',e=>e[0].items[0].id='q-drift'],
 ['old metadata changed',e=>e[0].title+='drift'],['old ordering changed',e=>e[0].items.reverse()]
])test('registered target guard rejects '+name,()=>{const e=base();change(e);assert.throws(()=>run([doc()],e),/changed or missing/);});
test('forward stable references compile and order deterministically without changing old prefixes',()=>{
 const a=doc(),b=doc();a.data.id='q-forward-a';a.data.order=2;a.data.related=[{entryId:a.data.entryId,questionId:'q-forward-b'}];
 b.data.id='q-forward-b';b.data.order=1;
 const input=base(),before=clone(input),out=run([a,b],input);assert.deepEqual(input,before);assert.deepEqual(out[0].items.slice(0,8),proof.beforeEntry.items);
 assert.deepEqual(out[0].items.slice(8).map(x=>x.id),['q-forward-b','q-forward-a']);
 assert.ok(out[0].items[9].a.includes('#/e/qb-testing-engineering/q-forward-b'));assert.deepEqual(run([b,a]),out);
});
test('only the existing count-label projection derives a numeric label; absent metadata stays absent',()=>{
 assert.equal(Object.hasOwn(run()[0],'number'),false);
 const e=base(),r=registry();e[0].number=r.records[0].entry.number='8 问';
 const out=run([doc()],e,r);assert.equal(out[0].number,'8 问');assert.equal(projectNoteDisplay(out)[0].number,'9 问');
});
test('baseline and empty late stages preserve identity and do not evaluate late documents',()=>{
 const entries=base(),docs=[doc()];const baseline=prepareMergedQuestionAuthoring(docs,null,{baselineTest:true});
 assert.equal(baseline.documents,docs);assert.equal(baseline.compile(entries),entries);
 assert.equal(prepareMergedQuestionAuthoring([],registry()).compile(entries),entries);
});
test('real built corpus contains the exact approved ninth question and all other eleven appends',()=>{
 const entries=readdirSync(path.join(root,'dist/data/chapters')).filter(f=>f.endsWith('.json')).flatMap(f=>read('dist/data/chapters/'+f).entries);
 const byId=new Map(entries.map(e=>[e.id,e]));assert.equal(entries.length,803);
 assert.equal(entries.reduce((n,e)=>n+(e.kind==='qa'?e.items.length:1),0),1814);
 assert.equal(entries.filter(e=>e.kind==='qa').reduce((n,e)=>n+e.items.length,0),1335);
 assert.deepEqual(byId.get(proof.beforeEntry.id),proof.approvedFinalEntry);
 assert.equal(proof.allApprovedAppends.length,12);
 for(const a of proof.allApprovedAppends)assert.deepEqual(byId.get(a.entryId).items[a.expectedIndex],a.expectedItem,a.entryId+'#'+a.expectedIndex);
});

test('cross-target late references preserve both callers and all complete old prefixes',()=>{
 const input=base(),other=clone(input[0]);other.id='other-merged-qa';input.push(other);
 const before=clone(input),r=registry();r.records.push({type:'appendEntry',entry:clone(other)});
 const a=doc(),b=doc();a.data.id='q-cross-a';b.data.id='q-cross-b';b.data.entryId=other.id;
 a.data.related=[{entryId:other.id,questionId:b.data.id}];b.data.related=[{entryId:a.data.entryId,questionId:a.data.id}];
 const out=run([a,b],input,r);assert.deepEqual(input,before);
 for(let i=0;i<2;i++){assert.deepEqual(out[i].items.slice(0,8),before[i].items);assert.deepEqual({...out[i],items:before[i].items},before[i]);}
 assert.ok(out[0].items[8].a.includes('#/e/other-merged-qa/q-cross-b'));
 assert.ok(out[1].items[8].a.includes('#/e/qb-testing-engineering/q-cross-a'));
});

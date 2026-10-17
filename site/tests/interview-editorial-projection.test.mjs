import {restoreExpectedNoteDisplay} from './helpers/note-display-oracle.mjs';
import {projectAlgorithmCorrections} from '../scripts/algorithm-corrections.mjs';
import {projectReviewedContent} from '../scripts/reviewed-content-projection.mjs';
import {upstream} from './helpers/editorial-upstream.mjs';
import {buildSearchRecords} from '../scripts/build-search.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {projectInterviewEditorial,EDITORIAL_REGISTRY_SHA256} from '../scripts/interview-editorial-projection.mjs';
import {projectSource} from '../scripts/display-projection.mjs';
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root),'utf8'),json=async p=>JSON.parse(await read(p));
const raw=v=>createHash('sha256').update(v).digest('hex'),sha=v=>raw(JSON.stringify(v));
const registry=await json('content/interview-editorial-projection.json'),catalog=await json('dist/data/catalog.json'),search=await json('dist/data/search.json');
const chunks=await Promise.all([...new Set(catalog.entries.map(e=>e._chunk))].map(p=>json('dist/'+p)));
const byId=new Map(chunks.flatMap(c=>c.entries).map(e=>[e.id,e]));
const finalPublished=catalog.entries.map(e=>byId.get(e.id));
const published=projectReviewedContent(projectAlgorithmCorrections(restoreExpectedNoteDisplay(finalPublished,upstream.claimEntries),await json('content/algorithm-corrections.json'),{reverse:true}),await json('content/reviewed-content-projection.json'),{reverse:true});
const question=(entries,r)=>entries.find(e=>e.id===r.entryId).items.find(q=>r.questionId===null?q.q===r.questionText:q.id===r.questionId);
function reverse(entries){for(const r of registry.records)for(const [f,v]of Object.entries(r.fields))question(entries,r)[f]=v.before;return entries;}
const editorialTargets=new Set(registry.records.map(r=>r.entryId));
const cloneTargets=entries=>entries.map(e=>editorialTargets.has(e.id)?structuredClone(e):e);
const input=reverse(cloneTargets(published));
test('editorial registry pins exactly six reviewed questions and twelve text fields',()=>{
 assert.equal(sha(registry),EDITORIAL_REGISTRY_SHA256);
 assert.equal(EDITORIAL_REGISTRY_SHA256,'f5f661ac515217247b8c361cf1e95a0b873e3b001a68397cb5fceef4d1362f82');
 assert.deepEqual(registry.records.map(r=>[r.entryId,r.questionId]),[['own-mq-reliability','q-own-mq-relay-ownership'],['own-spring-async','q-own-spring-webflux-model'],['bg-redis-4',null],['ai-agent-1',null],['bg-mysql-1',null],['bg-mysql-1',null]]);
 for(const r of registry.records){assert.deepEqual(Object.keys(r.fields).sort(),['a','lead']);for(const v of Object.values(r.fields)){assert.equal(sha(v.before),v.beforeSha256);assert.equal(sha(v.after),v.afterSha256);}assert.equal(raw(r.fields.a.before),r.provenance.originalAnswerRawSha256);assert.equal(raw(r.fields.lead.before),r.provenance.originalLeadRawSha256);}
});
test('editorial exact output is reversible and preserves all other fields, identities, order and provenance',()=>{
 const snapshot=structuredClone(input),out=projectInterviewEditorial(input,registry);
 assert.deepEqual(input,snapshot);assert.deepEqual(out,published);assert.deepEqual(reverse(out),input);
 assert.deepEqual(input,upstream.claimEntries);assert.deepEqual(search,buildSearchRecords(finalPublished,upstream.metadata.TOPICS));
});
test('editorial baseline bypasses without a registry; undocumented bypass flags do not',()=>{
 assert.equal(projectInterviewEditorial(input,null,{baselineTest:true}),input);
 assert.throws(()=>projectInterviewEditorial(input,null,{skip:true}),/registry integrity/);
});
test('editorial rejects stale answer or lead, missing and duplicate targets, identity drift and double application',()=>{
 for(const r of registry.records){
  for(const field of ['a','lead']){const a=cloneTargets(input);question(a,r)[field]+='!';assert.throws(()=>projectInterviewEditorial(a,registry),/stale input/);}
  for(const key of Object.keys(r.questionIdentity)){const a=cloneTargets(input);question(a,r)[key]='changed';assert.throws(()=>projectInterviewEditorial(a,registry),/identity|missing/);}
  for(const key of Object.keys(r.entryIdentity)){const a=cloneTargets(input);a.find(e=>e.id===r.entryId)[key]='changed';assert.throws(()=>projectInterviewEditorial(a,registry),/identity|missing/);}
  const a=cloneTargets(input),e=a.find(e=>e.id===r.entryId);e.items.push(structuredClone(question(a,r)));assert.throws(()=>projectInterviewEditorial(a,registry),/duplicate target/);
  assert.throws(()=>projectInterviewEditorial(input.filter(e=>e.id!==r.entryId),registry),/missing target/);
 }
 assert.throws(()=>projectInterviewEditorial([...input,input[0]],registry),/duplicate entry/);
 assert.throws(()=>projectInterviewEditorial(published,registry),/already applied/);
});
test('editorial rejects forged scope, identities, text and provenance even with recomputed field hashes',()=>{
 for(const mutate of [r=>r.records.pop(),r=>r.records.push(r.records[0]),r=>r.records[0].entryId='doc-19',r=>r.records[0].questionIdentity.q='changed',r=>r.records[0].provenance.originalAnswerRawSha256='forged',r=>{r.records[0].fields.a.after+='!';r.records[0].fields.a.afterSha256=sha(r.records[0].fields.a.after);},r=>r.records[0].fields.html=r.records[0].fields.a]){
  const r=structuredClone(registry);mutate(r);assert.throws(()=>projectInterviewEditorial(input,r),/registry integrity/);
 }
});
test('editorial permits future unrelated authoring, questions, supplementary fields and target reordering',()=>{
 const a=cloneTargets(input);a.push({id:'future-editorial-entry',items:[{id:'new-q',a:'new answer'}]});
 for(const r of registry.records){const e=a.find(e=>e.id===r.entryId);e.items[r.questionId===null?'push':'unshift']({id:'new-'+r.entryId,q:'New independently authored question',a:'New answer'});e.supplementHtml='future supplement';question(a,r).futureField={source:'future provenance'};}
 a.reverse();const out=projectInterviewEditorial(a,registry);assert.deepEqual(reverse(out),a);
});
test('editorial retains sourceArchive bytes and applies after all prior corrections',async()=>{
 assert.equal(await read('dist/data/archives/source-entries.json'),JSON.stringify(upstream.reading.sourceArchive)+'\n');
 const build=await read('scripts/build.mjs');assert.ok(build.indexOf('const editorialEntries=projectInterviewEditorial(claimEntries')>build.indexOf('const claimEntries=projectClaimExamples(cleanedEntries'));
 assert.ok(build.includes("json(reading.sourceArchive)"));
});
test('editorial renders the oral lead exactly once and the full body unchanged in every QA mode',async()=>{
 const renderer=projectSource('src/app/renderers.js',await read('src/app/renderers.js'),await json('content/display-projection.json'));
 const ctx=vm.createContext({DATA:{},h:x=>String(x??''),cmpCard:()=>'',statusOf:()=>0,HLC:{},state:{qaMode:'lead'}});vm.runInContext(renderer,ctx);
 for(const r of registry.records)for(const mode of ['q','lead','full']){
  ctx.it={...question(published,r),key:r.entryId+'#'+r.questionId,no:1};ctx.mode=mode;
  const html=vm.runInContext('qaListHtml([it],{mode})',ctx);
  assert.equal(html.split(ctx.it.lead).length-1,1);assert.ok(html.includes('<div class="qa-rest">'+ctx.it.a+'</div>'));assert.ok(!ctx.it.a.includes(ctx.it.lead));
  assert.ok(!/<pre\b/i.test(ctx.it.a));
 }
});
test('editorial preserves unique related metadata and restored technical conditions',()=>{
 for(const r of registry.records.slice(0,2)){const after=r.fields.a.after,before=r.fields.a.before;
  const tail=before.slice(before.indexOf('<h3 class="md-h md-h3">常见问法</h3>'));
  for(const block of new Set(tail.match(/<h3[\s\S]*?(?=<h3|$)/g))){assert.ok(after.includes(block));assert.equal(after.split(block).length-1,1);}
 }
 assert.match(registry.records[0].fields.a.after,/去重记录与业务变更.*本地事务边界内原子提交/);
 assert.match(registry.records[1].fields.a.after,/上游按协议发送数据、完成或错误信号/);
});

test("earlier two records retain every field except two separately reviewed wording improvements",async()=>{
 const expected=await json("tests/fixtures/priority-prose/prior-editorial-records.json");
 const edits=[["Outbox 表的领取身份与资源端的 fencing 合同应分别说明。", "Outbox 表里谁有权领取任务，和下游资源怎样拒绝旧持有者的请求，是两套规则，要分别说明。"], ["具体错误取决于各自库的合同", "具体会出什么错，要看各自库对线程、事件循环和资源使用的约束"]];
 for(let i=0;i<2;i++){const v=expected[i].fields.a;assert.equal(v.after.split(edits[i][0]).length-1,1);v.after=v.after.replace(edits[i][0],edits[i][1]);v.afterSha256=sha(v.after);}
 assert.deepEqual(registry.records.slice(0,2),expected);
});

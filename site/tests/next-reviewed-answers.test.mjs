import {projectPriorityViewRuntime} from '../scripts/interview-priority-view.mjs';
import {prior248Registry,restorePrior248} from './helpers/backend-scenario-oracle.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {projectReviewedContent} from '../scripts/reviewed-content-projection.mjs';
import {projectInterviewEditorial} from '../scripts/interview-editorial-projection.mjs';
import {upstream} from './helpers/editorial-upstream.mjs';
import {priorReviewedRegistry,restorePriorReviewed} from './helpers/next-reviewed-oracle.mjs';
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root),'utf8'),json=async p=>JSON.parse(await read(p)),hash=s=>createHash('sha256').update(s).digest('hex'),get=(v,p)=>p.reduce((a,k)=>a[k],v),set=(v,p,x)=>get(v,p.slice(0,-1))[p.at(-1)]=x;
const currentRegistry=await json('content/reviewed-content-projection.json'),registry=prior248Registry(currentRegistry),evidence=registry.nextReviewedEvidence,input=projectInterviewEditorial(upstream.claimEntries,await json('content/interview-editorial-projection.json')),output=restorePrior248(projectReviewedContent(input,currentRegistry),currentRegistry),prior=priorReviewedRegistry(registry),frozenPrior=await json('tests/fixtures/next-reviewed/prior107.json');
const selected=Object.keys(evidence.inputFileHashes).filter(x=>x!=='root-scenario01-read-boundary.json'),frozen=new Map(await Promise.all(selected.map(async name=>[name,await json('tests/fixtures/next-reviewed/'+name)])));
// Isolated renderer tests include the real additive priority helper, as the complete bundle does.
const priorityRuntime = projectPriorityViewRuntime('src/app/structure.js','',await json('content/interview-priority-view.json'));
test('next reviewed strict composition reconstructs all107 records and37 sources byte exactly',()=>{
 assert.deepEqual(prior,frozenPrior);assert.equal(hash(JSON.stringify(prior)),evidence.priorRegistrySha256);assert.equal(hash(JSON.stringify(prior.records)),evidence.priorRecordsSha256);assert.equal(prior.records.length,107);assert.equal(registry.sources.length,37);assert.deepEqual(registry.sources,prior.sources);assert.equal(registry.records.length,248);assert.equal(registry.records.filter(r=>r.nextReviewedComposition).length,20);
 for(const r of registry.records.filter(r=>r.nextReviewedComposition)){const {priorRecord,approvedDelta}=r.nextReviewedComposition;assert.deepEqual(priorRecord.after,approvedDelta.before);assert.deepEqual(r.before,priorRecord.before);assert.equal(r.beforeSha256,priorRecord.beforeSha256);assert.deepEqual(prior.records.find(p=>p.entryId===r.entryId&&JSON.stringify(p.path)===JSON.stringify(r.path)),priorRecord);}
 const restored=restorePriorReviewed(output,registry);for(const r of prior.records)assert.deepEqual(get(restored.find(e=>e.id===r.entryId),r.path),r.after);
});
test('all161 deltas retain exact raw or typed guard evidence; only3 explicit noops omitted',()=>{
 assert.equal(evidence.approvedDeltas.length,161);assert.equal(evidence.droppedNoops.length,3);let total=0;
 for(const [name,rows]of frozen){for(const row of rows){total++;const typed=name.startsWith('scenario'),sha=v=>hash(typed?JSON.stringify(v):v);assert.equal(sha(row.before),row[typed?'beforeSha256':'beforeSHA256']);assert.equal(sha(row.after),row[typed?'afterSha256':'afterSHA256']);const matches=evidence.approvedDeltas.filter(d=>d.evidence.input===name&&d.evidence.rowIndex===rows.indexOf(row));if(JSON.stringify(row.before)===JSON.stringify(row.after)){assert.equal(matches.length,0);continue;}assert.equal(matches.length,1);const d=matches[0];assert.deepEqual(d.evidence.originalRecord,row);assert.deepEqual(d.before,row.before);assert.deepEqual(d.after,row.after);const r=registry.records.find(r=>r.entryId===row.entryId&&JSON.stringify(r.path)===JSON.stringify(row.field));assert.deepEqual(r.rootQualification?.before??r.after,row.after);}}
 assert.equal(total,164);
});
test('root strict-read qualification changes precisely the independently approved fragment',()=>{const q=evidence.rootQualification,r=registry.records.find(r=>r.entryId===q.entryId&&JSON.stringify(r.path)===JSON.stringify(q.path));assert.equal(r.rootQualification.before.split(q.oldFragment).length-1,1);assert.equal(r.after,r.rootQualification.before.replace(q.oldFragment,q.newFragment));assert.equal(r.rootQualification.after,r.after);assert.match(r.after,/事务语义/);});
test('finite typed paths exclude identity questions and metadata and enforce exact array shape',()=>{
 const arrays=registry.records.filter(r=>r.valueType==='string-array');assert.equal(arrays.length,41);assert.equal(arrays.filter(r=>r.before.length!==r.after.length).length,6);
 const allowed=['requirements','capacityPlan','architecture','dataFlow','consistency','failureModes','keyPoints','observability','tradeoffs','security'];
 for(const r of registry.records){if(!prior.records.some(p=>p.entryId===r.entryId&&JSON.stringify(p.path)===JSON.stringify(r.path)))assert.ok(!Object.hasOwn(r.entryIdentity,'number'));assert.ok(!r.path.some(k=>['q','id','mk','number','questions','followups','progressKey'].includes(k)));}
 for(const r of arrays){assert.equal(r.path.length,1);assert.ok(allowed.includes(r.path[0]));assert.ok(r.before.every(v=>typeof v==='string'));assert.ok(r.after.every(v=>typeof v==='string'));assert.equal(hash(JSON.stringify(r.before)),r.beforeSha256);assert.equal(hash(JSON.stringify(r.after)),r.afterSha256);
  for(const change of [v=>v.concat('forged'),v=>v.slice(1),v=>Object.assign({},v),v=>v.map((x,i)=>i===0?42:x)]){const a=input.map(e=>e.id===r.entryId?structuredClone(e):e);set(a.find(e=>e.id===r.entryId),r.path,change(r.before));assert.throws(()=>projectReviewedContent(a,currentRegistry),/stale input/);}
 }
});
test('typed projection is reversible immutable and cannot alias source or registry arrays',()=>{
 const before=structuredClone(input),saved=structuredClone(registry);assert.deepEqual(projectReviewedContent(projectReviewedContent(input,currentRegistry),currentRegistry,{reverse:true}),input);assert.deepEqual(input,before);assert.deepEqual(registry,saved);
 const r=registry.records.find(r=>r.valueType==='string-array'),fresh=projectReviewedContent(input,currentRegistry);get(fresh.find(e=>e.id===r.entryId),r.path).push('mutate isolated result');assert.deepEqual(input,before);assert.deepEqual(registry,saved);
 assert.throws(()=>projectReviewedContent(projectReviewedContent(input,currentRegistry),currentRegistry),/stale input/);
});
test('all entry IDs question identities followups code and anchors survive approved prose projection',()=>{
 const attrs=(s,k)=>[...s.matchAll(new RegExp('\\b'+k+'="([^"]+)"','g'))].map(m=>m[1]);
 assert.deepEqual(output.map(e=>e.id),input.map(e=>e.id));
 for(let i=0;i<input.length;i++){const a=input[i],b=output[i];for(const key of ['id','kind','mod','part','cat','title','number','followups'])assert.deepEqual(b[key],a[key],a.id+' '+key);assert.deepEqual(b.items?.map(q=>[q.id,q.q,q.mk]),a.items?.map(q=>[q.id,q.q,q.mk]));}
 for(const d of evidence.approvedDeltas){if(typeof d.before!=='string')continue;const code=s=>[...s.matchAll(/<pre\b[\s\S]*?<\/pre>/g)].map(m=>m[0]);assert.deepEqual(code(d.after),code(d.before),d.entryId+' code');for(const anchor of attrs(d.before,'id'))assert.ok(attrs(d.after,'id').includes(anchor),d.entryId+' '+anchor);for(const href of attrs(d.before,'href').filter(h=>h.startsWith('#/')))assert.ok(attrs(d.after,'href').includes(href),d.entryId+' '+href);}
});
test('new content scope admits unrelated future fields and questions without derived-number dependency',()=>{
 const a=structuredClone(input),r=registry.records.find(r=>r.valueType==='string-array'),e=a.find(e=>e.id===r.entryId);e.unrelatedFuture={text:'Future fact'};e.requirements.push(...[]);a.push({id:'future-next-review',kind:'doc',html:'New content'});const qa=a.find(e=>e.id==='ai-agent-1');qa.items.push({id:'future-next-review-question',q:'Future question?',mk:0,a:'New answer'});const out=projectReviewedContent(a,currentRegistry);assert.deepEqual(out.at(-1),a.at(-1));assert.deepEqual(out.find(x=>x.id===r.entryId).unrelatedFuture,{text:'Future fact'});assert.deepEqual(projectReviewedContent(out,currentRegistry,{reverse:true}),a);assert.equal(out.find(e=>e.id==='ai-agent-1').items.at(-1).id,'future-next-review-question');
});
test('actual compiled legacy renderer no longer repeats approved Agent leads in answer bodies',async()=>{
 const app=await read('dist/assets/app.js'),renderer=app.slice(app.indexOf('function qaCardHtml(it) {'),app.indexOf('function qaListHtml(',app.indexOf('function qaCardHtml(it) {'))),c=vm.createContext({DATA:{},h:x=>String(x??''),cmpCard:()=>'',statusOf:()=>0,HLC:{},state:{qaMode:'lead'}});vm.runInContext(priorityRuntime+renderer,c);
 const cases=[...(await json('tests/fixtures/next-reviewed/agent-lead-dedup-alternative.json')),...(await json('tests/fixtures/next-reviewed/agent-02-small-alternatives.json'))];assert.equal(cases.length,17);
 for(const p of cases){const e=output.find(e=>e.id===p.entryId),q=e.items[p.field[1]],text=p.removedExactPrefix.replace(/<[^>]+>/g,'');c.it={...q,key:e.id+'#'+p.field[1],no:1};const html=vm.runInContext('qaCardHtml(it)',c).replace(/<[^>]+>/g,'');assert.equal(html.split(text).length-1,p.entryId==='ai-agent-5'&&p.field[1]===12?0:1,e.id+' '+p.field[1]);assert.ok(q.lead);}
});

import {priorReviewedRegistry,restorePriorReviewed} from './helpers/next-reviewed-oracle.mjs';
import {restoreExpectedNoteDisplay} from './helpers/note-display-oracle.mjs';
import {upstream} from './helpers/editorial-upstream.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {projectReviewedContent} from '../scripts/reviewed-content-projection.mjs';
const root=new URL('../',import.meta.url),json=async p=>JSON.parse(await readFile(new URL(p,root),'utf8')),hash=s=>createHash('sha256').update(s).digest('hex'),get=(e,p)=>p.reduce((v,k)=>v[k],e);
const activeRegistry=await json('content/reviewed-content-projection.json'),registry=priorReviewedRegistry(activeRegistry),evidence=registry.backendCleanupEvidence,proof=evidence.records,retention=await json('tests/fixtures/backend-cleanup-retention.json');
const cat=await json('dist/data/catalog.json'),needed=new Set(activeRegistry.records.map(r=>r.entryId)),chunks=[...new Set(cat.entries.filter(e=>needed.has(e.id)).map(e=>e._chunk))];
const activePublished=restoreExpectedNoteDisplay((await Promise.all(chunks.map(p=>json('dist/'+p)))).flatMap(c=>c.entries).filter(e=>needed.has(e.id)),upstream.claimEntries);
const published=restorePriorReviewed(activePublished,activeRegistry);
const input=projectReviewedContent(activePublished,activeRegistry,{reverse:true});
const code=s=>[...s.matchAll(/<pre\b[\s\S]*?<\/pre>/g)].map(x=>x[0]);
const attrs=(s,key)=>[...s.matchAll(new RegExp('\\b'+key+'="([^"]+)"','g'))].map(x=>x[1]);
function retained(old,next){const a=[...next];for(const x of old){const i=a.indexOf(x);assert.notEqual(i,-1,'retained occurrence '+x);a.splice(i,1);}}
test('backend40 plus cleanup40 exactly match approved leaf bytes and unchanged37-source provenance',()=>{
 assert.equal(proof.filter(x=>x.group==='backend').length,40);assert.equal(proof.filter(x=>x.group==='cleanup').length,40);assert.equal(proof.filter(x=>x.priorRecord).length,6);
 assert.equal(registry.sources.length,37);assert.equal(hash(JSON.stringify(registry.sources)),evidence.priorSourcesSha256);
 const prior=registry.records.slice(0,33).map(r=>r.composition?.priorRecord??r);assert.equal(hash(JSON.stringify(prior)),evidence.priorRecordsSha256);
 for(const p of proof){assert.equal(get(published.find(e=>e.id===p.entryId),p.path),p.after);assert.equal(hash(p.before),p.beforeSha256);assert.equal(hash(p.after),p.afterSha256);if(p.priorRecord){assert.equal(p.priorRecord.after,p.before);const r=registry.records.find(r=>r.entryId===p.entryId&&JSON.stringify(r.path)===JSON.stringify(p.path));assert.equal(r.before,p.priorRecord.before);assert.deepEqual(r.composition.priorRecord,p.priorRecord);assert.equal(r.composition.approvedDelta.before,p.before);}}
});
test('cleanup applies only exact approved substitutions; code anchors links and all other prose retained',()=>{
 for(const p of proof){assert.deepEqual(code(p.after),code(p.before));retained(attrs(p.before,'id'),attrs(p.after,'id'));retained(attrs(p.before,'href'),attrs(p.after,'href'));if(p.group!=='cleanup')continue;let s=p.before;for(const edit of p.replacements){assert.equal(s.split(edit.before).length-1,edit.expectedCount);s=s.split(edit.before).join(edit.after);}assert.equal(s,p.after);retained(attrs(p.before,'href'),attrs(p.after,'href'));assert.deepEqual(attrs(p.before,'id'),attrs(p.after,'id'));}
 assert.equal(evidence.excludedGuide,'own-algo-manual-guide');assert.ok(!registry.records.some(r=>r.entryId===evidence.excludedGuide));assert.ok(!proof.some(r=>r.entryId===evidence.excludedGuide));
});
test('backend factual leads and bodies retain approved numeric examples and revised detailed guidance',()=>{
 const backend=proof.filter(x=>x.group==='backend'),lead=backend.filter(x=>x.path.at(-1)==='lead');assert.equal(lead.length,12);
 for(const p of lead){assert.ok(p.after.length>50);const body=backend.find(x=>x.entryId===p.entryId&&JSON.stringify(x.path)===JSON.stringify(p.path.length===1?['html']:p.path.slice(0,-1).concat('a')));assert.ok(body);assert.ok(body.after.length>p.after.length);assert.equal(get(published.find(e=>e.id===p.entryId),p.path),p.after);}
 for(const original of retention.preRevisionApprovedAfter){let expected=original.after;const details=retention.revisionDetails.filter(d=>d.entryId===original.entryId&&JSON.stringify(d.field)===JSON.stringify(original.field));for(const detail of details){assert.equal(expected.split(detail.before).length-1,1);expected=expected.replace(detail.before,detail.after);}const p=backend.find(x=>x.entryId===original.entryId&&JSON.stringify(x.path)===JSON.stringify(original.field));assert.equal(p.after,expected);for(const detail of details)assert.ok(p.after.includes(detail.after));}
 const body=id=>backend.filter(x=>x.entryId===id).map(x=>x.after).join('\n');
 for(const text of ['166667','833334','1389','MAX','maxKeys'])assert.ok(body('bg-mysql-3').includes(text),text);
 for(const text of ['1.8','180','80 万','2000','TCC','Saga','outbox','P95','P99'])assert.ok(body('doc-20').includes(text),text);
 const doc20=backend.find(x=>x.entryId==='doc-20'&&x.path[0]==='html');const headings=s=>[...s.matchAll(/<h[1-6]\b[\s\S]*?<\/h[1-6]>/g)].map(x=>x[0]);retained(headings(doc20.before),headings(doc20.after));
 assert.match(body('bg-mysql-6'),/8\.4\.0/);assert.match(body('bg-mysql-6'),/VECTOR/);
});
test('all28 technical cleanup false positives are unchanged by cleanup including touched answers',()=>{
 assert.equal(retention.falsePositives.length,28);
 for(const f of retention.falsePositives){const p=proof.find(x=>x.group==='cleanup'&&x.entryId===f.entryId&&JSON.stringify(x.path)===JSON.stringify(f.path));if(!p)continue;assert.equal(p.before,f.before);const plain=s=>s.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');assert.ok(plain(p.before).includes(f.context.replace(/\s+/g,' ')));assert.ok(plain(p.after).includes(f.context.replace(/\s+/g,' ')));}
});
test('new backend leaf scopes remain immutable-identity guarded and future additions survive without full graph cloning',()=>{
 const target='bg-mysql-1',clone=()=>input.map(e=>e.id===target?structuredClone(e):e);
 for(const key of ['id','title','kind']){const a=clone();a.find(e=>e.id===target)[key]+='changed';assert.throws(()=>projectReviewedContent(a,activeRegistry),/identity|missing target/);}
 for(const key of ['id','q','mk']){const a=clone();a.find(e=>e.id===target).items[0][key]='changed';assert.throws(()=>projectReviewedContent(a,activeRegistry),/question identity/);}
 const future=clone(),q={id:'q-future-backend-review',q:'Future backend question?',mk:false,lead:'Future lead',a:'Future body'};future.find(e=>e.id===target).items.push(q);future.push({id:'future-backend-entry',kind:'doc',html:'Unrelated future facts'});const out=projectReviewedContent(future,activeRegistry);assert.deepEqual(out.find(e=>e.id===target).items.at(-1),q);assert.equal(out.at(-1),future.at(-1));assert.deepEqual(projectReviewedContent(out,activeRegistry,{reverse:true}),future);
});

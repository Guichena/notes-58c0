import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readReviewedComparisonCorrections,projectReviewedComparisonMetadata as project,projectAuditMetadata} from '../scripts/audit-metadata-correction.mjs';
import {projectReferenceMetadata} from '../scripts/metadata-card-corrections.mjs';
import {projectLateWikiMetadata} from '../scripts/late-wiki-corrections.mjs';
import {projectVoiceMetadata} from '../scripts/voice-factual-correction.mjs';
import {readPracticeBoundaryCorrections,projectPracticeBoundaryCorrections} from '../scripts/practice-boundary-corrections.mjs';
import {readComparisonEquivalence,createComparisonVerifier} from '../scripts/comparison-visibility.mjs';
const json=async file=>JSON.parse(await readFile(new URL('../'+file,import.meta.url),'utf8'));
const sha=value=>createHash('sha256').update(value).digest('hex');
const registry=await readReviewedComparisonCorrections(),boundary=await readPracticeBoundaryCorrections(),catalog=await json('dist/data/catalog.json'),byId=new Map();
for(const file of new Set(catalog.entries.map(entry=>entry._chunk)))for(const entry of (await json('dist/'+file)).entries)byId.set(entry.id,entry);
const entries=catalog.entries.map(entry=>byId.get(entry.id));
const base=projectAuditMetadata(projectVoiceMetadata(projectLateWikiMetadata(projectReferenceMetadata(await json('content/metadata.json'),await json('content/metadata-card-corrections.json')),await json('content/late-wiki-metadata-corrections.json')),await json('content/voice-factual-correction.json')));
const paired=boundary.postReviewRecords.filter(record=>record.review.purpose==='paired-comparison-factual-cell');

test('52 exact card corrections change only the approved 97 text fields and two presentation flags',()=>{
 assert.equal(registry.records.length,52);assert.equal(new Set(registry.records.map(record=>record.key)).size,52);
 const changes=registry.records.flatMap(record=>record.exactFieldChanges);
 assert.equal(changes.length,99);assert.equal(changes.filter(change=>typeof change.oldValue==='string'&&typeof change.newValue==='string').length,97);
 const flags=changes.filter(change=>change.metadataPath.at(-1)==='dup');
 assert.deepEqual(flags.map(change=>[change.metadataPath[2],change.oldValue,change.newValue]).sort(),[['ai-agent-2#10',1,0],['ai-agent-2#6',1,0]]);
 const saved=JSON.stringify(base),out=project(base,entries,registry);
 assert.equal(JSON.stringify(base),saved);assert.deepEqual(out.HL,catalog.HL);
 const keys=new Set(registry.records.map(record=>record.key));
 for(const [key,card] of Object.entries(base.HL.cards))if(!keys.has(key))assert.strictEqual(out.HL.cards[key],card);
 assert.deepEqual({...out,HL:undefined},{...base,HL:undefined});assert.deepEqual({...out.HL,cards:undefined},{...base.HL,cards:undefined});
 for(const record of registry.records){assert.equal(sha(JSON.stringify(base.HL.cards[record.key])),record.expectedOriginalHash);assert.equal(sha(JSON.stringify(out.HL.cards[record.key])),record.newCardHash);}
 assert.deepEqual(project(out,entries,registry,{reverse:true}),base);
});

test('metadata guards reject double application, stale cards, tampered exact fields and question/answer/lead drift',()=>{
 assert.throws(()=>project(project(base,entries,registry),entries,registry),/card input changed/);
 const r=registry.records[0],[id,index]=r.key.split('#');
 const changed=structuredClone(base);changed.HL.cards[r.key].rows[0].cells[0]+='stale';assert.throws(()=>project(changed,entries,registry),/card input changed/);
 const modified=structuredClone(registry);modified.records[0].exactFieldChanges[0].newValue+='unreviewed';assert.throws(()=>project(base,entries,modified),/registry integrity/);
 for(const field of ['q','id','a','lead']){
  const drift=structuredClone(entries);const item=drift.find(entry=>entry.id===id).items[Number(index)];item[field]=(item[field]||'')+'changed';
  assert.throws(()=>project(base,drift,registry),/question identity drift|final answer\/lead changed/);
 }
});

test('metadata accepts only the final paired-body stage, while baseline mode excludes all new cards',()=>{
 assert.equal(paired.length,3);
 for(const record of paired){
  const drift=entries.map(entry=>entry.id===record.entryId?{...entry,items:entry.items.map((item,index)=>index===record.path[1]?{...item,a:record.before}:item)}:entry);
  assert.throws(()=>project(base,drift,registry),/final answer\/lead changed/);
  assert.equal(registry.records.find(r=>r.key===record.entryId+'#'+record.path[1]).expectedAnswerSha256,record.afterSha256);
 }
 assert.strictEqual(project(base,null,null,{baselineTest:true}),base);
 assert.strictEqual(project(base,entries,registry,{baselineTest:true,reverse:true}),base);
});

test('three paired body corrections replace one unique td each and preserve every other byte and identity',()=>{
 const before=projectPracticeBoundaryCorrections(entries,boundary,{reverse:true});
 assert.deepEqual(projectPracticeBoundaryCorrections(before,boundary),entries);
 for(const record of paired){
  assert.equal(record.edits.length,1);const edit=record.edits[0];
  assert.match(edit.beforeHtml,/^<td>[^<]*<\/td>$/);assert.match(edit.afterHtml,/^<td>[^<]*<\/td>$/);
  assert.equal(record.before.split(edit.beforeHtml).length,2);assert.equal(record.before.replace(edit.beforeHtml,edit.afterHtml),record.after);
  assert.equal(sha(record.before),record.beforeSha256);assert.equal(sha(record.after),record.afterSha256);
  const current=byId.get(record.entryId).items[record.path[1]],old=before.find(entry=>entry.id===record.entryId).items[record.path[1]];
  assert.equal(current.a,record.after);assert.equal(old.a,record.before);assert.deepEqual({...current,a:undefined},{...old,a:undefined});
  const preserved=html=>[...html.matchAll(/<details\b[^>]*>[\s\S]*?<\/details>|\b(?:id|href)="[^"]*"/g)].map(m=>m[0]);
  assert.deepEqual(preserved(record.after),preserved(record.before));
 }
 assert.equal(byId.get('bg-分布式-2').items[1].a.includes('<td>全局口径最稳；可用性和跨机房 RT 压力更高</td>'),false);
});

test('all corrected cards remain visible; no equivalence proof is silently rebased to a changed card',async()=>{
 const proofs=await readComparisonEquivalence(),keys=new Set(proofs.records.map(record=>record.key));assert.equal(proofs.records.length,21);
 const verifier=createComparisonVerifier({records:proofs.records,cards:catalog.HL.cards,digest:async value=>sha(value),entryForId:id=>byId.get(id)});
 await Promise.all(entries.filter(entry=>entry.items).map(entry=>verifier.verifyEntry(entry)));
 for(const record of registry.records){const [id,index]=record.key.split('#');assert.equal(keys.has(record.key),false);assert.equal(verifier.isDuplicate(record.key,byId.get(id).items[Number(index)]),false);}
});

test('catalog and runtime emit corrected cards without review registries or private evidence paths',async()=>{
 const delivered=JSON.stringify(catalog)+await readFile(new URL('../dist/assets/app.js',import.meta.url),'utf8');
 for(const value of [registry.review.sourceFile,registry.review.addendumFile,'expectedOriginalHash','exactFieldChanges','paired-comparison-factual-cell'])assert.ok(!delivered.includes(value));
 assert.equal(catalog.HL.cards['ai-agent-2#6'].dup,0);assert.equal(catalog.HL.cards['ai-agent-2#10'].dup,0);
});

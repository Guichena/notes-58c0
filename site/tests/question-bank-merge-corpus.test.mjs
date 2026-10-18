import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {projectQuestionBankMerge,readQuestionBankMerge} from '../scripts/question-bank-merge.mjs';
import {sha256} from '../scripts/interview-voice-review.mjs';
import {expectedNoteDisplay} from './helpers/note-display-oracle.mjs';
import {readPracticeBoundaryCorrections,projectPracticeBoundaryCorrections,restoreBeforePracticeBoundary} from '../scripts/practice-boundary-corrections.mjs';
import {restoreReviewedAuditQuestions} from './helpers/reviewed-audit-authoring.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const json=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
async function loadEntries(base){
 const load=async p=>JSON.parse(await readFile(path.join(base,p),'utf8'));
 const catalog=await load('dist/data/catalog.json'),byId=new Map();
 for(const file of new Set(catalog.entries.map(e=>e._chunk)))for(const e of (await load('dist/'+file)).entries)byId.set(e.id,e);
 return catalog.entries.map(e=>byId.get(e.id));
}
test('final merge reverses to the exact restored corpus and preserves existing identities and indexes',async()=>{
 const catalog=await json('dist/data/catalog.json'),chunks=new Map();
 for(const e of catalog.entries)if(!chunks.has(e._chunk))chunks.set(e._chunk,await json('dist/'+e._chunk));
 const byId=new Map([...chunks.values()].flatMap(c=>c.entries).map(e=>[e.id,e]));
 const entries=catalog.entries.map(e=>byId.get(e.id)),registry=await readQuestionBankMerge();
 const prePractice=restoreBeforePracticeBoundary(entries,await readPracticeBoundaryCorrections());
 const reviewedBase=await restoreReviewedAuditQuestions(prePractice);
 const baseline=projectQuestionBankMerge(reviewedBase,registry,{reverse:true});
 assert.equal(baseline.length,768);
 assert.equal(baseline.reduce((n,e)=>n+(e.kind==='qa'?e.items.length:1),0),1603);
 assert.equal(sha256(JSON.stringify(baseline)),'7505b58a04dafaa14dc956be38a45b03fb2ade1cab92ebc41cd9f9fa4d153877');
 assert.deepEqual(projectQuestionBankMerge(baseline,registry),reviewedBase);
 for(const [i,old]of baseline.entries()){
  const current=entries[i];
  for(const key of ['id','kind','mod','part','cat','title','progressKey'])assert.deepEqual(current[key],old[key]);
  // Only the existing display policy's derived whole QA-count token may change.
  assert.equal(current.number,expectedNoteDisplay([{...old,items:current.items}])[0].number);
  if(old.kind==='qa')for(const [q,question]of old.items.entries()){
   for(const key of ['id','q','mk','sub'])assert.deepEqual(current.items[q][key],question[key]);
  }
 }
 // Registry bookkeeping must never appear as data fields in shipped entries.
 const inspect=value=>{
  if(!value||typeof value!=='object')return;
  for(const [key,child]of Object.entries(value)){
   assert.ok(!['sourceRecordIds','sourceRecordId','baseEntriesSha256','baselineShape','beforeItemsSha256'].includes(key));inspect(child);
  }
 };
 entries.forEach(inspect);
 assert.deepEqual(entries,expectedNoteDisplay(entries));
});

test('actual current disposable build accepts independent authoring while preserving every delivered identity and field',async()=>{
 const temp=await mkdtemp(path.join(tmpdir(),'question-bank-future-'));
 try{
  execFileSync(process.execPath,[path.join(root,'tests/helpers/copy-authoring-tree.mjs'),root,temp],{stdio:'pipe',timeout:120000});
  const entry={schemaVersion:1,draft:false,id:'future-independent-entry',kind:'doc',module:'code',part:'Future authoring',category:'Independent',title:'Future entry',sections:[{id:'future-section',title:'Future section',body:'Independent future text.'}]};
  const questions=[
   {schemaVersion:1,draft:false,entryId:'bg-mysql-1',id:'q-future-independent',question:'Future independently authored question?',shortAnswer:'Future answer.',explanation:'Future independent explanation.'},
   {schemaVersion:1,draft:false,entryId:'own-spring-advice',id:'q-future-append-target',order:1000000,question:'Future question alongside merged additions?',shortAnswer:'Future answer.',explanation:'Future independent explanation.'}
  ];
  await writeFile(path.join(temp,'authoring/entries/future-independent-entry.json'),JSON.stringify(entry));
  for(const q of questions)await writeFile(path.join(temp,'authoring/questions',q.id+'.json'),JSON.stringify(q));
  // The unchanged historical test retains its 384 MiB cap. This current-corpus
  // acceptance case explicitly uses a separate, reasonable 1 GiB build heap.
  execFileSync(process.execPath,['scripts/build.mjs'],{cwd:temp,env:{...process.env,NODE_OPTIONS:'--max-old-space-size=1024'},stdio:'pipe',timeout:120000});
  const current=await loadEntries(root),future=await loadEntries(temp),futureIds=new Set(questions.map(q=>q.id));
  assert.equal(future.at(-1).id,entry.id);
  assert.deepEqual(future.slice(0,current.length).map(e=>e.id),current.map(e=>e.id));
  for(const q of questions){
   const old=current.find(e=>e.id===q.entryId),changed=future.find(e=>e.id===q.entryId);
   assert.equal(changed.items.at(-1).id,q.id);assert.equal(changed.items.length,old.items.length+1);
   assert.deepEqual(changed.items.slice(0,-1),old.items);
  }
  assert.deepEqual(future,expectedNoteDisplay(future));
  const restore=entries=>entries.filter(e=>e.id!==entry.id).map(e=>e.items?{...e,items:e.items.filter(q=>!futureIds.has(q.id))}:e);
  assert.deepEqual(expectedNoteDisplay(restore(future)),current);
  const load=async(base,p)=>JSON.parse(await readFile(path.join(base,p),'utf8'));
  const catalog=await load(temp,'dist/data/catalog.json');
  for(const q of questions)assert.equal(catalog.entries.find(e=>e.id===q.entryId).number,future.find(e=>e.id===q.entryId).number);
  assert.deepEqual(restore(await load(temp,'dist/data/archives/source-entries.json')),await load(root,'dist/data/archives/source-entries.json'));
  const registry=await readQuestionBankMerge(),practiceRegistry=await readPracticeBoundaryCorrections();
  const reverseCurrent=entries=>projectQuestionBankMerge(projectPracticeBoundaryCorrections(entries,practiceRegistry,{reverse:true}),registry,{reverse:true});
  const reversed=reverseCurrent(future);
  assert.deepEqual(expectedNoteDisplay(restore(reversed)),reverseCurrent(current));
  for(const q of questions)assert.equal(reversed.find(e=>e.id===q.entryId).items.at(-1).id,q.id);
 }finally{await rm(temp,{recursive:true,force:true});}
});

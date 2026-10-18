import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readPracticeBoundaryCorrections,projectPracticeBoundaryCorrections as project} from '../scripts/practice-boundary-corrections.mjs';
import {projectInterviewVoiceReview} from '../scripts/interview-voice-review.mjs';

const json=async file=>JSON.parse(await readFile(new URL('../'+file,import.meta.url),'utf8'));
const sha=value=>createHash('sha256').update(value).digest('hex');
const registry=await readPracticeBoundaryCorrections(),catalog=await json('dist/data/catalog.json');
const byId=new Map();
for(const file of new Set(catalog.entries.map(entry=>entry._chunk)))for(const entry of (await json('dist/'+file)).entries)byId.set(entry.id,entry);
const entries=catalog.entries.map(entry=>byId.get(entry.id));
const before=project(entries,registry,{reverse:true});
const intermediate=projectInterviewVoiceReview(entries,{schemaVersion:1,records:registry.postReviewRecords||[]},{reverse:true});
const increments=registry.records.filter(record=>record.insertion);
const expected=[
  ['fifth-skill-stage-observability','ai-agent-2',11,'d5ef07e8fc92e0621bc52773733a57da48ede4e3b570b0fa941f65d2a36ff6f0','687e06fc3d751bcda3282c9243469ef803622a9a6dad43a6f84f17e6b831f67b'],
  ['fifth-runtime-gateway-routing','ai-agent-7',3,'aa95baf567237eb4b7af1cbd3e192ca924808ac58284ad1fd0697debb781d392','ecc2cdf84516a4fcc5521d7f3ed0a553269093497b49ed74436100d2a3d3b053'],
  ['fifth-generated-harness-evaluation','ai-agent-9',6,'2359bcb6747ce66812e9e74019f3308be0dc5a2b6522222518051c07f7413320','299f354b3e3224f323bed4f440b6ec31f7ca77c5a8eeb5f423f0ad27015a675a'],
  ['huang-governance-dual-approval','own-tools-governance',1,'f9a193e26ac27f8c350cb510faa08a39fe04523ce5ea06e333d618ea44ea5a9a','24b25ed95ee71ecb18d5663ed9cd7d3bf4ed51bdddf522be926c59db13de5c86']
];

test('four reviewed increments insert exactly once and reverse to the independently pinned old answers',()=>{
  assert.deepEqual(increments.map(r=>[r.review.proposalId,r.entryId,r.path[1],sha(r.before),sha(r.after)]),expected);
  const applied=project(before,registry);
  for(const record of increments) {
    const {anchorHtml,insertHtml}=record.insertion;
    assert.equal(record.before.split(anchorHtml).length,2);
    assert.equal(record.before.includes(insertHtml),false);
    assert.equal(record.after.split(anchorHtml).length,2);
    assert.equal(record.after.split(insertHtml).length,2);
    assert.equal(record.before.replace(anchorHtml,insertHtml+anchorHtml),record.after);
    assert.equal(record.after.replace(insertHtml,''),record.before);
    assert.equal(record.review.sourceSha256,'fa7983064323e7786b05111597151a857e436694c80b8e95a4e5e0a5b1957fb6');
    const old=before.find(entry=>entry.id===record.entryId),current=applied.find(entry=>entry.id===record.entryId);
    assert.equal(intermediate.find(entry=>entry.id===record.entryId).items[record.path[1]].a,record.after,'exact intermediate insertion hash remains independently verifiable');
    const finalReview=registry.postReviewRecords?.find(r=>r.entryId===record.entryId&&r.path[1]===record.path[1]);
    assert.equal(current.items[record.path[1]].a,finalReview?.after||record.after);
    assert.equal(current.items[record.path[1]].a.split(insertHtml).length,2,'later review retains the full approved increment once');
    assert.deepEqual({...current.items[record.path[1]],a:undefined},{...old.items[record.path[1]],a:undefined});
    assert.deepEqual({...current,items:undefined},{...old,items:undefined});
  }
  assert.deepEqual(applied,entries);
  assert.deepEqual(project(applied,registry,{reverse:true}),before);
});

test('reviewed insertion links resolve to real stable question keys or original indexes',()=>{
  let links=0;
  for(const record of increments)for(const match of record.insertion.insertHtml.matchAll(/href="#\/e\/([^/\"]+)\/([^\"]+)"/g)) {
    const entry=byId.get(match[1]),key=match[2];
    assert.ok(entry,match[1]);
    const question=/^\d+$/.test(key)?entry.items[Number(key)]:entry.items.find(question=>question.id===key);
    assert.ok(question,match[0]);links++;
  }
  assert.equal(links,3);
});

test('repeat application, stale target hashes, duplicate anchors and wrong question identities fail closed',()=>{
  assert.throws(()=>project(entries,registry),/stale input/);
  for(const record of increments)for(const mutate of [
    question=>{question.a+='stale';},
    question=>{question.a+=record.insertion.anchorHtml;},
    question=>{question.a=question.a.replace(record.insertion.anchorHtml,record.insertion.insertHtml+record.insertion.anchorHtml);},
    question=>{question.q+='changed';},
    question=>{question.id='changed-question-id';}
  ]) {
    const input=structuredClone(before);
    mutate(input.find(entry=>entry.id===record.entryId).items[record.path[1]]);
    assert.throws(()=>project(input,registry),/stale input|question identity drift/);
  }
  const modified=structuredClone(registry);modified.records.find(record=>record.insertion).insertion.anchorHtml+='stale';
  assert.throws(()=>project(before,modified),/registry integrity/);
});

test('baseline mode excludes every increment without requiring or mutating its registry',()=>{
  const snapshot=JSON.stringify(before);
  assert.equal(project(before,null,{baselineTest:true}),before);
  assert.equal(project(before,registry,{baselineTest:true,reverse:true}),before);
  assert.equal(JSON.stringify(before),snapshot);
  for(const record of increments)assert.equal(before.find(entry=>entry.id===record.entryId).items[record.path[1]].a.includes(record.insertion.insertHtml),false);
});

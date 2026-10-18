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
const {postReviewRecords:allPostReviewRecords,...firstRegistry}=registry;
const records=allPostReviewRecords.filter(record=>!record.review.purpose);
const stage={schemaVersion:1,records:allPostReviewRecords};
const intermediate=projectInterviewVoiceReview(entries,stage,{reverse:true});
const attrs=(html,key)=>[...html.matchAll(new RegExp('\\b'+key+'="([^"]*)"','g'))].map(match=>match[1]).sort();
const details=html=>[...html.matchAll(/<details\b[^>]*>[\s\S]*?<\/details>/g)].map(match=>match[0]);

test('post-review batch is finite and leaves the previously approved registry and intermediate hashes intact',()=>{
  assert.equal(sha(JSON.stringify(firstRegistry)),'61ffd978ac0263db043ba9cf16e27933a1df5a002088ca0362c6835a2ad0ab1e');
  assert.equal(records.length,12);
  assert.equal(records.reduce((n,record)=>n+record.edits.length,0),20);
  assert.equal(new Set(records.flatMap(record=>record.review.candidateIds)).size,15);
  assert.equal(records.reduce((n,record)=>n+[...record.before].length-[...record.after].length,0),888);
  for(const record of records) {
    assert.equal(record.review.sourceSha256,'d6978220c28f87fc738906500f965ab0caa93e1081fb13aec8d3044375dc536e');
    assert.equal(sha(record.before),record.beforeSha256);assert.equal(sha(record.after),record.afterSha256);
    assert.equal(intermediate.find(entry=>entry.id===record.entryId).items[record.path[1]].a,record.before);
    assert.equal(byId.get(record.entryId).items[record.path[1]].a,record.after);
  }
  for(const record of registry.records)assert.equal(intermediate.find(entry=>entry.id===record.entryId).items[record.path[1]].a,record.after);
});

test('each semantic replacement has a unique exact fragment and preserves every variant, anchor and link occurrence',()=>{
  for(const record of records) {
    let actual=record.before;
    for(const edit of record.edits) {
      assert.equal(sha(actual),edit.beforeAnswerSha256);
      assert.equal(sha(edit.beforeHtml),edit.beforeSha256);assert.equal(sha(edit.afterHtml),edit.afterSha256);
      assert.equal(actual.split(edit.beforeHtml).length,2);
      actual=actual.replace(edit.beforeHtml,edit.afterHtml);
      assert.equal(sha(actual),edit.afterAnswerSha256);
    }
    assert.equal(actual,record.after);
    assert.deepEqual(details(actual),details(record.before));
    assert.deepEqual(attrs(actual,'id'),attrs(record.before,'id'));
    assert.deepEqual(attrs(actual,'href'),attrs(record.before,'href'));
    for(const increment of registry.records.filter(r=>r.insertion&&r.entryId===record.entryId&&r.path[1]===record.path[1]))assert.equal(actual.split(increment.insertion.insertHtml).length,2);
  }
  for(const record of records.filter(record=>record.entryId==='own-mq-operations')) {
    assert.equal(record.edits.length,1);
    assert.match(record.edits[0].beforeHtml,/^<h3(?: class="md-h md-h3")?>[^<]+<\/h3>$/);
    assert.doesNotMatch(record.edits[0].beforeHtml,/\bid=/);
    assert.equal(record.edits[0].afterHtml,'');
  }
});

test('forward projection and strict reverse phase order restore every field without rewriting old question identities',()=>{
  const snapshot=JSON.stringify(before);
  assert.deepEqual(project(before,registry),entries);
  assert.deepEqual(project(entries,registry,{reverse:true}),before);
  assert.deepEqual(projectInterviewVoiceReview(intermediate,stage),entries);
  assert.throws(()=>projectInterviewVoiceReview(entries,firstRegistry,{reverse:true}),/stale input/,'undoing the first phase before post-review must fail on the shared target');
  assert.equal(JSON.stringify(before),snapshot);
  for(const [index,old] of before.entries()) {
    const current=entries[index];
    assert.deepEqual({...current,items:undefined},{...old,items:undefined});
    if(old.items)assert.deepEqual(current.items.map(({a,...rest})=>rest),old.items.map(({a,...rest})=>rest));
  }
});

test('post-review rejects repeated application, stale answers, changed question identities and edit tampering',()=>{
  assert.throws(()=>project(entries,registry),/stale input/);
  assert.throws(()=>projectInterviewVoiceReview(entries,stage),/stale input/);
  for(const record of records)for(const mutate of [question=>{question.a+='stale';},question=>{question.q+='changed';}]) {
    const input=structuredClone(before);mutate(input.find(entry=>entry.id===record.entryId).items[record.path[1]]);
    assert.throws(()=>project(input,registry),/stale input|question identity drift/);
  }
  for(const key of ['beforeHtml','afterHtml','beforeAnswerSha256','afterAnswerSha256']) {
    const modified=structuredClone(registry);modified.postReviewRecords[0].edits[0][key]+='tampered';
    assert.throws(()=>project(before,modified),/registry integrity/);
  }
});

test('future independently authored questions survive both phases and baseline mode excludes the entire layer',()=>{
  const question={id:'q-future-post-review',q:'Independent question?',a:'Independent answer.',mk:0,sub:''};
  const input=before.map(entry=>entry.id==='ai-agent-7'?{...entry,number:entry.number.replace(/\d+/,String(entry.items.length+1)),items:[...entry.items,question]}:entry);
  const actual=project(input,registry);
  assert.equal(actual.find(entry=>entry.id==='ai-agent-7').items.at(-1),question);
  assert.deepEqual(project(actual,registry,{reverse:true}),input);
  assert.equal(project(input,null,{baselineTest:true}),input);
  assert.equal(project(input,registry,{baselineTest:true,reverse:true}),input);
});

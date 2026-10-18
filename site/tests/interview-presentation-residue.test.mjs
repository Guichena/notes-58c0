import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readPracticeBoundaryCorrections,projectPracticeBoundaryCorrections as project} from '../scripts/practice-boundary-corrections.mjs';
import {projectInterviewVoiceReview} from '../scripts/interview-voice-review.mjs';
import {readComparisonEquivalence} from '../scripts/comparison-visibility.mjs';
import {readReviewedComparisonCorrections} from '../scripts/audit-metadata-correction.mjs';
const json=async file=>JSON.parse(await readFile(new URL('../'+file,import.meta.url),'utf8'));
const sha=value=>createHash('sha256').update(value).digest('hex');
const registry=await readPracticeBoundaryCorrections(),records=registry.postReviewRecords.filter(record=>record.review.purpose==='interview-presentation-residue');
// Reconstruct the exact previously pinned registry, excluding only the separately
// tested later five-record Huang batch; its original hash assertion stays intact.
const historicalPostReviewRecords=registry.postReviewRecords.filter(record=>record.review.purpose!=='huang-reviewed-concept-batch');
const previous={...registry,postReviewRecords:historicalPostReviewRecords.filter(record=>record.review.purpose!=='interview-presentation-residue')};
const catalog=await json('dist/data/catalog.json'),byId=new Map();
for(const file of new Set(catalog.entries.map(entry=>entry._chunk)))for(const entry of (await json('dist/'+file)).entries)byId.set(entry.id,entry);
const entries=catalog.entries.map(entry=>byId.get(entry.id)),stage={schemaVersion:1,records},intermediate=projectInterviewVoiceReview(entries,stage,{reverse:true});
const attrs=(html,key)=>[...html.matchAll(new RegExp('\\b'+key+'="([^"]*)"','g'))].map(match=>match[1]).sort();
const matches=(html,re)=>[...html.matchAll(re)].map(match=>match[0]);
const stripHeadings=html=>html.replace(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/g,'');

test('43 exact answers and 55 fragments extend the frozen checkpoint without rewriting any prior record',()=>{
 assert.equal(sha(JSON.stringify(previous)),'93f4f4017c05f3ff832e2b9866c6227941c9e75969402d10b65d6414bc0a011e');
 assert.equal(records.length,43);assert.equal(records.reduce((n,record)=>n+record.edits.length,0),55);
 assert.equal(historicalPostReviewRecords.length,59);
 assert.equal(records.filter(record=>record.review.categories.includes('semantic-consolidation')).length,3);
 assert.equal(records.filter(record=>record.review.categories.includes('heading-wrapper-only')).length,31);
 assert.equal(records.filter(record=>record.review.categories.includes('spring-learner-wording')).length,9);
 for(const record of records){
  assert.equal(record.review.sourceSha256,'aa9071e4c556e0470cc11ed541b9d9cc52e6d3e2457c4a998345bae0a7800aa0');
  assert.equal(intermediate.find(entry=>entry.id===record.entryId).items[record.path[1]].a,record.before);
  assert.equal(byId.get(record.entryId).items[record.path[1]].a,record.after);
  let actual=record.before;for(const edit of record.edits){assert.equal(sha(actual),edit.beforeAnswerSha256);assert.equal(actual.split(edit.beforeHtml).length,2);assert.equal(sha(edit.beforeHtml),edit.beforeSha256);assert.equal(sha(edit.afterHtml),edit.afterSha256);actual=actual.replace(edit.beforeHtml,edit.afterHtml);assert.equal(sha(actual),edit.afterAnswerSha256);}
  assert.equal(actual,record.after);assert.equal(sha(record.after),record.afterSha256);
 }
});

test('every original anchor, link, question variant and list item is preserved with stable question identities',()=>{
 for(const record of records){
  assert.deepEqual(attrs(record.after,'id'),attrs(record.before,'id'));assert.deepEqual(attrs(record.after,'href'),attrs(record.before,'href'));
  assert.deepEqual(matches(record.after,/<details\b[^>]*>[\s\S]*?<\/details>/g),matches(record.before,/<details\b[^>]*>[\s\S]*?<\/details>/g));
  assert.deepEqual(matches(record.after,/<li\b[^>]*>[\s\S]*?<\/li>/g).sort(),matches(record.before,/<li\b[^>]*>[\s\S]*?<\/li>/g).sort());
  const current=byId.get(record.entryId).items[record.path[1]],old=intermediate.find(entry=>entry.id===record.entryId).items[record.path[1]];
  assert.deepEqual({...current,a:undefined},{...old,a:undefined});
 }
});

test('HNSW, enterprise RAG and line indexing keep their unique limits and exact moved payloads',()=>{
 const semantic=records.filter(record=>record.review.categories.includes('semantic-consolidation'));
 for(const record of semantic)for(const condition of record.review.preservedConditions.filter(condition=>condition.html)){
  assert.equal(sha(condition.html),condition.sha256);assert.ok(record.before.includes(condition.html));assert.equal(record.after.split(condition.html).length,2);
 }
 const hnsw=semantic.find(record=>record.entryId==='ai-rag-3').after;
 for(const text of ['MiniHnsw','1..1024','1e100','efConstruction≥M','efSearch≥max(1,K)','16层','输入向量复制','Hubness','query/doc','重建对应索引'])assert.ok(hnsw.includes(text),text);
 assert.ok(hnsw.includes('query=[0]，ID0=[2e-200]、ID1=[1e-200]'));assert.ok(hnsw.includes('visited/frontier最坏O(n)'));assert.ok(hnsw.includes('不能把“双向添加”误读成永久无向图不变量'));
 const rag=semantic.find(record=>record.entryId==='ai-rag-8').after;
 for(const text of ['不自动继承其他场景的10万DAU或两秒SLA','旧代在请求结束后再回收','生产相近负载下的SLO、故障恢复和安全审计证据','线上评测','评测泄漏','Mock','权限作用域及版本'])assert.ok(rag.includes(text),text);
 const lines=semantic.find(record=>record.entryId==='own-os-files').after;
 for(const text of ['Python 3.11','ExceptionGroup/BaseExceptionGroup','映射失效、短读和清理异常可见','多个资源的 close 抛同一个异常对象','主体错误与全部清理错误都得到保留','不代表数百 GB 吞吐基准','64KiB','TOCTOU'])assert.ok(lines.includes(text),text);
});

test('31 heading-only plans preserve all paragraph bytes and warnings; Spring keeps exact file and non-execution limits',()=>{
 let warnings=0;
 for(const record of records.filter(record=>record.review.categories.includes('heading-wrapper-only'))){
  assert.equal(stripHeadings(record.after),stripHeadings(record.before));
  const cautions=matches(record.before,/<p\b[^>]*>不能仅凭示例中的测试数量[\s\S]*?<\/p>/g);
  for(const caution of cautions){assert.equal(record.after.split(caution).length,record.before.split(caution).length);warnings++;}
 }
 assert.equal(warnings,23);
 for(const record of records.filter(record=>record.review.categories.includes('spring-learner-wording'))){
  assert.equal(record.edits.length,1);const edit=record.edits[0],path=/code\/[A-Za-z0-9_/.]+\.java/.exec(edit.beforeHtml)[0];
  assert.equal(edit.afterHtml,'<p class="md-p">若要复现实验，需准备完整源码与依赖，并按约定路径 '+path+' 组织文件。本页说明验证方案，未附完整可运行文件，也未执行该练习。</p>');
  assert.equal(record.before.replace(edit.beforeHtml,edit.afterHtml),record.after);
 }
});

test('forward and strict reverse restore the whole corpus; repeated and stale applications reject rather than silently skip',()=>{
 const before=project(entries,registry,{reverse:true}),snapshot=JSON.stringify(before);
 assert.deepEqual(project(before,registry),entries);assert.equal(JSON.stringify(before),snapshot);
 assert.deepEqual(projectInterviewVoiceReview(intermediate,stage),entries);
 assert.throws(()=>projectInterviewVoiceReview(entries,stage),/stale input/);
 for(const record of records)for(const field of ['a','q']){
  const drift=intermediate.map(entry=>entry.id===record.entryId?{...entry,items:entry.items.map((q,i)=>i===record.path[1]?{...q,[field]:q[field]+'changed'}:q)}:entry);
  assert.throws(()=>projectInterviewVoiceReview(drift,stage),/stale input|question identity drift/);
 }
 const tampered=structuredClone(registry);tampered.postReviewRecords.at(-1).edits[0].afterHtml+='unreviewed';assert.throws(()=>project(before,tampered),/registry integrity/);
});

test('new targets do not rebase comparison evidence or prior metadata guards, and baseline/future authoring remain supported',async()=>{
 const targets=new Set(records.map(record=>record.entryId+'#'+record.path[1]));
 for(const record of (await readComparisonEquivalence()).records)assert.equal(targets.has(record.key),false);
 for(const record of (await readReviewedComparisonCorrections()).records)assert.equal(targets.has(record.key),false);
 for(const record of previous.postReviewRecords)assert.equal(targets.has(record.entryId+'#'+record.path[1]),false);
 const before=project(entries,registry,{reverse:true});
 assert.strictEqual(project(before,null,{baselineTest:true}),before);
 const added={id:'q-future-presentation',q:'Independent future question?',a:'Independent answer.',mk:0,sub:''};
 const input=before.map(entry=>entry.id==='ai-rag-3'?{...entry,number:entry.number.replace(/\d+/,String(entry.items.length+1)),items:[...entry.items,added]}:entry);
 const output=project(input,registry);assert.strictEqual(output.find(entry=>entry.id==='ai-rag-3').items.at(-1),added);assert.deepEqual(project(output,registry,{reverse:true}),input);
});

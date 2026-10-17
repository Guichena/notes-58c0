import test from 'node:test';
import {existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {correctAIAnswers} from '../scripts/ai-answer-corrections.mjs';
const packageRoot=fileURLToPath(new URL('../',import.meta.url));
const site=path.resolve(process.env.AI_CORRECTIONS_SITE || (existsSync(path.join(packageRoot,'scripts/authoring.mjs')) ? packageRoot : path.join(packageRoot,'../../site/notes-58c0-refactor')));
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const {compileAuthoring,readAuthoring}=await import(pathToFileURL(path.join(site,'scripts/authoring.mjs')));
const registry=await json(path.join(packageRoot,'content/ai-answer-corrections.json'));
const metadata=await json(path.join(site,'content/metadata.json'));
const all=(await Promise.all((await readdir(path.join(site,'content/chapters'))).filter(f=>f.endsWith('.json')).map(f=>json(path.join(site,'content/chapters',f))))).flatMap(c=>c.entries);
const originals=metadata.entryOrder.map(id=>all.find(e=>e.id===id));
const compiled=compileAuthoring(originals,await readAuthoring(site),await json(path.join(site,'content/legacy-identities.json')));
const clone=x=>structuredClone(x);
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const apply=(c=compiled,o=originals,r=registry)=>correctAIAnswers(c,o,r);
const item=(list,r)=>list.find(e=>e.id===r.entryId).items[r.questionIndex];
test('exactly three answer and lead edits; every other value and source extension unchanged',()=>{
 const ob=JSON.stringify(originals), cb=JSON.stringify(compiled), fixed=apply();let changed=0;
 for(let ei=0;ei<compiled.length;ei++) {
  const old=compiled[ei], next=fixed[ei], records=registry.corrections.filter(r=>r.entryId===old.id);
  if(!records.length) {assert.equal(next,old);continue;}
  assert.deepEqual({...next,items:null},{...old,items:null});
  old.items.forEach((q,i)=>{const r=records.find(r=>r.questionIndex===i);if(!r){assert.equal(next.items[i],q);return;}
   changed++;assert.equal(next.items[i].a,r.newAnswer+q.a.slice(r.oldAnswer.length));assert.equal(next.items[i].lead,r.newLead);
   assert.deepEqual({...next.items[i],a:null,lead:null},{...q,a:null,lead:null});
  });
 }
 assert.equal(changed,3);assert.equal(JSON.stringify(originals),ob);assert.equal(JSON.stringify(compiled),cb);
});
test('arbitrary appended source bytes survive prefix replacement, including code',()=>{
 const c=clone(compiled); for(const r of registry.corrections)item(c,r).a+='\n<pre>untouched(); &amp; 中文</pre>\n';
 const fixed=apply(c);for(const r of registry.corrections)assert.equal(item(fixed,r).a.slice(r.newAnswer.length),item(c,r).a.slice(r.oldAnswer.length));
});
test('baseline bypass preserves reference even with absent registry/originals',()=>assert.equal(correctAIAnswers(compiled,null,null,{baselineTest:true}),compiled));
test('reject unknown, missing, duplicate targets and unknown fields',()=>{
 for(const mutate of [r=>r.corrections.pop(),r=>r.corrections[0].entryId='unknown',r=>r.corrections[1]=clone(r.corrections[0]),r=>r.extra=1,r=>r.corrections[0].extra=1]){const r=clone(registry);mutate(r);assert.throws(()=>apply(compiled,originals,r));}
});
test('reject changed original hash, question identity, answer and lead',()=>{
 for(const field of ['q','a','lead','mk']){const o=clone(originals);item(o,registry.corrections[0])[field]='drift';assert.throws(()=>apply(compiled,o));}
 for(const field of ['oldAnswer','oldLead','questionId','questionIndex','expectedOriginalHash']){const r=clone(registry);r.corrections[0][field]='drift';assert.throws(()=>apply(compiled,originals,r));}
});
test('reject compiled prefix, lead, ID drift and double application',()=>{
 for(const field of ['a','lead','q','id']){const c=clone(compiled);item(c,registry.corrections[0])[field]='drift';assert.throws(()=>apply(c));}
 assert.throws(()=>apply(apply()));
});
test('no explicit lead variant exposes corrected first paragraph through splitLead contract',()=>{
 const o=clone(originals),c=clone(compiled),r=clone(registry), rec=r.corrections[0];
 delete item(o,rec).lead;delete item(c,rec).lead;rec.oldLeadPresent=false;rec.oldLead=null;rec.expectedOriginalHash=sha(item(o,rec));
 const q=item(apply(c,o,r),rec);assert.equal(Object.hasOwn(q,'lead'),false);assert.ok(q.a.startsWith('<p class="md-p">'));assert.ok(q.a.indexOf('</p>')>0);
});
test('correct technical conditions and obsolete claims removed from original display prefixes',()=>{
 const fixed=apply();const q=Object.fromEntries(registry.corrections.map(r=>[r.entryId,item(fixed,r)]));
 assert.match(q['ai-模型与评测-4'].a,/若所有奖励相同，则 A_i = 0/);assert.match(q['ai-模型与评测-4'].a,/二值正确性奖励/);assert.match(q['ai-模型与评测-4'].a,/KL 或熵/);
 assert.match(q['ai-模型与评测-5'].a,/0.15\/0.05/);assert.match(q['ai-模型与评测-5'].lead,/不保证绝对概率/);
 assert.match(q['ai-模型与评测-1'].a,/RMSNorm/);assert.match(q['ai-模型与评测-1'].a,/Q\/K/);
 for(const r of registry.corrections){const x=item(fixed,r);assert.ok(!x.a.startsWith(r.oldAnswer));assert.notEqual(x.lead,r.oldLead);assert.doesNotMatch(r.newAnswer+r.newLead,/原稿更正|来源说明/);}
});

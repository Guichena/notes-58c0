import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {correctMainAnswers} from '../scripts/main-answer-corrections.mjs';
import {compileAuthoring,readAuthoring} from '../scripts/authoring.mjs';
const root=new URL('../',import.meta.url).pathname;
const json=async p=>JSON.parse(await readFile(root+p,'utf8'));
const originals=(await Promise.all((await readdir(root+'content/chapters')).map(f=>json('content/chapters/'+f)))).flatMap(x=>x.entries);
const registry=await json('content/main-answer-corrections.json');
const compiled=compileAuthoring(originals,await readAuthoring(root),await json('content/legacy-identities.json'));
test('15 finite main-answer corrections preserve originals and every unrelated compiled field',()=>{
 const before=structuredClone(compiled),sourceBefore=structuredClone(originals),after=correctMainAnswers(compiled,originals,registry);
 assert.deepEqual(compiled,before);assert.deepEqual(originals,sourceBefore);
 for(const f of registry.fields){const e=after.find(e=>e.id===f.entry_id);assert.deepEqual(e[f.field],f.new_full_field);e[f.field]=structuredClone(f.old_full_field);}
 assert.deepEqual(after,compiled);
});
test('main-answer guards reject missing, drifted, duplicate and repeated corrections; baseline is exact',()=>{
 assert.equal(correctMainAnswers(compiled,null,null,{baselineTest:true}),compiled);
 const changed=structuredClone(compiled);changed.find(e=>e.id===registry.fields[0].entry_id)[registry.fields[0].field]=['drift'];assert.throws(()=>correctMainAnswers(changed,originals,registry),/compiled hash mismatch/);
 const broken=structuredClone(registry);broken.fields[1]=broken.fields[0];assert.throws(()=>correctMainAnswers(compiled,originals,broken),/duplicate field/);
 const missing=compiled.filter(e=>e.id!=='handwrite-61');assert.throws(()=>correctMainAnswers(missing,originals,registry),/missing target/);
 assert.throws(()=>correctMainAnswers(correctMainAnswers(compiled,originals,registry),originals,registry),/compiled hash mismatch/);
});

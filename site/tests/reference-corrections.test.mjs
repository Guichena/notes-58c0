import test from 'node:test';import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';
import {compileAuthoring,readAuthoring} from '../scripts/authoring.mjs';
import {correctReferenceFields} from '../scripts/reference-field-corrections.mjs';
import {correctReferenceOriginalAnswers} from '../scripts/original-qa-corrections.mjs';
const root=new URL('../',import.meta.url).pathname,json=async p=>JSON.parse(await readFile(root+p,'utf8'));
const all=(await Promise.all((await readdir(root+'content/chapters')).map(f=>json('content/chapters/'+f)))).flatMap(c=>c.entries),originals=(await json('content/metadata.json')).entryOrder.map(id=>all.find(e=>e.id===id));
const compiled=compileAuthoring(originals,await readAuthoring(root),await json('content/legacy-identities.json'));
for(const [name,apply,file,get] of [['fields',correctReferenceFields,'reference-field-corrections.json',(entries,r)=>[entries.find(e=>e.id===r.entry_id),r.field]],['qa',correctReferenceOriginalAnswers,'original-qa-corrections.json',(entries,r)=>[entries.find(e=>e.id===r.entryId).items[r.questionIndex],'a']]]){
 const reg=await json('content/'+file);
 test('reference '+name+' preserves source, suffixes, unrelated values and rejects reapplication',()=>{const before=JSON.stringify(compiled),ob=JSON.stringify(originals),c=structuredClone(compiled);for(const r of reg.corrections){const [o,k]=get(c,r);o[k]+=' appended exact suffix';}const result=apply(c,originals,reg);for(const r of reg.corrections){const [o,k]=get(result,r);assert.ok(o[k].endsWith(' appended exact suffix'));assert.ok(o[k].startsWith(r.new_full_field||r.newAnswer));}assert.equal(JSON.stringify(compiled),before);assert.equal(JSON.stringify(originals),ob);assert.throws(()=>apply(result,originals,reg));});
 test('reference '+name+' fails closed for source, prefix, target and output drift',()=>{for(const target of ['source','compiled','target','output','missing','duplicate']){const c=structuredClone(compiled),o=structuredClone(originals),r=structuredClone(reg);if(target==='source'||target==='compiled'){const [obj,k]=get(target==='source'?o:c,r.corrections[0]);obj[k]='drift';}if(target==='target')r.corrections[0][name==='qa'?'entryId':'entry_id']='wrong';if(target==='output')r.corrections[0][name==='qa'?'newAnswer':'new_full_field']+='drift';if(target==='missing')r.corrections.pop();if(target==='duplicate')r.corrections[1]=r.corrections[0];assert.throws(()=>apply(c,o,r),target);}});
 test('reference '+name+' baseline bypass',()=>assert.equal(apply(compiled,null,null,{baselineTest:true}),compiled));
}

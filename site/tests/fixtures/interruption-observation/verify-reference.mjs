import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const read=n=>JSON.parse(fs.readFileSync(new URL(n,import.meta.url),'utf8'));
assert.equal(createHash('sha256').update(fs.readFileSync(new URL('./transition-proof.json',import.meta.url))).digest('hex'),'049585793a2a5878490447ee5775e566e33b6015ff3ab2239f8ce40e7b960736','exact interruption proof required');
export const interruptionProof=read('./transition-proof.json');
export const interruptionSha=x=>createHash('sha256').update(x).digest('hex');
const R=interruptionProof.records,get=(o,p)=>p.reduce((x,k)=>x?.[k],o),set=(o,p,v)=>p.slice(0,-1).reduce((x,k)=>x[k],o)[p.at(-1)]=v;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),record=(id,p)=>R.find(r=>r.entryId===id&&same(r.path,p));
assert.equal(R.length,2);assert.equal(new Set(R.map(r=>JSON.stringify([r.entryId,r.path]))).size,2);
for(const r of R){assert.equal(interruptionSha(r.before),r.beforeSha256);assert.equal(interruptionSha(r.after),r.afterSha256);assert.equal(get(interruptionProof.beforeEntries[r.entryId],r.path),r.before);assert.equal(get(interruptionProof.afterEntries[r.entryId],r.path),r.after);}
export function interruptionLeaf(id,p,old){const r=record(id,p);return r&&old===r.before?r.after:old;}
export function interruptionHash(id,p,old){const r=record(id,p);return r&&old===r.beforeSha256?r.afterSha256:old;}
export function interruptionEntry(old){const next=structuredClone(old);for(const r of R.filter(r=>r.entryId===old.id)){if(get(next,r.path)===r.before)set(next,r.path,r.after);}return next;}
export function interruptionReferenceEntry(current){const next=structuredClone(current);for(const r of R.filter(r=>r.entryId===current.id)){assert.equal(get(next,r.path),r.after,'exact entire corrected leaf required before historical reference');set(next,r.path,r.before);}return next;}
export function interruptionRegistryBefore(current){const prior=structuredClone(current);for(const r of interruptionProof.registryRecords){const matches=prior.records.filter(c=>c.entryId===r.after.entryId&&same(c.path,r.after.path));assert.equal(matches.length,1);assert.deepEqual(matches[0],r.after,'exact composed existing record required');Object.assign(matches[0],structuredClone(r.before));}assert.equal(prior.records.length,current.records.length,'two existing records never append');return prior;}
export function interruptionAssetHash(path,old){const r=interruptionProof.assets.find(r=>r.distRelativePath===path&&r.beforeSha256===old);return r?r.afterSha256:old;}
export function interruptionSourceText(path,old){const r=read('./source-transitions.json').replacements.find(r=>r.target===path&&r.before===old);return r?r.after:old;}
export function interruptionSourceHash(path,old){const r=read('./source-transitions.json').replacements.find(r=>r.target===path&&r.beforeSha256===old);return r?r.afterSha256:old;}
export function interruptionRuntimePath(fixtures){const original=new URL('../agent-backend-relocation/verify-runtime.py',import.meta.url);assert.equal(fileURLToPath(new URL('../agent-backend-relocation/',import.meta.url)).replace(/\/$/,''),fixtures.replace(/\/$/,''),'explicit original backend fixtures');assert.equal(interruptionSha(fs.readFileSync(original)),interruptionProof.originalConsumers['tests/fixtures/agent-backend-relocation/verify-runtime.py'].sha256);return fileURLToPath(new URL('./backend_runtime.py',import.meta.url));}
export function assertInterruptionEntries(E){for(const [id,entry]of Object.entries(interruptionProof.afterEntries))assert.deepEqual(E.get(id),entry,'complete corrected entry '+id);return {leaves:2,entries:2};}
export const interruptionCanon=x=>JSON.stringify((function sort(v){if(Array.isArray(v))return v.map(sort);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])]));return v;})(x));
export function interruptionEntryHash(id,old){if(!Object.hasOwn(interruptionProof.beforeEntries,id))return old;assert.equal(old,interruptionSha(interruptionCanon(interruptionProof.beforeEntries[id])),'exact prior entire entry canonical hash required');return interruptionSha(interruptionCanon(interruptionProof.afterEntries[id]));}
export function interruptionExpectedRegistry(prior){const result=structuredClone(prior);for(const row of interruptionProof.registryRecords){const matches=result.records.flatMap((r,i)=>r.entryId===row.before.entryId&&same(r.path,row.before.path)?[i]:[]);assert.equal(matches.length,1);assert.deepEqual(result.records[matches[0]],row.before,'entire exact prior registry record');result.records[matches[0]]=structuredClone(row.after);}assert.equal(result.records.length,prior.records.length);return result;}

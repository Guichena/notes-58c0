import {prior405Registry,restorePrior405} from './remaining-reviewed-oracle.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const get=(e,p)=>p.reduce((a,k)=>a[k],e);
export function prior248Registry(current){
 current=prior405Registry(current);
 const old=structuredClone(current);delete old.backendScenarioEvidence;
 old.records=current.records.slice(0,248).map(r=>structuredClone(r.backendScenarioComposition?.priorRecord??r));
 assert.equal(createHash('sha256').update(JSON.stringify(old)).digest('hex'),current.backendScenarioEvidence.priorRegistrySha256);
 return old;
}
export function restorePrior248(entries,current){
 entries=restorePrior405(entries,current);current=prior405Registry(current);
 const out=structuredClone(entries),byId=new Map(out.map(e=>[e.id,e]));
 for(const d of current.backendScenarioEvidence.deltas){
  if(!byId.has(d.entryId))continue;
  const e=byId.get(d.entryId);assert.deepEqual(get(e,d.path),d.after,'exact backend/scenario after-value before historical reconstruction');
  get(e,d.path.slice(0,-1))[d.path.at(-1)]=structuredClone(d.before);
 }
 return out;
}

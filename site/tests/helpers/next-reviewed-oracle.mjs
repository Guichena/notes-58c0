import {prior248Registry,restorePrior248} from './backend-scenario-oracle.mjs';
import assert from 'node:assert/strict';
// Independently reconstruct the complete prior registry, preserving property order.
export function priorReviewedRegistry(current){
 if(current.backendScenarioEvidence)current=prior248Registry(current);
 const old=structuredClone(current);delete old.nextReviewedEvidence;
 old.records=current.records.slice(0,107).map(r=>structuredClone(r.nextReviewedComposition?.priorRecord??r));
 return old;
}
// Undo only the independently frozen approved next-wave leaves, after checking final bytes.
export function restorePriorReviewed(entries,registry){
 if(registry.backendScenarioEvidence){entries=restorePrior248(entries,registry);registry=prior248Registry(registry);}
 const byId=new Map(entries.map(e=>[e.id,e]));const out=entries.map(e=>structuredClone(e)),byOut=new Map(out.map(e=>[e.id,e]));
 for(const delta of registry.nextReviewedEvidence.approvedDeltas){
  if(!byId.has(delta.entryId))continue;
  const r=registry.records.find(r=>r.entryId===delta.entryId&&JSON.stringify(r.path)===JSON.stringify(delta.path));
  const get=(e,p)=>p.reduce((a,k)=>a[k],e);
  assert.deepEqual(get(byId.get(delta.entryId),delta.path),r.after,'final reviewed value before historical reconstruction');
  get(byOut.get(delta.entryId),delta.path.slice(0,-1))[delta.path.at(-1)]=structuredClone(delta.before);
 }
 return out;
}

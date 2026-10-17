import {prior1109Registry,restorePrior1109} from './final-reviewed-oracle.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=name=>readFileSync(new URL('../fixtures/remaining-reviewed/'+name,import.meta.url),'utf8');
const hash=s=>createHash('sha256').update(s).digest('hex');
const get=(e,p)=>p.reduce((a,k)=>a[k],e);
export function prior405Registry(current){
 current=prior1109Registry(current);
 if(!current.remainingReviewedEvidence)return current;
 const ev=current.remainingReviewedEvidence,prior=JSON.parse(read('prior405.json'));
 assert.equal(hash(JSON.stringify(prior)),ev.priorRegistrySha256);
 const old=structuredClone(current);delete old.remainingReviewedEvidence;old.records=old.records.slice(0,405);
 for(const i of ev.overlapIndices){
  const expected=structuredClone(prior.records[i]),actual=old.records[i];
  for(const k of ['after','afterSha256','operation','review'])expected[k]=actual[k];
  assert.deepEqual(actual,expected,'only approved current overlap fields may differ');
  old.records[i]=structuredClone(prior.records[i]);
 }
 assert.deepEqual(old,prior);assert.equal(hash(JSON.stringify(old)),ev.priorRegistrySha256);return old;
}
export function remainingDeltas(current){const raw=read('approved-deltas.json');assert.equal(hash(raw),current.remainingReviewedEvidence.deltaFixtureSha256);return JSON.parse(raw);}
export function restorePrior405(entries,current){
 entries=restorePrior1109(entries,current);current=prior1109Registry(current);
 if(!current.remainingReviewedEvidence)return entries;
 const out=structuredClone(entries),byId=new Map(out.map(e=>[e.id,e]));
 for(const d of remainingDeltas(current)){
  const e=byId.get(d.entryId);if(!e)continue;
  const p=get(e,d.path.slice(0,-1));assert.ok(Object.hasOwn(p,d.path.at(-1)));assert.deepEqual(p[d.path.at(-1)],d.after,'exact remaining after-value before reconstruction');
  if(!d.beforePresent)delete p[d.path.at(-1)];else p[d.path.at(-1)]=structuredClone(d.before);
 }
 return out;
}

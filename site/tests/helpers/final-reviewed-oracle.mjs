import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const read=n=>readFileSync(new URL('../fixtures/final-reviewed/'+n,import.meta.url),'utf8'),hash=s=>createHash('sha256').update(s).digest('hex'),get=(e,p)=>p.reduce((a,k)=>a[k],e);
export function prior1109Registry(current){
 if(!current.finalReviewedEvidence)return current;
 const ev=current.finalReviewedEvidence,prior=JSON.parse(read('prior1109.json'));assert.equal(hash(JSON.stringify(prior)),ev.priorRegistrySha256);
 const old=structuredClone(current);delete old.finalReviewedEvidence;old.records=old.records.slice(0,1109);
 for(const i of ev.overlapIndices){const expected=structuredClone(prior.records[i]),actual=old.records[i];for(const k of ['after','afterSha256','operation','review'])expected[k]=actual[k];assert.deepEqual(actual,expected,'only approved final overlap fields differ');old.records[i]=structuredClone(prior.records[i]);}
 assert.deepEqual(old,prior);return old;
}
export function finalDeltas(current){const raw=read('approved-deltas.json');assert.equal(hash(raw),current.finalReviewedEvidence.deltaFixtureSha256);return JSON.parse(raw);}
export function restorePrior1109(entries,current){
 if(!current.finalReviewedEvidence)return entries;
 const out=structuredClone(entries),byId=new Map(out.map(e=>[e.id,e]));for(const d of finalDeltas(current)){const e=byId.get(d.entryId);if(!e)continue;const p=get(e,d.path.slice(0,-1));assert.ok(Object.hasOwn(p,d.path.at(-1)));assert.deepEqual(p[d.path.at(-1)],d.after,'exact final after-value before reconstruction');if(!d.beforePresent)delete p[d.path.at(-1)];else p[d.path.at(-1)]=structuredClone(d.before);}return out;
}

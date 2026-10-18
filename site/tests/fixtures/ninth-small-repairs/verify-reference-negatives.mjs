import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

// Pure reference-object self-checks only. This script never writes a site, builds a
// dist, overlays actual entries, or treats proof objects as actual-dist acceptance.
const flag=process.argv.indexOf('--helper');
const helperUrl=flag<0?new URL('./verify-reference.mjs',import.meta.url):pathToFileURL(path.resolve(process.argv[flag+1]));
const H=await import(helperUrl.href),P=H.ninthProof;
const sha=x=>createHash('sha256').update(x).digest('hex');
const result={status:'PASS_REFERENCE_HELPER_NEGATIVES',helperSha256:sha(fs.readFileSync(helperUrl)),actualAcceptance:false,siteWrites:0,coreNegativeChecks:[],observations:{}};
function rejected(name,fn){assert.throws(fn,assert.AssertionError,name+' must reject the tampered complete reference');result.coreNegativeChecks.push(name);}

// 1. A valid migrated snippet is permitted only after an exact complete current leaf.
const narrow=P.records.find(r=>r.segments?.some(s=>!r.after.includes(s.before)));
assert.ok(narrow);const segment=narrow.segments.find(s=>!narrow.after.includes(s.before));
assert.equal(H.ninthIncludes(narrow.entryId,narrow.path,narrow.after,segment.before),true);
rejected('complete-current-leaf-tamper',()=>H.ninthIncludes(narrow.entryId,narrow.path,narrow.after+' UNREVIEWED',segment.before));

// 2. The entire current question, including its identity and other fields, is guarded.
const qr=P.records.find(r=>r.path[0]==='items'&&r.path[2]==='a'),qi=qr.path[1];
const finalQuestion=P.finalEntries[qr.entryId].items[qi];
assert.deepEqual(H.ninthReferenceQuestion(qr.entryId,qi,structuredClone(finalQuestion)),P.originalEntries[qr.entryId].items[qi]);
const wrongQuestion=structuredClone(finalQuestion);wrongQuestion.q+=' UNREVIEWED';
rejected('complete-current-question-identity-tamper',()=>H.ninthReferenceQuestion(qr.entryId,qi,wrongQuestion));

// 3. A full-entry reverse must reject unrelated sibling/metadata drift as well.
const finalEntry=P.finalEntries['ai-agent-9'];assert.ok(finalEntry);
assert.deepEqual(H.ninthReferenceEntry(structuredClone(finalEntry)),P.originalEntries[finalEntry.id]);
const wrongEntry=structuredClone(finalEntry);wrongEntry.items[0].q+=' UNREVIEWED SIBLING';
rejected('complete-current-entry-sibling-tamper',()=>H.ninthReferenceEntry(wrongEntry));

// 4. Exact527 registry reversal preserves original500 bytes logically, record order,
// earliest before values, reasons, and all unrelated records. Changes outside the31
// affected after values are rejected even when the total record count stays527.
const original=JSON.parse(fs.readFileSync(new URL('./original500-registry.json',helperUrl),'utf8'));
assert.equal(original.records.length,500);const current=structuredClone(original);
const k=r=>JSON.stringify([r.entryId,r.path]),by=new Map(current.records.map(r=>[k(r),r]));
for(const r of P.records){const prev=by.get(k(r));if(prev){assert.equal(prev.after,r.before);prev.after=r.after;prev.afterSha256=r.afterSha256;}else{const row=Object.fromEntries(['entryId','path','before','after','beforeSha256','afterSha256','reason'].map(f=>[f,r[f]]));current.records.push(row);by.set(k(r),row);}}
assert.equal(current.records.length,527);const beforeCurrent=JSON.stringify(current);
assert.deepEqual(H.ninthRegistryBefore(current),original);assert.equal(JSON.stringify(current),beforeCurrent,'registry helper must not mutate its input');
const wrongRegistry=structuredClone(current);wrongRegistry.records[0].reason+=' UNREVIEWED';
rejected('entire527-registry-unrelated-record-tamper',()=>H.ninthRegistryBefore(wrongRegistry));

// Diagnostics are not actual content acceptance and intentionally expose API edge
// cases without changing the four required tamper-rejection test outcomes.
const retained=[];
for(const r of P.records)for(const [i,s]of (r.segments??[]).entries())if(r.after.includes(s.before))retained.push({entryId:r.entryId,path:r.path,segmentIndex:i,retainedReferenceUnchanged:H.ninthFragment(r.entryId,r.path,s.before)===s.before});
assert.ok(retained.every(x=>x.retainedReferenceUnchanged));result.observations.retainedSegments=retained;
if(H.ninthKeyInfo){
 const ids=new Map([['example',{id:'example',items:[{id:'1',a:'named-numeric-id-at-index-zero'},{id:'q-second',a:'numeric-index-one'}]}]]);
 result.observations.numericIndexResolution=H.ninthKeyInfo(ids,'example#1').path;assert.deepEqual(result.observations.numericIndexResolution,['items',1,'a']);
 result.observations.namedIdResolution=H.ninthKeyInfo(ids,'example#q-second').path;
}
let stringIndexRejected=false;try{H.ninthReferenceQuestion(qr.entryId,String(qi),wrongQuestion);}catch(e){assert.ok(e instanceof assert.AssertionError);stringIndexRejected=true;}
assert.equal(stringIndexRejected,true);result.observations.stringIndexTamperRejected=stringIndexRejected;
assert.equal(result.coreNegativeChecks.length,4);
console.log(JSON.stringify(result,null,2));

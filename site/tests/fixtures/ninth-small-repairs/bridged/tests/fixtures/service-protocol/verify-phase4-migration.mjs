const NINTH_ORIGINAL_URL=new URL("../../../../../service-protocol/verify-phase4-migration.mjs",import.meta.url);
import assert from 'node:assert/strict';import fs from'node:fs';import path from'node:path';import crypto from'node:crypto';
import {eighthLeaf} from '../eighth-reconciliation/verify-dependencies.mjs';
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
export function verifyWorkflowMigration(p,{here,pkg,pm,target,semanticBlocks}){
 assert.equal(p.schemaVersion,1);
 for(const [name,h]of Object.entries(p.sourceFiles))assert.equal(sha(fs.readFileSync(path.join(here,'..',name))),h,'unchanged original source fixture '+name);
 const r=pkg.records.find(r=>r.entryId==='ai-agent-5');assert.deepEqual(r,p.serviceRecord);
 const w=p.workflowRecord,a=p.workflowOriginalAfterPrefix,fix=p.repair;
 assert.equal(r.after,w.before,'service exact after is complete workflow before');assert.equal(r.afterSha256,w.beforeSha256);
 for(const x of [r,w]){assert.equal(sha(x.before),x.beforeSha256);assert.equal(sha(x.after),x.afterSha256);}
 assert.deepEqual(w,a.composedRecord);assert.equal(w.after,a.originalRecord.after+a.exactAppendixHtml);assert.equal(sha(a.originalRecord.after),a.originalAfterSha256);assert.equal(Array.from(a.exactAppendixHtml).length,735);assert.equal(sha(a.exactAppendixHtml),a.appendixSha256);
 assert.equal(sha(w.after),fix.beforeSha256);assert.equal(w.after.split(fix.oldExactSubstring).length,2);
 assert.equal(p.expectedFinalBody,w.after.replace(fix.oldExactSubstring,fix.newExactSubstring));assert.equal(sha(p.expectedFinalBody),fix.afterSha256);assert.equal(target('ai-agent-5#3').a,eighthLeaf('ai-agent-5',['items',3,'a'],p.expectedFinalBody),'exact repaired final body and approved eighth transition');
 assert.equal(fix.newExactParagraph,fix.oldExactParagraph.replace(fix.oldExactSubstring,fix.newExactSubstring));assert.ok(fix.newExactSubstring.includes('延迟与传感器错误处理'));assert.ok(p.expectedFinalBody.endsWith(a.exactAppendixHtml),'prior735-codepoint appendix preserved');
 const sm=p.workflowSourceMap;assert.equal(sm.sourceBlockCount,247);assert.equal(sm.blocks.length,247);assert.equal(sm.sourceBodySha256,sha(w.before));
 const bs=semanticBlocks(w.before);assert.equal(bs.length,247);
 for(const [i,b]of sm.blocks.entries()){
  assert.equal(b.sourceBlockIndex,i);assert.equal(b.sourceHtml,bs[i][0]);assert.equal(sha(b.sourceHtml),b.sourceSha256);assert.equal(Array.from(w.before).slice(...b.sourceSpanCodePoints).join(''),b.sourceHtml);assert.ok(b.destinations.length);
  for(const key of b.destinations)assert.ok(p.destinationWitnesses[key]);
 }
 assert.equal(Object.keys(p.originalWorkflowDestinations).length,37);assert.equal(Object.keys(p.destinationWitnesses).length,44);
 let witnessCount=0;
 for(const [key,d]of Object.entries(p.destinationWitnesses)){
  const body=target(d.stableReviewKey).a;assert.ok(d.witnesses.length);
  if(p.originalWorkflowDestinations[key]){
   const old=p.originalWorkflowDestinations[key];assert.equal(d.stableReviewKey,old.stableReviewKey);assert.equal(d.witnesses.length,old.witnesses.length);
   d.witnesses.forEach((w,i)=>{assert.equal(w.oldHtml,old.witnesses[i].html);assert.equal(w.oldSha256,old.witnesses[i].sha256);assert.equal(sha(w.oldHtml),w.oldSha256);assert.equal(w.html,w.oldHtml===fix.oldExactParagraph?fix.newExactParagraph:w.oldHtml);});
  }else assert.ok(d.reason,'new exact canonical evidence has a stated semantic reason');
  for(const w of d.witnesses){assert.equal(sha(w.html),w.sha256);assert.match(w.html,/^<p\b/,'aliases or navigation are not substantive proof');assert.ok(body.includes(w.html),'missing semantic condition '+key);witnessCount++;}
 }
 assert.equal(p.conditionReviews.length,68);const explanatory=sm.blocks.filter(b=>b.sourceBlockIndex<95&&!b.tag.startsWith('h'));assert.equal(explanatory.length,68);
 for(const [i,c]of p.conditionReviews.entries()){const b=explanatory[i];assert.equal(c.workflowSourceBlockIndex,b.sourceBlockIndex);assert.equal(c.sourceHtml,b.sourceHtml);assert.equal(c.sourceText,b.sourceText);assert.equal(c.sourceSha256,b.sourceSha256);assert.ok(c.review);for(const k of b.destinations)assert.ok(c.destinationKeys.includes(k));for(const k of c.destinationKeys)assert.ok(p.destinationWitnesses[k]);}
 const physical=p.conditionReviews.find(c=>c.workflowSourceBlockIndex===47);assert.equal(physical.physicalRepairRequired,true);assert.ok(physical.sourceText.includes('传感器错误'));assert.ok(physical.sourceText.includes('延迟'));
 assert.equal(p.remaps.length,246);const seen=new Set();
 for(const remap of p.remaps){
  const key=JSON.stringify([remap.stableReviewKey,remap.sourceBlockIndex,remap.destinationIndex]);assert.ok(!seen.has(key));seen.add(key);
  const map=pm.maps.find(x=>x.stableReviewKey===remap.stableReviewKey);assert.ok(map);assert.deepEqual(remap.originalDestination,map.blocks[remap.sourceBlockIndex].destinations[remap.destinationIndex]);assert.equal(remap.originalDestination.stableReviewKey,'ai-agent-5#3');
  assert.equal(sha(remap.originalDestination.html),remap.originalDestination.sha256);assert.ok(w.before.includes(remap.originalDestination.html));
  const rows=remap.workflowBlockIndices.map(i=>sm.blocks[i]);assert.equal(rows.map(b=>b.sourceHtml).join(''),remap.originalDestination.html);
  const required=[...new Set(rows.flatMap(b=>p.conditionReviews.find(c=>c.workflowSourceBlockIndex===b.sourceBlockIndex)?.destinationKeys??b.destinations))];assert.deepEqual(remap.semanticDestinationKeys,required);
  for(const key of required)assert.ok(p.destinationWitnesses[key]);
 }
 const variants=p.workflowVariants;assert.equal(variants.variantCount,151);assert.equal(variants.variants.length,151);
 const panel=p.expectedFinalBody.match(/<details class="qa-variants"><summary>继续追问（151）<\/summary><ul class="md-list">([\s\S]*?)<\/ul><\/details>/);assert.ok(panel);assert.equal([...panel[1].matchAll(/<li>/g)].length,151);
 const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#x27;');
 for(const v of variants.variants){assert.equal(sha(v.original),v.originalSha256);assert.ok(panel[1].includes('<li>'+esc(v.original)+' '),'exact old wording '+v.index);for(const k of v.destinations){const d=p.originalWorkflowDestinations[k];assert.ok(d);assert.ok(panel[1].includes('href="#/e/'+d.stableReviewKey.replace('#','/')+'"'));target(d.stableReviewKey);}}
 return{oldServiceBlocks:322,oldWorkflowSourceBlocks:247,oldWorkflowWordings:151,explicitDestinationRemaps:246,conditionReviews:68,substantiveWitnesses:witnessCount,physicalDelayAndSensorErrorRestored:true};
}
export function assertRelocatedDestination(p,mapKey,blockIndex,destinationIndex,d,target){
 const row=p.remaps.find(r=>r.stableReviewKey===mapKey&&r.sourceBlockIndex===blockIndex&&r.destinationIndex===destinationIndex);
 if(!row){assert.ok(target(d.stableReviewKey).a.includes(d.html),'missing unchanged exact destination '+d.stableReviewKey);return;}
 assert.deepEqual(row.originalDestination,d);assert.ok(row.semanticDestinationKeys.length);
 for(const k of row.semanticDestinationKeys){const dest=p.destinationWitnesses[k];assert.ok(dest);for(const w of dest.witnesses){assert.equal(sha(w.html),w.sha256);assert.ok(target(dest.stableReviewKey).a.includes(w.html),'missing remapped substantive destination '+k+' for '+mapKey+'#'+blockIndex);}}
}

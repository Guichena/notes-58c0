const NINTH_ORIGINAL_URL=new URL("../../../../../agent-answer-contracts/verify-phase3-migration.mjs",import.meta.url);
import {assertCapacityPrefixes,acceptedCapacityTargetHash,acceptedCapacityEntry} from './verify-phase5-capacity-prefix.mjs';
// Explicit reviewed relocation oracle. Reads supplied real built entries; performs no projection or overlay.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const hash=s=>createHash('sha256').update(s).digest('hex');
const get=(o,p)=>p.reduce((a,k)=>a[k],o);
const patterns=[/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/g,/<pre\b[^>]*>[\s\S]*?<\/pre>/g,/<a\b[^>]*>[\s\S]*?<\/a>/g,/<details\b[^>]*>[\s\S]*?<\/details>/g];
const names=['headings','codeBlocks','links','alternateQuestions'];
export const migrationRecord=(proof,id,index)=>proof.approvedRecords.find(r=>r.entryId===id&&r.path.join('.')===`items.${index}.a`);
export function acceptedLeafHash(proof,r){
 const changed=proof.approvedRecords.find(x=>x.entryId===r.entryId&&JSON.stringify(x.path)===JSON.stringify(r.path));
 if(!changed)return r.afterSha256;
 assert.equal(changed.beforeSha256,r.afterSha256,'old eight-leaf pin remains mandatory');
 return changed.afterSha256;
}
export function assertMigratedStructure(proof,snapshot){
 const r=migrationRecord(proof,snapshot.entryId,snapshot.index);assert.ok(r);
 patterns.forEach((re,i)=>{
  const values=r.before.match(re),old=snapshot.preservedStructure[i];
  assert.equal(values?.length??0,old.count);assert.equal(hash(JSON.stringify(values)),old.sha256,'original structure pin');
  const rows=proof.structureMappings.filter(x=>x.entryId===snapshot.entryId&&x.index===snapshot.index&&x.type===names[i]);
  assert.equal(rows.length,values?.length??0);
  for(let j=0;j<rows.length;j++){assert.equal(rows[j].ordinal,j);assert.equal(rows[j].oldHtml,values[j]);assert.equal(hash(rows[j].oldHtml),rows[j].oldSha256);}
 });
}
export function verifyMigration(map,proof,original){
 assertCapacityPrefixes(map);
 assert.equal(proof.schemaVersion,1);assert.equal(original.snapshots.length,6);assert.equal(original.expectedLeaves.length,8);
 assert.deepEqual(proof.approvedRecords.map(r=>[r.entryId,r.path]),[['ai-agent-5',['items',6,'a']],['ai-agent-8',['items',6,'a']]]);
 for(const r of proof.approvedRecords){
  assert.equal(hash(r.before),r.beforeSha256);assert.equal(hash(r.after),r.afterSha256);
  assert.equal(get(map.get(r.entryId),r.path),r.after,'exact approved current answer');
 }
 const arbitration=migrationRecord(proof,'ai-agent-5',6),safety=migrationRecord(proof,'ai-agent-8',6);
 assert.equal(arbitration.beforeSha256,original.snapshots.find(s=>s.entryId==='ai-agent-5').answerBeforeSha256);
 assert.equal(safety.beforeSha256,original.expectedLeaves.find(r=>r.entryId==='ai-agent-8'&&r.path.join('.')==='items.6.a').afterSha256);
 for(const t of proof.targets){
  const entry=map.get(t.entryId);assert.ok(entry,t.entryId);const actual=get(entry,t.path);
  assert.equal(typeof actual,'string');assert.equal(hash(actual),acceptedCapacityTargetHash(t),t.entryId+' '+t.path.join('.'));
  if(t.path[0]==='items')assert.equal(entry.items[t.path[1]].id??String(t.path[1]),t.questionId);
 }
 for(const w of proof.witnesses){
  assert.equal(hash(w.html),w.sha256);assert.ok(w.html.length>0);const t=proof.targets[w.targetIndex];assert.ok(t);
  assert.ok(get(map.get(t.entryId),t.path).includes(w.html),'substantive/structural witness '+t.entryId+' '+t.path.join('.'));
 }
 assert.equal(proof.sourceBlocks.length,170);
 assert.deepEqual(proof.sourceBlocks.map(r=>r.sourceBlockIndex),Array.from({length:170},(_,i)=>i));
 for(const row of proof.sourceBlocks){
  assert.equal(row.sourceEntryId,'ai-agent-8');assert.equal(row.sourceItemIndex,6);
  assert.equal(hash(row.sourceHtml),row.sourceSha256);assert.ok(safety.before.includes(row.sourceHtml));
  assert.ok(row.witnessIndices.length>0);for(const i of row.witnessIndices)assert.ok(proof.witnesses[i]);
 }
 assert.equal(proof.conflictSegments.length,10);assert.equal(proof.conflictSegments.map(s=>s.before).join(''),arbitration.before);
 for(const row of proof.conflictSegments){
  assert.equal(hash(row.before),row.beforeSha256);assert.equal(hash(row.newHtml),row.newSha256);
  assert.equal(proof.witnesses[row.witnessIndex].html,row.newHtml);
  if(row.mode==='exact')assert.equal(row.newHtml,row.before);
  else if(row.mode==='heading-level-only')assert.equal(row.newHtml,row.before.replace('<h4>双分析加裁决，还是单分析加校验</h4>','<h3 class="md-h md-h3">双分析加裁决，还是单分析加校验</h3>'));
  else {assert.equal(row.mode,'heading-retitled-anchor-retained');assert.match(row.before,/id="add-own-distributed-s10974"/);assert.match(row.newHtml,/id="add-own-distributed-s10974"/);}
 }
 assert.equal(proof.structureMappings.length,62);
 for(const row of proof.structureMappings){
  assert.equal(hash(row.oldHtml),row.oldSha256);assert.ok(row.witnessIndices.length>0);
  const witnesses=row.witnessIndices.map(i=>{assert.ok(proof.witnesses[i]);return proof.witnesses[i].html;});
  if(row.mode==='exact-relocation')assert.ok(witnesses.includes(row.oldHtml));
  else if(row.mode==='reviewed-heading-reclassification'){assert.ok(witnesses.some(s=>s.includes(row.newHeading)));assert.match(row.newHeading,/^<h[1-6]\b/);assert.ok(row.reason);}
  else {
   assert.equal(row.mode,'exact-wording-retention-with-answers');const words=[...row.oldHtml.matchAll(/<li>(.*?)<\/li>/g)].map(m=>m[1]);
   assert.equal(words.length,28);assert.deepEqual(row.wordings,words);assert.equal(witnesses.length,28);
   words.forEach((w,i)=>assert.equal(witnesses[i],'<span class="qa-variant-wording">'+w+'</span>'));
  }
 }
 for(const s of original.snapshots)if(migrationRecord(proof,s.entryId,s.index))assertMigratedStructure(proof,s);
 assert.equal(proof.prefixContracts.length,3);
 for(const c of proof.prefixContracts){
  if(c.kind==='leaf-full-prefix'){
   assert.equal(c.entryId,'own-runtime-incident-workflow');assert.deepEqual(c.path,['items',0,'a']);assert.equal(hash(c.before),c.beforeSha256);assert.equal(hash(c.after),c.afterSha256);
   assert.ok(c.after.startsWith(c.before));assert.ok(c.after.length>c.before.length);assert.equal(get(map.get(c.entryId),c.path),c.after);
  }else{
   assert.equal(c.kind,'whole-entry-append');assert.deepEqual([c.beforeCount,c.afterCount],c.entryId==='own-os-sandbox'?[1,6]:[6,7]);
   assert.equal(hash(JSON.stringify(c.beforeEntry)),c.beforeSha256);assert.equal(hash(JSON.stringify(c.afterEntry)),c.afterSha256);
   assert.equal(c.beforeEntry.items.length,c.beforeCount);assert.equal(c.afterEntry.items.length,c.afterCount);
   assert.deepEqual(c.afterEntry.items.slice(0,c.beforeCount),c.beforeEntry.items,'entire old question objects, no field omission');
   assert.deepEqual({...c.afterEntry,items:null},{...c.beforeEntry,items:null});
   assert.deepEqual(map.get(c.entryId),acceptedCapacityEntry(c),'exact final full entry, not >= count');
  }
 }
 assert.equal(proof.practiceEntry.id,'own-practice-agent-script-recovery');assert.equal(hash(JSON.stringify(proof.practiceEntry)),proof.practiceEntrySha256);assert.deepEqual(map.get(proof.practiceEntry.id),proof.practiceEntry);
 assert.deepEqual(proof.unknownContractTarget,{entryId:proof.practiceEntry.id,path:['html']});
 return {sourceBlocks:170,conflictSegments:10,structures:62,targets:proof.targets.length,witnesses:proof.witnesses.length,prefixes:3};
}

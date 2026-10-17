// Historical tree oracle: normalize only explicitly reviewed additive layers and
// the four sealed display-order permutations. No directory-wide exclusions.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(x).digest('hex');
const fixture=async name=>readFile(new URL('../fixtures/'+name,import.meta.url),'utf8');
const original=await fixture('reading-preservation-learning-order-original.json');
assert.equal(sha(original),'a06f45eced530f9c78031a8731b9ff637ebc3b8857a0f281f1c4d1ba2bcc0fe7');
const addedText=await fixture('reading-preservation-reviewed-additions.json');
assert.equal(sha(addedText),'e01da659d6b4c9f8b74c5f202c97775d783b1a5efc9255a93c1eff4d8dfa0c25');
const changeText=await fixture('interview-priority-entry-order.json');
assert.equal(sha(changeText),'bea327a3d6ed959b8a4088331566f754c43d3bf71d6aa0fc1b093cef98ca6922');
export const reviewedAddedPaths=Object.freeze(JSON.parse(addedText).addedContentPaths);
const added=new Set(reviewedAddedPaths);
assert.equal(added.size,80);
const current=JSON.parse(original), changes=JSON.parse(changeText).changes;
assert.equal(changes.length,4);
for(const change of changes){
 const group=current.modules.flatMap(m=>m.parts.flatMap(p=>p.categories)).find(c=>c.groupId===change.groupId);
 assert.ok(group);assert.deepEqual(group.entryIds,change.before);
 assert.equal(new Set(change.after).size,change.after.length);
 assert.deepEqual([...change.after].sort(),[...change.before].sort());
 group.entryIds=change.after;
}
const expectedCurrent=JSON.stringify(current,null,2)+'\n';
export function normalizeReadingPreservationFile(file,bytes){
 if(added.has(file))return null;
 if(file==='content/interview-learning-order.json'){
  assert.equal(bytes.toString(),expectedCurrent,'Learning order must differ only by four reviewed entry permutations, with unchanged membership and other fields');
  return Buffer.from(original);
 }
 return bytes;
}

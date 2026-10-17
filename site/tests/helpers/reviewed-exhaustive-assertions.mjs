import assert from 'node:assert/strict';
export function runGlobalChecks({input,output,registry,projectReviewedContent,get}){
assert.throws(()=>projectReviewedContent(output,registry),/stale input/);assert.throws(()=>projectReviewedContent([...input,input[0]],registry),/duplicate entry/);
return ['double-apply','duplicate-entry'];
}
export function runRangeChecks({input,output,registry,projectReviewedContent,get},start,end){
for(const r of registry.records.slice(start,end)){const a=input.map(e=>e.id===r.entryId?structuredClone(e):e),e=a.find(e=>e.id===r.entryId);get(e,r.path.slice(0,-1))[r.path.at(-1)]+='!';assert.throws(()=>projectReviewedContent(a,registry),r.path[0]==='title'?/entry identity mismatch/:/stale input/);assert.throws(()=>projectReviewedContent(input.filter(e=>e.id!==r.entryId),registry),/missing target/);if(r.questionIdentity){for(const k of ['q','id','mk']){const b=input.map(e=>e.id===r.entryId?structuredClone(e):e);b.find(e=>e.id===r.entryId).items[r.questionIdentity.index][k]='forged';assert.throws(()=>projectReviewedContent(b,registry),/question identity/);}}}
}

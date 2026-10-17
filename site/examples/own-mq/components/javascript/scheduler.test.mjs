import assert from 'node:assert/strict';
import {mapLimit,dependencyBatches,runDag,LatestResult,cooperativeSum} from './scheduler.mjs';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let active=0,peak=0;
assert.deepEqual(await mapLimit([0,1,2,3,4],2,async n=>{
  active++;peak=Math.max(peak,active);
  try{await sleep(5);return n*2;}finally{active--;}
}),[0,2,4,6,8]);assert.equal(peak,2);
assert.deepEqual(await mapLimit([],1,()=>{throw new Error();}),[]);
await assert.rejects(mapLimit([1],0,()=>1),TypeError);
const original=new Error('primary');let started=0;
await assert.rejects(mapLimit([0,1,2,3],1,()=>{started++;throw original;}),e=>e===original);
assert.equal(started,1);
const stop=new AbortController();stop.abort(original);
await assert.rejects(mapLimit([1],1,()=>{throw new Error('must not start');},{signal:stop.signal}),e=>e===original);
const controller=new AbortController();const hanging=mapLimit([1,2],1,()=>new Promise(()=>{}),{signal:controller.signal});
controller.abort(original);await assert.rejects(hanging,e=>e===original);
const graph=[{id:'A',deps:[]},{id:'B',deps:[]},{id:'C',deps:['A','B']},{id:'D',deps:['C']}];
assert.deepEqual(dependencyBatches(graph),[['A','B'],['C'],['D']]);
assert.throws(()=>dependencyBatches([{id:'A',deps:['B']}]),TypeError);
assert.throws(()=>dependencyBatches([{id:'A',deps:['B']},{id:'B',deps:['A']}]),/cycle/);
assert.throws(()=>dependencyBatches([{id:'A',deps:[]},{id:'A',deps:[]}]),TypeError);
const result=await runDag(graph,2,async(node,inputs)=>node.id==='C'?inputs.get('A')+inputs.get('B'):1);
assert.equal(result.get('C'),2);let seen=[];
await assert.rejects(runDag(graph,2,async node=>{seen.push(node.id);if(node.id==='B')throw original;return 1;}),e=>e===original);
assert(!seen.includes('C')&&!seen.includes('D'));
const latest=new LatestResult(),old=latest.begin(),current=latest.begin();
assert(old.signal.aborted);assert(!latest.complete(old,'old'));assert(latest.complete(current,'new'));assert.equal(latest.value,'new');
assert.equal(await cooperativeSum([0,1,2],new AbortController().signal,1),3);
await assert.rejects(cooperativeSum([1],stop.signal),e=>e===original);

for (const thrown of [undefined, null, false, 0, '']) {
  let caught = false;
  try { await mapLimit([1], 1, async () => { throw thrown; }); }
  catch (failure) { caught = true; assert.equal(failure, thrown); }
  assert.equal(caught, true);
}
console.log('scheduler tests OK; local JS only; no remote effects or durable queue');

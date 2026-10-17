import {prior1109Registry} from './helpers/final-reviewed-oracle.mjs';
import {createHash} from 'node:crypto';
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {deeplyFrozenPlainJSON as eligible,stableJSONIntrinsics} from '../scripts/immutable-json-eligibility.mjs';
import {projectReviewedContent as project} from './fixtures/final-reviewed/prior1109-projection.mjs';import {projectReviewedContent as uncached} from './fixtures/remaining-reviewed/uncached1109-projection.mjs';
import {freezeStableRegistry as freeze} from './helpers/immutable-registry-fixture.mjs';
const registry=prior1109Registry(JSON.parse(await readFile(new URL('../content/reviewed-content-projection.json',import.meta.url),'utf8')));
const uncachedSource=await readFile(new URL('./fixtures/remaining-reviewed/uncached1109-projection.mjs',import.meta.url));
let input,output;
const missing=r=>assert.throws(()=>project([],r),/missing target/),put=(e,path,v)=>{let p=e;for(let i=0;i<path.length-1;i++){p[path[i]]??=typeof path[i+1]==='number'?[]:{};p=p[path[i]];}p[path.at(-1)]=structuredClone(v);};
test('immutable registry eligibility rejects proxy accessor custom prototype cycles symbols sparse arrays and non-JSON values',()=>{
 assert.equal(eligible(freeze({value:[1,'a',false,null]})),true);for(const v of [{a:1},Object.freeze({a:{b:1}}),Object.freeze(Object.create({a:1})),Object.freeze(Object.create(null)),Object.freeze(new Date()),Object.freeze(new Map()),Object.freeze({a:undefined}),Object.freeze({a:NaN}),Object.freeze({a:Infinity}),Object.freeze({a:1n}),Object.freeze({a:()=>1}),Object.freeze({[Symbol('x')]:1}),Object.freeze([,1]),Object.freeze(new Proxy({a:1},{}))])assert.equal(eligible(v),false);
 let calls=0;const accessor=Object.freeze(Object.defineProperty({},'a',{enumerable:true,get(){calls++;return 1;}}));assert.equal(eligible(accessor),false);assert.equal(calls,0);
 const hidden=Object.freeze(Object.defineProperty({},'a',{value:1}));assert.equal(eligible(hidden),false);const extra=[1];extra.extra=1;assert.equal(eligible(Object.freeze(extra)),false);const cycle={};cycle.self=cycle;assert.equal(eligible(Object.freeze(cycle)),false);
 const shared=freeze({a:1});assert.equal(eligible(freeze({a:shared,b:shared})),true);
});
test('mutable-after-first-use and shallow-frozen registry still receive complete integrity validation on every call',()=>{
 missing(registry);const r=registry.records[0],old=r.after;r.after+='MUTATED';assert.throws(()=>project([],registry),/registry integrity/);r.after=old;
 Object.freeze(registry);assert.equal(eligible(registry),false);missing(registry);r.after+='SHALLOW';assert.throws(()=>project([],registry),/registry integrity/);r.after=old;
});
test('deeply frozen canonical registry gives byte-exact uncached forward and reverse outputs while preserving all targets',()=>{
 assert.equal(createHash('sha256').update(uncachedSource).digest('hex'),'04f74a359744599c94325bd2659804e825a28ac42a17b3cd1d5d7794a86fe528');freeze(registry);assert.equal(eligible(registry),true);const map=new Map();for(const r of registry.records){let e=map.get(r.entryId);if(!e){e={...r.entryIdentity};map.set(r.entryId,e);}for(const [k,v] of Object.entries(r.entryIdentity)){if(Object.hasOwn(e,k))assert.deepEqual(e[k],v);else e[k]=v;}if(r.questionIdentity){const q=r.questionIdentity;e.items??=[];e.items[q.index]??={q:q.q,mk:q.mk,...(q.id===null?{}:{id:q.id})};}if(r.beforePresent!==false)put(e,r.path,r.before);}
 input=[...map.values()];const expected=uncached(input,registry);output=project(input,registry);assert.deepEqual(output,expected);assert.deepEqual(project(output,registry,{reverse:true}),uncached(output,registry,{reverse:true}));assert.deepEqual(project(output,registry,{reverse:true}),input);
 for(const reverse of [false,true]){const base=reverse?output:input,r=registry.records.at(-1),a=base.map(e=>e.id===r.entryId?structuredClone(e):e);put(a.find(e=>e.id===r.entryId),r.path,['stale']);assert.throws(()=>project(a,registry,{reverse}),/stale input/);}
});
test('corrupt frozen data and accessor custom-prototype proxy fixtures never gain trusted cached status',()=>{
 const last=freeze({...registry.records.at(-1),after:['corrupt']}),bad=freeze({...registry,records:[...registry.records.slice(0,-1),last]});assert.equal(eligible(bad),true);for(let i=0;i<2;i++)assert.throws(()=>project([],bad),/registry integrity/);
 let chosen=registry.records;const accessor={...registry};Object.defineProperty(accessor,'records',{enumerable:true,get(){return chosen;}});Object.freeze(accessor);assert.equal(eligible(accessor),false);missing(accessor);chosen=bad.records;assert.throws(()=>project([],accessor),/registry integrity/);
 const proto={},custom=Object.freeze(Object.assign(Object.create(proto),registry));assert.equal(eligible(custom),false);missing(custom);proto.toJSON=()=>({});assert.throws(()=>project([],custom),/registry integrity/);
 const proxy=new Proxy(registry,{});assert.equal(eligible(proxy),false);missing(proxy);
});
test('cached registry rechecks prototype toJSON and JSON stringify stability without skipping per-input absence or identity guards',()=>{
 missing(registry);for(const proto of [Object.prototype,Array.prototype]){Object.defineProperty(proto,'toJSON',{configurable:true,value(){return {};}});try{assert.equal(stableJSONIntrinsics(),false);assert.throws(()=>project([],registry),/registry integrity/);}finally{delete proto.toJSON;}}
 const stringify=JSON.stringify;JSON.stringify=()=>'';try{assert.equal(stableJSONIntrinsics(),false);assert.throws(()=>project([],registry),/registry integrity/);}finally{JSON.stringify=stringify;}
 assert.equal(stableJSONIntrinsics(),true);missing(registry);
 const absent=registry.records.find(r=>r.beforePresent===false),a=input.map(e=>e.id===absent.entryId?{...e,supplementHtml:null}:e);assert.throws(()=>project(a,registry),/stale input/);
 const qrecord=registry.records.find(r=>r.questionIdentity),b=input.map(e=>e.id===qrecord.entryId?structuredClone(e):e);b.find(e=>e.id===qrecord.entryId).items[qrecord.questionIdentity.index].q+='!';assert.throws(()=>project(b,registry),/question identity/);
 assert.equal(project(input,null,{baselineTest:true}),input);
});

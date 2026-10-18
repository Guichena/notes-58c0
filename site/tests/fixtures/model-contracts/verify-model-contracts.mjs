#!/usr/bin/env node
import {eighthLeaf,eighthHash,eighthEntry,eighthQuestion,eighthReferenceQuestion,eighthSourceHash,eighthSourceText,eighthReasoningIncludes} from '../eighth-reconciliation/verify-dependencies.mjs';
// Read-only, dependency-free verification. Fixtures model contracts, not production services.
import {approvedSeventhLeaf,assertLegacyDestination,composeSeventhEntry,composeSeventhQuestion,referenceSeventhItem,assertReviewedOriginalFile,assertModelTransitions} from '../seventh-reconciliation/verify-dependencies.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const arg=(name,def)=>{const i=process.argv.indexOf(name);return i<0?def:process.argv[i+1];};
const mode=arg('--mode','final');
assert.ok(['candidate','final'].includes(mode));
const dist=path.resolve(arg('--dist','dist'));
const read=n=>JSON.parse(fs.readFileSync(path.join(here,n),'utf8'));
const sha=x=>crypto.createHash('sha256').update(x,'utf8').digest('hex');
const recordText=fs.readFileSync(path.join(here,'records.json'),'utf8');
const pkg=JSON.parse(recordText), map=read('preservation-map.json'), baseline=read('identity-baseline.json');
const checks=[];let staged=0,alreadyApplied=0;
function check(name,fn){try{checks.push({name,status:'passed',...fn()});}catch(e){checks.push({name,status:'failed',error:e.stack||String(e)});}}
const entries=new Map();
const chapterDir=path.join(dist,'data','chapters');
for(const file of fs.readdirSync(chapterDir).filter(f=>f.endsWith('.json'))){
 const obj=JSON.parse(fs.readFileSync(path.join(chapterDir,file),'utf8'));
 for(const e of obj.entries||[]){assert.ok(!entries.has(e.id),`duplicate entry ${e.id}`);entries.set(e.id,e);}
}
function leaf(e,p){return p.reduce((v,k)=>v[k],e);}
function setLeaf(e,p,v){p.slice(0,-1).reduce((o,k)=>o[k],e)[p.at(-1)]=v;}
const originals=new Map([...entries].map(([k,v])=>[k,structuredClone(v)]));
function target(key){const at=key.lastIndexOf('#');return entries.get(key.slice(0,at)).items[Number(key.slice(at+1))].a;}
const blocks=x=>[...x.matchAll(/<(p|h2|h3|h4|li|summary)\b[^>]*>[\s\S]*?<\/\1>/g)];
const variants=x=>x.match(/<details class="qa-variants">[\s\S]*?<\/details>/)?.[0]||'';
const li=x=>[...x.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(m=>m[1]);
function htmlBalanced(s){const stack=[],voids=new Set(['br','hr','img','input','meta','link','wbr']);for(const m of s.matchAll(/<(\/?)([A-Za-z][\w-]*)\b[^>]*>/g)){const tag=m[2].toLowerCase();if(m[1])assert.equal(stack.pop(),tag);else if(!voids.has(tag)&&!m[0].endsWith('/>'))stack.push(tag);}assert.deepEqual(stack,[]);}
check('exact-eight-leaves-and-input-state',()=>{
 assertModelTransitions(entries);assert.equal(pkg.records.length,8);assert.equal(new Set(pkg.records.map(r=>r.entryId+JSON.stringify(r.path))).size,8);
 assert.deepEqual(pkg.records.map(r=>({entryId:r.entryId,path:r.path})),baseline.changedLeaves);
 for(const r of pkg.records){assert.equal(sha(r.before),r.beforeSha256);assert.equal(sha(r.after),r.afterSha256);assert.notEqual(r.before,r.after);const e=entries.get(r.entryId);assert.ok(e);const v=leaf(e,r.path);if(v===eighthLeaf(r.entryId,r.path,approvedSeventhLeaf(r))){alreadyApplied++;}else{assert.equal(mode,'candidate',`${r.entryId} ${r.path} not applied in final dist`);assert.equal(v,r.before,`before guard failed: ${r.entryId} ${r.path}`);setLeaf(e,r.path,r.after);staged++;}}
 return {leaves:8,stagedInMemory:staged,alreadyApplied,siteWrites:0};
});
check('entry-identities-indexes-and-untouched-fields',()=>{
 let items=0;for(const b of baseline.entries){const e=entries.get(b.entryId);assert.equal(e.items.length,b.itemCount);assert.deepEqual(Object.fromEntries(Object.entries(e).filter(([k])=>k!=='items')),b.entryFields);for(const item of b.itemFields){const x=e.items[item.index];assert.deepEqual(Object.fromEntries(Object.entries(x).filter(([k])=>!['a','lead'].includes(k))),eighthQuestion(b.entryId,item.index,item.fields));items++;}}
 return {entries:baseline.entries.length,itemIdentities:items};
});
check('independent-full-paragraph-destination-map',()=>{
 assert.equal(map.recordFileSha256,sha(recordText));let count=0;
 for(const m of map.maps){const rec=pkg.records.find(r=>`${r.entryId}#${r.path[1]}`===m.stableReviewKey&&r.path[2]==='a');assert.ok(rec);assert.equal(sha(rec.before),m.beforeSha256);assert.equal(sha(rec.after),m.afterSha256);const old=blocks(rec.before);assert.equal(old.length,m.sourceBlockCount);assert.equal(old.length,m.blocks.length);for(const [i,b] of m.blocks.entries()){assert.equal(b.sourceBlockIndex,i);assert.equal(old[i][0],b.sourceHtml);assert.equal(sha(b.sourceHtml),b.sourceSha256);assert.equal(Array.from(rec.before).slice(...b.sourceSpanCodePoints).join(''),b.sourceHtml);assert.ok(b.destinations.length>0);for(const d of b.destinations){assert.equal(sha(d.html),d.sha256);assertLegacyDestination(d,entries);}count++;}}
 assert.equal(count,193);return {mappedBlocks:count};
});
check('html-variants-anchors-and-routes',()=>{
 let routes=0,variantItems=0;for(const r of pkg.records){htmlBalanced(r.after);assert.ok(!/<pre\b/.test(r.after));for(const match of r.after.matchAll(/<details class="qa-variants"><summary>其他问法（(\d+)）<\/summary><ul class="md-list">([\s\S]*?)<\/ul><\/details>/g)){const count=li(match[2]).length;assert.equal(count,Number(match[1]));variantItems+=count;}
 const beforeAnchors=[...r.before.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);for(const a of beforeAnchors)assert.ok(r.after.includes(`id="${a}"`),`anchor lost ${a}`);
 for(const m of r.after.matchAll(/href="#\/e\/([^"]+)"/g)){const [id,item]=decodeURIComponent(m[1]).split('/');assert.ok(entries.has(id),`missing route ${id}`);if(item!==undefined){const xs=entries.get(id).items||[];assert.ok(/^\d+$/.test(item)?Number(item)<xs.length:xs.some(x=>x.id===item),`missing route ${m[1]}`);}routes++;}}
 const before61=read('source-model6-1.json').a,after62=target('ai-模型与评测-6#2');for(const v of li(variants(before61)))assert.ok(li(variants(after62)).includes(v));for(const key of ['4#5','4#7','3#5']){const [n,i]=key.split('#');assert.equal(variants(read(`source-model${n}-${i}.json`).a),variants(target(`ai-模型与评测-${key}`)));}for(const v of li(variants(read('source-model6-2.json').a)))assert.ok(li(variants(after62)).includes(v));
 for(const key of ['6#1','6#2','7#5']) { const html=target(`ai-模型与评测-${key}`); assert.ok(!/href="https?:/.test(html)); assert.ok(!/官方参考|参考与关联/.test(html)); }
 return {internalRoutes:routes,variantItems,originalRolloutVariantsMoved:3,originalInlineReleaseQuestionsMoved:3};
});
check('narrow-truth-fix-boundaries-and-no-broad-rewrite',()=>{
 for(const i of [5,7]){const r=pkg.records.find(r=>r.entryId==='ai-模型与评测-4'&&r.path[1]===i);const a=blocks(r.before),b=blocks(r.after);assert.equal(a.length,b.length);const diff=a.map((x,j)=>x[0]!==b[j][0]).filter(Boolean).length;assert.equal(diff,1);}
 const a=target('ai-模型与评测-4#5'),b=target('ai-模型与评测-4#7');assert.ok(!a.includes('只有经最终结果校验的中间步骤才可信'));assert.ok(a.includes('最终答案正确，不能证明每个中间步骤都正确'));assert.ok(a.includes('最终失败，也不意味着此前每一步都错误'));assert.ok(!b.includes('把它也反向更新，等于训练模型去'));assert.ok(b.includes('loss mask 不等于 detach'));assert.ok(b.includes('离散观测本身和外部工具'));
 return {changedParagraphs:2};
});
check('outcome-is-not-step-truth-fixture',()=>{
 const correctFinalWrongStep={steps:[false,true],final:true};const wrongFinalCorrectPrefix={steps:[true,false],final:false};assert.equal(correctFinalWrongStep.final,true);assert.equal(correctFinalWrongStep.steps.every(Boolean),false);assert.equal(wrongFinalCorrectPrefix.final,false);assert.equal(wrongFinalCorrectPrefix.steps.some(Boolean),true);return {counterexamples:2,scope:'Logical independence fixture; not a reward-model benchmark.'};
});
check('masked-observation-context-gradient-fixture',()=>{
 // Observation direct loss is 0, but later action loss depends on its representation u*x.
 const x=2,w=3,y=1,u=0.5;const loss=v=>(w*(v*x)-y)**2+0*(v*x)**2;const analytic=2*(w*u*x-y)*w*x;const eps=1e-6,fd=(loss(u+eps)-loss(u-eps))/(2*eps);assert.ok(Math.abs(analytic-fd)<1e-7);assert.notEqual(analytic,0);const detachedRepresentation=u*x;const detachedLoss=()=> (w*detachedRepresentation-y)**2;assert.equal((detachedLoss(u+eps)-detachedLoss(u-eps))/(2*eps),0);return {maskedContextGradient:analytic,detachedContextGradient:0,scope:'Scalar chain rule only, no Transformer training or environment differentiation claim.'};
});
class CacheFixture{
 constructor(){this.l1=new Map();this.l2=new Map();this.source=new Map();this.version=0;this.allow=true;this.trace=[];}
 valid(x,now){return x&&x.version===this.version&&x.expiresAt>now;}
 read(k,now){if(!this.allow)throw Error('permission revoked');for(const [name,c] of [['L1',this.l1],['L2',this.l2]]){this.trace.push(name);const x=c.get(k);if(this.valid(x,now)){if(name==='L2')this.l1.set(k,{...x});return x.value;}}this.trace.push('source');const value=this.source.get(k);const x={value,version:this.version,expiresAt:now+10};this.l2.set(k,x);this.l1.set(k,{...x});return value;}
 invalidate(){this.version++;this.l1.clear();this.l2.clear();}
 refill(k,x){if(x.version!==this.version)return false;this.l2.set(k,x);return true;}
}
check('two-level-read-ttl-invalidation-and-authorization-fixtures',()=>{
 const c=new CacheFixture();c.source.set('tenantA:query','fresh');assert.equal(c.read('tenantA:query',0),'fresh');assert.deepEqual(c.trace,['L1','L2','source']);c.trace=[];c.read('tenantA:query',1);assert.deepEqual(c.trace,['L1']);c.l1.clear();c.trace=[];c.read('tenantA:query',9);assert.deepEqual(c.trace,['L1','L2']);assert.equal(c.l1.get('tenantA:query').expiresAt,10);const late={value:'stale',version:c.version,expiresAt:50};c.invalidate();assert.equal(c.refill('tenantA:query',late),false);c.read('tenantA:query',11);c.allow=false;assert.throws(()=>c.read('tenantA:query',12),/permission revoked/);assert.equal(c.l1.has('tenantB:query'),false);return {scenarios:6,scope:'Sequential contract fixtures, not distributed cache or race scheduling proof.'};
});
class BudgetFixture{
 constructor(limit){this.limit=limit;this.used=0;this.reserved=0;this.calls=new Map();this.events=new Map();}
 reserve(attempt,n,priceVersion='v1'){if(this.calls.has(attempt)){assert.equal(this.calls.get(attempt).reservation,n);return false;}if(this.used+this.reserved+n>this.limit)throw Error('budget');this.calls.set(attempt,{reservation:n,held:n,state:'inflight',priceVersion,confirmed:0,usageVersion:0});this.reserved+=n;return true;}
 unknown(attempt){this.calls.get(attempt).state='unknown';}
 confirm(attempt,event,amount,version){const identity=attempt+':'+event,payload=JSON.stringify([amount,version]);if(this.events.has(identity)){assert.equal(this.events.get(identity),payload,'event conflict');return false;}const c=this.calls.get(attempt);if(version<c.usageVersion)return false;if(version===c.usageVersion){assert.equal(c.confirmed,amount,'version conflict');return false;}this.events.set(identity,payload);this.reserved-=c.held;c.held=0;this.used+=amount-c.confirmed;c.confirmed=amount;c.usageVersion=version;c.state='confirmed';return true;}
}
check('billing-attempt-dedup-unknown-and-used-plus-reserved-fixtures',()=>{
 const b=new BudgetFixture(100);b.reserve('r1:a1',60);assert.throws(()=>b.reserve('r1:a2',50),/budget/);b.unknown('r1:a1');assert.equal(b.reserved,60);assert.equal(b.used,0);b.confirm('r1:a1','event1',40,1);assert.deepEqual([b.used,b.reserved],[40,0]);assert.equal(b.confirm('r1:a1','event1',40,1),false);assert.throws(()=>b.confirm('r1:a1','event1',41,1),/event conflict/);b.reserve('r1:a2',50,'v2');assert.throws(()=>b.reserve('r2:a1',11),/budget/);b.confirm('r1:a2','event2',45,1);assert.equal(b.used,85);assert.equal(b.calls.get('r1:a1').priceVersion,'v1');assert.equal(b.calls.get('r1:a2').priceVersion,'v2');b.confirm('r1:a1','event3',42,2);assert.equal(b.used,87);assert.equal(b.confirm('r1:a1','late-v1',40,1),false);assert.equal(b.used,87);return {scenarios:9,scope:'Sequential in-memory accounting fixture. Production must implement atomic durable transactions and supplier-specific event identities.'};
});
check('actual-over-reservation-recorded-without-clamping',()=>{
 const b=new BudgetFixture(100);b.reserve('late',95);b.confirm('late','confirmed',110,1);assert.equal(b.used,110);assert.equal(b.reserved,0);assert.throws(()=>b.reserve('next',1),/budget/);return {actual:110,limit:100,subsequentAdmission:'rejected',scope:'Exposes estimation risk; does not claim estimated preflight guarantees a hard supplier charge cap.'};
});
check('kv-capacity-migration-and-rollout-conditions',()=>{
 const n=2*1*32*8192*8*128*2;assert.equal(n,2**30);const a=target('ai-模型与评测-3#5');assert.ok(a.includes('1,073,741,824'));assert.ok(a.includes('应用层开关不能把任意已训练模型等效改成 MQA'));const c=target('ai-模型与评测-6#1');assert.ok(!c.includes('2 * B * L * T'));const r=target('ai-模型与评测-6#2');assert.ok(r.includes('若同时迁移了权威数据存储位置'));assert.ok(r.includes('若只是切换模型、仍共享同一权威库'));return {rawKvBytes:n,gib:1};
});
const output={schemaVersion:1,testedAt:new Date().toISOString(),mode,dist,runtime:{node:process.version,platform:process.platform,arch:process.arch},recordsSha256:sha(recordText),verifierSha256:sha(fs.readFileSync(fileURLToPath(import.meta.url),'utf8')),checks,passed:checks.filter(c=>c.status==='passed').length,failed:checks.filter(c=>c.status==='failed').length,limitations:['Read-only artifact and small mathematical/state-machine fixtures only.','No site build, browser review, live cache, database, supplier billing, GPU or training test.','Final acceptance requires --mode final against the actual final dist.','No network fetch occurs during this portable offline verification.']};
console.log(JSON.stringify(output,null,2));if(output.failed)process.exitCode=1;

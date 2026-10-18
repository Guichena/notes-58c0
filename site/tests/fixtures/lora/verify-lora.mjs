#!/usr/bin/env node
// Dependency-free, read-only artifact checks and tiny algebra fixtures.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const arg=(name,fallback)=>{const n=process.argv.indexOf(name);return n<0?fallback:process.argv[n+1];};
const mode=arg('--mode','final');
assert.ok(['candidate','final'].includes(mode),'--mode must be candidate or final');
const dist=path.resolve(arg('--dist','dist'));
const sha=x=>crypto.createHash('sha256').update(x,'utf8').digest('hex');
const read=name=>JSON.parse(fs.readFileSync(path.join(here,name),'utf8'));
const pkgText=fs.readFileSync(path.join(here,'records.json'),'utf8');
const pkg=JSON.parse(pkgText),map=read('preservation-map.json'),baseline=read('identity-baseline.json');
const eid='ai-模型与评测-5', indices=[0,1,3,4];
const entries=new Map(), inputHashes=[];
for(const file of fs.readdirSync(path.join(dist,'data','chapters')).filter(f=>f.endsWith('.json'))){
 const text=fs.readFileSync(path.join(dist,'data','chapters',file),'utf8');
 inputHashes.push({file,sha256:sha(text)});
 for(const e of JSON.parse(text).entries||[]){assert.ok(!entries.has(e.id));entries.set(e.id,e);}
}
const checks=[];
const check=(name,fn)=>{try{checks.push({name,status:'passed',...fn()});}catch(e){checks.push({name,status:'failed',error:e.stack||String(e)});}};
const leaf=(e,p)=>p.reduce((x,k)=>x[k],e);
const setLeaf=(e,p,v)=>{p.slice(0,-1).reduce((x,k)=>x[k],e)[p.at(-1)]=v;};
const target=key=>{const p=key.lastIndexOf('#');return entries.get(key.slice(0,p)).items[Number(key.slice(p+1))].a;};
const body=i=>entries.get(eid).items[i].a;
const extractBlocks=x=>[...x.matchAll(/<(p|h2|h3|h4|li|summary)\b[^>]*>[\s\S]*?<\/\1>/g)];
const originalEntries=structuredClone([...entries]);

check('exact-eight-leaf-guards-and-package-hashes',()=>{
 assert.equal(pkg.records.length,8);
 assert.deepEqual(pkg.records.map(r=>({entryId:r.entryId,path:r.path})),baseline.changedLeaves);
 assert.deepEqual(pkg.records.map(r=>r.path),indices.flatMap(i=>[['items',i,'a'],['items',i,'lead']]));
 let staged=0,alreadyApplied=0;
 for(const r of pkg.records){
  assert.equal(r.entryId,eid);assert.equal(sha(r.before),r.beforeSha256);assert.equal(sha(r.after),r.afterSha256);assert.notEqual(r.before,r.after);
  const e=entries.get(eid),current=leaf(e,r.path);
  if(current===r.after){alreadyApplied++;continue;}
  assert.equal(mode,'candidate',`${r.path.join('.')} not applied to supplied final dist`);
  assert.equal(current,r.before,`${r.path.join('.')} before guard mismatch`);
  setLeaf(e,r.path,r.after);staged++;
 }
 return {stagedInMemory:staged,alreadyApplied,siteWrites:0};
});
check('preserve-identities-indexes-question-wording-and-other-fields',()=>{
 const e=entries.get(eid);
 assert.equal(e.items.length,baseline.itemCount);
 assert.deepEqual(Object.fromEntries(Object.entries(e).filter(([k])=>k!=='items')),baseline.entryFields);
 for(const item of baseline.itemIdentities){assert.equal(e.items[item.index].id??null,item.id);}
 for(const item of baseline.targetFields){assert.deepEqual(Object.fromEntries(Object.entries(e.items[item.index]).filter(([k])=>!['a','lead'].includes(k))),item.fields);}
 // The overlay itself is incapable of changing anything except the eight authorized leaves.
 const restored=structuredClone([...entries]);
 for(const r of pkg.records){const e=restored.find(([k])=>k===r.entryId)[1];const original=originalEntries.find(([k])=>k===r.entryId)[1];setLeaf(e,r.path,leaf(original,r.path));}
 assert.deepEqual(restored,originalEntries);
 assert.deepEqual(map.titleChanges,[]);assert.deepEqual(map.itemOrEntryIdentityChanges,[]);assert.deepEqual(map.unownedEdits,[]);
 return {entryItemCount:e.items.length,targetQuestions:4,changedTitles:0,unownedEdits:0};
});
check('complete-before-block-to-exact-destination-map',()=>{
 assert.equal(map.recordFileSha256,sha(pkgText));
 let total=0,crossQuestion=0;
 for(const m of [...map.maps,...map.leadMaps]){
  const i=Number(m.stableReviewKey.split('#').at(-1));const r=pkg.records.find(r=>r.path[1]===i&&r.path[2]===(m.field||'a'));
  assert.equal(m.beforeSha256,r.beforeSha256);assert.equal(m.afterSha256,r.afterSha256);
  const old=extractBlocks(r.before);assert.equal(old.length,m.sourceBlockCount);assert.equal(old.length,m.blocks.length);
  for(const [j,b] of m.blocks.entries()){
   assert.equal(j,b.sourceBlockIndex);assert.equal(old[j][0],b.sourceHtml);assert.equal(sha(b.sourceHtml),b.sourceSha256);
   assert.equal([...r.before].slice(...b.sourceSpanCodePoints).join(''),b.sourceHtml);assert.ok(b.destinations.length);
   for(const d of b.destinations){assert.equal(sha(d.html),d.sha256);assert.ok(target(d.stableReviewKey).includes(d.html),`missing ${d.stableReviewKey}/${d.blockLabel}`);if(d.stableReviewKey!==m.stableReviewKey)crossQuestion++;}
   total++;
  }
 }
 assert.equal(total,78);
 return {sourceBlocks:total,bodyBlocks:70,leadBlocks:8,crossQuestionDestinations:crossQuestion,scope:'Exact coverage verifies the editorial preservation map; it does not independently prove semantic equivalence.'};
});
function balanced(s){
 const stack=[],voids=new Set(['br','hr','img','input','meta','link','wbr']);
 for(const m of s.matchAll(/<(\/?)([A-Za-z][\w-]*)\b[^>]*>/g)){
  const tag=m[2].toLowerCase();
  if(m[1])assert.equal(stack.pop(),tag,`unbalanced ${tag}`);else if(!voids.has(tag)&&!m[0].endsWith('/>'))stack.push(tag);
 }
 assert.deepEqual(stack,[]);
}
check('html-balance-anchors-variants-and-existing-routes',()=>{
 let routes=0,displayVariants=0;
 for(const r of pkg.records){
  balanced(r.after);assert.ok(!/<pre\b/.test(r.after),'no code piles');
  for(const a of r.before.matchAll(/\bid="([^"]+)"/g))assert.ok(r.after.includes(`id="${a[1]}"`),`lost anchor ${a[1]}`);
  for(const d of r.after.matchAll(/<details class="qa-variants"><summary>其他问法（(\d+)）<\/summary><ul class="md-list">([\s\S]*?)<\/ul><\/details>/g)){
   const count=[...d[2].matchAll(/<li>/g)].length;assert.equal(count,Number(d[1]));displayVariants+=count;
  }
  for(const l of r.after.matchAll(/href="#\/e\/([^"]+)"/g)){
   const [id,item]=decodeURIComponent(l[1]).split('/');assert.ok(entries.has(id),`missing route ${id}`);
   if(item!==undefined){const xs=entries.get(id).items||[];assert.ok(/^\d+$/.test(item)?Number(item)<xs.length:xs.some(x=>x.id===item),`missing item ${l[1]}`);}
   routes++;
  }
 }
 assert.equal(map.variants.length,26);
 for(const v of map.variants){
  const html=target(v.destinationKey||v.sourceKey);
  for(const d of v.destinationHtml)assert.ok(html.includes(d));
  if(v.originalHtml)assert.ok(v.destinationHtml[0].includes(v.originalHtml),'original variant lost');
  for(const t of v.answerTargets){const [id,i]=t.split('#');assert.ok(entries.get(id).items[Number(i)]);}
 }
 assert.equal(displayVariants,26);
 assert.ok(body(4).includes('领域微调后通用能力衰减如何缓解（另题：<a href="#/e/ai-模型与评测-5/5">'));
 return {internalRoutes:routes,originalFoldedVariants:16,originalInlineFollowups:10,displayVariants,pissaFollowupSummary:1,compoundVariantSplit:1};
});
check('canonical-ownership-and-unique-conditions',()=>{
 const needs={
  0:['ΔW=sBA','r(d_in+d_out)&lt;d_in·d_out','rank(ΔW)≤r','r 种任务','Adam','激活','不是泛化保证','奇异值快速衰减','输出误差','全参最优更新','LayerNorm','Q/K/V/O','embedding','卷积','DoRA','AdaLoRA','rsLoRA','QLoRA'],
  1:['∂L/∂A=sBᵀG','∂L/∂B=sGAᵀ','A=B=0','Kaiming-uniform','数据驱动分解','W0=UΣVᵀ','B0=Ur√Σr','A0=√ΣrVrᵀ','Wres=W0−B0A0','Wres+sB0A0=W0','s(BA−B0A0)','不必然需要任务激活数据','工作内存','近似误差'],
  3:['不是小秩普遍最优','推理轨迹是否正确','验证集是否真正独立','labels/loss mask','目标模块是否实际命中','trainable','α/r','α/√r','同等调参预算','dropout','不同随机种子','未参与调参的保留集','选型结论只覆盖同条件实际测得的任务和配置'],
  4:['不一定要 Merge','W=W0+ΔW','实数运算中等价','不承诺逐比特相同','多','revision','反量化','重新量化','后端不支持','logits','KV/prefix cache','独立版本命名空间','不会自动修复']
 };
 for(const [i,tokens] of Object.entries(needs))for(const token of tokens)assert.ok(body(Number(i)).includes(token),`missing ${i}: ${token}`);
 assert.ok(!body(0).includes('Wres='),'PiSSA derivation belongs to initialization question');
 assert.ok(!body(0).includes('∂L/'),'gradient derivation belongs to initialization question');
 assert.ok(!body(0).includes('重新量化'),'merge/quantization procedure belongs to deployment question');
 assert.ok(!body(1).includes('r(d_in+d_out)'),'do not reprint mechanism budget formula in initialization');
 assert.ok(!body(3).includes('Wres='),'rank selection should link to PiSSA initialization');
 assert.equal((body(0).match(/Adam/g)||[]).length,1);
 return {canonicalQuestions:4,requiredUniqueConditions:Object.values(needs).flat().length};
});

// Matrix helpers for tiny deterministic examples. These do not train any model.
const mm=(a,b)=>a.map(row=>b[0].map((_,j)=>row.reduce((sum,x,k)=>sum+x*b[k][j],0)));
const tr=a=>a[0].map((_,j)=>a.map(r=>r[j]));
const scale=(a,s)=>a.map(r=>r.map(x=>x*s));
const add=(a,b)=>a.map((r,i)=>r.map((x,j)=>x+b[i][j]));
const sub=(a,b)=>add(a,scale(b,-1));
const norm=a=>Math.hypot(...a.flat());
const near=(a,b,eps=1e-9)=>assert.ok(norm(sub(a,b))<eps,`${JSON.stringify(a)} != ${JSON.stringify(b)}`);
const W0=[[3,1],[0,2]],A=[[0.4,-0.2]],B=[[0.3],[-0.5]],s=2,x=[[2],[-1]],y=[[1],[0.5]];
const output=(a,b)=>add(mm(W0,x),scale(mm(mm(b,a),x),s));
const loss=(a,b)=>norm(sub(output(a,b),y))**2/2;
const grads=(a,b)=>{const G=mm(sub(output(a,b),y),tr(x));return {a:scale(mm(tr(b),G),s),b:scale(mm(G,tr(a)),s)};};

check('factor-shape-parameter-budget-and-forward-merge-fixtures',()=>{
 near(output(A,B),mm(add(W0,scale(mm(B,A),s)),x));
 const lowrank=4*(64+32),full=64*32,large=32*(64+32);
 assert.equal(lowrank,384);assert.equal(full,2048);assert.ok(lowrank<full);assert.ok(large>full);
 const dw=scale(mm(B,A),s),w=add(W0,dw),det=m=>m[0][0]*m[1][1]-m[0][1]*m[1][0];
 assert.ok(Math.abs(det(dw))<1e-12);assert.ok(Math.abs(det(w))>1e-3);
 return {lowRankParameters:lowrank,fullParameters:full,oversizedRankParameters:large,updateRank:1,mergedRank:2,scope:'Two-dimensional algebra and parameter counts only.'};
});
check('analytic-gradients-finite-differences-and-zero-initialization',()=>{
 const g=grads(A,B),eps=1e-6;let compared=0;
 for(const key of ['a','b']){const input=key==='a'?A:B;for(let i=0;i<input.length;i++)for(let j=0;j<input[0].length;j++){
  const plus=structuredClone(input),minus=structuredClone(input);plus[i][j]+=eps;minus[i][j]-=eps;
  const fd=key==='a'?(loss(plus,B)-loss(minus,B))/(2*eps):(loss(A,plus)-loss(A,minus))/(2*eps);
  assert.ok(Math.abs(fd-g[key][i][j])<1e-7);compared++;
 }}
 const zeroA=[[0,0]],zeroB=[[0],[0]],oneZero=grads(A,zeroB),bothZero=grads(zeroA,zeroB);
 near(output(A,zeroB),mm(W0,x));assert.equal(norm(oneZero.a),0);assert.ok(norm(oneZero.b)>0);
 assert.equal(norm(bothZero.a),0);assert.equal(norm(bothZero.b),0);
 const updatedB=add(zeroB,scale(oneZero.b,-0.01));assert.ok(norm(grads(A,updatedB).a)>0);
 return {finiteDifferenceCoordinates:compared,oneZero:'B can learn first; A gets signal after B changes',doubleZero:'both task gradients zero',scope:'Standard bilinear branch and squared-error toy loss, no regularization or special optimizer.'};
});
check('pissa-residual-scaling-and-original-base-conversion',()=>{
 // For diag(9,4), the first singular component is diag(9,0).
 const base=[[9,0],[0,4]],b0=[[3],[0]],a0=[[3,0]],component=mm(b0,a0),residual=sub(base,component);
 near(add(residual,component),base);
 assert.ok(norm(sub(add(base,component),base))>1,'loading the principal component on original base must fail');
 const explicitS=4,scaledB0=scale(b0,1/Math.sqrt(explicitS)),scaledA0=scale(a0,1/Math.sqrt(explicitS));
 near(add(residual,scale(mm(scaledB0,scaledA0),explicitS)),base);
 const trainedB=add(scaledB0,[[0.1],[0.2]]),trainedA=add(scaledA0,[[0.2,-0.1]]);
 const trained=add(residual,scale(mm(trainedB,trainedA),explicitS));
 const delta=scale(sub(mm(trainedB,trainedA),mm(scaledB0,scaledA0)),explicitS);
 near(add(base,delta),trained);
 assert.ok(norm(sub(add(base,scale(mm(trainedB,trainedA),explicitS)),trained))>1);
 return {identityCases:3,wrongBaseCounterexamples:2,scope:'Known diagonal SVD and scalar-scale identities; not a PiSSA implementation, training or approximation-quality benchmark.'};
});
check('rank-scaling-and-quantized-merge-counterexamples',()=>{
 const alpha=16,r1=8,r2=16;assert.equal(alpha/r1,2);assert.equal(alpha/r2,1);assert.notEqual(alpha/r1,alpha/r2);
 assert.equal((2*r1)/r1,(2*r2)/r2);
 // A deliberately coarse rounding quantizer shows why real arithmetic equivalence is insufficient.
 const quantize=x=>Math.round(x),base=1,delta=0.4;
 assert.notEqual(quantize(base+delta),quantize(base)+delta);
 return {fixedAlphaChangesScale:true,quantizationCounterexample:{mergedQuantized:quantize(base+delta),unmerged:quantize(base)+delta},scope:'Illustrative rounding only; does not model any production quantizer.'};
});
check('source-documentation-and-read-only-input-stability',()=>{
 const refs=read('technical-refs.json');assert.equal(refs.sources.length,4);
 for(const s of refs.sources)assert.ok(/^https:\/\/(arxiv\.org|huggingface\.co)\//.test(s.url));
 for(const input of inputHashes){assert.equal(sha(fs.readFileSync(path.join(dist,'data','chapters',input.file),'utf8')),input.sha256,`input changed during verification: ${input.file}`);}
 return {primarySourceRecords:4,chapterFilesRead:inputHashes.length,siteWrites:0,networkRequests:0};
});

const result={schemaVersion:1,testedAt:new Date().toISOString(),mode,dist,runtime:{node:process.version,platform:process.platform,arch:process.arch},
 recordsSha256:sha(pkgText),verifierSha256:sha(fs.readFileSync(fileURLToPath(import.meta.url),'utf8')),checks,
 passed:checks.filter(c=>c.status==='passed').length,failed:checks.filter(c=>c.status==='failed').length,
 limitations:['Candidate mode overlays only authorized leaves in memory. Final mode requires these exact leaves already present in the supplied actual dist.',
 'No build, browser rendering, GPU, real model, training, performance or serving-cache tests are performed.',
 'Paragraph maps and required-condition checks support the full editorial reading; they are not a machine proof of semantic equivalence.']};
console.log(JSON.stringify(result,null,2));
if(result.failed)process.exitCode=1;

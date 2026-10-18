#!/usr/bin/env node
const NINTH_ORIGINAL_URL=new URL("../../../../../model-contracts/verify-sixth-reconciliation.mjs",import.meta.url);
import {ninthLeaf,ninthHash,ninthEntry,ninthQuestion,ninthReferenceQuestion,ninthReferenceEntry,ninthIncludes,ninthFragment,ninthSubstantiveIncludes,ninthSourceText,ninthSourceHash,ninthRegistryBefore,ninthEntryHash,ninthKeyIncludes,ninthKeyHash,ninthKeyFragment,ninthKeyQuestion} from '../../../../verify-reference.mjs';
import {eighthLeaf,eighthHash,eighthEntry,eighthQuestion,eighthReferenceQuestion,eighthSourceHash,eighthSourceText,eighthReasoningIncludes} from '../eighth-reconciliation/verify-dependencies.mjs';
// Additive, read-only final-dist guard. All eleven original model-contract oracles remain byte-for-byte unchanged.
import {approvedSeventhLeaf,assertLegacyDestination,composeSeventhEntry,composeSeventhQuestion,referenceSeventhItem,assertReviewedOriginalFile,assertModelTransitions} from '../seventh-reconciliation/verify-dependencies.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(NINTH_ORIGINAL_URL));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const read=n=>JSON.parse(fs.readFileSync(path.join(here,n),'utf8'));
const proofFile='sixth-reconciliation/migration-proof.json';
const proofSha='3f6fb65b9ff52de8dba045b96b11c23353aa52b4fda09689ae32840d054b84b1';
const pkgNames=['integration-parallel-quantization','integration-model-comparison-metrics'];
const source=(pkg,n)=>read(`sixth-reconciliation/${pkg}/${n}`);
const leaf=(o,p)=>p.reduce((v,k)=>v[k],o);
function setLeaf(o,p,v){p.slice(0,-1).reduce((v,k)=>v[k],o)[p.at(-1)]=v;}
const fields=o=>Object.fromEntries(Object.entries(o).filter(([k])=>!['a','lead'].includes(k)));
const plain=s=>s.replace(/<[^>]*>/g,'').replaceAll('&gt;','>').replaceAll('&lt;','<').replaceAll('&amp;','&');
const blocks=s=>[...s.matchAll(/<(p|h[1-6]|li|th|td|summary)\b[^>]*>[\s\S]*?<\/\1>/g)];
export const names=[
 'original fixtures, eleven-oracle verifier and wrapper are unchanged',
 'all historical baseline differences have exact pre-sixth provenance',
 'four legacy entries retain all forty complete question objects',
 'ten sixth-batch leaves retain exact guarded whole-object transitions',
 'six appended objects and prior math dependency remain exact',
 'all 301 migrated source blocks retain substantive or exact archive evidence',
 'all eleven reused canonical question objects retain their complete bodies',
 'all 48 original variants and source anchors remain traceable',
 'old eight leaves and 193 original destinations retain all prior contracts',
];
export function verify(dist){
 const checks=[],errors=[];const check=(name,fn)=>{try{checks.push({name,status:'passed',...fn()});}catch(e){checks.push({name,status:'failed',error:e.message});errors.push(name+': '+e.message);}};
 const proof=read(proofFile),base=read('identity-baseline.json'),E=new Map();
 for(const f of fs.readdirSync(path.join(dist,'data/chapters')).filter(f=>f.endsWith('.json'))){
  for(const e of JSON.parse(fs.readFileSync(path.join(dist,'data/chapters',f),'utf8')).entries||[]){assert.ok(!E.has(e.id),'duplicate entry '+e.id);E.set(e.id,e);}
 }
 const get=key=>{const at=key.lastIndexOf('#'),eid=key.slice(0,at),q=key.slice(at+1),e=E.get(eid);assert.ok(e,'missing entry '+eid);const it=e.items?.find((x,i)=>String(x.id??i)===q);assert.ok(it,'missing question '+key);return it;};
 const oldItem=(eid,index)=>proof.mutationBeforeObjects.find(x=>x.entryId===eid&&x.index===index)?.item;
 const dest=d=>{assert.equal(sha(d.html),d.sha256);assert.match(d.html,/<p\b/,'title-only destination '+d.stableReviewKey);for(const f of d.fragments||[d.html])assert.ok(ninthKeyIncludes(E,d.stableReviewKey,f),'missing substantive destination '+d.stableReviewKey+' '+d.section);};
 check(names[0],()=>{
  assert.equal(sha(fs.readFileSync(path.join(here,proofFile))),proofSha,'migration proof changed without review');
  assert.equal(Object.keys(proof.originalFixtures).length,9);
  for(const [n,h] of Object.entries(proof.originalFixtures))assertReviewedOriginalFile('tests/fixtures/model-contracts/'+n,h);
  assertReviewedOriginalFile('tests/final-model-contracts.test.mjs',proof.originalWrapper.sha256);assertModelTransitions(E);
  for(const [n,h] of Object.entries(proof.sourceEvidenceFiles))assert.equal(sha(fs.readFileSync(path.join(here,n))),h,'source evidence changed '+n);
  assert.equal(proof.proposalReconciliation.wholeFileProposalIsStale,true);
  assert.equal(proof.proposalReconciliation.applyOriginalProposal,false);
  assert.equal(proof.proposalReconciliation.records.length,4);
  for(const r of proof.proposalReconciliation.records){assert.deepEqual(leaf(base,r.jsonPath),r.before);const m=proof.mutations.find(x=>x.entryId+'#'+x.path[1]===r.targetKey&&JSON.stringify(x.path)===JSON.stringify(r.sourcePath));assert.ok(m);assert.equal(r.after,r.jsonPath.at(-1)==='aSha256'?m.afterSha256:m.after);}
  return {originalFixtures:9,originalOracles:11,sourceEvidenceFiles:21,staleWholeFileProposalRejected:true};
 });
 check(names[1],()=>{
  let identities=0,transitions=0;assert.equal(proof.historicalPreSixthMigrations.length,29);
  for(const b of base.entries){const e=proof.protectedPreSixthEntries.find(x=>x.id===b.entryId);assert.ok(e);assert.equal(e.items.length,b.itemCount);assert.deepEqual(Object.fromEntries(Object.entries(e).filter(([k])=>k!=='items')),b.entryFields);
   for(const bi of b.itemFields){const it=e.items[bi.index];assert.deepEqual(fields(it),bi.fields);for(const field of ['a','lead']){const before=field==='a'?(bi.aSha256??null):('lead'in bi?sha(bi.lead):null),after=sha(it[field]);if(before!==after){const rows=proof.historicalPreSixthMigrations.filter(r=>r.entryId===b.entryId&&JSON.stringify(r.path)===JSON.stringify(['items',bi.index,field]));assert.equal(rows.length,1);const row=rows[0],r=row.sourceRecord;assert.equal(row.originalBaselineSha256,before);assert.equal(row.preSixthSha256,after);if(before===null){assert.equal(row.kind,'previously-approved-whole-question-append');assert.deepEqual(r.expectedItem,it);}else{assert.equal(row.kind,'previously-approved-leaf');assert.equal(r.beforeSha256??r.currentSha256,before);if('before'in r)assert.equal(sha(r.before),before);assert.equal(r.after,it[field]);assert.equal(r.afterSha256,after);}transitions++;}identities++;}}
  }
  assert.equal(identities,80);assert.equal(transitions,29);return {baselineAnswerAndLeadIdentities:80,explainedHistoricalTransitions:29,legacyHashesReplaced:0};
 });
 check(names[2],()=>{
  assert.equal(proof.protectedPreSixthEntries.length,4);let objects=0,leaves=0;
  for(const old of proof.protectedPreSixthEntries){const expected=structuredClone(old);for(const r of proof.mutations.filter(r=>r.entryId===old.id)){assert.equal(leaf(expected,r.path),r.before);setLeaf(expected,r.path,r.after);leaves++;}assert.deepEqual(E.get(old.id),eighthEntry(composeSeventhEntry(expected)),old.id+' complete object changed outside explicitly proved seventh leaves');objects+=old.items.length;}
  assert.equal(objects,40);assert.equal(leaves,5);return {completeQuestionObjects:40,preciseMutatedLeaves:5,unchangedCompleteQuestions:37};
 });
 check(names[3],()=>{
  assert.equal(proof.mutations.length,10);assert.equal(proof.mutationBeforeObjects.length,7);assert.equal(new Set(proof.mutations.map(r=>r.entryId+JSON.stringify(r.path))).size,10);
  for(const pkg of pkgNames){const rs=source(pkg,'records.json').records;assert.deepEqual(proof.mutations.filter(r=>r.package===pkg).map(({package:owner,...r})=>r),rs);}
  for(const b of proof.mutationBeforeObjects){const expected=structuredClone(b.item);for(const r of proof.mutations.filter(x=>x.entryId===b.entryId&&x.path[1]===b.index)){assert.equal(r.path[0],'items');assert.equal(r.path.length,3);assert.equal(expected[r.path[2]],r.before);assert.equal(sha(r.before),r.beforeSha256);assert.equal(sha(r.after),r.afterSha256);assert.notEqual(r.before,r.after);if(r.mode==='exact-old-prefix-plus-append'){assert.ok(r.after.startsWith(r.before));assert.ok(r.after.length>r.before.length);}expected[r.path[2]]=r.after;}assert.deepEqual(E.get(b.entryId)?.items[b.index],expected,b.entryId+'#'+b.index+' guarded whole object mismatch');}
  return {appliedLeaves:10,completeTransitionObjects:7,exactOldPrefixExtensions:4,stagedInMemory:0,siteWrites:0};
 });
 check(names[4],()=>{
  assert.equal(proof.appends.length,6);
  for(const a of proof.appends){assert.equal(sha(a.expectedItem.a),a.afterSha256);if(a.expectedItemSha256)assert.equal(sha(JSON.stringify(a.expectedItem)),a.expectedItemSha256);assert.equal(a.expectedItem.id,a.questionId);assert.deepEqual(E.get(a.entryId)?.items[a.expectedIndex],a.expectedItem,'whole appended object '+a.questionId);}
  const dep=source(pkgNames[1],'composite-dependency.json');assert.equal(sha(JSON.stringify(dep.expectedItem)),dep.expectedItemSha256);assert.deepEqual(E.get(dep.entryId)?.items[dep.index],dep.expectedItem);
  return {wholeAppendedObjects:6,existingCompositeDependency:1};
 });
 check(names[5],()=>{
  let mapped=0,archived=0;
  const pmap=source(pkgNames[0],'preservation-map.json'),parchive=source(pkgNames[0],'out-of-scope-original-archive.json'),extension=source(pkgNames[0],'archive-extension-proposal.json');
  assert.equal(pmap.blocks.length,193);assert.equal(parchive.records.length,3);
  assert.equal(sha(extension.before),extension.beforeSha256);assert.equal(sha(extension.after),extension.afterSha256);assert.equal(sha(extension.insertedHtml),extension.insertedSha256);
  const chars=Array.from(extension.before),at=extension.insertionOffsetCodePoints;assert.equal(extension.after,chars.slice(0,at).join('')+extension.insertedHtml+chars.slice(at).join(''));
  assert.equal(fs.readFileSync(path.join(dist,extension.distRelativePath),'utf8'),extension.after,'complete shared robot archive extension missing');
  for(const i of [6,7]){const before=oldItem('ai-模型与评测-3',i).a,bs=blocks(before),rows=pmap.blocks.filter(b=>b.sourceKey==='ai-模型与评测-3#'+i);assert.equal(bs.length,rows.length);for(const [j,b] of rows.entries()){assert.equal(b.index,j);assert.equal(b.html,bs[j][0]);assert.equal(sha(b.html),b.sha256);assert.equal(Array.from(before).slice(...b.sourceSpanCodePoints).join(''),b.html);assert.ok(b.destinations.length);for(const d of b.destinations)dest(d);if(b.disposition!=='mapped'){const ar=parchive.records.find(x=>x.sourceBlockIndex===j);assert.ok(ar);assert.equal(ar.html,b.html);assert.equal(sha(ar.html),ar.sha256);const w=proof.parallelArchiveWitnesses.find(x=>x.sourceBlockIndex===j);assert.ok(w);assert.equal(w.sourceHtml,ar.html);assert.equal(w.sourceSha256,ar.sha256);assert.equal(sha(w.archiveHtml),w.archiveSha256);if(j===68){assert.equal(w.kind,'exact-question-wrapper-migration');assert.equal(w.sourceHtml,'<li>VLA 边端部署的硬件选型</li>');assert.equal(w.archiveHtml,'<p>原问法：VLA 边端部署的硬件选型</p>');assert.equal(w.publicVariantHtml,'<li><a href="#/e/own-theory-serving/q-model-edge-acceptance">VLA 边端部署的硬件选型</a></li>');assert.equal(sha(w.publicVariantHtml),w.publicVariantSha256);assert.ok(get('ai-模型与评测-3#7').a.includes(w.publicVariantHtml),'exact linked public variant changed');}else{assert.equal(w.kind,'verbatim-html');assert.equal(w.archiveHtml,ar.html);}assert.ok(extension.after.includes(w.archiveHtml));archived++;}mapped++;}}
  const mmap=source(pkgNames[1],'preservation-map.json'),marchive=source(pkgNames[1],'out-of-scope-original-archive.json'),before=oldItem('ai-模型与评测-2',1).a,bs=blocks(before);
  assert.equal(mmap.blocks.length,108);assert.equal(bs.length,108);assert.equal(marchive.records.length,9);assert.equal(sha(before),mmap.beforeSha256);assert.deepEqual(marchive.originalQuestionObject,oldItem('ai-模型与评测-2',1));
  for(const [j,b] of mmap.blocks.entries()){assert.equal(b.sourceBlockIndex,j);assert.equal(b.sourceHtml,bs[j][0]);assert.equal(sha(b.sourceHtml),b.sourceSha256);assert.equal(before.slice(...b.sourceSpanCodeUnits),b.sourceHtml);if(b.archiveId!==null){const ar=marchive.records.find(x=>x.sourceBlockIndex===b.archiveId);assert.ok(ar);assert.equal(ar.originalHtml,b.sourceHtml);assert.equal(sha(ar.originalHtml),ar.sha256);archived++;}assert.ok(b.destinations.length||b.disposition==='archive');for(const d of b.destinations)dest(d);mapped++;}
  assert.equal(mapped,301);assert.equal(archived,12);return {sourceBlocks:301,exactArchivedSourceBlocks:12,completeSharedArchiveFiles:1};
 });
 check(names[6],()=>{
  assert.equal(proof.canonicalWholeObjects.length,11);for(const x of proof.canonicalWholeObjects)assert.deepEqual(E.get(x.entryId)?.items[x.index],eighthQuestion(x.entryId,x.index,composeSeventhQuestion(x.key,x.item)),'canonical whole question changed '+x.key);
  const p=source(pkgNames[0],'canonical-coverage.json');let fragments=0;for(const r of p.reuse){assert.equal(sha(r.html),r.sha256);for(const f of r.fragments||[r.html]){assert.ok(get(r.stableReviewKey).a.includes(f),'canonical body missing '+r.stableReviewKey);fragments++;}}
  const m=source(pkgNames[1],'canonical-coverage.json');for(const r of m.candidates){const [eid,q]=r.key.split('#');const change=proof.mutationBeforeObjects.find(b=>b.entryId===eid&&String(b.item.id??b.index)===q);const current=get(r.key),currentIndex=E.get(eid).items.indexOf(current),old=change?.item??referenceSeventhItem(r.key,eighthReferenceQuestion(eid,currentIndex,current));assert.equal(sha(old.a),r.bodySha256,'canonical original body mismatch '+r.key);}
  return {canonicalCompleteObjects:11,parallelCanonicalFragments:fragments,metricsCanonicalBodies:9};
 });
 check(names[7],()=>{
  let count=0,anchors=0;for(const [pkg,expected] of [[pkgNames[0],23],[pkgNames[1],25]]){const vs=source(pkg,'variant-map.json');assert.equal(vs.variants.length,expected);const ar=source(pkg,'out-of-scope-original-archive.json');for(const v of vs.variants){const key=v.sourceKey??'ai-模型与评测-2#1',r=proof.mutations.find(r=>r.entryId+'#'+r.path[1]===key&&r.path[2]==='a');assert.ok(r.before.includes(v.originalHtml));assert.equal(sha(v.originalHtml),v.sha256);if(v.disposition==='archive'){assert.equal(ar.records.find(x=>x.sourceBlockIndex===v.archiveId)?.originalHtml,v.originalHtml);}else{assert.ok(plain(get(key).a).includes(v.originalText),'original variant lost '+v.originalText);for(const d of v.destinations)dest(d);}count++;}}
  for(const r of proof.mutations.filter(r=>r.path[2]==='a'))for(const m of r.before.matchAll(/\bid="([^"]+)"/g)){assert.ok(r.after.includes(`id="${m[1]}"`),'original anchor lost '+m[1]);anchors++;}
  assert.equal(count,48);return {variants:48,originalAnchors:anchors};
 });
 check(names[8],()=>{
  const rs=read('records.json').records,map=read('preservation-map.json');assert.equal(rs.length,8);let destinations=0,sourceBlocks=0;
  for(const r of rs){assert.equal(leaf(E.get(r.entryId),r.path),approvedSeventhLeaf(r),'old model-contract applied leaf changed outside approved transition');assert.equal(sha(r.before),r.beforeSha256);assert.equal(sha(r.after),r.afterSha256);}
  for(const row of map.maps)for(const b of row.blocks){assert.equal(sha(b.sourceHtml),b.sourceSha256);for(const d of b.destinations){assert.equal(sha(d.html),d.sha256);assertLegacyDestination(d,E);destinations++;}sourceBlocks++;}
  assert.equal(sourceBlocks,193);return {originalAppliedLeaves:8,originalSourceBlocks:193,originalDestinationWitnesses:destinations};
 });
 return {schemaVersion:1,mode:'actual-final-dist-only',dist:path.resolve(dist),checks,passed:checks.filter(x=>x.status==='passed').length,failed:errors.length,errors,stagedInMemory:0,siteWrites:0,proofSha256:sha(fs.readFileSync(path.join(here,proofFile))),limitations:['Additional read-only artifact proof; original eleven semantic oracles remain separately required.','No build, browser, GPU or live runtime execution.']};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 assert.equal(process.argv.length,4,'Only --dist PATH is supported');assert.equal(process.argv[2],'--dist','Explicit final dist is required');
 try{const result=verify(path.resolve(process.argv[3]));console.log(JSON.stringify(result,null,2));if(result.failed)process.exitCode=1;}catch(e){console.error(e.stack);process.exitCode=1;}
}

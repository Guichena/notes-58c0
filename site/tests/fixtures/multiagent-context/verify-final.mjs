import {physical,assertPhysicalBody,physicalWitness,physicalPrefix} from '../agent-workflow/verify-phase4-physical-repair.mjs';
import {eighthLeaf} from '../eighth-reconciliation/verify-dependencies.mjs';
import {assertFrameworkDestination} from '../seventh-reconciliation/verify-dependencies.mjs';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const sha=s=>createHash('sha256').update(s).digest('hex');
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const blocks=s=>[...s.matchAll(/<(p|h2|h3|h4|li|summary|pre|tr)\b[^>]*>[\s\S]*?<\/\1>/g)].map(m=>m[0]);
const access=(object,path)=>path.reduce((o,k)=>o?.[k],object);
export async function verifyFinal({dist,fixtures}){
 assert.ok(dist&&fixtures,'Explicit actual dist and fixtures are required.');
 const records=(await read(join(fixtures,'records.json'))).records;
 const maps=(await read(join(fixtures,'paragraph-destinations.json'))).maps;
 const variants=(await read(join(fixtures,'variant-destinations.json'))).variants;
 const identities=(await read(join(fixtures,'identity-baseline.json'))).items;
 const prefixes=(await read(join(fixtures,'original-question-identities.json'))).entries;
 const expectedNew=await read(join(fixtures,'compiled-new-entry.json'));
 const deps=await read(join(fixtures,'dependencies.json'));
 const all=new Map(),catalog=await read(join(dist,'data/catalog.json'));
 for(const f of await readdir(join(dist,'data/chapters'))){if(!f.endsWith('.json'))continue;for(const e of (await read(join(dist,'data/chapters',f))).entries){assert.ok(!all.has(e.id),'Duplicate route '+e.id);all.set(e.id,e);}}
 const allowed=new Set(['ai-agent-5:1','ai-agent-5:4','ai-agent-5:3','doc-17:null','own-agent-runtime-design:4','own-juc-contexts:2','ai-agent-6:14']);
 assert.equal(records.length,7);assert.equal(new Set(records.map(r=>r.entryId+':'+r.itemIndex)).size,7);
 const item=(id,i)=>{const it=all.get(id)?.items?.[i];assert.ok(it,'Missing question '+id+'/'+i);return it;};
 const body=(id,i)=>i===null?all.get(id)?.html:item(id,i).a;
 assertPhysicalBody(body('ai-agent-5',3));
 for(const r of records){
  assert.ok(allowed.has(r.entryId+':'+r.itemIndex),'Unapproved field');
  assert.deepEqual(r.path,r.itemIndex===null?['html']:['items',r.itemIndex,'a']);
  assert.equal(sha(r.before),r.beforeSha256);assert.equal(sha(r.after),r.afterSha256);
  const actual=access(all.get(r.entryId),r.path);
  assert.ok(actual===eighthLeaf(r.entryId,r.path,r.entryId==='ai-agent-5'&&r.itemIndex===3?(assert.equal(r.after,physical.beforeBody),physical.afterBody):r.after),'UNAPPLIED_OR_CHANGED '+r.entryId+'/'+r.itemIndex);
  if(r.itemIndex!==null){const it=item(r.entryId,r.itemIndex);assert.equal(it.q,r.questionGuard);assert.equal(it.id??null,r.questionId??null);assert.equal(sha(r.questionGuard),r.questionSha256);}
  if(r.mode==='append-only-unique-detail')assert.ok(r.after.startsWith(r.before),'Canonical prefix changed');
  for(const m of r.before.matchAll(/\bid="([^"]+)"/g))assert.ok(r.after.includes('id="'+m[1]+'"'),'Original anchor lost '+m[1]);
  if(r.entryId==='ai-agent-5'&&[1,4].includes(r.itemIndex))assert.doesNotMatch(r.after,/<pre\b|<table\b/,'Conceptual answer became code/table');
 }
 const actualNew=all.get(expectedNew.id);assert.ok(actualNew,'Missing scenario entry');
 for(const [k,v]of Object.entries(expectedNew))if(k!=='items')assert.deepEqual(actualNew[k],v,'Scenario entry metadata changed');
 assert.ok(actualNew.items.length>=expectedNew.items.length,'Owned scenario prefix missing');
 assert.deepEqual(actualNew.items.slice(0,expectedNew.items.length),expectedNew.items,'Owned scenario prefix changed');
 assert.equal(expectedNew.items.length,4);assert.equal(new Set(expectedNew.items.map(x=>x.id)).size,4);
 for(const x of identities){const target=x.itemIndex===null?all.get(x.entryId):item(x.entryId,x.itemIndex);for(const [k,v] of Object.entries(x.unchangedFields))assert.deepEqual(target[k],v,'Metadata changed '+x.entryId+'/'+x.itemIndex+':'+k);}
 for(const e of prefixes){const actual=all.get(e.entryId);assert.ok(actual);for(const q of e.questions){const it=item(e.entryId,q.itemIndex);assert.equal(it.q,q.q,'Original question moved');assert.equal(it.id??null,q.id);}}
 const dest=d=>{assert.equal(sha(d.html),d.sha256);if(assertFrameworkDestination(d,all))return;assert.ok(body(d.entryId,d.itemIndex)?.includes(physicalWitness(d.entryId,d.itemIndex,d.html)),'Missing substantive destination '+d.key+' '+d.entryId+'/'+d.itemIndex);};
 assert.equal(maps.length,326);assert.equal(variants.length,156);
 for(const i of [1,4]){
  const r=records.find(r=>r.entryId==='ai-agent-5'&&r.itemIndex===i),bs=blocks(r.before),rows=maps.filter(m=>m.sourceItemIndex===i);
  assert.equal(rows.length,bs.length);assert.deepEqual([...rows.map(x=>x.sourceBlockIndex)].sort((a,b)=>a-b),bs.map((_,j)=>j));
  for(const m of rows){assert.equal(m.sourceEntryId,'ai-agent-5');assert.equal(m.sourceHtml,bs[m.sourceBlockIndex]);assert.equal(sha(m.sourceHtml),m.sourceSha256);assert.ok(m.destinations.length);m.destinations.forEach(dest);}
 }
 for(const v of variants){const r=records.find(r=>r.entryId===v.sourceEntryId&&r.itemIndex===v.sourceItemIndex);assert.equal(blocks(r.before)[v.sourceBlockIndex],v.sourceHtml);assert.equal(sha(v.sourceHtml),v.sourceSha256);assert.equal(v.retainedDestination.html,v.sourceHtml);dest(v.retainedDestination);assert.ok(v.semanticDestinations.length);for(const d of v.semanticDestinations){assert.match(d.html,/^<p\b/,'Variant must have a substantive prose destination');assert.ok(d.html.replace(/<[^>]*>/g,'').length>40,'Bare link is not coverage');dest(d);}}
 const foundation=await read(join(fixtures,'foundation-reconciliation.json'));
 assert.equal(foundation.oldRoleWitnessMappings.length,57);assert.equal(foundation.foundationSourceMappings.length,14);
 const roleBefore=records.find(r=>r.entryId==='ai-agent-5'&&r.itemIndex===1).before;
 for(const w of foundation.oldRoleWitnessMappings){assert.equal(sha(w.oldWitness),w.oldWitnessSha256);assert.equal(sha(w.originalBlockHtml),w.originalBlockSha256);assert.equal(blocks(roleBefore)[w.sourceBlockIndex],w.originalBlockHtml);w.newSubstantiveDestinations.forEach(dest);}
 for(const row of foundation.foundationSourceMappings){assert.equal(row.replaceOnlyDestinationKey,'roles');assert.ok(row.oldSourceRow.destinationKeys.includes('roles'));assert.deepEqual(row.preserveOtherDestinationKeys,row.oldSourceRow.destinationKeys.filter(k=>k!=='roles'));row.newSubstantiveDestinations.forEach(dest);}
 const sp=foundation.specializedGeneralAppend,spRecord=records.find(r=>r.entryId==='own-agent-runtime-design'&&r.itemIndex===4);assert.deepEqual(sp.guardedRecord,spRecord);assert.equal(sp.prefixProof.beforeSha256,spRecord.beforeSha256);assert.equal(sp.prefixProof.afterPrefixSha256,spRecord.beforeSha256);assert.ok(sp.oldWitnessesPreserved.every(w=>w.retainedInFinal));
 const workflow=await read(join(fixtures,'workflow-after-reconciliation.json')),post=records.find(r=>r.entryId==='ai-agent-5'&&r.itemIndex===3);
 assert.equal(workflow.originalGuardedRecord.after,post.before);assert.equal(workflow.proposedFinalAfter,post.after);assert.equal(workflow.fullPrefixProof.oldSha256,post.beforeSha256);assert.equal(workflow.fullPrefixProof.finalPrefixSha256,post.beforeSha256);assert.equal(post.after,post.before+workflow.exactAppendixHtml);assert.equal(sha(workflow.exactAppendixHtml),workflow.appendixSha256);
 deps.requiredFinalWitnesses.forEach(dest);
 for(const dep of deps.requiredBefore){assert.equal(sha(dep.after),dep.afterSha256);const r=records.find(r=>r.entryId===dep.entryId&&r.itemIndex===dep.itemIndex);assert.equal(r.before,dep.after,'Post-dependency guard changed');assert.ok(body(dep.entryId,dep.itemIndex).startsWith(physicalPrefix(dep.entryId,dep.itemIndex,dep.after)),'Final dependency prefix absent');}
 const changed=[...records.map(r=>({entryId:r.entryId,html:r.after})),...expectedNew.items.map(x=>({entryId:expectedNew.id,html:x.a}))];
 for(const {entryId,html} of changed){
  assert.ok(catalog.entries.some(e=>e.id===entryId),'Missing catalog route '+entryId);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size,'Duplicate HTML anchors');
  for(const m of html.matchAll(/href="#\/e\/([^"/]+)(?:\/([^"]+))?"/g)){const id=decodeURIComponent(m[1]),e=all.get(id);assert.ok(e||catalog.archivedRoutes?.[id],'Broken entry route '+id);if(m[2]&&e){const q=decodeURIComponent(m[2]);assert.ok(/^\d+$/.test(q)?e.items?.[Number(q)]:e.items?.some(it=>it.id===q),'Broken question route '+m[0]);}}
 }
 const core1=item('ai-agent-5',1).a.split('<details')[0],core4=item('ai-agent-5',4).a.split('<details')[0];
 for(const t of ['控制权','通信拓扑','调度权','逻辑权威','严格优先级','工作窃取','N×(N−1)','投递数不等于','TaskLeaseStore'])assert.ok(core1.includes(t),'Role distinction missing '+t);
 for(const t of ['事实/假设/未决项','task_id + question_id + expected_revision','同一任务也可能有不同 question','六个模块','UNKNOWN','Memory revision','可推断性','Skill/Prompt 不是鉴权实现'])assert.ok(core4.includes(t),'Context distinction missing '+t);
 assert.doesNotMatch(core1,/售前解释|eventId 区分|不要周五/,'Unrelated scenario body returned to roles');
 assert.doesNotMatch(core4,/存活看进程|Python ContextVar 与 asyncio|支付通知或自己的回复/,'Relocated topic returned to context core');
 for(const t of ['NOT_APPLICABLE','RETURNED','routeHistory','二十或五十个','已支付金额','普通肯定词','模型自报置信度'])assert.ok(all.get('doc-17').html.includes(t));
 for(const t of ['k-of-n','同 attempt、不同 payload','HTTP 200','生产故障验证'])assert.ok(item('ai-agent-5',3).a.includes(t));
 return {status:'PASS_ACTUAL_FINAL_DIST',dist:resolve(dist),phase4PhysicalConditionRepairVerified:true,guardedLeaves:records.length,sourceBlocks:maps.length,exactVariantOccurrences:variants.length,newEntries:1,newQuestions:4,appendOnlyCanonicals:5};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const args=process.argv.slice(2),get=k=>{const i=args.indexOf(k);return i<0?null:args[i+1];};const dist=get('--dist');if(!dist)throw Error('An explicit actual built --dist is required; there is no overlay or synthetic acceptance mode.');try{console.log(JSON.stringify(await verifyFinal({dist:resolve(dist),fixtures:resolve(get('--fixtures')||fileURLToPath(new URL('.',import.meta.url)))}),null,2));}catch(e){console.error(e.stack);process.exitCode=1;}}

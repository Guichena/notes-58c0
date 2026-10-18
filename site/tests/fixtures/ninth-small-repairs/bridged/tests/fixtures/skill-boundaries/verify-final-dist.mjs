const NINTH_ORIGINAL_URL=new URL("../../../../../skill-boundaries/verify-final-dist.mjs",import.meta.url);
import {readFile,readdir,writeFile,realpath} from 'node:fs/promises';
import {eighthLeaf,eighthQuestion} from '../eighth-reconciliation/verify-dependencies.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.dirname(fileURLToPath(NINTH_ORIGINAL_URL));
const args=process.argv.slice(2);const value=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const mode=value('--mode','final');if(!['final','preflight'].includes(mode))throw Error('mode must be final or preflight');
const dist=path.resolve(value('--dist',path.join(root,'../../integration-site/dist')));
const out=path.resolve(value('--out',path.join(root,mode+'-verification.json')));
const inside=(p,base)=>p===base||p.startsWith(base+path.sep);
// Explicit temporary reports are supported after installing this file in tests/fixtures.
// Protect the complete selected site (dist and sibling source/test/fixture paths),
// resolving symlinks so an apparently external report cannot write back into it.
const physicalDist=await realpath(dist);
const physicalSite=await realpath(path.dirname(dist));
let physicalOut;
try{physicalOut=await realpath(out);}catch(error){
 if(error.code!=='ENOENT')throw error;
 physicalOut=path.join(await realpath(path.dirname(out)),path.basename(out));
}
if(inside(out,dist)||inside(out,path.dirname(dist))||inside(physicalOut,physicalDist)||inside(physicalOut,physicalSite))throw Error('Report must be outside site/dist, its sibling source directories and installed fixtures');
const fixtureMarker=path.sep+'tests'+path.sep+'fixtures'+path.sep;
if(root.includes(fixtureMarker)){
 const fixtureSite=root.slice(0,root.indexOf(fixtureMarker));
 if(inside(out,fixtureSite)||inside(physicalOut,await realpath(fixtureSite)))throw Error('Report must not write the installed site or fixture directory');
}
const j=async p=>JSON.parse(await readFile(p,'utf8'));
const [guard,old,newQuestions,dm,rows,variants]=await Promise.all(['records.json','before-entry.json','compiled-new-questions.json','destinations.json','source-block-mapping.json','variant-alias-migration.json'].map(f=>j(path.join(root,f))));
let entries=[];for(const f of await readdir(path.join(dist,'data/chapters')))if(f.endsWith('.json'))entries.push(...(await j(path.join(dist,'data/chapters',f))).entries);
const byId=new Map(entries.map(e=>[e.id,e]));const checks=[];
const check=(name,ok,details)=>checks.push({name,passed:!!ok,...(details===undefined?{}:{details})});
const digest=s=>createHash('sha256').update(String(s)).digest('hex');
const get=(e,ps)=>{try{return ps.reduce((a,k)=>a[k],e);}catch{return undefined;}};
const set=(e,ps,v)=>{const parent=ps.slice(0,-1).reduce((a,k)=>a[k],e);parent[ps.at(-1)]=v;};
// Bounded, evidence-backed dependency reconciliation. Historical fixtures remain immutable.
const reconciliation=await j(path.join(root,'foundation-reconciliation.json'));
for(const [file,expected] of Object.entries(reconciliation.immutableFixtureSha256))check('Original fixture bytes retained '+file,digest(await readFile(path.join(root,file),'utf8'))===expected);
const append=reconciliation.guardAppend;
check('Reconciliation append target is doc-17/html',append.entryId==='doc-17'&&JSON.stringify(append.path)==='["html"]');
const originalDoc17=guard.records.find(r=>r.entryId==='doc-17'&&JSON.stringify(r.path)==='["html"]');
check('Doc17 append predecessor is original Skill after',digest(originalDoc17?.after)===append.previousAfterSha256);
check('Doc17 append has exact authored bytes',!!append.appendedHtml&&digest(append.appendedHtml)===append.appendedSha256&&digest(originalDoc17?.after+append.appendedHtml)===append.expectedFinalSha256);
check('Exactly CLI and workflow wording corrections',reconciliation.destinationCorrections.length===2&&reconciliation.destinationCorrections.map(c=>c.key).join(',')==='cli,workflow');
const effectiveSection=(key,html)=>{
 if(mode==='preflight')return html; // Preserve the original, explicitly non-final proposal overlay.
 const correction=reconciliation.destinationCorrections.find(c=>c.key===key);
 return correction?html.replace(correction.from,correction.to):html;
};
for(const c of reconciliation.destinationCorrections){
 const d=dm[c.key];
 check('Correction source target and exact old section '+c.key,d?.entryId===c.entryId&&JSON.stringify(d?.path)===JSON.stringify(c.path)&&digest(d?.substantiveHtml)===c.oldSectionSha256&&d.substantiveHtml.split(c.from).length===2);
 check('Correction changes only reviewed clause '+c.key,digest(d.substantiveHtml.replace(c.from,c.to))===c.effectiveSectionSha256);
}
const e=byId.get('ai-agent-2');check('Source entry exists',!!e);
check('No duplicate entry identity',entries.length===byId.size);
check('All 13 original question identities stay at original indexes',e?.items.length>=old.items.length&&old.items.every((q,i)=>e.items[i].q===q.q&&e.items[i].id===q.id),{oldCount:old.items.length,actualCount:e?.items.length});
for(const i of [0,9,11])for(const k of ['q','id','lead','leadType','sub','mk'])check(`Legacy item ${i} ${k} unchanged`,e?.items[i]?.[k]===old.items[i][k]);
for(const r of guard.records){
 const actual=get(byId.get(r.entryId),r.path),isDoc17=r.entryId==='doc-17'&&JSON.stringify(r.path)==='["html"]',expected=mode==='final'?eighthLeaf(r.entryId,r.path,isDoc17?r.after+append.appendedHtml:r.after):r.before;
 check(`${mode==='final'?'Actual applied after':'Exact before guard'} ${r.entryId}/${r.path.join('/')}`,actual===expected,{actualSha256:digest(actual),expectedSha256:digest(expected)});
 if(mode==='preflight'&&actual===r.before)set(byId.get(r.entryId),r.path,r.after);
}
for(const [i,q]of newQuestions.entries()){
 const actual=e?.items.find(x=>x.id===q.id);
 if(mode==='preflight'){
  check('New ID not already present in preflight '+q.id,!actual);
  if(!actual)e.items.push(q);
 } else {
  check('Actual compiled authored question '+q.id,JSON.stringify(actual)===JSON.stringify(eighthQuestion('ai-agent-2',old.items.length+i,q)));
  check('Appended stable index '+q.id,e?.items[old.items.length+i]?.id===q.id);
 }
 check('Unique authored ID '+q.id,e?.items.filter(x=>x.id===q.id).length===1);
}
for(const i of [0,9,11]){
 const actual=e?.items[i]?.a||'';
 for(const id of [...old.items[i].a.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]))check(`Original anchor ${id}`,actual.includes(`id="${id}"`));
 check('No code dump in rewritten item '+i,!/<pre\b|code-card/i.test(actual));
}
function hasRoute(href){
 const m=href.match(/^#\/e\/([^/]+)(?:\/(.+))?$/);if(!m)return false;
 const item=byId.get(decodeURIComponent(m[1]));if(!item)return false;
 if(m[2]===undefined)return true;const q=decodeURIComponent(m[2]);return /^\d+$/.test(q)?!!item.items?.[Number(q)]:!!item.items?.some(x=>x.id===q);
}
const htmlLeaves=[...guard.records.map(r=>({id:r.entryId+'/'+r.path.join('/'),body:get(byId.get(r.entryId),r.path)||''})),...newQuestions.map(q=>({id:q.id,body:e?.items.find(x=>x.id===q.id)?.a||''}))];
for(const leaf of htmlLeaves)for(const m of leaf.body.matchAll(/href="(#\/e\/[^"\s]+)"/g))check(`Link from ${leaf.id} to ${m[1]}`,hasRoute(m[1]));
for(const [key,d]of Object.entries(dm)){
 const body=get(byId.get(d.entryId),d.path)||'';check('Destination exists '+key,!!body);check('Destination route '+key,hasRoute(d.route));
 if(d.questionId)check('Destination stable question identity '+key,byId.get(d.entryId)?.items[d.questionIndex]?.id===d.questionId);
 check('Substantive section retained '+key,body.includes(effectiveSection(key,d.substantiveHtml)));
 d.substantiveWitnesses.forEach((w,i)=>check(`Substantive witness ${key}/${i}`,body.includes(effectiveSection(key,w))));
}
check('All 310 source blocks accounted',rows.length===310&&new Set(rows.map(r=>r.id)).size===310);
check('All 197 original variants accounted',variants.length===197&&new Set(variants.map(r=>r.id)).size===197);
for(const i of [0,9,11]){
 const bs=await j(path.join(root,`blocks-item-${i}.json`));
 check('Exact block inventory item '+i,JSON.stringify(rows.filter(r=>r.questionIndex===i).map(r=>r.id))===JSON.stringify(bs.map(r=>r.id)));
 for(const b of bs){
  const row=rows.find(r=>r.id===b.id);
  check('Exact original source '+b.id,old.items[i].a.slice(b.start,b.end)===b.html&&row?.html===b.html&&row?.text===b.text);
  check('Explicit semantic destinations '+b.id,!!row?.destinationKeys.length&&row.destinationKeys.every(k=>dm[k]));
  for(const key of row?.destinationKeys||[]){const d=dm[key];check(`Actual semantic coverage ${b.id}->${key}`,!!d&&(get(byId.get(d.entryId),d.path)||'').includes(effectiveSection(key,d.substantiveHtml)));}
 }
}
if(mode==='final'){
for(const row of reconciliation.affectedSourceConditions){
 const original=rows.find(r=>r.id===row.sourceId);
 check('Reconciled source identity '+row.sourceId,original?.text===row.sourceText&&original?.sourceKind===row.sourceKind&&JSON.stringify(original?.destinationKeys)===JSON.stringify(row.originalDestinationKeys));
 for(const [i,c] of row.conditions.entries()){
  const d=dm[c.destinationKey],body=d?(get(byId.get(d.entryId),d.path)||''):'';
  check(`Reconciled unique condition ${row.sourceId}/${i}`,!!d&&row.originalDestinationKeys.includes(c.destinationKey)&&effectiveSection(c.destinationKey,d.substantiveHtml).includes(c.witness)&&body.includes(c.witness),{condition:c.condition,destinationKey:c.destinationKey});
 }
}
for(const [i,c] of reconciliation.supplementalConditions.entries())check(`Supplemental retained condition ${c.sourceId}/${i}`,(get(byId.get(c.entryId),c.path)||'').includes(c.witness),{condition:c.condition});
for(const variant of variants){
 const row=rows.find(r=>r.id===variant.id);
 check('Exact retained variant '+variant.id,variant.sourceKind==='variant'&&row?.sourceKind==='variant'&&['html','text','start','end','questionIndex'].every(k=>variant[k]===row[k])&&JSON.stringify(variant.destinationKeys)===JSON.stringify(row.destinationKeys));
 for(const key of variant.destinationKeys){const d=dm[key];check(`Actual retained variant coverage ${variant.id}->${key}`,!!d&&(get(byId.get(d.entryId),d.path)||'').includes(effectiveSection(key,d.substantiveHtml)));}
}
}
for(const r of guard.records.filter(r=>!['0','9','11'].includes(String(r.path[1]))||r.entryId!=='ai-agent-2'))check('Append preserves canonical original '+r.entryId+'/'+r.path.join('/'),r.after.startsWith(r.before));
const failed=checks.filter(c=>!c.passed);
const report={status:failed.length?'failed':'passed',mode,dist,checkedAt:new Date().toISOString(),siteFilesModified:false,actualFinalDistValidated:mode==='final'&&!failed.length,preflightUsesInMemoryProposalOverlay:mode==='preflight',scope:'11 guarded answer leaves (doc-17 with exact lineage-checked append), two bounded wording corrections, 2 exact authoring-compiled appended questions, legacy 13 identities, 310 exact source blocks, 197 variants and 45 scoped substantive destination sections; unrelated entries and unrelated additions remain free.',checks:checks.length,failedChecks:failed.length,failures:failed,tests:checks};
await writeFile(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,tests:undefined,failures:failed.slice(0,6),report:out}));process.exitCode=failed.length?1:0;

import {physical,assertPhysicalBody,physicalHash} from '../agent-workflow/verify-phase4-physical-repair.mjs';
import {eighthLeaf,eighthHash,eighthEntry} from '../eighth-reconciliation/verify-dependencies.mjs';
import {readFile, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
const here=path.dirname(fileURLToPath(import.meta.url));
const args=process.argv.slice(2), opt=(key,fallback)=>{const n=args.indexOf(key);return n<0?fallback:args[n+1];};
const mode=opt('--mode','final');
if(!['final','preflight'].includes(mode))throw Error('--mode must be final or preflight');
const dist=path.resolve(opt('--dist',path.join(here,'../../integration-site/dist')));
const output=path.resolve(opt('--out',path.join(here,mode==='final'?'final-dist-verification.json':'current-dist-preflight.json')));
if(output===dist||output.startsWith(dist+path.sep))throw Error('Report must be outside dist; verifier does not write the site.');
const j=async p=>JSON.parse(await readFile(p,'utf8'));
const sha=s=>createHash('sha256').update(s).digest('hex');
const plain=s=>s.replace(/<[^>]*>/g,' ').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n))).replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const checks=[],check=(name,pass,details)=>checks.push({name,passed:!!pass,...(details===undefined?{}:{details})});
const records=(await j(path.join(here,'records.json'))).records;
const fresh=await j(path.join(here,'compiled-new-entries.json'));
const authored=await j(path.join(here,'new-authoring-entries.json'));
const destinations=await j(path.join(here,'destinations.json'));
const rows=(await j(path.join(here,'source-block-mapping.json'))).rows;
const snapshots=await j(path.join(here,'existing-targets-full.json'));
const aliases=(await j(path.join(here,'variant-alias-migration.json'))).aliases;
const archiveRows=(await j(path.join(here,'out-of-scope-archive-proposal.json'))).records;
const reconciliation=await j(path.join(here,'foundation-tool-witness-reconciliation.json'));
const reconciliationContract=await j(path.join(here,'reconciliation-contract.json'));
const approvedAppendQuestions=await j(path.join(here,'approved-skill-append-questions.json'));
const originalToolDestination=await j(path.join(here,'original-tool-destination.json'));
const originalToolAnswer=await readFile(path.join(here,'original-tool-answer.html'),'utf8');
const skillOriginalBlocks=await j(path.join(here,'skill-original-tool-blocks.json'));
const dependencyWitnesses=await j(path.join(here,'foundation-dependency-witness-reconciliation.json'));
const dependencyLeaves=await j(path.join(here,'approved-dependency-leaves.json'));
const runtimeAppend=await j(path.join(here,'approved-runtime-compiled-append.json'));
const fifthWitnesses=await j(path.join(here,'fifth-witness-reconciliation.json'));
const fifthCompiled=await j(path.join(here,'fifth-compiled-reconciliation.json'));
const fifthLeaves=await j(path.join(here,'fifth-approved-dependency-leaves.json'));
const phase2=await j(path.join(here,'phase2-dag-append-reconciliation.json'));
const phase2Entry=id=>phase2.entries.find(e=>e.entryId===id);
const fifthExpected=id=>eighthEntry(phase2Entry(id)?.afterEntry??fifthCompiled.entries.find(e=>e.entryId===id)?.expectedEntry??fresh.find(e=>e.id===id));

const current=new Map();
for(const name of await readdir(path.join(dist,'data/chapters'))){
 if(!name.endsWith('.json'))continue;
 const chapter=await j(path.join(dist,'data/chapters',name));
 for(const e of chapter.entries){check('unique current entry '+e.id,!current.has(e.id));current.set(e.id,e);}
}
check('exactly two owned answer records',records.length===2&&records.every((r,i)=>r.entryId==='ai-agent-1'&&isDeepStrictEqual(r.path,['items',i+1,'a'])));
const proposed=new Map([...current].map(([id,e])=>[id,structuredClone(e)]));
for(const r of records){
 const i=r.path[1],actual=current.get(r.entryId)?.items?.[i]?.a;
 check('record hashes '+i,sha(r.before)===r.beforeSha256&&sha(r.after)===r.afterSha256);
 check((mode==='final'?'actual after leaf ':'current before leaf ')+i,actual===(mode==='final'?eighthLeaf(r.entryId,r.path,r.after):r.before),{actualSha256:actual==null?null:sha(actual),expectedSha256:mode==='final'?eighthHash(r.entryId,r.path,r.afterSha256):r.beforeSha256});
 if(mode==='preflight'&&proposed.get(r.entryId)?.items?.[i])proposed.get(r.entryId).items[i].a=r.after;
}
check('exact four compiled additions',fresh.length===4&&new Set(fresh.map(e=>e.id)).size===4);
check('exact 21 stable new question IDs',fresh.reduce((n,e)=>n+e.items.length,0)===21&&new Set(fresh.flatMap(e=>e.items.map(q=>q.id))).size===21&&fresh.every(e=>e.items.every(q=>/^q-agent-foundation-/.test(q.id))));
for(const e of fresh){
 const actual=current.get(e.id),expected=fifthExpected(e.id);
 if(mode==='final')check('exact compiled current entry '+e.id,isDeepStrictEqual(actual,expected),{present:!!actual,expectedSha256:sha(JSON.stringify(expected)),actualSha256:actual?sha(JSON.stringify(actual)):null});
 else{check('new entry does not collide '+e.id,!actual);proposed.set(e.id,structuredClone(e));}
 check('neutral source '+e.id,e.source==='面试学习笔记');
}
check('scenario classification',fresh.some(e=>e.id==='own-agent-task-scenarios'&&e.mod==='design'&&e.cat==='Agent 场景'));
const resolved=mode==='preflight'?proposed:current;
const physicalVerified=mode==='final'?assertPhysicalBody(resolved.get('ai-agent-5')?.items?.[3]?.a):false;
check('phase4 only exact physical condition addition',mode!=='final'||physicalVerified);
const finalHash=(d,h)=>mode==='final'?eighthHash(d?.entryId,d?.path??['items',d?.questionIndex,'a'],physicalHash(d?.entryId,d?.questionIndex,h)):h;
const drift=[];
const getTarget=d=>{
 const entry=resolved.get(d.entryId);
 if(d.type==='existing-verified-html')return {entry,body:typeof entry?.html==='string'?entry.html:undefined};
 const byId=['new-question','existing-approved-append'].includes(d.type);
 const q=byId?entry?.items?.find(q=>q.id===d.questionId):entry?.items?.[d.questionIndex];
 return {entry,q,body:q?.a};
};
const approvedTypes=new Set(['retained-main','new-question','existing-verified','existing-verified-html','existing-approved-append','source-provenance','out-of-scope-archive']);
check('approved destination types only',Object.values(destinations).every(d=>approvedTypes.has(d.type)));
for(const [key,d]of Object.entries(destinations)){
 if(d.type==='source-provenance'||d.type==='out-of-scope-archive')continue;
 const {entry,q,body}=getTarget(d);
 check('destination field resolves '+key,typeof body==='string');
 if(typeof body!=='string')continue;
 if(d.type==='existing-verified'){
  const old=snapshots[d.snapshotKey??(d.entryId+'#'+d.questionIndex)]?.item;
  check('existing question identity/index '+key,!!old&&(q.id??String(d.questionIndex))===(old.id??String(d.questionIndex)));
  const hash=sha(body),same=hash===finalHash(d,d.answerBodySha256);
  check('reviewed existing body exact '+key,same,{expectedSha256:d.answerBodySha256,actualSha256:hash});
  if(!same)drift.push({key,entryId:d.entryId,questionIndex:d.questionIndex,expectedSha256:d.answerBodySha256,actualSha256:hash,action:'Manual paragraph-level semantic review required; not silently accepted.'});
 }else if(d.type==='existing-verified-html'){
  const old=snapshots[d.snapshotKey];
  check('reviewed document identity/path '+key,isDeepStrictEqual(d.path,['html'])&&entry.kind===d.entryKindGuard&&old?.entryId===entry.id&&old?.kind===entry.kind);
  const same=sha(body)===finalHash(d,d.answerBodySha256);
  check('reviewed existing document exact '+key,same&&sha(old?.html??'')===d.answerBodySha256,{expectedSha256:d.answerBodySha256,actualSha256:sha(body)});
  if(!same)drift.push({key,entryId:d.entryId,path:['html'],expectedSha256:d.answerBodySha256,actualSha256:sha(body),action:'Full document body changed; no HTML exemption.'});
 }else if(d.type==='existing-approved-append'){
  const approved=approvedAppendQuestions.find(x=>x.id===d.questionId);
  check('approved append stable index and exact question '+key,!!approved&&entry.items[d.expectedIndex]?.id===d.questionId&&q.q===d.questionGuard&&sha(q.q)===d.questionSha256&&q.q===approved.q);
  check('approved append exact answer '+key,!!approved&&body===(mode==='final'?eighthLeaf(d.entryId,d.path,approved.a):approved.a)&&sha(body)===finalHash(d,d.answerBodySha256),{expectedSha256:d.answerBodySha256,actualSha256:sha(body)});
 }else if(d.type==='retained-main')check('retained main body exact '+key,sha(body)===finalHash(d,d.answerBodySha256));
 else{
  const aq=authored.find(e=>e.id===d.entryId)?.questions?.find(q=>q.id===d.questionId);
  check('new authoring semantic hash '+key,!!aq&&sha(aq.shortAnswer+'\n'+aq.blocks.map(b=>b.text).join('\n'))===d.answerBodySha256);
 }
 if(d.substantiveHtml)check('exact substantive section '+key,sha(d.substantiveHtml)===d.substantiveHtmlSha256&&body.includes(d.substantiveHtml));
 check('substantive destination paragraphs '+key,d.substantiveWitnesses?.length>0&&d.substantiveWitnesses.every(w=>plain(body).includes(plain(w))));
}
check('reconciled exact destination-kind counts',Object.values(destinations).filter(d=>d.type==='existing-verified').length===reconciliationContract.existingQuestionDestinationCount&&Object.values(destinations).filter(d=>d.type==='existing-verified-html').length===reconciliationContract.existingHtmlDestinationCount&&Object.values(destinations).filter(d=>d.type==='existing-approved-append').length===reconciliationContract.approvedAppendDestinationCount);
check('two approved append identities distinct from four fresh entries',approvedAppendQuestions.length===2&&new Set(approvedAppendQuestions.map(q=>q.id)).size===2&&approvedAppendQuestions.every(q=>!fresh.some(e=>e.items.some(f=>f.id===q.id))));
check('original tool source body pinned',sha(originalToolAnswer)===originalToolDestination.answerBodySha256&&reconciliation.oldToolAnswerBodySha256===originalToolDestination.answerBodySha256);
check('nineteen old tool witnesses retained',originalToolDestination.substantiveWitnesses.length===19&&reconciliation.originalWitnessCount===19&&reconciliation.rows.length===19&&new Set(reconciliation.rows.map(r=>r.witnessIndex)).size===19);
const compact=s=>plain(s).replace(/\s+/g,'');
for(const row of reconciliation.rows){
 const block=skillOriginalBlocks.find(b=>b.id===row.skillOriginalBlockId);
 check('original tool witness exact '+row.witnessIndex,row.oldText===originalToolDestination.substantiveWitnesses[row.witnessIndex]&&sha(row.oldText)===row.oldTextSha256&&compact(originalToolAnswer).includes(compact(row.oldText))&&!!block&&sha(block.html)===row.skillOriginalHtmlSha256&&compact(block.text)===compact(row.oldText));
 check('old tool witness has explicit substantive destinations '+row.witnessIndex,row.destinationKeys.length>0&&row.destinationKeys.every(key=>{const d=destinations[key];const target=d&&getTarget(d);return d?.substantiveWitnesses?.length>0&&typeof target?.body==='string'&&d.substantiveWitnesses.every(w=>plain(target.body).includes(plain(w)));}));
 for(const section of row.actualSubstantiveSections){const d=destinations[section.key];check('old witness section/body guards '+row.witnessIndex+'/'+section.key,!!d&&row.destinationKeys.includes(section.key)&&section.answerBodySha256===d.answerBodySha256&&section.sectionSha256===d.substantiveHtmlSha256);}
}
// Reconciled dependency leaves are exact, including Tool Use lead and the explicitly approved compiled append.
check('six explicit dependency leaves',dependencyLeaves.length===6&&new Set(dependencyLeaves.map(r=>r.entryId+JSON.stringify(r.path))).size===6);
for(const r of dependencyLeaves){
 let actual=resolved.get(r.entryId);for(const part of r.path)actual=actual?.[part];
 check('explicit dependency leaf exact '+r.entryId+'/'+r.path.join('/'),sha(r.before)===r.beforeSha256&&sha(r.after)===r.afterSha256&&actual===(mode==='final'?eighthLeaf(r.entryId,r.path,r.after):r.after));
}
const appendedEntry=resolved.get(runtimeAppend.entryId),baselineEntry=structuredClone(runtimeAppend.originalCompiledEntry),appendRecord=runtimeAppend.record;
const beforeAppend=baselineEntry.items[runtimeAppend.questionIndex].a;
check('approved runtime original prefix exact',beforeAppend===appendRecord.before&&appendRecord.after.startsWith(beforeAppend)&&sha(beforeAppend)===appendRecord.beforeSha256&&sha(appendRecord.after)===appendRecord.afterSha256);
baselineEntry.items[runtimeAppend.questionIndex].a=appendRecord.after;
check('approved runtime compiled rebase only one leaf',isDeepStrictEqual(baselineEntry,fresh.find(e=>e.id===runtimeAppend.entryId))&&isDeepStrictEqual(fifthExpected(runtimeAppend.entryId),appendedEntry)&&appendedEntry.items[runtimeAppend.questionIndex].id===runtimeAppend.questionId&&destinations['framework-evidence'].approvedCompiledAfterSha256===sha(appendRecord.after));
check('approved runtime all old witnesses retained',runtimeAppend.oldSubstantiveWitnesses.length===destinations['framework-evidence'].substantiveWitnesses.length&&runtimeAppend.oldSubstantiveWitnesses.every((w,i)=>w===destinations['framework-evidence'].substantiveWitnesses[i]&&plain(appendRecord.after).includes(plain(w))));
for(const [key,d]of Object.entries(destinations)){
 if(!d.publicRelativePath)continue;
 check('dependency archive safe relative path '+key,!path.isAbsolute(d.publicRelativePath)&&!d.publicRelativePath.split('/').includes('..'));
 let archiveBody='';try{archiveBody=await readFile(path.join(dist,d.publicRelativePath),'utf8');}catch{}
 check('dependency public archive exact '+key,sha(archiveBody)===d.archiveSha256&&archiveBody.includes(d.originalHtml)&&sha(d.originalHtml)===d.originalHtmlSha256);
}
for(const [label,expected]of [['toolcall',25],['architecture',42]]){
 const group=dependencyWitnesses[label];
 check('dependency original body pinned '+label,sha(group.originalBody)===group.originalDestination.answerBodySha256);
 check('dependency witness count '+label,group.originalWitnessCount===expected&&group.rows.length===expected&&group.originalDestination.substantiveWitnesses.length===expected&&new Set(group.rows.map(r=>r.witnessIndex)).size===expected);
 for(const row of group.rows){
  const prefix=label+'/'+row.witnessIndex;
  check('dependency old witness exact '+prefix,row.oldText===group.originalDestination.substantiveWitnesses[row.witnessIndex]&&sha(row.oldText)===row.oldTextSha256&&compact(group.originalBody).includes(compact(row.oldText)));
  if(label==='architecture')check('architecture original source block exact '+row.witnessIndex,sha(row.architectureOriginalHtml)===row.architectureOriginalHtmlSha256&&compact(row.architectureOriginalHtml)===compact(row.oldText)&&group.originalBody.includes(row.architectureOriginalHtml)&&row.status==='covered-or-explicit-public-archive');
  check('dependency witness explicit evidence '+prefix,row.evidence.length>0&&row.destinationKeys.length>0&&row.destinationKeys.every(k=>row.evidence.some(e=>e.destinationKey===k)));
  for(const [i,e]of row.evidence.entries()){
   const d=destinations[e.destinationKey];
   let body='';if(d?.publicRelativePath){try{body=await readFile(path.join(dist,d.publicRelativePath),'utf8');}catch{}}
   else body=d&&getTarget(d).body;
   const actualHash=typeof body==='string'?sha(body):null;
   const expectedHash=d?.publicRelativePath?d.archiveSha256:actualHash;
   check('dependency substantive evidence exact '+prefix+'/'+i,!!d&&row.destinationKeys.includes(e.destinationKey)&&/^<p\b/.test(e.html)&&sha(e.html)===e.htmlSha256&&typeof body==='string'&&body.includes(e.html)&&(d.publicRelativePath?e.archiveSha256===d.archiveSha256&&actualHash===d.archiveSha256:finalHash(d,e.answerBodySha256)===actualHash));
  }
 }
}

// Fifth-batch reconciliation composes explicit approved additions without weakening
// the original four entries/21 identities, earlier appends, or earlier witnesses.
check('fifth exact compiled rebase count',fifthCompiled.entries.length===2&&new Set(fifthCompiled.entries.map(e=>e.entryId)).size===2);
for(const c of fifthCompiled.entries){
 const original=fresh.find(e=>e.id===c.entryId),actual=phase2Entry(c.entryId)?.beforeEntry??resolved.get(c.entryId);
 check('fifth original compiled fixture exact '+c.entryId,isDeepStrictEqual(original,c.originalCompiledEntry)&&sha(JSON.stringify(original))===c.originalEntrySha256);
 const composed=structuredClone(original);
 for(const r of c.records){
  let value=composed;for(const p of r.path)value=value?.[p];
  check('fifth original answer full prefix '+c.entryId+'/'+r.path.join('/'),value===r.before&&sha(r.before)===r.beforeSha256&&sha(r.after)===r.afterSha256&&r.after.startsWith(r.before));
  let parent=composed;for(const p of r.path.slice(0,-1))parent=parent[p];parent[r.path.at(-1)]=r.after;
 }
 check('fifth old complete questions after approved leaves '+c.entryId,isDeepStrictEqual(composed,c.afterLeafEntry)&&isDeepStrictEqual(composed.items,c.oldQuestionObjectsAfterExplicitLeaves)&&composed.items.length===c.oldQuestionCount);
 composed.items.push(...structuredClone(c.expectedAppendItems));
 check('fifth final compiled composite exact '+c.entryId,isDeepStrictEqual(composed,c.expectedEntry)&&isDeepStrictEqual(actual,c.expectedEntry)&&sha(JSON.stringify(c.expectedEntry))===c.expectedEntrySha256&&actual.items.length===c.newQuestionCount);
 check('fifth old complete objects prefix stable '+c.entryId,isDeepStrictEqual(actual.items.slice(0,c.oldQuestionCount),c.oldQuestionObjectsAfterExplicitLeaves));
 for(const [i,q]of c.expectedAppendItems.entries())check('fifth appended scenario exact object '+q.id,isDeepStrictEqual(actual.items[c.oldQuestionCount+i],q));
}
const ca=fifthCompiled.collaborationAppend,ce=phase2Entry(ca.entryId)?.beforeEntry??resolved.get(ca.entryId);
check('fifth collaboration original four objects exact',ca.beforeEntry.items.length===4&&isDeepStrictEqual(ca.beforeEntry,fifthCompiled.originalCollaborationEntry)&&isDeepStrictEqual(ca.afterEntry.items.slice(0,4),ca.beforeEntry.items));
check('fifth collaboration six final objects exact',ca.appends.length===2&&ca.afterEntry.items.length===6&&isDeepStrictEqual(ce,ca.afterEntry));
for(const a of ca.appends)check('fifth collaboration appended exact object '+a.id,isDeepStrictEqual(ce?.items[a.index],a.expectedItem));
check('fifth exact dependency leaf count',fifthLeaves.length===9&&new Set(fifthLeaves.map(r=>r.entryId+JSON.stringify(r.path))).size===9);
for(const r of fifthLeaves){let value=resolved.get(r.entryId);for(const p of r.path)value=value?.[p];check('fifth explicit dependency leaf exact '+r.entryId+'/'+r.path.join('/'),sha(r.before)===r.beforeSha256&&sha(r.after)===r.afterSha256&&value===(mode==='final'?eighthLeaf(r.entryId,r.path,r.entryId==='ai-agent-5'&&JSON.stringify(r.path)==='["items",3,"a"]'?(r.after===physical.beforeBody&&physical.afterBody):r.after):r.after));}
const fifthPrefixKeys=new Set(['own-agent-task-scenarios/items/0/a','bg-redis-8/items/9/a','doc-17/html','own-agent-runtime-design/items/4/a','ai-agent-5/items/3/a']);
check('fifth five full dependency prefixes covered',fifthLeaves.filter(r=>fifthPrefixKeys.has(r.entryId+'/'+r.path.join('/'))).length===5);
for(const r of fifthLeaves){const key=r.entryId+'/'+r.path.join('/');if(fifthPrefixKeys.has(key))check('fifth complete old dependency body prefix '+key,r.after.startsWith(r.before)&&sha(r.after.slice(0,r.before.length))===r.beforeSha256);}
for(const [label,expectedCount]of [['multi',23],['roles',57]]){
 const group=fifthWitnesses[label];
 check('fifth original witness body pinned '+label,sha(group.originalBody)===group.originalDestination.answerBodySha256);
 check('fifth original witness exact count '+label,group.originalWitnessCount===expectedCount&&group.rows.length===expectedCount&&group.originalDestination.substantiveWitnesses.length===expectedCount&&new Set(group.rows.map(r=>r.witnessIndex)).size===expectedCount);
 for(const row of group.rows){
  const key=label+'/'+row.witnessIndex;
  check('fifth old witness exact '+key,row.oldText===group.originalDestination.substantiveWitnesses[row.witnessIndex]&&sha(row.oldText)===row.oldTextSha256&&sha(row.originalBlockHtml)===row.originalBlockHtmlSha256&&group.originalBody.includes(row.originalBlockHtml)&&compact(row.oldText)===compact(row.originalBlockHtml));
  check('fifth every witness has substantive evidence '+key,row.evidence.length>0&&row.destinationKeys.length>0&&row.destinationKeys.every(k=>row.evidence.some(e=>e.destinationKey===k)));
  for(const [i,e]of row.evidence.entries()){
   const d=destinations[e.destinationKey],body=d&&getTarget(d).body;
   check('fifth old witness exact relocated paragraph '+key+'/'+i,!!d&&row.destinationKeys.includes(e.destinationKey)&&/^<p\b/.test(e.html)&&sha(e.html)===e.htmlSha256&&e.html===d.substantiveHtml&&typeof body==='string'&&body.includes(e.html)&&sha(body)===finalHash(d,e.answerBodySha256)&&d.answerBodySha256===e.answerBodySha256);
  }
 }
}

// Phase2 is an explicit exact composition: phase1 objects are not compared to
// a sliced or normalized final object. The real final entry is deep-equal here.
check('phase2 exactly two approved appends',phase2.entries.length===2&&new Set(phase2.entries.map(e=>e.entryId)).size===2);
for(const c of phase2.entries){
 const previous=c.entryId==='own-agent-runtime-design'?fifthCompiled.entries.find(x=>x.entryId===c.entryId)?.expectedEntry:fifthCompiled.collaborationAppend.afterEntry;
 const actual=resolved.get(c.entryId),n=c.entryId==='own-agent-runtime-design'?7:6;
 check('phase2 baseline equals entire phase1 entry '+c.entryId,isDeepStrictEqual(c.beforeEntry,previous)&&c.beforeEntry.items.length===n&&sha(JSON.stringify(c.beforeEntry.items))===c.beforePrefixSha256);
 const expected=structuredClone(c.beforeEntry);
 check('phase2 single exact appended question '+c.entryId,c.appends.length===1&&c.appends[0].index===n&&c.appends[0].id===c.appends[0].expectedItem.id&&sha(JSON.stringify(c.appends[0].expectedItem))===c.appends[0].expectedItemSha256);
 expected.items.push(...c.appends.map(a=>structuredClone(a.expectedItem)));
 check('phase2 whole final entry exact '+c.entryId,isDeepStrictEqual(expected,c.afterEntry)&&isDeepStrictEqual(actual,mode==='final'?eighthEntry(c.afterEntry):c.afterEntry)&&actual.items.length===n+1);
 check('phase2 original complete question objects prefix exact '+c.entryId,isDeepStrictEqual(actual?.items?.slice(0,n),(mode==='final'?eighthEntry(c.beforeEntry):c.beforeEntry).items));
}
check('550 unique mapped original blocks',rows.length===550&&new Set(rows.map(r=>r.blockId)).size===550);
const originals=new Map();
for(const i of [1,2]){
 const raw=await readFile(path.join(here,`before-item-${i}.html`),'utf8');
 const blocks=await j(path.join(here,`blocks-item-${i}.json`));
 check('frozen original answer hash '+i,sha(raw)===records.find(r=>r.path[1]===i).beforeSha256);
 for(const b of blocks){originals.set(b.blockId,b);check('original block exact '+b.blockId,raw.slice(b.start,b.end)===b.html);}
}
for(const r of rows){
 const b=originals.get(r.blockId);
 check('preserved source text and HTML hash '+r.blockId,!!b&&r.sourceText===b.text&&r.sourceHtmlSha256===sha(b.html));
 check('all destination keys resolve '+r.blockId,r.destinationKeys.length>0&&r.destinationKeys.every(k=>destinations[k]));
 for(const key of r.destinationKeys){const d=destinations[key];if(!d||['source-provenance','out-of-scope-archive'].includes(d.type))continue;const t=getTarget(d);check('mapped substantive field reachable '+r.blockId+'/'+key,typeof t.body==='string');const embedded=r.destinations.find(x=>x.key===key);check('embedded mapped destination hash '+r.blockId+'/'+key,embedded?.answerBodySha256===d.answerBodySha256);}
}
check('482 source-wording records preserved',aliases.length===482&&aliases.every(a=>{const r=rows.find(r=>r.blockId===a.sourceBlockId);return r?.sourceText===a.originalWording&&isDeepStrictEqual(r.destinationKeys,a.destinationKeys);}));
const archive=await j(path.join(dist,'data/archives/source-entries.json'));
const publicOriginal=archive.find(e=>e.id==='ai-agent-1');
check('exactly two excluded questions',archiveRows.length===2&&archiveRows.some(r=>r.blockId==='i1-b164')&&archiveRows.some(r=>r.blockId==='i1-b225'));
for(const r of archiveRows)check('excluded original retained in public archive '+r.blockId,publicOriginal?.items?.[1]?.a?.includes(r.originalHtml));
const routeChecks=[];
for(const [label,body]of [...records.map(r=>['main-'+r.path[1],resolved.get(r.entryId)?.items?.[r.path[1]]?.a??'']),...fresh.flatMap(e=>(resolved.get(e.id)?.items??[]).map(q=>[e.id+'/'+q.id,q.a]))]){
 for(const match of body.matchAll(/href=["']#\/e\/([^"']+)["']/g)){
  const [eid,qid]=match[1].split('/').map(decodeURIComponent);const e=resolved.get(eid);
  const exists=!!e&&(qid==null||e.items?.some((q,i)=>(q.id??String(i))===qid));
  check('live route '+label+' → '+match[1],exists);routeChecks.push({from:label,entryId:eid,questionId:qid??null,exists});
 }
}
for(const [key,d]of Object.entries(destinations)){
 if(!d.route)continue;
 const match=/^#\/e\/([^/]+)(?:\/(.+))?$/.exec(d.route);
 const eid=match&&decodeURIComponent(match[1]),qid=match?.[2]==null?null:decodeURIComponent(match[2]);const e=eid&&resolved.get(eid);
 const exists=!!e&&(qid==null||e.items?.some((q,i)=>(q.id??String(i))===qid));
 check('reconciled canonical route '+key,exists);routeChecks.push({from:key,entryId:eid,questionId:qid,exists});
}
const failures=checks.filter(c=>!c.passed);
const report={status:failures.length?'failed':'passed',mode,checkedAt:new Date().toISOString(),dist,scope:'Phase 1: original two foundation leaves, four original entries and 21 original identities; explicit compound runtime/scenario after entries; 550 blocks and 482 aliases; 86 prior witnesses plus all 80 old multi/roles witnesses; previous six and nine new strict dependency leaves; full original collaboration four-object prefix and exact six-object final entry.',actualFinalDistValidated:mode==='final'&&failures.length===0,preflightUsesInMemoryProposalOverlay:mode==='preflight',existingCanonicalBodiesReviewed:reconciliationContract.existingQuestionDestinationCount,existingCanonicalDocumentsReviewed:reconciliationContract.existingHtmlDestinationCount,approvedAppendDestinationsReviewed:reconciliationContract.approvedAppendDestinationCount,phase4PhysicalConditionRepairVerified:physicalVerified,phase2AppendedQuestions:2,phase2RuntimeFinalCount:8,phase2CollaborationFinalCount:7,fifthOldMultiWitnessesReconciled:23,fifthOldRolesWitnessesReconciled:57,fifthDependencyLeavesChecked:9,fifthCompiledEntriesRebased:2,fifthScenarioAppendedQuestions:2,fifthCollaborationFinalQuestions:6,oldToolWitnessesReconciled:19,oldToolcallWitnessesReconciled:25,oldArchitectureWitnessesReconciled:42,explicitDependencyLeavesChecked:6,approvedRuntimePrefixAppends:1,existingBodyDrift:drift,checks:checks.length,failedChecks:failures.length,siteFilesModified:false,routeChecks,failures,tests:checks};
await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,mode,actualFinalDistValidated:report.actualFinalDistValidated,checks:report.checks,failedChecks:report.failedChecks,existingBodyDrift:drift,report:output},null,2));
if(failures.length)process.exitCode=1;

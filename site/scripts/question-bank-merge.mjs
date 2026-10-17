// Final, additive content projection. Source provenance is validated here and
// never copied into learner entries, the catalog, search, or runtime bundles.
import {readFile} from 'node:fs/promises';
import {MODULES} from './authoring.mjs';
import {projectInterviewVoiceReview,sha256} from './interview-voice-review.mjs';
import {projectNoteDisplay} from './note-display-cleanup.mjs';
const fail=message=>{throw Error('Question bank merge: '+message);};
const digest=value=>sha256(JSON.stringify(value));
const text=value=>typeof value==='string'&&!!value.trim();
const stable=value=>typeof value==='string'&&/^[a-z][a-z0-9-]*$/.test(value);
const keys=(value,allowed)=>{
 if(!value||typeof value!=='object'||Array.isArray(value))fail('expected object');
 for(const key of Object.keys(value))if(!allowed.includes(key))fail('unknown field '+key);
};
const passive=(value,trustedBefore='')=>{
 if(!text(value))fail('empty learner content');
 const copyButton='<button class="copy-button md-copy" type="button">';
 const priorCount=trustedBefore.split(copyButton).length-1,currentCount=value.split(copyButton).length-1;
 // Preserve only the exact inert copy-button shell already present in a guarded
 // baseline answer; new questions and added interactive markup stay rejected.
 if(priorCount&&currentCount<=priorCount)value=value.replaceAll(copyButton,'');
 const decoded=value.replace(/&#(x[0-9a-f]+|[0-9]+);?/gi,(_,n)=>String.fromCodePoint(Number.parseInt(n[0].toLowerCase()==='x'?n.slice(1):n,n[0].toLowerCase()==='x'?16:10))).replace(/&colon;/gi,':');
 // Inspect URI/event syntax only inside real markup: escaped source code may
 // legitimately contain a Go field literal such as data: make(...).
 const tags=decoded.match(/<[^>]*>/g)||[];
 if(/<\s*(?:script|iframe|object|embed|style|link|meta|base|svg|math|form|input|button|textarea|select|audio|video)\b/i.test(decoded)||tags.some(tag=>/\bon[a-z]+\s*=/i.test(tag)||/(?:javascript|vbscript|data):/i.test(tag.replace(/[\u0000-\u0020]/g,''))))fail('unsafe learner markup');
};
const validateQuestion=q=>{
 keys(q,['id','q','a','lead','leadType','sub','mk']);
 if(!stable(q.id)||!q.id.startsWith('q-'))fail('new questions require stable q-* IDs');
 passive(q.q);passive(q.a);
 if(q.lead!==undefined)passive(q.lead);
 if(q.leadType!==undefined&&q.leadType!=='authored')fail('invalid lead type');
 if(q.sub!==undefined&&typeof q.sub!=='string')fail('invalid section');
 if(typeof q.mk!=='boolean')fail('question mk must be boolean');
};
const scenarioLists=['requirements','capacityPlan','architecture','dataFlow','consistency','failureModes','keyPoints','observability','tradeoffs','security','followups'];
const validateEntry=e=>{
 const common=['id','kind','mod','part','cat','title','number','progressKey','supplementHtml'];
 const fields={qa:['items'],doc:['html'],handwrite:['questionHtml','analysisHtml','answerHtml','relatedHtml','knowledge'],database:['questionHtml','analysisHtml','answerHtml','relatedHtml','knowledge'],scenario:['idea','description','metrics','components','interviewAnswer','code',...scenarioLists],algo:['idea','description','code','time','space','walkthrough','correctness','complexityNote','pitfall','boundaryCases','methodCompare','followupQuestions']};
 if(!fields[e?.kind])fail('unsupported new entry kind');
 keys(e,[...common,...fields[e.kind]]);
 if(e.supplementHtml!==undefined)passive(e.supplementHtml);
 if(!stable(e.id)||!MODULES.includes(e.mod))fail('invalid new entry identity');
 for(const key of ['part','cat','title'])passive(e[key]);
 if(e.number!==undefined&&!['string','number'].includes(typeof e.number))fail('invalid number');
 if(typeof e.number==='number'&&!Number.isFinite(e.number))fail('invalid number');
 if(e.progressKey!==undefined&&!stable(e.progressKey))fail('invalid progress key');
 if(e.kind==='qa'){
  if(!Array.isArray(e.items)||!e.items.length)fail('new QA entry needs items');
  e.items.forEach(validateQuestion);return;
 }
 const required={doc:['html'],handwrite:['questionHtml','analysisHtml','answerHtml'],database:['questionHtml','analysisHtml','answerHtml'],scenario:['idea','description','interviewAnswer','requirements','architecture'],algo:['idea','description','code','time','space']};
 for(const key of required[e.kind])if(!Object.hasOwn(e,key))fail('missing learner field '+key);
 const listKeys=[...scenarioLists,'knowledge','boundaryCases','methodCompare','followupQuestions'];
 for(const key of fields[e.kind])if(Object.hasOwn(e,key)){
  if(listKeys.includes(key)){
   if(!Array.isArray(e[key])||!e[key].length)fail('empty learner list '+key);e[key].forEach(value=>passive(value));
  }else if(key==='code'){
   // Plain source code is escaped by the existing code-card renderer.
   if(!text(e[key]))fail('empty source code');
  }else passive(e[key]);
 }
};
function validateIdentities(entries){
 const ids=new Set(),progress=new Set();
 for(const e of entries){
  if(ids.has(e.id))fail('duplicate entry '+e.id);ids.add(e.id);
  const key=e.progressKey||e.id;
  if(progress.has(key))fail('duplicate progress key '+key);progress.add(key);
  if(e.kind==='qa'){
   const anchors=new Set();
   for(const [i,q]of e.items.entries()){
    const anchor=String(q.id||i);
    if(anchors.has(anchor))fail('duplicate question anchor '+e.id+'#'+anchor);
    anchors.add(anchor);
   }
  }
 }
}
export async function readQuestionBankMerge(){
 return JSON.parse(await readFile(new URL('../content/question-bank-merge.json',import.meta.url),'utf8'));
}
const countPattern=/^(\s*)\d+(\s*问\s*)$/;
const countLabel=(label,count)=>label.replace(countPattern,(_,before,after)=>before+count+after);
// This is only a small shape, not a second content snapshot. The complete known
// graph must still match baseEntriesSha256 after independent tails are removed.
export const questionBankBaselineShape=entries=>entries.map(e=>({id:e.id,...(e.kind==='qa'?{
 questionCount:e.items.length,
 ...(typeof e.number==='string'&&countPattern.test(e.number)?{countLabel:e.number}:{})
}:{})}));
function validateBaselineShape(shape){
 if(!Array.isArray(shape)||!shape.length)fail('baseline shape required');
 const ids=new Set();
 for(const s of shape){
  keys(s,['id','questionCount','countLabel']);
  if(!text(s.id)||ids.has(s.id))fail('invalid baseline shape identity');ids.add(s.id);
  if(s.questionCount!==undefined&&(!Number.isSafeInteger(s.questionCount)||s.questionCount<0))fail('invalid baseline question count');
  if(s.countLabel!==undefined&&(s.questionCount===undefined||typeof s.countLabel!=='string'||!countPattern.test(s.countLabel)||s.countLabel!==countLabel(s.countLabel,s.questionCount)))fail('invalid baseline count label');
 }
}
function projectedShape(registry){
 const shape=structuredClone(registry.baselineShape),byId=new Map(shape.map(s=>[s.id,s]));
 for(const r of registry.records){
  if(r.type==='appendQuestions'){
   const s=byId.get(r.entryId);if(s?.questionCount===undefined||!Array.isArray(r.items))fail('missing QA append target');
   s.questionCount+=r.items.length;
   if(s.countLabel!==undefined)s.countLabel=countLabel(s.countLabel,s.questionCount);
  }else if(r.type==='appendEntry'){
   const [s]=questionBankBaselineShape([r.entry]);
   if(byId.has(s.id))fail('duplicate entry '+s.id);
   if(s.countLabel!==undefined)s.countLabel=countLabel(s.countLabel,s.questionCount);
   shape.push(s);byId.set(s.id,s);
  }
 }
 return shape;
}
function splitIndependentAuthoring(entries,shape,{reverse=false}={}){
 validateIdentities(entries);
 const knownIds=new Set(shape.map(s=>s.id)),known=[],futureEntries=[],futureQuestions=new Map();
 for(const e of entries){
  if(!knownIds.has(e.id)){
   if(reverse&&known.length!==shape.length)fail('current entries reordered by future content');
   // Upstream authoring permits QA/doc entries and adds this inert source label.
   const {source,...learner}=e;
   if(source!==undefined&&!text(source))fail('invalid future source label');
   if(!['qa','doc'].includes(e.kind))fail('future entry must be independently authored');
   validateEntry(learner);futureEntries.push(e);continue;
  }
  const s=shape[known.length];
  if(s?.id!==e.id)fail('baseline entry order changed');
  let core=e;
  if(s.questionCount!==undefined){
   if(e.kind!=='qa'||!Array.isArray(e.items)||e.items.length<s.questionCount)fail('baseline questions missing '+e.id);
   const tail=e.items.slice(s.questionCount);tail.forEach(validateQuestion);
   if(s.countLabel!==undefined&&e.number!==countLabel(s.countLabel,e.items.length))fail('invalid derived question count '+e.id);
   if(tail.length){
    futureQuestions.set(e.id,tail);
    core={...e,items:e.items.slice(0,s.questionCount),...(s.countLabel!==undefined?{number:s.countLabel}:{})};
   }
  }
  known.push(core);
 }
 if(known.length!==shape.length)fail('baseline entries missing');
 return {known,futureEntries,futureQuestions};
}
function restoreIndependentAuthoring(entries,{futureEntries,futureQuestions}){
 const out=projectNoteDisplay(entries.map(e=>futureQuestions.has(e.id)?{...e,items:[...e.items,...futureQuestions.get(e.id)]}:e));
 out.push(...futureEntries);validateIdentities(out);return out;
}
// Isolate only independent additions before the earlier positional voice review.
// Its identity/before-field checks remain unchanged. The caller must subsequently
// run the merge, whose complete baseline hash validates every retained old field.
export function prepareQuestionBankAuthoring(entries,registry,{baselineTest=false}={}){
 if(baselineTest||registry?.baselineShape===undefined)return {entries,restore:out=>out};
 validateBaselineShape(registry.baselineShape);
 const split=splitIndependentAuthoring(entries,registry.baselineShape);
 return {entries:split.known,restore:out=>restoreIndependentAuthoring(out,split)};
}
function validateCoverage(registry,entries){
 const byId=new Map(entries.map(e=>[e.id,e])),covered=new Set(),seen=new Set();
 for(const c of registry.coverage){
  keys(c,['sourceRecordId','entryId','questionId','rationale']);
  if(!text(c.sourceRecordId)||!text(c.rationale))fail('coverage needs source record and rationale');
  const e=byId.get(c.entryId);if(!e)fail('coverage target missing '+c.entryId);
  if(c.questionId!==undefined&&(!text(c.questionId)||!e.items?.some((q,i)=>String(q.id||i)===c.questionId)))fail('coverage question missing');
  const key=JSON.stringify([c.sourceRecordId,c.entryId,c.questionId]);
  if(seen.has(key))fail('duplicate coverage mapping');seen.add(key);
  covered.add(JSON.stringify([c.sourceRecordId,c.entryId]));
 }
 for(const r of registry.records)for(const id of r.sourceRecordIds){
  if(!covered.has(JSON.stringify([id,r.type==='appendEntry'?r.entry.id:r.entryId])))fail('operation lacks source coverage '+r.id);
 }
}
export function projectQuestionBankMerge(entries,registry,{baselineTest=false,reverse=false}={}){
 if(baselineTest||registry?.baselineShape===undefined)return projectQuestionBankMergeCore(entries,registry,{baselineTest,reverse});
 keys(registry,['schemaVersion','baseEntriesSha256','baselineShape','records','coverage']);
 if(registry.schemaVersion!==1||!Array.isArray(registry.records)||!Array.isArray(registry.coverage))fail('invalid registry');
 if(!/^[a-f0-9]{64}$/.test(registry.baseEntriesSha256))fail('baseline SHA required for shaped registry');
 validateBaselineShape(registry.baselineShape);
 const shape=reverse?projectedShape(registry):registry.baselineShape;
 const split=splitIndependentAuthoring(entries,shape,{reverse});
 let known=split.known;
 if(reverse){
  const originalIds=new Set(registry.baselineShape.map(s=>s.id));
  for(const id of split.futureQuestions.keys())if(!originalIds.has(id))fail('future questions target a merge-created entry '+id);
  // Only validated derived labels are restored. Every other number and identity
  // remains subject to the exact original operation and whole-corpus guards.
  const labels=new Map(registry.baselineShape.filter(s=>s.countLabel!==undefined).map(s=>[s.id,s.countLabel]));
  for(const r of registry.records)if(r.type==='appendEntry'&&r.entry.kind==='qa'&&typeof r.entry.number==='string'&&countPattern.test(r.entry.number))labels.set(r.entry.id,r.entry.number);
  known=known.map(e=>labels.has(e.id)?{...e,number:labels.get(e.id)}:e);
 }
 const out=projectQuestionBankMergeCore(known,registry,{reverse});
 return restoreIndependentAuthoring(out,split);
}
function projectQuestionBankMergeCore(entries,registry,{baselineTest=false,reverse=false}={}){
 if(baselineTest)return entries;
 keys(registry,['schemaVersion','baseEntriesSha256','baselineShape','records','coverage']);
 if(registry.schemaVersion!==1||!Array.isArray(registry.records)||!Array.isArray(registry.coverage))fail('invalid registry');
 validateIdentities(entries);
 if(!registry.records.length){
  if(registry.baseEntriesSha256!==null&&registry.baseEntriesSha256!==digest(entries))fail('baseline hash mismatch');
  validateCoverage(registry,entries);return entries;
 }
 if(!/^[a-f0-9]{64}$/.test(registry.baseEntriesSha256))fail('baseline SHA required');
 if(!reverse&&digest(entries)!==registry.baseEntriesSha256)fail('baseline hash mismatch');
 const ids=new Set(),targets=new Set();
 for(const r of registry.records){
  if(!stable(r.id)||ids.has(r.id))fail('invalid or duplicate operation ID');ids.add(r.id);
  if(!Array.isArray(r.sourceRecordIds)||!r.sourceRecordIds.length||r.sourceRecordIds.some(x=>!text(x))||new Set(r.sourceRecordIds).size!==r.sourceRecordIds.length)fail('source record IDs required');
  if(!text(r.rationale))fail('operation rationale required');
  const common=['id','type','sourceRecordIds','rationale'];
  if(r.type==='replaceField'){
   keys(r,[...common,'entryId','path','entryIdentity','questionIdentity','before','after','beforeSha256','afterSha256','review']);
   const key=JSON.stringify([r.entryId,r.path]);if(targets.has(key))fail('duplicate replacement target');targets.add(key);
   passive(r.after,r.before);
  }else if(r.type==='addSupplement'){
   keys(r,[...common,'entryId','beforeEntrySha256','html']);passive(r.html);
   if(!/^[a-f0-9]{64}$/.test(r.beforeEntrySha256))fail('entry SHA required');
   const key=JSON.stringify([r.entryId,['supplementHtml']]);if(targets.has(key))fail('duplicate supplement target');targets.add(key);
  }else if(r.type==='appendQuestions'){
   keys(r,[...common,'entryId','beforeItemsSha256','items']);
   if(!Array.isArray(r.items)||!r.items.length)fail('append needs questions');r.items.forEach(validateQuestion);
   if(!/^[a-f0-9]{64}$/.test(r.beforeItemsSha256))fail('items SHA required');
  }else if(r.type==='appendEntry'){
   keys(r,[...common,'entry']);validateEntry(r.entry);
  }else fail('unsupported operation '+r.type);
 }
 if(reverse)validateCoverage(registry,entries);
 let out=entries;
 for(const r of reverse?[...registry.records].reverse():registry.records){
  if(r.type==='replaceField'){
   out=projectInterviewVoiceReview(out,{schemaVersion:1,records:[r]},{reverse});
  }else if(r.type==='addSupplement'){
   const e=out.find(e=>e.id===r.entryId);if(!e)fail('missing supplement target');
   let changed;
   if(reverse){
    if(e.supplementHtml!==r.html)fail('added supplement changed');
    changed=structuredClone(e);delete changed.supplementHtml;
    if(digest(changed)!==r.beforeEntrySha256)fail('original supplement entry changed');
   }else{
    if(Object.hasOwn(e,'supplementHtml')||digest(e)!==r.beforeEntrySha256)fail('stale supplement target');
    changed={...e,supplementHtml:r.html};
   }
   out=out.map(x=>x===e?changed:x);
  }else if(r.type==='appendQuestions'){
   const e=out.find(e=>e.id===r.entryId);
   if(!e||e.kind!=='qa')fail('missing QA append target');
   let items;
   if(reverse){
    if(digest(e.items.slice(-r.items.length))!==digest(r.items))fail('appended questions changed');
    items=e.items.slice(0,-r.items.length);
    if(digest(items)!==r.beforeItemsSha256)fail('original items changed');
   }else{
    if(digest(e.items)!==r.beforeItemsSha256)fail('stale append target');
    items=[...e.items,...structuredClone(r.items)];
   }
   out=out.map(x=>x===e?{...e,items}:x);
  }else if(reverse){
   if(digest(out.at(-1))!==digest(r.entry))fail('appended entry changed or reordered');
   out=out.slice(0,-1);
  }else out=[...out,structuredClone(r.entry)];
  validateIdentities(out);
 }
 if(reverse){if(digest(out)!==registry.baseEntriesSha256)fail('reversed baseline hash mismatch');}
 else validateCoverage(registry,out);
 return out;
}

export function projectQuestionBankRuntime(file,text,{baselineTest=false}={}) {
 if(baselineTest)return text;
 if(file==='src/app/catalog.js'){const anchor='35 道架构场景题 + 高可用项目精讲 + 面经场景问答';if(text.split(anchor).length!==2)throw Error('Question bank module description drift');return text.replace(anchor,'架构场景题 + 高可用项目精讲 + 面经场景问答');}
 if(file==='src/app/renderers.js') {
  const countAnchor="aside: '11 个维度'";
  if(text.split(countAnchor).length!==2)throw Error('Question bank scenario dimension anchor drift');
  text=text.replace(countAnchor,"aside: `${DIMS.filter(([k]) => e[k] && e[k].length).length} 个维度`");
  { const anchor="<div class=\"wide\"><span>关键指标</span><strong>${h(e.metrics || '—')}</strong></div>"; if(text.split(anchor).length!==2)throw Error('Question bank scenario summary anchor drift'); text=text.replace(anchor,()=>"${e.metrics ? `<div class=\"wide\"><span>关键指标</span><strong>${h(e.metrics)}</strong></div>` : ''}"); }
  { const anchor="<div class=\"wide\"><span>核心组件</span><strong>${h(e.components || '—')}</strong></div>"; if(text.split(anchor).length!==2)throw Error('Question bank scenario summary anchor drift'); text=text.replace(anchor,()=>"${e.components ? `<div class=\"wide\"><span>核心组件</span><strong>${h(e.components)}</strong></div>` : ''}"); }
  return text;
 }
 if(file!=='src/app/fragments.js')return text;
 const anchor="function hydrateCode(root) {\n";
 if(text.split(anchor).length!==2)throw Error("Question bank runtime anchor drift");
 return text.replace(anchor,()=>anchor+"  // Plain imported <pre><code> blocks use the same bounded, copyable card as authored examples.\n  $$('pre', root).forEach((pre) => {\n    if (pre.closest('.code-card, .md-code-card')) return;\n    const source = pre.textContent;\n    const match = (pre.querySelector('code')?.className || '').match(/(?:language-|lang-)([a-z0-9_-]+)/i);\n    const lang = match ? match[1].toLowerCase() : 'text';\n    const extension = ({java:'java',sql:'sql',python:'py',javascript:'js',cpp:'cpp',go:'go'})[lang] || 'txt';\n    const template = document.createElement('template');\n    template.innerHTML = codeCard(source, 'example.' + extension, {lang});\n    const card = template.content.firstElementChild;\n    card._code = source;\n    pre.replaceWith(card);\n  });\n" );
}

import {readFile,readdir,lstat} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
export const SUPPLEMENT_KINDS=['doc','ptopic','algo','pattern','database','handwrite','scenario','syntax'];
export const MODULES=['algo','code','design','bagu','ai','syntax','plan'];
const esc=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const digest=x=>createHash('sha256').update(x).digest('hex');
const fail=(where,message)=>{throw new Error(`${where}: ${message}`);};
const obj=(v,w)=>{if(!v||typeof v!=='object'||Array.isArray(v))fail(w,'must be an object');};
const text=(v,w)=>{if(typeof v!=='string'||!v.trim())fail(w,'must be a non-empty string');};
const list=(v,w)=>{if(!Array.isArray(v))fail(w,'must be an array');return v;};
const optionalList=(v,w)=>v==null?[]:list(v,w);
const id=(v,w)=>{text(v,w);if(!/^[a-z][a-z0-9-]*$/.test(v))fail(w,'use a stable lowercase ID with letters, digits and hyphens');};
const strings=(v,w)=>optionalList(v,w).forEach((x,i)=>text(x,`${w}[${i}]`));
const known=(v,keys,w)=>{for(const k of Object.keys(v))if(!keys.includes(k))fail(w,`unknown field "${k}"`);};
const paragraph=value=>String(value).split(/\n\s*\n/).map(p=>'<p class="md-p">'+esc(p).replaceAll('\n','<br>')+'</p>').join('');
function body(value,where) {
 if(typeof value==='string') {text(value,where);return paragraph(value);}
 obj(value,where);known(value,['format','value'],where);text(value.value,where+'.value');
 if(value.format==='text') return paragraph(value.value);
 if(value.format==='html') {
  // Explicit author-controlled rich HTML. This is not a general-purpose sanitizer:
  // refuse active markup; never feed unreviewed imports into this field.
  if(/<\s*(?:script|iframe|object|embed|style|link|meta|base|svg|math|form|input|button|textarea|select|audio|video)\b|\bon[a-z]+\s*=|(?:javascript|vbscript|data)\s*:|&#|&colon;/i.test(value.value)) fail(where,'unsafe rich HTML; use reviewed passive markup or format:"text"');
  if(/(?:javascript|vbscript|data):/i.test(value.value.replace(/[\u0000-\u0020]/g,''))) fail(where,'unsafe rich HTML URL');
  return value.value;
 }
 fail(where,'format must be "text" or explicit trusted "html"');
}
function validateRefs(refs,where,byId) {
 for(const [i,ref] of optionalList(refs,where).entries()) {
  obj(ref,`${where}[${i}]`);known(ref,['entryId','questionId','label'],where);text(ref.entryId,where+'.entryId');
  const entry=byId.get(ref.entryId);if(!entry)fail(where,`unknown related entry ${ref.entryId}`);
  if(ref.questionId!=null) {
   text(ref.questionId,where+'.questionId');
   if(!entry.items?.some((q,index)=>(q.id||String(index))===ref.questionId))fail(where,`unknown related question ${ref.entryId}/${ref.questionId}`);
  }
  if(ref.label!=null)text(ref.label,where+'.label');
 }
}
function refsHTML(refs,byId) {
 if(!refs?.length)return '';
 return '<h3 class="md-h md-h3">关联知识</h3><ul class="md-list">'+refs.map(r=>`<li><a href="#/e/${encodeURIComponent(r.entryId)}${r.questionId==null?'':'/'+encodeURIComponent(r.questionId)}">${esc(r.label||byId.get(r.entryId).title)}</a></li>`).join('')+'</ul>';
}
function codeHTML(blocks,where) {
 return optionalList(blocks,where).map((block,i)=>{
  obj(block,where);known(block,['language','label','value'],where);text(block.language,where+'.language');text(block.value,where+'.value');
  if(block.label!=null)text(block.label,where+'.label');
  return `<div class="code-card md-code-card"><div class="code-toolbar"><span class="file-label">${esc(block.label||block.language)}</span></div><div class="code-scroll"><pre class="md-pre" data-lang="${esc(block.language)}">${esc(block.value)}</pre></div></div>`;
 }).join('');
}
const labelledList=(label,items)=>items?.length?`<h3 class="md-h md-h3">${label}</h3><ul class="md-list">${items.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul>`:'';
function questionExplanation(q,where) {
 if(Object.hasOwn(q,'blocks')) {
  if(Object.hasOwn(q,'explanation')||Object.hasOwn(q,'code'))fail(where,'blocks and explanation/code are mutually exclusive');
  return structuredBlocks(q.blocks,where+'.blocks');
 }
 return body(q.explanation,where+'.explanation');
}
function sectionContent(section,where) {
 if(Object.hasOwn(section,'blocks')) {
  if(Object.hasOwn(section,'body')||Object.hasOwn(section,'code'))fail(where,'blocks and body/code are mutually exclusive');
  return structuredBlocks(section.blocks,where+'.blocks');
 }
 return body(section.body,where+'.body')+codeHTML(section.code,where+'.code');
}
function validateQuestion(q,where) {
 obj(q,where);known(q,['schemaVersion','draft','entryId','id','order','question','commonPhrasings','shortAnswer','explanation','blocks','followUps','code','tags','related','mustKnow'],where);
 if(q.schemaVersion!=null&&q.schemaVersion!==1)fail(where,'unsupported schemaVersion');
 id(q.id,where+'.id');if(!q.id.startsWith('q-'))fail(where+'.id','new question IDs must start with q-; never use a numeric position');
 if(q.order!=null&&!Number.isFinite(q.order))fail(where+'.order','must be a finite number');
 for(const key of ['question','shortAnswer'])text(q[key],where+'.'+key);
 questionExplanation(q,where);
 for(const key of ['commonPhrasings','followUps','tags'])strings(q[key],where+'.'+key);
 codeHTML(q.code,where+'.code');
 if(q.mustKnow!=null&&typeof q.mustKnow!=='boolean')fail(where+'.mustKnow','must be boolean');
 if(q.draft!=null&&typeof q.draft!=='boolean')fail(where+'.draft','must be boolean');
}
function compileQuestion(q,where,byId) {
 validateQuestion(q,where);validateRefs(q.related,where+'.related',byId);
 const lead='<p class="md-p sx-ess"><span class="sx-tag">本质</span>'+esc(q.shortAnswer).replaceAll('\n','<br>')+'</p>';
 return {id:q.id,q:esc(q.question),a:lead+questionExplanation(q,where)+labelledList('常见问法',q.commonPhrasings)+labelledList('追问',q.followUps)+(Object.hasOwn(q,'blocks')?'':codeHTML(q.code,where+'.code'))+labelledList('标签',q.tags)+refsHTML(q.related,byId),sub:'',mk:q.mustKnow||false,lead,leadType:'authored'};
}
export function validateLegacy(entries,identity) {
 const byId=new Map(entries.map(e=>[e.id,e]));
 if(byId.size!==entries.length)fail('content','duplicate entry ID');
 const legacyIds=new Set(identity.entries.map(e=>e.id));
 for(const e of entries)if(!legacyIds.has(e.id))fail(e.id,'new entries belong in authoring/entries/, not the frozen original chapter layer');
 for(const unit of identity.entries) {
  const e=byId.get(unit.id);if(!e)fail('legacy',`missing original entry ${unit.id}; retain its ID`);
  if(e.kind!==unit.kind||(e.progressKey||e.id)!==unit.progressKey)fail(unit.id,'original kind/progressKey cannot change');
  if(unit.questions) {
   if(!Array.isArray(e.items)||e.items.length!==unit.questions.length)fail(unit.id,'original questions cannot be inserted/removed in content/chapters; add a stable-ID question through authoring/questions/ instead');
   unit.questions.forEach((hash,i)=>{
    const q=e.items[i];if(q.id||digest(q.q)!==hash)fail(`${unit.id}#${i}`,'legacy question inserted/reordered/renamed: restore its original position and wording; edit its answer normally, or add a new stable-ID question through authoring/questions/');
   });
  }
 }
}
export async function readAuthoring(root) {
 const documents=[];
 for(const type of ['entries','questions','answer-additions','supplements']) {
  const dir=path.join(root,'authoring',type);let names=[];
  try{names=await readdir(dir);}catch(error){if(error.code!=='ENOENT')throw error;}
  for(const name of names.filter(n=>n.endsWith('.json')).sort()) {
   const file=path.join('authoring',type,name);let data;
   try{data=JSON.parse(await readFile(path.join(root,file),'utf8'));}catch(error){fail(file,'invalid JSON: '+error.message);}
   // Only vetted local image paths are inspected; never resolve author-supplied
   // arbitrary paths or follow symlinks outside the imported asset tree.
   const blockOwners=type==='entries'
    ? (data?.kind==='qa'&&Array.isArray(data.questions)?data.questions:data?.kind==='doc'&&Array.isArray(data.sections)?data.sections:[])
    : [data];
   for(const owner of blockOwners)if(Array.isArray(owner?.blocks)) {
    for(const block of owner.blocks)if(block?.type==='image') {
     const relative=importedImagePath(block.src,file+'.blocks.image.src');
     const parts=['public',...relative.split('/')];let current=root;
     for(const [i,part] of parts.entries()) {
      current=path.join(current,part);let info;
      try{info=await lstat(current);}catch(error){if(error.code==='ENOENT')fail(file,'missing imported image asset '+relative);throw error;}
      if(info.isSymbolicLink())fail(file,'image asset path cannot contain symlinks');
      if(i===parts.length-1?!info.isFile():!info.isDirectory())fail(file,'invalid imported image asset '+relative);
     }
    }
   }
   documents.push({type,file,data});
  }
 }
 return documents;
}
export function compileUnextendedAuthoring(originalEntries,documents,identity) {
 const entries=structuredClone(originalEntries);validateLegacy(entries,identity);
 const byId=new Map(entries.map(e=>[e.id,e]));
 const entryDocs=documents.filter(d=>d.type==='entries')
  .sort((a,b)=>String(a.file).localeCompare(String(b.file),'en')||String(a.data.id).localeCompare(String(b.data.id),'en'));
 const queue=[];const seenEntryIds=new Set(byId.keys());const seenQuestions=new Set();
 for(const doc of entryDocs) {
  const {data:d,file:w}=doc;obj(d,w);known(d,['schemaVersion','draft','id','kind','module','part','category','title','number','source','tags','related','questions','sections'],w);
  if(d.schemaVersion!==1)fail(w,'schemaVersion must be 1');id(d.id,w+'.id');
  if(seenEntryIds.has(d.id))fail(w,`duplicate entry ID ${d.id}`);seenEntryIds.add(d.id);
  if(!['qa','doc'].includes(d.kind))fail(w,'kind must be qa or doc');
  if(!MODULES.includes(d.module))fail(w,'unknown module; use '+MODULES.join(', '));
  for(const k of ['part','category','title'])text(d[k],w+'.'+k);
  strings(d.tags,w+'.tags');
  if(d.source!=null)text(d.source,w+'.source');
  if(d.number!=null&&!['string','number'].includes(typeof d.number))fail(w+'.number','must be a string or number');
  if(d.draft!=null&&typeof d.draft!=='boolean')fail(w+'.draft','must be boolean');
  if(d.kind==='qa')list(d.questions,w+'.questions').forEach((q,i)=>{validateQuestion(q,`${w}.questions[${i}]`);const key=d.id+'#'+q.id;if(seenQuestions.has(key))fail(w,'duplicate question ID '+key);seenQuestions.add(key);});
  else list(d.sections,w+'.sections').forEach((section,i)=>{obj(section,w);known(section,['id','title','body','code','blocks'],w);id(section.id,w+'.section.id');text(section.title,w+'.section.title');sectionContent(section,`${w}.sections[${i}]`);});
  if(d.kind==='doc'&&!d.draft&&!d.sections.length)fail(w,'active knowledge entry needs at least one section');
  if(d.draft)continue;
  const e={id:d.id,kind:d.kind,mod:d.module,part:d.part,cat:d.category,title:d.title,number:d.number??'',source:d.source||'自建知识库'};
  if(d.kind==='qa')e.items=[];else e.html='';entries.push(e);byId.set(e.id,e);queue.push(doc);
 }
 // First create every stable question identity, so references may point forward.
 const additions=new Map();
 const add=(entryId,q,file)=>{
  const e=byId.get(entryId);if(!e)fail(file,`unknown or draft target entry ${entryId}`);if(e.kind!=='qa')fail(file,'questions require a QA target entry');
  if(!additions.has(entryId))additions.set(entryId,[]);additions.get(entryId).push({q,file});
 };
 for(const {data:d,file} of queue)if(d.kind==='qa')for(const q of d.questions)if(!q.draft)add(d.id,q,file);
 for(const {data:q,file} of documents.filter(d=>d.type==='questions')) {
  validateQuestion(q,file);text(q.entryId,file+'.entryId');const key=q.entryId+'#'+q.id;
  if(seenQuestions.has(key)||byId.get(q.entryId)?.items?.some(x=>x.id===q.id))fail(file,'duplicate question ID '+key);seenQuestions.add(key);
  if(!q.draft)add(q.entryId,q,file);
 }
 for(const [entryId,items] of additions) {
  items.sort((a,b)=>(a.q.order||0)-(b.q.order||0)||a.q.id.localeCompare(b.q.id,'en'));
  const e=byId.get(entryId);e.items.push(...items.map(({q})=>({id:q.id})));
 }
 for(const [entryId,items] of additions) {
  const e=byId.get(entryId);const offset=e.items.length-items.length;
  items.forEach(({q,file},i)=>{e.items[offset+i]=compileQuestion(q,file,byId);});
 }
 for(const {data:d,file} of queue) {
  const e=byId.get(d.id);validateRefs(d.related,file+'.related',byId);
  if(d.kind==='doc') {
   const ids=new Set();
   e.html=d.sections.map(section=>{if(ids.has(section.id))fail(file,'duplicate section ID '+section.id);ids.add(section.id);return `<h2 class="md-h md-h2" id="${esc(section.id)}">${esc(section.title)}</h2>`+sectionContent(section,file+'.sections');}).join('')+labelledList('标签',d.tags)+refsHTML(d.related,byId);
  } else {
   if(!e.items.length)fail(file,'active QA entry needs at least one active question');
   if(d.tags?.length||d.related?.length)e.items[0].a+=labelledList('标签',d.tags)+refsHTML(d.related,byId);
  }
 }
 return entries;
}

// Compile all authored identities/content once, then freeze the hash boundary before
// any extension is applied. The helper never evaluates extension documents.
export function compileAuthoring(originalEntries,documents,identity) {
 const snapshot=compileUnextendedAuthoring(originalEntries,documents,identity);
 const entries=structuredClone(snapshot);
 applyExtensions(originalEntries,entries,documents,new Map(entries.map(e=>[e.id,e])),snapshot);
 return entries;
}
function authoredTarget(snapshot,type,data,where='extension') {
 if(type!=='answer-additions')fail(where,'authored targetOrigin supports answer-additions only');
 if(typeof data.questionId!=='string'||!/^q-[a-z0-9-]+$/.test(data.questionId))fail(where,'authored questionId must be a stable q- ID, never a numeric position');
 const entry=snapshot.find(e=>e.id===data.entryId);
 if(!entry)fail(where,'unknown or draft authored target entry '+data.entryId);
 if(entry.kind!=='qa')fail(where,'authored answer addition requires a QA target');
 const question=entry.items.find(q=>q.id===data.questionId&&q.leadType==='authored');
 if(!question)fail(where,'unknown or draft authored target question '+data.questionId);
 return question;
}
export function authoredExtensionTarget(originalEntries,documents,identity,data,where='extension') {
 if(data.targetOrigin!=='authored')fail(where,'authored helper requires explicit targetOrigin:"authored"');
 return authoredTarget(compileUnextendedAuthoring(originalEntries,documents,identity),'answer-additions',data,where);
}

// Lock additions to the exact original target, not to previously generated HTML.
// Hashing JSON uses the source property order; scaffolding computes it for authors.
export const originalContentHash = value => digest(JSON.stringify(value));
export function extensionTarget(originalEntries,type,data,where='extension') {
 const entry=originalEntries.find(e=>e.id===data.entryId);
 if(!entry)fail(where,'unknown original target entry '+data.entryId);
 if(type==='answer-additions') {
  if(entry.kind!=='qa')fail(where,'answer addition requires an original QA target');
  if(typeof data.questionId!=='string'||!/^(0|[1-9][0-9]*)$/.test(data.questionId))fail(where,'questionId must be an exact original zero-based index string');
  const question=entry.items[Number(data.questionId)];
  if(!question)fail(where,'unknown original target question '+data.questionId);
  return question;
 }
 if(!SUPPLEMENT_KINDS.includes(entry.kind))fail(where,'supplement requires a supported original non-QA target: '+SUPPLEMENT_KINDS.join(', '));
 return entry;
}
function extensionBody(value,where) {
 // Source imports cannot opt into raw HTML, even when marked as reviewed.
 if(typeof value!=='string') {
  obj(value,where);known(value,['format','value'],where);
  if(value.format!=='text')fail(where,'extensions require format:"text"; raw HTML is prohibited');
 }
 return body(value,where);
}
function applyExtensions(originalEntries,entries,documents,byId,snapshot) {
 const ids=new Set(),passages=new Set();
 const docs=documents.filter(d=>['answer-additions','supplements'].includes(d.type))
  .sort((a,b)=>String(a.data.id).localeCompare(String(b.data.id),'en'));
 for(const {type,data:d,file:w} of docs) {
  obj(d,w);known(d,['schemaVersion','draft','id','entryId','questionId','targetOrigin','expectedOriginalHash','title','body','code','blocks','related'],w);
  if(d.schemaVersion!==1)fail(w,'schemaVersion must be 1');id(d.id,w+'.id');
  if(!d.id.startsWith('add-'))fail(w,'extension ID must start with add-');
  if(ids.has(d.id))fail(w,'duplicate addition ID '+d.id);ids.add(d.id);
  text(d.entryId,w+'.entryId');text(d.title,w+'.title');
  if(type==='supplements'&&d.questionId!=null)fail(w,'supplement cannot specify questionId');
  if(d.draft!=null&&typeof d.draft!=='boolean')fail(w,'draft must be boolean');
  const origin=d.targetOrigin===undefined?'original':d.targetOrigin;
  if(!['original','authored'].includes(origin))fail(w,'targetOrigin must be original or authored');
  const target=origin==='authored'?authoredTarget(snapshot,type,d,w):extensionTarget(originalEntries,type,d,w);
  if(d.expectedOriginalHash!==originalContentHash(target))fail(w,'mismatched expectedOriginalHash; recheck original target and source');
  const hasBlocks=Object.hasOwn(d,'blocks');
  if(hasBlocks&&(Object.hasOwn(d,'body')||Object.hasOwn(d,'code')))fail(w,'blocks and body/code are mutually exclusive');
  const content=hasBlocks?structuredBlocks(d.blocks,w+'.blocks'):extensionBody(d.body,w+'.body')+codeHTML(d.code,w+'.code');
  validateRefs(d.related,w+'.related',byId);
  const passage=JSON.stringify([origin,d.entryId,d.questionId??null,content]);
  if(passages.has(passage))fail(w,'duplicate addition content for the same target');passages.add(passage);
  if(d.draft)continue;
  const e=byId.get(d.entryId);
  const html=`<h2 class="md-h md-h2" id="${esc(d.id)}">${esc(d.title)}</h2>`+content+refsHTML(d.related,byId);
  if(type==='answer-additions') {
   const question=origin==='authored'?e.items.find(q=>q.id===d.questionId):e.items[Number(d.questionId)];
   question.a+=html;
  }
  else e.supplementHtml=(e.supplementHtml||'')+html;
 }
}

export function importedImagePath(value,where) {
 text(value,where);
 // Deliberately exclude remote URLs, percent encodings, queries, fragments,
 // traversal, backslashes, SVG and active document formats.
 if(!/^assets\/imported\/(?:[a-zA-Z0-9][a-zA-Z0-9_-]*\/)*[a-zA-Z0-9][a-zA-Z0-9_.-]*\.(?:png|jpe?g|webp|gif|avif)$/i.test(value)||value.includes('..'))fail(where,'image src must be a local raster path under assets/imported/');
 return value;
}
export function structuredBlocks(blocks,where='blocks') {
 list(blocks,where);if(!blocks.length)fail(where,'must contain at least one block');
 return blocks.map((b,i)=>{
  const w=`${where}[${i}]`;obj(b,w);
  switch(b.type) {
   case 'paragraph':
    known(b,['type','text'],w);text(b.text,w+'.text');return paragraph(b.text);
   case 'heading':
    known(b,['type','level','text'],w);text(b.text,w+'.text');
    if(![2,3,4].includes(b.level))fail(w,'heading level must be 2, 3 or 4');
    return `<h${b.level} class="md-h md-h${b.level}">${esc(b.text)}</h${b.level}>`;
   case 'list': {
    known(b,['type','ordered','items'],w);
    if(typeof b.ordered!=='boolean')fail(w,'ordered must be boolean');
    list(b.items,w+'.items');strings(b.items,w+'.items');if(!b.items.length)fail(w,'list cannot be empty');
    const tag=b.ordered?'ol':'ul';return `<${tag} class="md-list">`+b.items.map(x=>`<li>${esc(x)}</li>`).join('')+`</${tag}>`;
   }
   case 'table':
    known(b,['type','headers','rows'],w);list(b.headers,w+'.headers');strings(b.headers,w+'.headers');
    if(!b.headers.length)fail(w,'table headers cannot be empty');
    list(b.rows,w+'.rows');if(!b.rows.length)fail(w,'table rows cannot be empty');
    for(const row of b.rows) {list(row,w+'.row');if(row.length!==b.headers.length)fail(w,'table row width must match headers');for(const cell of row)if(typeof cell!=='string')fail(w,'table cells must be strings');}
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr>'+b.headers.map(x=>`<th>${esc(x)}</th>`).join('')+'</tr></thead><tbody>'+b.rows.map(row=>'<tr>'+row.map(x=>`<td>${esc(x)}</td>`).join('')+'</tr>').join('')+'</tbody></table></div>';
   case 'code': {
    known(b,['type','language','label','value'],w);const {type,...code}=b;return codeHTML([code],w);
   }
   case 'image':
    known(b,['type','src','alt'],w);text(b.alt,w+'.alt');
    return `<img src="${esc(importedImagePath(b.src,w+'.src'))}" alt="${esc(b.alt)}" loading="lazy" decoding="async">`;
   default:fail(w,'unknown block type '+b.type);
  }
 }).join('');
}

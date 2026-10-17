// Finite, reviewed reading projection; source documents remain immutable.
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function projectInterviewReading(entries,policy,{baselineTest=false}={}) {
 if(baselineTest)return {entries,archivedRoutes:{},sourceArchive:[],report:null};
 if(policy?.schemaVersion!==1)throw Error('Invalid interview reading policy');
 const originals=new Map(entries.map(e=>[e.id,e])), projected=structuredClone(entries), byId=new Map(projected.map(e=>[e.id,e]));
 const archived=new Set(policy.archivedEntries.map(e=>e.id)), archivedRoutes={};
 if(archived.size!==policy.archivedEntries.length)throw Error('Duplicate archived ID');
 for(const rule of policy.archivedEntries){
  if(!byId.has(rule.id)||!byId.has(rule.ownerId)||archived.has(rule.ownerId))throw Error('Invalid archive owner: '+rule.id);
  archivedRoutes[rule.id]={ownerId:rule.ownerId,mod:byId.get(rule.ownerId).mod};
 }
 const seen=new Set();
 for(const field of policy.fields){
  const key=field.entryId+'/'+JSON.stringify(field.path);
  if(seen.has(key)||archived.has(field.entryId))throw Error('Duplicate or archived field: '+key);seen.add(key);
  let value=byId.get(field.entryId);if(!value)throw Error('Unknown projection entry: '+key);
  for(const part of field.path.slice(0,-1))value=value[part];
  const last=field.path.at(-1);
  if(sha(value[last])!==field.sha256||sha(field.before)!==field.sha256||sha(field.after)!==field.afterSha256)throw Error('Reading source hash mismatch: '+key);
  value[last]=field.after;
 }
 const transferred=new Set();
 for(const transfer of policy.knowledgeTransfers||[]) {
  const transferId=transfer.id||transfer.sourceId;if(transferred.has(transferId))throw Error('Duplicate knowledge transfer: '+transferId);transferred.add(transferId);
  const source=originals.get(transfer.sourceId),owner=byId.get(transfer.ownerId);
  let sourceHtml=source;for(const key of transfer.sourcePath||['html'])sourceHtml=sourceHtml?.[key];
  if(typeof sourceHtml!=='string')throw Error('Missing knowledge source field: '+transfer.sourceId);
  if(!owner||Object.entries(transfer.ownerIdentity||{}).length!==3||Object.entries(transfer.ownerIdentity).some(([key,value])=>owner[key]!==value))throw Error('Knowledge owner identity mismatch: '+transfer.ownerId);
  if(!archived.has(transfer.sourceId)||!owner||archived.has(transfer.ownerId)||sha(sourceHtml)!==transfer.sourceHtmlSha256||sha(transfer.html)!==transfer.htmlSha256)throw Error('Invalid knowledge transfer: '+transfer.sourceId);
  owner.readingNotesHtml=(owner.readingNotesHtml||'')+transfer.html;
 }
 const restoredBlocks=new Set();
 for(const rule of policy.knowledgeRestorations||[]){
  if(restoredBlocks.has(rule.id))throw Error('Duplicate knowledge restoration: '+rule.id);restoredBlocks.add(rule.id);
  let field=originals.get(rule.sourceId);for(const key of rule.sourcePath||[])field=field?.[key];
  const owner=byId.get(rule.ownerId);
  if(typeof field!=='string'||sha(field)!==rule.sourceFieldSha256||!field.includes(rule.sourceBlock)||createHash('sha256').update(rule.sourceBlock).digest('hex')!==rule.sourceBlockSha256)throw Error('Knowledge restoration source mismatch: '+rule.id);
  if(!owner||archived.has(rule.ownerId)||Object.keys(rule.ownerIdentity||{}).length!==3||Object.entries(rule.ownerIdentity).some(([k,v])=>owner[k]!==v))throw Error('Knowledge restoration owner mismatch: '+rule.id);
  if(sha(rule.html)!==rule.htmlSha256||/<pre\b|<code\b|class=["'][^"']*\bcode-card\b|<(?:script|iframe|object|embed|style|link)\b|\bon[a-z]+\s*=|javascript:/i.test(rule.html))throw Error('Knowledge restoration output mismatch: '+rule.id);
  if(rule.destinationPath){
   if(rule.sourceId!==rule.ownerId||JSON.stringify(rule.destinationPath)!==JSON.stringify(rule.sourcePath))throw Error('Invalid knowledge restoration destination: '+rule.id);
   let destination=owner;for(const key of rule.destinationPath.slice(0,-1))destination=destination?.[key];const key=rule.destinationPath.at(-1);
   if(!destination||typeof destination[key]!=='string')throw Error('Missing knowledge restoration destination: '+rule.id);
   destination[key]+=rule.html;
  }else{
   if(typeof rule.contextLabel!=='string'||!rule.contextLabel.trim())throw Error('Missing knowledge restoration context: '+rule.id);
   const label=rule.contextLabel.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
   owner.readingNotesHtml=(owner.readingNotesHtml||'')+'<details class="reading-example"><summary>补充示例：'+label+'</summary>'+rule.html+'</details>';
  }
 }
 const visible=projected.filter(e=>!archived.has(e.id));
 // Fail closed before build.mjs removes or publishes any dist files.
 const theory=new Set(['bagu','ai','design','plan']);
 if(JSON.stringify([...(policy.theoryModules||[])].sort())!==JSON.stringify([...theory].sort()))throw Error('Invalid theory module scope');
 const inspect=(entry,value,path=[])=>{
  if(typeof value==='string'){
   if(/<pre\b|class=["'][^"']*\bcode-card\b/i.test(value)||(value.trim()&&(path.length===1&&path[0]==='code'||path[0]==='codeSkeletons'&&path.at(-1)==='code')))throw Error('Unprojected theory listing: '+entry.id+'/'+path.join('/'));
  }else if(value&&typeof value==='object')for(const [key,item]of Object.entries(value))inspect(entry,item,[...path,key]);
 };
 for(const entry of visible)if(theory.has(entry.mod))inspect(entry,entry);
 const allowedDocs=new Map((policy.visibleCodeDocuments||[]).map(rule=>{if(typeof rule.reason!=='string'||!rule.reason.trim())throw Error('Missing code document rationale: '+rule.id);return [rule.id,rule];}));
 if(allowedDocs.size!==(policy.visibleCodeDocuments||[]).length)throw Error('Duplicate visible code document');
 for(const entry of visible.filter(e=>e.kind==='doc')){
  const hasListing=/<pre\b|class=["'][^"']*\bcode-card\b/i.test(JSON.stringify(entry));
  if(hasListing){const rule=allowedDocs.get(entry.id);if(!rule||rule.kind!==entry.kind||rule.mod!==entry.mod||rule.htmlSha256!==sha(entry.html||''))throw Error('Unreviewed code companion: '+entry.id);allowedDocs.delete(entry.id);}
 }
 if(allowedDocs.size)throw Error('Missing reviewed code document: '+[...allowedDocs.keys()].join(','));
 const count=list=>Object.fromEntries(['algo','code','syntax','bagu','ai','design','plan'].map(mod=>[mod,list.filter(e=>e.mod===mod).reduce((n,e)=>n+(JSON.stringify(e).match(/<pre\b/g)||[]).length+(e.code?1:0)+(e.codeSkeletons?.snippets?.filter(s=>s.code).length||0),0)]));
 const units=list=>list.reduce((n,e)=>n+(e.kind==='qa'?e.items.length:1),0);
 return {entries:visible,archivedRoutes,sourceArchive:entries,report:{beforeEntries:entries.length,afterEntries:visible.length,beforeUnits:units(entries),afterUnits:units(visible),beforeCodeListings:count(entries),afterCodeListings:count(visible),archivedIds:[...archived],changedFields:policy.fields.length,sourceEntriesPreserved:entries.length,knowledgeRestorations:(policy.knowledgeRestorations||[]).map(r=>({id:r.id,sourceId:r.sourceId,ownerId:r.ownerId})),knowledgeTransfers:(policy.knowledgeTransfers||[]).map(t=>({sourceId:t.sourceId,ownerId:t.ownerId,characters:t.html.length}))}};
}
export function projectInterviewRuntime(file,text,{baselineTest=false}={}) {
 if(baselineTest)return text;
 function replace(before,after){if(!text.includes(before))throw Error('Reading runtime anchor missing: '+file);text=text.replace(before,after);}
 if(file==='src/app/catalog.js')replace("full: '算法手撕'", "full: '算法与数据结构'");
 if(file==='src/app/dashboard.js'){
  replace('这里把算法手撕、场景设计', '这里把算法与数据结构、场景设计');
  replace('Redis 快的核心是内存访问、单线程无锁、IO 多路复用和高效数据结构。', 'Redis 快的核心是内存访问、多数命令串行执行以减少锁竞争、IO 多路复用和高效数据结构。');
  replace('每个知识点都准备一句项目落地，证明不是背题。', '有真实经历就联系项目；没有则说明设计思路，不虚构落地。');
  replace('答题心法 <small>来自《春招准备总规划》第 6 节</small>', '答题心法');
 }
 if(file==='src/app/routing.js'){
  replace("  // 兼容 v7 书签：#<id>","  const archivedId = parts[0] === 'e' ? parts[1] : parts.join('/');\n  if (DATA.archivedRoutes?.[archivedId]) return { view: 'archived', id: archivedId };\n  // 兼容 v7 书签：#<id>");
  replace("const mod = (r.view === 'home' || r.view === 'nf') ? 'home' : e ? e.mod : r.mod;","const mod = (r.view === 'home' || r.view === 'nf') ? 'home' : r.view === 'archived' ? DATA.archivedRoutes[r.id].mod : e ? e.mod : r.mod;");
  replace("if (r.view === 'nf') html = renderNotFound(r.id);","if (r.view === 'archived') { const owner = byId.get(DATA.archivedRoutes[r.id].ownerId); html = '<section class=\"hero\"><h1>实现参考已归档</h1><p>本页原始源码与历史进度已保留。面试阅读请从问题、原理、适用条件与取舍继续。</p><p><a class=\"btn primary\" href=\"' + href(owner) + '\">继续学习：' + h(owner.title) + '</a></p></section>'; }\n    else if (r.view === 'nf') html = renderNotFound(r.id);");
 }
 if(file==='src/app/fragments.js'){
  replace("  return `${e.kind!=='qa'&&e.supplementHtml", "  return `${e.kind!=='qa'&&e.readingNotesHtml ? '<section class=\"md sec\">'+e.readingNotesHtml+'</section>' : ''}${e.kind!=='qa'&&e.supplementHtml");
 }
 if(file==='src/app/renderers.js'){
  replace("${qaListHtml(shown)}","${qaListHtml(shown)}\n    ${e.readingNotesHtml ? sec('补充知识与适用边界', '<div class=\"md\">'+e.readingNotesHtml+'</div>') : ''}");
  replace("${codeCard(s.code, 'Skeleton.java')}","${s.code ? codeCard(s.code, 'Skeleton.java') : ''}");
 }
 return text;
}

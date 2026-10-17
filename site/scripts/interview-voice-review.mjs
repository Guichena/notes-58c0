import {createHash} from 'node:crypto';
import {readdir, readFile} from 'node:fs/promises';
export const sha256 = value => createHash('sha256').update(value).digest('hex');
const technicalSpans = s => [...s.matchAll(/<pre\b[^>]*>[\s\S]*?<\/pre>|<code\b[^>]*>[\s\S]*?<\/code>/gi)].map(m=>m[0]);
const fail = message => { throw Error('Interview voice review: ' + message); };
const identityKeys = ['id','kind','mod','part','cat','title','number','progressKey'];
const roots = new Set(['items','html','lead','readingNotesHtml','supplementHtml','simple','code','summary','recognize','notApplicable','templates','variants','pitfalls','groups','folds','subtitle','problemDecomposition','capacityEstimation','architectureEvolution','tradeoffMatrix','codeSkeletons','failureModes','observability','problemMap','interviewPitch','questionHtml','analysisHtml','knowledge','answerHtml','relatedHtml','idea','description','metrics','components','requirements','architecture','dataFlow','keyPoints','followups','capacityPlan','consistency','interviewAnswer','tradeoffs','security','boundaryCases']);
const protectedKeys = new Set(['__proto__','prototype','constructor','id','mk','progressKey','q','title','name','topic','topicName','href','url','slug','relatedIds','source','from','sub','number','category','cat','mod','part','kind','group','linkLabel','statement','req','demoMain','expected']);
export const entryIdentity = e => Object.fromEntries(identityKeys.filter(k=>Object.hasOwn(e,k)).map(k=>[k,e[k]]));
export const questionIdentity = (e,p) => p[0]==='items' ? {index:p[1],...Object.fromEntries(['id','mk','q'].filter(k=>Object.hasOwn(e.items[p[1]],k)).map(k=>[k,e.items[p[1]][k]]))} : undefined;
export function answerFields(e) {
 const result=[];
 const visit=(v,p)=>{
  if(typeof v==='string'){if(v.trim())result.push({path:p,before:v,beforeSha256:sha256(v)});return;}
  if(Array.isArray(v)){v.forEach((x,i)=>visit(x,[...p,i]));return;}
  if(v&&typeof v==='object')for(const [k,x]of Object.entries(v))if(!protectedKeys.has(k))visit(x,[...p,k]);
 };
 for(const [k,v]of Object.entries(e))if(roots.has(k)) {
  if(k==='items')e.items.forEach((it,i)=>{for(const f of ['a','lead'])if(typeof it[f]==='string')visit(it[f],['items',i,f]);});
  else if(k==='simple'){for(const f of ['analysis','cx'])if(typeof v[f]==='string')visit(v[f],['simple',f]);}
  else if(k==='groups'){v.forEach((g,i)=>{if(g.note)visit(g.note,['groups',i,'note']);});}
  else visit(v,[k]);
 }
 return result;
}
export async function readInterviewVoiceReview(root) {
 const dir=new URL('../content/interview-voice-review/',import.meta.url);
 const files=(await readdir(dir)).filter(f=>f.endsWith('.json')).sort();
 const records=[];
 for(const file of files){const shard=JSON.parse(await readFile(new URL(file,dir),'utf8'));if(shard.schemaVersion!==1||!Array.isArray(shard.records))fail('invalid shard '+file);records.push(...shard.records);}
 return {schemaVersion:1,records};
}
export function projectInterviewVoiceReview(entries,registry,{baselineTest=false,reverse=false}={}) {
 if(baselineTest)return entries;
 if(registry?.schemaVersion!==1||!Array.isArray(registry.records))fail('invalid registry');
 const byId=new Map(entries.map(e=>[e.id,e]));if(byId.size!==entries.length)fail('duplicate entry');
 const seen=new Set(),allowed=new Map();
 for(const r of registry.records){
  const e=byId.get(r.entryId);if(!e)fail('missing entry '+r.entryId);
  if(!Array.isArray(r.path)||r.path.some(k=>typeof k==='string'&&['__proto__','prototype','constructor'].includes(k)))fail('unsafe path');
  const key=JSON.stringify([r.entryId,r.path]);if(seen.has(key))fail('duplicate target '+key);seen.add(key);
  if(!allowed.has(e.id))allowed.set(e.id,new Set(answerFields(e).map(f=>JSON.stringify(f.path))));
  if(!allowed.get(e.id).has(JSON.stringify(r.path)))fail('non-answer field '+key);
  if(JSON.stringify(entryIdentity(e))!==JSON.stringify(r.entryIdentity))fail('entry identity drift '+key);
  if(JSON.stringify(questionIdentity(e,r.path))!==JSON.stringify(r.questionIdentity))fail('question identity drift '+key);
  if(typeof r.before!=='string'||typeof r.after!=='string'||!r.after.trim()||sha256(r.before)!==r.beforeSha256||sha256(r.after)!==r.afterSha256)fail('hash/type mismatch '+key);
  if(!r.review||typeof r.review!=='object'||typeof r.review.rationale!=='string'||!r.review.rationale.trim())fail('explicit review rationale required '+key);
  const technicalField = ['code','java','formula'].includes(r.path.at(-1));
  if ((technicalField && r.before!==r.after || JSON.stringify(technicalSpans(r.before))!==JSON.stringify(technicalSpans(r.after))) && !(typeof r.review.technicalChangeRationale==='string' && r.review.technicalChangeRationale.trim())) fail('code/formula change requires separate justification '+key);
  const value=r.path.reduce((v,k)=>v?.[k],e),expected=reverse?r.after:r.before;
  if(value!==expected||sha256(value)!==(reverse?r.afterSha256:r.beforeSha256))fail('stale input '+key);
 }
 if(!registry.records.length)return entries;
 const targets=new Set(registry.records.map(r=>r.entryId));
 const out=entries.map(e=>targets.has(e.id)?structuredClone(e):e),outById=new Map(out.map(e=>[e.id,e]));
 for(const r of registry.records){const parent=r.path.slice(0,-1).reduce((v,k)=>v[k],outById.get(r.entryId));parent[r.path.at(-1)]=reverse?r.before:r.after;}
 return out;
}

import {readdir,readFile} from 'node:fs/promises';
import {projectInterviewVoiceReview,answerFields,entryIdentity,questionIdentity,sha256} from './interview-voice-review.mjs';
const fail=message=>{throw Error('Interview consolidation: '+message);};
const technicalSpans=s=>[...s.matchAll(/<pre\b[^>]*>[\s\S]*?<\/pre>|<code\b[^>]*>[\s\S]*?<\/code>/gi)].map(m=>m[0]);
export async function readInterviewConsolidation(){
 const dir=new URL('../content/interview-consolidation/',import.meta.url),records=[];
 for(const file of (await readdir(dir)).filter(f=>f.endsWith('.json')).sort()){
  const shard=JSON.parse(await readFile(new URL(file,dir),'utf8'));
  if(shard.schemaVersion!==1||!Array.isArray(shard.records))fail('invalid shard '+file);
  records.push(...shard.records);
 }
 return {schemaVersion:1,records};
}
// Consolidation is deliberately separate from voice editing. Its only permitted
// changes are exact, reviewed prose replacements backed by preservation evidence.
export function projectInterviewConsolidation(entries,registry,{baselineTest=false,reverse=false}={}){
 if(baselineTest)return entries;
 // Reuse all identity, answer-path, prototype, hash, stale-input and clone guards.
 const projected=projectInterviewVoiceReview(entries,registry,{reverse});
 const finalEntries=reverse?entries:projected,byId=new Map(finalEntries.map(e=>[e.id,e]));
 for(const r of registry.records){
  const key=JSON.stringify([r.entryId,r.path]);
  if(r.path.some(p=>['code','java','formula','codeSkeletons'].includes(p))||JSON.stringify(technicalSpans(r.before))!==JSON.stringify(technicalSpans(r.after)))fail('technical content must remain exact '+key);
  if(!Array.isArray(r.review.preservation)||!r.review.preservation.length)fail('preservation mapping required '+key);
  let expected=r.before;
  for(const mapping of r.review.preservation){
   if(!mapping||typeof mapping.removedText!=='string'||!mapping.removedText.trim()||typeof mapping.replacementText!=='string'||typeof mapping.rationale!=='string'||!mapping.rationale.trim())fail('invalid prose removal mapping '+key);
   if(technicalSpans(mapping.removedText).length||technicalSpans(mapping.replacementText).length)fail('technical spans cannot be removed or replaced '+key);
   const parts=expected.split(mapping.removedText);
   if(parts.length!==2)fail('removal must match exactly once '+key);
   if(mapping.removedText===mapping.replacementText)fail('mapping must remove duplicate prose '+key);
   expected=parts.join(mapping.replacementText);
   const retained=mapping.retained,e=byId.get(retained?.entryId);
   if(!e||!Array.isArray(retained.path))fail('missing retained target '+key);
   const field=answerFields(e).find(f=>JSON.stringify(f.path)===JSON.stringify(retained.path));
   if(!field||typeof retained.excerpt!=='string'||!retained.excerpt.trim()||!field.before.includes(retained.excerpt)||field.beforeSha256!==retained.fieldSha256)fail('retained evidence missing or stale '+key);
   if(JSON.stringify(entryIdentity(e))!==JSON.stringify(retained.entryIdentity)||JSON.stringify(questionIdentity(e,retained.path))!==JSON.stringify(retained.questionIdentity))fail('retained identity drift '+key);
  }
  if(expected!==r.after||sha256(expected)!==r.afterSha256)fail('changes exceed reviewed removal mappings '+key);
 }
 return projected;
}

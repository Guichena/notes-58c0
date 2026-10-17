import {createHash} from 'node:crypto';
const sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export const VOICE_REGISTRY_SHA256='0b66d0a5e27b80aa26d5d15deaa0b7882f78ebddde4c0091573e030ef8436ea1';
const fail=m=>{throw Error('Voice factual correction: '+m);};
function check(r){if(!r||sha(r)!==VOICE_REGISTRY_SHA256)fail('registry integrity mismatch');}
export function projectVoiceMetadata(metadata,r,{baselineTest=false}={}){
 if(baselineTest)return metadata;check(r);
 if(sha(metadata?.HL?.cards?.[r.card.key])!==r.card.expectedOriginalHash)fail('stale card');
 const out=structuredClone(metadata);out.HL.cards[r.card.key]=structuredClone(r.card.newCard);return out;
}
export function projectVoiceEntries(entries,originalEntries,r,{baselineTest=false}={}){
 if(baselineTest)return entries;check(r);
 const entryId='ai-模型与评测-7',original=originalEntries.find(e=>e.id===entryId)?.items?.[2];
 if(sha(original)!==r.expectedOriginalItemHash||original?.q!==r.question)fail('stale original item');
 if(entries.filter(e=>e.id===entryId).length!==1)fail('missing or duplicate target');
 const entry=entries.find(e=>e.id===entryId),item=entry.items?.[2];
 if(item?.q!==r.question)fail('stale target question');
 const answer=r.fields[0],lead=r.fields[1];
 if(item.a!==answer.before+r.allowedExistingSuffix||sha(item.lead)!==lead.beforeHash)fail('stale answer, lead or unexpected suffix');
 const out=structuredClone(entries),target=out.find(e=>e.id===entryId).items[2];
 target.a=answer.after+r.allowedExistingSuffix;target.lead=lead.after;return out;
}

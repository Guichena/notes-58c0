import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
// The old exact comparison correction is applied to its own reviewed checkpoint.
// Every subsequently changed answer with a card needs an explicit final paired review.
export function validateFinalAuditMetadata(metadata,before,after,registry,{baselineTest=false}={}){
 if(baselineTest)return metadata;
 if(registry?.schemaVersion!==1||!Array.isArray(registry.records))throw Error('Final metadata: invalid registry');
 const oldMap=new Map(before.map(e=>[e.id,e])),newMap=new Map(after.map(e=>[e.id,e]));
 const reviews=new Map(registry.records.map(r=>[r.key,r]));if(reviews.size!==registry.records.length)throw Error('Final metadata: duplicate review');
 const consumed=new Set();const result=structuredClone(metadata);
 for(const[key,card]of Object.entries(metadata.HL.cards)){
  const m=/^(.+)#(0|[1-9]\d*)$/.exec(key);if(!m)continue;
  const old=oldMap.get(m[1])?.items?.[Number(m[2])],now=newMap.get(m[1])?.items?.[Number(m[2])];
  if(!old||!now)continue;
  if(old.a===now.a&&old.lead===now.lead&&old.q===now.q)continue;
  const r=reviews.get(key);if(!r)throw Error('Final metadata: unreviewed answer/card pair '+key);
  if(r.newCard){if(sha(card)!==r.inputCardSha256)throw Error('Final metadata: input card drift '+key);result.HL.cards[key]=structuredClone(r.newCard);}
  const finalCard=result.HL.cards[key];
  if((now.id??null)!==r.questionId||now.q!==r.questionText||sha(now.a)!==r.answerSha256||sha(now.lead||'')!==r.leadSha256||sha(finalCard)!==r.cardSha256)throw Error('Final metadata: paired review drift '+key);
  consumed.add(key);
 }
 if(consumed.size!==reviews.size)throw Error('Final metadata: unused review');
 return result;
}

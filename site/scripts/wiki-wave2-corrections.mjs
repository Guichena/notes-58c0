import {createHash} from 'node:crypto';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const at=(v,p)=>p.reduce((x,k)=>x?.[k],v);
const fail=m=>{throw Error('Wiki wave 2 correction: '+m);};
const REGISTRY_HASH="626338cfb97a2c6ac0f5ff26d6d9b0ef41035ad15c948f27c8d6428be768f13a";
const CARD_HASH="833af57074c6a8ab8dbf2d09bb12dbba90b032a06bcc52133427e7b913f357a3";
/** Run after existing corrections, before display/reading. Sources are immutable parsed files keyed by relative path. */
export function correctWikiWave2(entries,sources,registry,{baselineTest=false}={}){
 if(baselineTest)return entries;
 if(hash(registry)!==REGISTRY_HASH||registry.schemaVersion!==1||registry.corrections.length!==7)fail('registry scope/output drift');
 const map=new Map(entries.map(e=>[e.id,e]));if(map.size!==entries.length)fail('duplicate entry identity');
 for(const r of registry.corrections){
  if(!sources.has(r.sourceFile)||hash(at(sources.get(r.sourceFile),r.sourcePath))!==r.sourceHash||hash(r.sourceValue)!==r.sourceHash)fail('source drift '+r.id);
  if(hash(at(map.get(r.entryId),r.fieldPath))!==r.beforeHash||hash(r.before)!==r.beforeHash||hash(r.after)!==r.afterHash)fail('compiled/output drift '+r.id);
  let candidate=structuredClone(r.before);
  for(const op of r.replacements){
   if(typeof candidate==='string'){if(candidate.split(op.old).length-1!==1)fail('occurrence '+r.id);candidate=candidate.replace(op.old,op.new);}
   else {if(candidate[op.index]!==op.old)fail('array value '+r.id);candidate[op.index]=op.new;}
  }
  if(hash(candidate)!==r.afterHash)fail('replacement mismatch '+r.id);
 }
 const out=structuredClone(entries),outMap=new Map(out.map(e=>[e.id,e]));
 for(const r of registry.corrections){const holder=at(outMap.get(r.entryId),r.fieldPath.slice(0,-1));holder[r.fieldPath.at(-1)]=structuredClone(r.after);}
 return out;
}

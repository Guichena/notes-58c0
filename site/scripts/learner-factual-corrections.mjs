import {createHash} from 'node:crypto';
export const FACTUAL_REGISTRY_SHA256='eaffa78c8a40f7702cf2c9971c1e3d6c9b0b834527174370edf52f8c01ef2879';
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=message=>{throw new Error('Learner factual corrections: '+message);};
const get=(value,keys)=>keys.reduce((v,k)=>v?.[k],value);
export function projectLearnerFactualCorrections(entries,registry,{baselineTest=false}={}) {
 if(baselineTest)return entries;
 if(!registry||sha(registry)!==FACTUAL_REGISTRY_SHA256)fail('registry integrity mismatch');
 if(registry.schemaVersion!==1||registry.fields.length!==62)fail('invalid finite scope');
 const ids=new Map();for(const e of entries){if(ids.has(e.id))fail('duplicate entry');ids.set(e.id,e);}
 for(const [id,identity] of Object.entries(registry.identities)){const e=ids.get(id);if(!e||Object.entries(identity).some(([k,v])=>e[k]!==v))fail('target identity mismatch');}
 for(const q of registry.questions){if(ids.get(q.entryId)?.items?.[q.index]?.q!==q.q)fail('target question mismatch');}
 const targets=new Set();
 for(const f of registry.fields){
  const key=JSON.stringify([f.entryId,f.path]);if(targets.has(key))fail('duplicate target');targets.add(key);
  if(!Array.isArray(f.path)||!f.path.length||f.path.some(k=>['__proto__','prototype','constructor'].includes(k)))fail('invalid path');
  const value=get(ids.get(f.entryId),f.path);
  if(typeof value!=='string'||value!==f.before||sha(value)!==f.beforeSha256)fail('stale input field '+key);
  if(typeof f.after!=='string'||sha(f.after)!==f.afterSha256)fail('output hash mismatch '+key);
 }
 const output=structuredClone(entries),outById=new Map(output.map(e=>[e.id,e]));
 for(const f of registry.fields){const owner=get(outById.get(f.entryId),f.path.slice(0,-1));owner[f.path.at(-1)]=f.after;}
 return output;
}

import {createHash} from 'node:crypto';
export const HANDWRITE_REGISTRY_SHA256='b48faee0d9c7a2e7347157a3b1bd023b84fd53da98dc916c6f99e2d30a8b3d5f';
const sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const fail=m=>{throw Error('Handwrite repair: '+m);};
export function projectHandwriteRepairs(entries,registry,{baselineTest=false}={}) {
 if(baselineTest)return entries;
 if(!registry||sha(registry)!==HANDWRITE_REGISTRY_SHA256)fail('registry integrity mismatch');
 if(registry.schemaVersion!==1||registry.fields.length!==3)fail('invalid finite scope');
 const ids=new Map();for(const e of entries){if(ids.has(e.id))fail('duplicate entry');ids.set(e.id,e);}
 for(const [id,identity] of Object.entries(registry.identities)){const e=ids.get(id);if(!e||Object.entries(identity).some(([k,v])=>e[k]!==v))fail('target identity mismatch');}
 const targets=new Set();
 for(const f of registry.fields){
  if(!['handwrite-64','handwrite-65','handwrite-68'].includes(f.entryId)||JSON.stringify(f.path)!=='["answerHtml"]'||targets.has(f.entryId))fail('invalid target');targets.add(f.entryId);
  const value=ids.get(f.entryId)?.answerHtml;
  if(typeof value!=='string'||value!==f.before||sha(value)!==f.beforeSha256)fail('stale input field '+f.entryId);
  if(typeof f.after!=='string'||sha(f.after)!==f.afterSha256)fail('output hash mismatch');
 }
 const output=structuredClone(entries),byId=new Map(output.map(e=>[e.id,e]));
 for(const f of registry.fields)byId.get(f.entryId).answerHtml=f.after;
 return output;
}

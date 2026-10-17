import {createHash} from 'node:crypto';
export const LEARNER_READING_REGISTRY_SHA256='47ddaf28a8797afdbdd7409d52062e99c292dbc84b77d370770d40355cf2767f';
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=message=>{throw new Error('Learner reading cleanup: '+message);};
const get=(value,keys)=>keys.reduce((v,k)=>v?.[k],value);
export const TEXT_PARTS=/(<pre\b[^>]*>[\s\S]*?<\/pre>|<code\b[^>]*>[\s\S]*?<\/code>|<[^>]*>)/g;
export function replayReadingEdits(value,field,{reverse=false}={}) {
 if(reverse)for(const d of [...(field.dedup||[])].reverse())for(const pos of d.positions)value=value.slice(0,pos)+d.paragraph+value.slice(pos);
 const nodes=value.split(TEXT_PARTS);
 for(const edit of reverse?[...field.edits].reverse():field.edits) {
  const {nodeIndex:i}=edit;
  if(!Number.isInteger(i)||i<0||i%2||nodes[i] !== (reverse?edit.after:edit.before))fail('text-node edit mismatch');
  nodes[i]=reverse?edit.before:edit.after;
 }
 value=nodes.join('');
 if(!reverse)for(const d of field.dedup||[])for(const pos of [...d.positions].reverse()) {
  if(value.slice(pos,pos+d.paragraph.length)!==d.paragraph||!value.slice(0,pos).includes(d.paragraph))fail('dedup mismatch');
  value=value.slice(0,pos)+value.slice(pos+d.paragraph.length);
 }
 return value;
}
export function projectLearnerReadingCleanup(entries,registry,{baselineTest=false}={}) {
 if(baselineTest)return entries;
 if(!registry||sha(registry)!==LEARNER_READING_REGISTRY_SHA256)fail('registry integrity mismatch');
 if(registry.schemaVersion!==1||registry.fields.length!==610||registry.aliases.length!==103)fail('finite scope mismatch');
 const ids=new Map();for(const e of entries){if(ids.has(e.id))fail('duplicate entry');ids.set(e.id,e);}
 for(const [id,identity] of Object.entries(registry.identities)){const e=ids.get(id);if(!e||Object.entries(identity).some(([k,v])=>e[k]!==v))fail('target identity mismatch');}
 for(const q of registry.questions)if(ids.get(q.entryId)?.items?.[q.index]?.q!==q.q)fail('target question mismatch');
 const targets=new Set();
 for(const f of registry.fields){
  const key=JSON.stringify([f.entryId,f.path]);if(targets.has(key))fail('duplicate target');targets.add(key);
  if(!Array.isArray(f.path)||!f.path.length||f.path.some(k=>['__proto__','prototype','constructor'].includes(k)))fail('invalid path');
  const value=get(ids.get(f.entryId),f.path);
  if(typeof value!=='string'||value!==f.before||sha(value)!==f.beforeSha256)fail('stale input '+key);
  if(typeof f.after!=='string'||sha(f.after)!==f.afterSha256)fail('output hash mismatch '+key);
  if(replayReadingEdits(value,f)!==f.after||replayReadingEdits(f.after,f,{reverse:true})!==value)fail('non-reversible edit '+key);
 }
 const aliasTargets=new Set();for(const a of registry.aliases){const key=JSON.stringify([a.entryId,a.path]);if(aliasTargets.has(key))fail('duplicate alias');aliasTargets.add(key);if(a.path.length!==1||!['part','cat'].includes(a.path[0])||get(ids.get(a.entryId),a.path)!==a.before||sha(a.before)!==a.sha256||sha(a.after)!==a.afterSha256)fail('alias mismatch');}
 const output=structuredClone(entries),outById=new Map(output.map(e=>[e.id,e]));
 for(const f of registry.fields)get(outById.get(f.entryId),f.path.slice(0,-1))[f.path.at(-1)]=f.after;
 return output;
}

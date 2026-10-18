import {createHash} from 'node:crypto';
const sha = text => createHash('sha256').update(text).digest('hex');
const fail = text => {throw Error('Final audit: '+text);};
export function projectFinalAuditCorrections(entries,registry,{baselineTest=false,reverse=false}={}) {
 if(baselineTest) return entries;
 if(registry?.schemaVersion!==1 || !Array.isArray(registry.records)) fail('invalid registry');
 const output=structuredClone(entries), byId=new Map(output.map(e=>[e.id,e]));
 if(byId.size!==output.length) fail('duplicate entry');
 const records=reverse?[...registry.records].reverse():registry.records;
 for(const r of records){
  if(!Array.isArray(r.path)||!r.path.length||r.path.some(x=>['__proto__','prototype','constructor','id'].includes(x))) fail('unsafe field path');
  if(typeof r.before!=='string'||typeof r.after!=='string'||r.before===r.after||sha(r.before)!==r.beforeSha256||sha(r.after)!==r.afterSha256) fail('invalid field hashes');
  if(Object.hasOwn(r,'beforeMissing')&&typeof r.beforeMissing!=='boolean') fail('invalid beforeMissing flag');
  if(r.beforeMissing===true&&(r.path.length!==1||r.path[0]!=='supplementHtml'||r.before!==''||!r.after.trim())) fail('invalid missing supplement');
  let target=byId.get(r.entryId); if(!target) fail('missing entry '+r.entryId);
  for(const key of r.path.slice(0,-1)){if(!Object.hasOwn(target,key)) fail('missing path');target=target[key];}
  const key=r.path.at(-1),before=reverse?r.after:r.before,after=reverse?r.before:r.after;
  if(r.beforeMissing===true){
   if(reverse){if(!Object.hasOwn(target,key)||target[key]!==before) fail('source drift '+r.entryId+' '+r.path.join('.'));delete target[key];}
   else {if(Object.hasOwn(target,key)) fail('source drift '+r.entryId+' '+r.path.join('.'));target[key]=after;}
   continue;
  }
  if(!Object.hasOwn(target,key)||target[key]!==before) fail('source drift '+r.entryId+' '+r.path.join('.'));
  target[key]=after;
 }
 return output;
}

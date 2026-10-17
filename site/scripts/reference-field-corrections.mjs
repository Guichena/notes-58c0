import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(x).digest('hex');
const fail=x=>{throw Error('Reference field correction: '+x);};
const scope=new Map([['database-89/analysisHtml',['25b47c13a8966a7ce00fba464fb477dac0d3e6ceee53814824bcfc6e289ea992','e7ec679dfe2472751b27da56ea7258cfd4b4e58c0e6322c6404b26ed686a1ce9']],['database-91/answerHtml',['7f493d448dd5f4233238055a001743bda320510e687ef5977271011a22b27af0','b24841950e0adac81f445118e3c65342a6bae3e5b00b2007198502fd7199ec9f']]]);
export function correctReferenceFields(entries, originals, registry, {baselineTest=false}={}) {
 if(baselineTest)return entries;
 if(registry?.schemaVersion!==1||registry.corrections?.length!==scope.size)fail('registry scope');
 const maps=[originals,entries].map(list=>{const map=new Map(list.map(e=>[e.id,e]));if(map.size!==list.length)fail('duplicate identity');return map;});
 const seen=new Set();
 for(const r of registry.corrections){
  const key=r.entry_id+'/'+r.field, hashes=scope.get(key);if(!hashes||seen.has(key))fail('target scope');seen.add(key);
  if(sha(r.old_full_field)!==hashes[0]||sha(r.new_full_field)!==hashes[1]||r.old_full_field_sha256!==hashes[0]||r.new_full_field_sha256!==hashes[1])fail('registry drift');
  const [source,compiled]=maps.map(m=>m.get(r.entry_id)?.[r.field]);
  if(source!==r.old_full_field||typeof compiled!=='string'||!compiled.startsWith(source))fail('source or compiled prefix drift');
 }
 return entries.map(e=>{const changes=registry.corrections.filter(r=>r.entry_id===e.id);if(!changes.length)return e;const next={...e};for(const r of changes)next[r.field]=r.new_full_field+e[r.field].slice(r.old_full_field.length);return next;});
}

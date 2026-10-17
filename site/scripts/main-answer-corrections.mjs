// Finite reviewed primary-answer corrections; immutable source and authoring locks stay intact.
import {createHash} from 'node:crypto';
const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const fail=message=>{throw Error('Main answer correction: '+message);};
export function correctMainAnswers(entries,originalEntries,registry,{baselineTest=false}={}) {
 if(baselineTest)return entries;
 if(registry?.schemaVersion!==1||!Array.isArray(registry.fields)||registry.fields.length!==15)fail('invalid registry');
 const expected=['handwrite-50','handwrite-54','handwrite-61','pattern-bigdata-file','scenario-distributed-lock'];
 if(JSON.stringify([...new Set(registry.fields.map(f=>f.entry_id))].sort())!==JSON.stringify(expected.sort()))fail('invalid target scope');
 const original=new Map(originalEntries.map(e=>[e.id,e])),byId=new Map(entries.map(e=>[e.id,e]));const seen=new Set();
 for(const f of registry.fields){
  const key=f.entry_id+'/'+f.field;if(seen.has(key))fail('duplicate field '+key);seen.add(key);
  const source=original.get(f.entry_id),entry=byId.get(f.entry_id);if(!source||!entry)fail('missing target '+key);
  if(!Object.hasOwn(source,f.field)||!Object.hasOwn(entry,f.field))fail('missing field '+key);
  if(hash(f.old_full_field)!==f.old_full_field_sha256||hash(f.new_full_field)!==f.new_full_field_sha256)fail('registry hash mismatch '+key);
  if(hash(source[f.field])!==f.old_full_field_sha256)fail('original hash mismatch '+key);
  if(hash(entry[f.field])!==f.old_full_field_sha256)fail('compiled hash mismatch '+key);
 }
 const result=structuredClone(entries),out=new Map(result.map(e=>[e.id,e]));
 for(const f of registry.fields)out.get(f.entry_id)[f.field]=structuredClone(f.new_full_field);
 return result;
}

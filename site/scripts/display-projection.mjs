// Reviewed display-only projection. Original content and authoring hash locks stay intact.
import {createHash} from 'node:crypto';
const sha = text => createHash('sha256').update(text).digest('hex');
const fail = message => { throw new Error('Display projection: '+message); };
function guard(text, expected, label) {
 if(typeof text!=='string' || sha(text)!==expected) fail(label+' hash mismatch');
}
export function projectEntries(entries, manifest, {baselineTest=false, originalChapters}={}) {
 if(baselineTest) return entries;
 if(manifest?.schema_version!==1 || !Array.isArray(manifest.fields)) fail('invalid manifest');
 const result=structuredClone(entries), byId=new Map();
 for(const entry of result) {if(byId.has(entry.id))fail('duplicate entry '+entry.id);byId.set(entry.id,entry);}
 const seen=new Set();
 // Validate the entire projection before applying any replacement.
 for(const change of manifest.fields) {
  const key=change.entry_id+'/'+change.field;
  if(seen.has(key)) fail('duplicate target '+key);seen.add(key);
  if(!['html','lead'].includes(change.field)) fail('unsupported field '+key);
  const parts=change.json_pointer?.split('/');
  if(parts?.length!==4 || parts[0]!=='' || parts[1]!=='entries' || !/^\d+$/.test(parts[2]) || parts[3]!==change.field) fail('invalid pointer '+key);
  if(!change.file.startsWith('content/chapters/') || change.file.includes('..')) fail('invalid chapter '+key);
  const original=originalChapters?.get(change.file)?.entries[Number(parts[2])];
  if(!original || original.id!==change.entry_id) fail('original pointer identity mismatch '+key);
  guard(change.old_full_field,change.old_full_field_sha256,'manifest original '+key);
  guard(change.new_full_field,change.new_full_field_sha256,'manifest result '+key);
  guard(original[change.field],change.old_full_field_sha256,'original source '+key);
  const entry=byId.get(change.entry_id);
  if(!entry) fail('missing entry '+key);
  guard(entry[change.field],change.old_full_field_sha256,'compiled source '+key);
 }
 for(const change of manifest.fields)byId.get(change.entry_id)[change.field]=change.new_full_field;
 return result;
}
export function projectSource(file,text,manifest,{baselineTest=false}={}) {
 if(baselineTest)return text;
 if(manifest?.schema_version!==1 || !Array.isArray(manifest.ui))fail('invalid UI manifest');
 const matches=manifest.ui.filter(change=>change.file===file);
 if(matches.length>1)fail('duplicate UI target '+file);
 if(!matches.length)return text;
 const change=matches[0];
 if(!['src/app/renderers.js','src/app/routing.js'].includes(file))fail('unsupported UI file '+file);
 guard(change.old_full_field,change.old_full_field_sha256,'UI manifest original '+file);
 guard(text,change.old_full_field_sha256,'UI source '+file);
 guard(change.new_full_field,change.new_full_field_sha256,'UI result '+file);
 return change.new_full_field;
}

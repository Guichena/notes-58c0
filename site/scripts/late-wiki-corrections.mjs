import {createHash} from 'node:crypto';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const at=(v,p)=>p.reduce((x,k)=>x?.[k],v);
const fail=m=>{throw Error('Late wiki correction: '+m);};
const REGISTRY_HASH="0b82ee9d3d40304e66f953fcce36c2204859ba0ffff37a05af9b79e2c026bd38";
const CARD_HASH="886a69381283af9a1b6b6e8e8091f475e97b6a7bebf01bd00c6c02e9183fea69";
/** Run after existing corrections, before display/reading. Sources are immutable parsed files keyed by relative path. */
export function correctLateWiki(entries,sources,registry,{baselineTest=false}={}){
 if(baselineTest)return entries;
 if(hash(registry)!==REGISTRY_HASH||registry.schemaVersion!==1||registry.corrections.length!==4)fail('registry scope/output drift');
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
/** Finite two-card projection; composes with the disjoint existing metadata registry in either order. */
export function projectLateWikiMetadata(metadata,registry,{baselineTest=false}={}){
 if(baselineTest)return metadata;
 if(hash(registry)!==CARD_HASH||registry.schemaVersion!==1||registry.corrections.length!==2)fail('card registry drift');
 for(const r of registry.corrections){if(!['ai-agent-6#5','ai-模型与评测-2#0'].includes(r.key)||hash(metadata?.HL?.cards?.[r.key])!==r.expectedOriginalHash||hash(r.oldCard)!==r.expectedOriginalHash||hash(r.newCard)!==r.newCardHash)fail('card source/output drift');}
 const out=structuredClone(metadata);for(const r of registry.corrections)out.HL.cards[r.key]=structuredClone(r.newCard);return out;
}

/** Finite source-level append; compiled by the existing authoring compiler, never raw HTML. */
export function appendMerchantSection(documents,registry,{baselineTest=false}={}){
 if(baselineTest)return documents;
 if(hash(registry)!==MERCHANT_HASH||registry.entryId!=='own-runtime-domain-designs'||registry.section.id!=='s-reference-merchant-promotion')fail('merchant registry drift');
 const matches=documents.filter(d=>d.type==='entries'&&d.file===registry.sourceFile&&d.data.id===registry.entryId);
 if(matches.length!==1||hash(matches[0].data)!==registry.expectedOriginalHash)fail('merchant source drift');
 if(matches[0].data.sections.some(s=>s.id===registry.section.id))fail('duplicate merchant section');
 const out=structuredClone(documents);out.find(d=>d.file===registry.sourceFile).data.sections.push(structuredClone(registry.section));return out;
}
const MERCHANT_HASH="569a1c3c9a172a21f02b5dd025ad1c4d9281dc9b5583c1f584a0316011b7efd8";

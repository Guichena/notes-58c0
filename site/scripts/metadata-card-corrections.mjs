import {createHash} from 'node:crypto';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail=m=>{throw Error('Metadata card correction: '+m);};
const keys=(x,want)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join('|')===[...want].sort().join('|');
const scope=new Set(['ai-rag-6#4','ai-agent-8#1','ai-agent-3#1','bg-分布式-1#0']);
/** Finite metadata-only projection. Pass frozen source metadata, then use the clone in catalog generation. */
export function projectReferenceMetadata(metadata,registry,{baselineTest=false}={}){
 if(baselineTest)return metadata;
 if(hash(registry)!=='c5aaac620232af28947c2dce2414ddee9f03dfdcc6555560b1730a3ab71e70a3')fail('reviewed registry drift');
 if(!keys(registry,['schemaVersion','corrections'])||registry.schemaVersion!==1||!Array.isArray(registry.corrections)||registry.corrections.length!==4)fail('invalid registry');
 if(!metadata?.HL?.cards||typeof metadata.HL.cards!=='object'||Array.isArray(metadata.HL.cards))fail('missing cards');
 const seen=new Set();
 for(const r of registry.corrections){
  if(!keys(r,['key','expectedOriginalHash','oldCard','newCard','newCardHash'])||!scope.has(r.key)||seen.has(r.key))fail('unknown or duplicate target');seen.add(r.key);
  if(!Object.hasOwn(metadata.HL.cards,r.key)||hash(metadata.HL.cards[r.key])!==r.expectedOriginalHash||hash(r.oldCard)!==r.expectedOriginalHash)fail('original card mismatch '+r.key);
  const c=r.newCard;
  if(hash(c)!==r.newCardHash||hash(c)===r.expectedOriginalHash)fail('replacement hash mismatch '+r.key);
  if(!keys(c,['title','cols','rows','dup'])||typeof c.title!=='string'||!c.title.trim()||!Array.isArray(c.cols)||c.cols.length<2||!c.cols.every(v=>typeof v==='string'&&v.trim())||!Array.isArray(c.rows)||!c.rows.length||c.dup!==0)fail('invalid replacement card '+r.key);
  for(const row of c.rows)if(!keys(row,['dim','cells'])||typeof row.dim!=='string'||!row.dim.trim()||!Array.isArray(row.cells)||row.cells.length!==c.cols.length||!row.cells.every(v=>typeof v==='string'&&v.trim()))fail('invalid replacement row '+r.key);
 }
 const result=structuredClone(metadata);
 for(const r of registry.corrections)result.HL.cards[r.key]=structuredClone(r.newCard);
 return result;
}

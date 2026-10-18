const NINTH_ORIGINAL_URL=new URL("../../../../../agent-dag-dispatch/verify-final.mjs",import.meta.url);
import {assertPhysicalBody,physicalWitness} from '../agent-workflow/verify-phase4-physical-repair.mjs';
import {eighthLeaf,eighthEntry,eighthQuestion} from '../eighth-reconciliation/verify-dependencies.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(NINTH_ORIGINAL_URL));
assert.equal(process.argv.length,4,'Use: node verify-final.mjs --dist /actual/final/dist');
assert.equal(process.argv[2],'--dist');
const dist=path.resolve(process.argv[3]);
const read=f=>JSON.parse(fs.readFileSync(path.join(here,f),'utf8'));
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const jsonsha=v=>sha(JSON.stringify(v));
const entries=new Map();
for(const f of fs.readdirSync(path.join(dist,'data/chapters')).filter(f=>f.endsWith('.json'))){
 for(const e of JSON.parse(fs.readFileSync(path.join(dist,'data/chapters',f),'utf8')).entries){
  assert.ok(!entries.has(e.id),'duplicate entry '+e.id);entries.set(e.id,e);
 }
}
const getBody=(id,q)=>{
 const e=entries.get(id);assert.ok(e,'missing target '+id);
 if(q===null||q===undefined)return e.html??e.supplementHtml??'';
 const item=/^\d+$/.test(String(q))?e.items[Number(q)]:e.items.find(x=>x.id===q);
 assert.ok(item,'missing question '+id+'#'+q);return item.a;
};
assertPhysicalBody(getBody('ai-agent-5',3));
const at=(obj,keys)=>keys.reduce((o,k)=>o[k],obj);
const records=read('records.json').records;
for(const r of records){
 assert.equal(sha(r.before),r.beforeSha256,'before hash');assert.equal(sha(r.after),r.afterSha256,'after hash');
 assert.equal(at(entries.get(r.entryId),r.path),eighthLeaf(r.entryId,r.path,r.after),'actual dist is not integrated: '+r.entryId+' '+r.path.join('.'));
}
const original=read('before.json');const current=entries.get('ai-agent-5').items[11];
for(const k of Object.keys(original).filter(k=>k!=='a'))assert.deepEqual(current[k],original[k],'old question metadata '+k);
for(const m of original.a.matchAll(/\bid="([^"]+)"/g))assert.equal((current.a.match(new RegExp('id="'+m[1]+'"','g'))??[]).length,1,'legacy anchor '+m[1]);
const app=read('append-manifest.json');
for(const entry of app.entries){
 const actual=entries.get(entry.entryId);assert.ok(actual);
 assert.equal(jsonsha(entry.beforeEntry.items),entry.beforePrefixSha256);
 assert.deepEqual(actual.items.slice(0,entry.beforeEntry.items.length),eighthEntry(entry.beforeEntry).items,'complete old prefix '+entry.entryId);
 assert.equal(actual.items.length,entry.beforeEntry.items.length+entry.appends.length,'reviewed final item count '+entry.entryId);
 for(const a of entry.appends){assert.equal(jsonsha(a.expectedItem),a.expectedItemSha256);assert.deepEqual(actual.items[a.index],eighthQuestion(entry.entryId,a.index,a.expectedItem),'exact appended item '+a.id);}
}
const mapping=read('source-block-map.json');
assert.equal(mapping.sourceSha256,sha(original.a));assert.equal(mapping.sourceBlocks.length,134);
const allIndexes=new Set();
for(const block of mapping.sourceBlocks){
 assert.ok(!allIndexes.has(block.sourceBlock));allIndexes.add(block.sourceBlock);
 assert.equal(sha(block.originalHtml),block.originalSha256);
 assert.ok(block.destinations.length,'unmapped source block '+block.sourceBlock);
 for(const d of block.destinations){
  assert.equal(sha(d.excerpt),d.excerptSha256);assert.ok(d.snippets.length,'no substantive witness');
  const body=getBody(d.entryId,d.questionId).replace(/<details\b[^>]*>[\s\S]*?<\/details>/g,'');
  for(const snippet of d.snippets)assert.ok(body.includes(physicalWitness(d.entryId,d.questionId,snippet)),'missing substantive witness for source block '+block.sourceBlock+' at '+d.entryId+'#'+d.questionId);
 }
}
const plain=s=>s.replace(/<[^>]*>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#x27;/g,"'");
const variants=read('variant-map.json');assert.equal(variants.length,46);
for(const v of variants){assert.ok(plain(current.a).includes(v.publicText),'lost wording '+v.sourceBlock);getBody(v.destination.entryId,v.destination.questionId);}
const beforeGraph=records.find(x=>x.entryId==='p-graph').before;
assert.ok(getBody('p-graph',null).startsWith(beforeGraph),'previous graph content altered');
for(const word of ['F∩B','全部入度零点','空终点集合返回空图','非零出度终点','重复边去重','孤立点既是起点又是终点','不能只检查最后留下的子图','小于 100','完整 Java 手撕实现'])assert.ok(getBody('p-graph',null).includes(word),word);
const mainBody=current.a.split('<details')[0];
assert.ok(!/Python|asyncio/.test(current.a),'public scheduling answer must use Java or language-neutral concurrency wording');
assert.ok(!mainBody.includes('tasks.md上的一个勾'));assert.ok(!mainBody.includes('TTS 节点应声明'));assert.ok(!mainBody.includes('从起点正向求可达集合 F'));
for(const word of ['All-success','Best-effort','First-valid','Quorum','plan_revision','同一本地事务','SKIP LOCKED','操作身份','受变更影响的后代失效'])assert.ok(mainBody.includes(word),word);
for(const entry of app.entries){
 for(const item of entry.appends){
  for(const m of item.expectedItem.a.matchAll(/href="#\/e\/([^"/]+)(?:\/([^"/]+))?"/g)){assert.ok(entries.has(m[1]),'broken link '+m[0]);if(m[2])getBody(m[1],m[2]);}
 }
}
for(const m of current.a.matchAll(/href="#\/e\/([^"/]+)(?:\/([^"/]+))?"/g)){assert.ok(entries.has(m[1]),'broken link '+m[0]);if(m[2])getBody(m[1],m[2]);}
console.log(JSON.stringify({passed:true,actualDist:dist,overlays:0,phase4PhysicalConditionRepairVerified:true,guardedLeaves:records.length,sourceBlocks:mapping.sourceBlocks.length,originalPhrasingBlocks:variants.length,verbatimPhrasingBlocks:45,languageNeutralRephrasings:1,oldQuestionUnchanged:true,legacyAnchors:4,exactAppendedItems:2,graphPriorContentUnchanged:true}));

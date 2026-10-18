import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const sha=s=>createHash('sha256').update(s).digest('hex');
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const key=r=>r.entryId+(r.path[0]==='items'?'#'+r.path[1]:'');
const locate=(all,k)=>{const [e,i]=k.split('#');return i===undefined?all.get(e)?.html:all.get(e)?.items?.[Number(i)]?.a;};
const stripNavigation=s=>s.replace(/<details\b[^>]*class="qa-(?:variants|related)"[^>]*>[\s\S]*?<\/details>/g,'');
const ALLOWED=['ai-agent-3#2','ai-agent-3#6','ai-agent-1#1','ai-agent-3#5','ai-agent-1#3','ai-agent-2#14','own-agent-runtime-design#1','own-agent-project-expression#0','own-runtime-domain-designs','plan-日常与ai使用-1#3','ai-agent-5#3','ai-agent-9#7','ai-上下文工程-2#0','own-agent-runtime-design#3','ai-agent-6#0','ai-模型与评测-4#4','own-agent-project-expression#3','ai-agent-5#11','ai-agent-2#3','own-distributed-ch13#1','own-tools-governance#1','ai-agent-3#3','own-agent-runtime-design#7','own-agent-runtime-design#0','ai-agent-6#12','ai-agent-2#12','own-tools-execution#0','own-runtime-moderation#0','ai-上下文工程-5#1'].sort();
export async function validateFixtures(fixtures){
 const records=(await read(join(fixtures,'records.json'))).records;
 const source=await read(join(fixtures,'source-variants.json'));
 const questions=await read(join(fixtures,'display-questions.json'));
 const map=await read(join(fixtures,'condition-map.json'));
 const witnesses=(await read(join(fixtures,'evidence-witnesses.json'))).witnesses;
 const identities=await read(join(fixtures,'identity-baseline.json'));
 assert.deepEqual(records.map(key).sort(),ALLOWED,'scope must remain the approved 29 existing leaves');
 assert.equal(records.length,29);assert.equal(source.length,347);assert.equal(questions.length,114);
 assert.equal(map.rows.length,347);assert.equal(map.reviewedOccurrences,346);assert.equal(map.ambiguousArchiveOnly,1);
 assert.equal(map.rows.filter(r=>r.coverageStatus==='AMBIGUOUS_ARCHIVE_ONLY').length,1);
 assert.equal(new Set(questions.map(q=>q.id)).size,questions.length);assert.equal(new Set(questions.map(q=>q.text)).size,questions.length);
 const qs=new Map(questions.map(q=>[q.id,q]));
 for(const q of questions){const escaped=q.text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');assert.equal(q.html,'<li>'+escaped+'</li>','question text/HTML disagreement');const r=records.find(r=>key(r)===q.target);assert.ok(r?.after.includes(q.html),'question absent from exact approved target '+q.id);}
 for(const r of records){
  assert.deepEqual(r.path,r.path[0]==='items'?['items',r.itemIndex,'a']:['html']);
  for(const field of ['before','after','preservedPrefix'])assert.equal(sha(r[field]),r[field+'Sha256'],'fixture hash '+key(r)+'.'+field);
  assert.ok(r.after.startsWith(r.preservedPrefix),'prefix not preserved '+key(r));
  if(['ai-agent-3#2','ai-agent-3#6'].includes(key(r))){assert.equal(r.preservedPrefix,r.before.slice(0,r.before.indexOf('<details class="qa-variants">')));assert.equal(r.changeMode,'replace-tail-core-byte-identical');}
  else{assert.equal(r.preservedPrefix,r.before);assert.equal(r.changeMode,'append-only');}
  for(const a of r.before.matchAll(/\bid="([^"]+)"/g))assert.ok(r.after.includes(a[0]),'lost original anchor '+key(r));
 }
 for(const i of [2,6]){
  const raw=records.find(r=>key(r)==='ai-agent-3#'+i).before.split('<details class="qa-variants">')[1];
  const lis=[...raw.matchAll(/<li>[\s\S]*?<\/li>/g)].map(m=>m[0]);
  assert.equal(lis.length,i===2?229:118);
  for(const s of source.filter(v=>v.sourceItemIndex===i))assert.equal(s.sourceHtml,lis[s.sourceVariantIndex-1],'original source changed');
 }
 let conditionCount=0,assigned=0;
 for(let n=0;n<source.length;n++){
  const s=source[n],r=map.rows[n];for(const f of ['sourceEntryId','sourceItemIndex','sourceVariantIndex','sourceHtml','sourceText'])assert.equal(r[f],s[f],'source map identity '+n+'.'+f);
  if(r.coverageStatus==='AMBIGUOUS_ARCHIVE_ONLY'){
   assert.equal(s.sourceItemIndex,2);assert.equal(s.sourceVariantIndex,117);assert.equal(s.sourceText,'- React的原理');assert.equal(r.destinationQuestionIds.length,0);assert.equal(r.conditions.length,0);continue;
  }
  assert.equal(r.coverageStatus,'REVIEWED_SUBSTANTIVE_EVIDENCE');assert.equal(r.destinationQuestionIds.length,1);
  const q=qs.get(r.destinationQuestionIds[0]);assert.ok(q);assert.equal(q.target,r.finalDestination);assert.equal(q.text,r.normalizedQuestion);assert.ok(q.sources.some(([i,v])=>i===s.sourceItemIndex&&v===s.sourceVariantIndex));
  assert.ok(r.conditions.length>0,'condition set required');
  for(const c of r.conditions){conditionCount++;assert.equal(c.status,'SUBSTANTIVE_BODY_VERIFIED');assert.ok(c.witnesses.length);for(const wid of c.witnesses)assert.ok(witnesses[wid],'missing witness '+wid);}
  assigned++;
 }
 assert.equal(assigned,346);assert.equal(questions.reduce((n,q)=>n+q.sources.length,0),346);assert.equal(conditionCount,map.conditionOccurrences);
 for(const [wid,w]of Object.entries(witnesses)){assert.equal(w.id,wid);assert.equal(sha(w.exactHtml),w.snippetSha256);assert.ok(w.exactText.length>15,'not substantive '+wid);assert.match(w.exactHtml,/^<(p|li)\b/);}
 return {records,source,questions,map,witnesses,identities};
}
export async function inspectFinal({dist,fixtures}){
 assert.ok(dist&&fixtures,'Explicit actual built dist and frozen fixtures required. No overlay mode exists.');
 const x=await validateFixtures(fixtures),all=new Map(),inventory=[];
 const catalog=await read(join(dist,'data/catalog.json'));await readFile(join(dist,'index.html'),'utf8');
 for(const f of (await readdir(join(dist,'data/chapters'))).filter(f=>f.endsWith('.json')).sort()){
  const bytes=await readFile(join(dist,'data/chapters',f),'utf8');inventory.push({file:f,sha256:sha(bytes)});
  for(const e of JSON.parse(bytes).entries){assert.ok(!all.has(e.id),'duplicate entry '+e.id);all.set(e.id,e);}
 }
 const errors=[],fail=(code,detail)=>errors.push({code,detail});
 for(const id of x.identities){const it=all.get(id.entryId)?.items?.[id.index];if(!it){fail('MISSING_QUESTION',id.entryId+'#'+id.index);continue;}for(const [f,v]of Object.entries(id.unchangedFields))if(JSON.stringify(it[f])!==JSON.stringify(v))fail('METADATA_CHANGED',id.entryId+'#'+id.index+'.'+f);}
 for(const r of x.records){
  const k=key(r),actual=locate(all,k);if(typeof actual!=='string'){fail('MISSING_LEAF',k);continue;}
  if(!actual.startsWith(r.preservedPrefix))fail('CORE_PREFIX_CHANGED',k);
  if(actual!==r.after)fail('UNAPPLIED_OR_CHANGED',k);
  if(!catalog.entries.some(e=>e.id===r.entryId))fail('MISSING_CATALOG_ROUTE',r.entryId);
  for(const m of r.after.matchAll(/href="#\/e\/([^"/]+)(?:\/([^"]+))?"/g)){
   const eid=decodeURIComponent(m[1]),e=all.get(eid);
   if(!e&&!catalog.archivedRoutes?.[eid])fail('BROKEN_LINK',m[0]);
   if(m[2]&&e){const q=decodeURIComponent(m[2]);if(!(/^\d+$/.test(q)?e.items?.[Number(q)]:e.items?.some(it=>it.id===q)))fail('BROKEN_LINK',m[0]);}
  }
 }
 for(const q of x.questions)if(!locate(all,q.target)?.includes(q.html))fail('MISSING_OR_MISROUTED_QUESTION',q.id+' -> '+q.target);
 for(const [wid,w]of Object.entries(x.witnesses)){
  const actual=locate(all,w.sourceKey);
  if(typeof actual!=='string'||!stripNavigation(actual).includes(w.exactHtml))fail('MISSING_SUBSTANTIVE_EVIDENCE',wid+' -> '+w.sourceKey);
 }
 return {status:errors.length?'FAIL_ACTUAL_DIST':'PASS_ACTUAL_FINAL_DIST',dist:resolve(dist),changedLeaves:29,sourceOccurrences:347,semanticallyReviewedOccurrences:346,ambiguousArchiveOnly:1,displayQuestions:114,conditionOccurrences:x.map.conditionOccurrences,substantiveWitnesses:Object.keys(x.witnesses).length,inventorySha256:sha(JSON.stringify(inventory)),errors};
}
export async function verifyFinal(options){const r=await inspectFinal(options);if(r.errors.length){const e=new Error(r.errors.map(e=>e.code+' '+e.detail).join('\n'));e.result=r;throw e;}return r;}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2),get=n=>{const i=args.indexOf(n);return i<0?null:args[i+1];};
 const fixtures=resolve(get('--fixtures')||fileURLToPath(new URL('.',import.meta.url)));
 try{if(args.includes('--check-fixtures')){const x=await validateFixtures(fixtures);console.log(JSON.stringify({status:'PASS_CANDIDATE_FIXTURE_INTEGRITY_NOT_FINAL_DIST',records:x.records.length,sourceOccurrences:x.source.length,conditions:x.map.conditionOccurrences,witnesses:Object.keys(x.witnesses).length}));}else{const dist=get('--dist');if(!dist)throw Error('Explicit --dist is required; overlays and synthetic positive results are not supported.');const result=await inspectFinal({dist:resolve(dist),fixtures});console.log(JSON.stringify(result,null,2));if(result.errors.length)process.exitCode=1;}}
 catch(e){console.error(e.stack);process.exitCode=1;}
}

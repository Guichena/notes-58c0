import assert from 'node:assert/strict';
import {readFile,readdir,writeFile,mkdir,cp,rm,mkdtemp} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectFinal} from './verify-final-dist.mjs';
import {tmpdir} from 'node:os';
const args=process.argv.slice(2),get=k=>{const i=args.indexOf(k);return i<0?null:args[i+1];};
const base=fileURLToPath(new URL('.',import.meta.url)),dist=get('--dist');
if(!dist)throw Error('Explicit actual built --dist required. Only negative copies are made; there is no overlay positive.');
const fixture=resolve(get('--fixtures')||base),original=await inspectFinal({dist:resolve(dist),fixtures:fixture});
const tmp=await mkdtemp(join(tmpdir(),'reasoning-negative-dist-'));
const results=[];
try{
 await mkdir(join(tmp,'data/chapters'),{recursive:true});await cp(join(dist,'data/chapters'),join(tmp,'data/chapters'),{recursive:true});await cp(join(dist,'data/catalog.json'),join(tmp,'data/catalog.json'));await cp(join(dist,'index.html'),join(tmp,'index.html'));
 const files=new Map();for(const f of await readdir(join(tmp,'data/chapters'))){if(!f.endsWith('.json'))continue;const path=join(tmp,'data/chapters',f),text=await readFile(path,'utf8');for(const e of JSON.parse(text).entries)files.set(e.id,{path,text});}
 const questions=JSON.parse(await readFile(join(fixture,'display-questions.json'),'utf8'));
 const witnesses=JSON.parse(await readFile(join(fixture,'evidence-witnesses.json'),'utf8')).witnesses;
 const tests=[
  {name:'unique-50-step-question-moved-to-wrong-topic',entry:'ai-agent-3',mutate:e=>{const q=questions.find(q=>q.id==='v2-157');assert.ok(e.items[2].a.includes(q.html));e.items[2].a=e.items[2].a.replace(q.html,'');e.items[6].a+=q.html;},expected:['MISSING_OR_MISROUTED_QUESTION','v2-157 -> ai-agent-3#2']},
  {name:'changed-protected-core',entry:'ai-agent-3',mutate:e=>{e.items[2].a=e.items[2].a.replace('ReAct 是','ReAct 不是');},expected:['CORE_PREFIX_CHANGED','ai-agent-3#2']},
  {name:'changed-stable-question',entry:'ai-agent-3',mutate:e=>{e.items[6].q+='（未经批准改题）';},expected:['METADATA_CHANGED','ai-agent-3#6.q']},
  {name:'lost-TODO-unique-condition-evidence',entry:'ai-agent-5',mutate:e=>{const s=witnesses['ai-agent-5#13:p9'].exactHtml;assert.ok(e.items[13].a.includes(s));e.items[13].a=e.items[13].a.replace(s,'');},expected:['MISSING_SUBSTANTIVE_EVIDENCE','ai-agent-5#13:p9 -> ai-agent-5#13']},
  {name:'link-alone-is-not-an-answer',entry:'ai-agent-5',mutate:e=>{const s=witnesses['ai-agent-5#13:p9'].exactHtml;assert.ok(e.items[13].a.includes(s));e.items[13].a=e.items[13].a.replace(s,'<p><a href="#/e/ai-agent-5/13">TODO 状态与执行验收</a></p>');},expected:['MISSING_SUBSTANTIVE_EVIDENCE','ai-agent-5#13:p9 -> ai-agent-5#13']},
 ];
 for(const t of tests){
  assert.ok(!original.errors.some(e=>e.code===t.expected[0]&&e.detail===t.expected[1]),'negative must introduce a NEW failure');
  const f=files.get(t.entry),data=JSON.parse(f.text);t.mutate(data.entries.find(e=>e.id===t.entry));await writeFile(f.path,JSON.stringify(data)+'\n');
  const got=await inspectFinal({dist:tmp,fixtures:fixture});assert.ok(got.errors.some(e=>e.code===t.expected[0]&&e.detail===t.expected[1]),'mutation not rejected '+t.name);
  results.push({name:t.name,status:'REJECTED_AS_EXPECTED',expectedCode:t.expected[0],expectedDetail:t.expected[1]});await writeFile(f.path,f.text);
 }
 const restored=await inspectFinal({dist:tmp,fixtures:fixture});assert.equal(restored.inventorySha256,original.inventorySha256,'negative copy restored exactly');
 const finalOriginal=await inspectFinal({dist:resolve(dist),fixtures:fixture});assert.equal(finalOriginal.inventorySha256,original.inventorySha256,'original actual dist changed during negative test');
 console.log(JSON.stringify({status:'PASS_DIST_ONLY_NEGATIVE_TESTS',actualInputDist:resolve(dist),inputStatus:original.status,inputInventorySha256:original.inventorySha256,unappliedActualRejected:original.errors.some(e=>e.code==='UNAPPLIED_OR_CHANGED'),warning:original.status==='FAIL_ACTUAL_DIST'?'Input is still unapplied; this is NOT a final positive result. Every mutation adds its own specific failure.':null,tests:results,originalDistUntouched:true,overlayOrSyntheticPositive:false},null,2));
}finally{await rm(tmp,{recursive:true,force:true});}

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import {compileAuthoring,readAuthoring} from '../scripts/authoring.mjs';
import {projectSource} from '../scripts/display-projection.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>readFile(path.join(root,p),'utf8');
const json=async p=>JSON.parse(await read(p));
const manifest=await json('content/display-projection.json');
const source=await read('src/app/renderers.js');
const projected=projectSource('src/app/renderers.js',source,manifest);
const metadata=await json('content/metadata.json');
const originals=(await Promise.all((await readdir(path.join(root,'content/chapters'))).filter(x=>x.endsWith('.json')).map(x=>json('content/chapters/'+x)))).flatMap(x=>x.entries);
const byId=new Map(originals.map(e=>[e.id,e]));
const entries=compileAuthoring(metadata.entryOrder.map(id=>byId.get(id)),await readAuthoring(root),await json('content/legacy-identities.json'));
const h=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function context(code){
 const c=vm.createContext({DATA:{},h,statusOf:()=>0,HLC:{},cmpCard:()=>'',state:{qaMode:'lead'},ENTRIES:entries,TOPICS:metadata.TOPICS,TREE:Object.fromEntries([...new Set(entries.map(e=>e.mod))].map(mod=>[mod,{all:entries.filter(e=>e.mod===mod)}])),byId:new Map(entries.map(e=>[e.id,e])),SCENARIO_COUNTERFACTUALS:{},TRACES:{},ICON:{ext:'',shuffle:''},qKey:(id,i)=>id+'#'+i,qAnchor:(_id,i)=>i+1,unitsOf:()=>({ok:0,total:1}),pageHead:(_e,o)=>JSON.stringify(o),sec:(title,body)=>title+body,callout:(title,body)=>title+body,bullets:items=>JSON.stringify(items),fold:(title,body)=>title+body,relatedLinks:()=>'',pager:()=>'',vizFigure:()=>'',diagramFor:()=>'',codeCard:code=>code,keyCard:()=>'',entryNum:e=>e.number,modColor:()=>'',pitchBlock:x=>x,sentencePitch:x=>x,deepenBlock:()=>'',href:e=>'#/e/'+e.id});
 vm.runInContext(code,c);return c;
}
const old=context(source),current=context(projected);
function card(ctx,it,mode){ctx.it=structuredClone(it);ctx.mode=mode;return vm.runInContext('qaListHtml([it], {mode})',ctx);}
function parts(html){const m=html.match(/<div class="qa-body"><div class="md">([\s\S]*?)<\/div>\s*<div class="qa-foot">/);assert.ok(m);const body=m[1];const lead=body.match(/^<div class="qa-lead">([\s\S]*?)<\/div>/)?.[1]||'';const rest=body.match(/<div class="qa-rest">([\s\S]*)<\/div>$/)?.[1]||'';return {lead,rest};}
test('every original QA card retains byte-identical rendering in all three display modes',()=>{
 let count=0;for(const e of originals.filter(e=>e.kind==='qa'))for(const [i,q] of e.items.entries())for(const mode of ['q','lead','full']){const it={...q,key:e.id+'#'+i,no:i+1};assert.equal(card(current,it,mode),card(old,it,mode),e.id+'#'+i+' '+mode);count++;}assert.equal(count,507*3);
});
test('every authored QA has exactly one lead prefix and its complete answer in all modes',()=>{
 let count=0;for(const e of entries.filter(e=>e.kind==='qa'))for(const [i,q] of e.items.entries())if(q.leadType==='authored')for(const mode of ['q','lead','full']){
  const snapshot=JSON.stringify(q), html=card(current,{...q,key:e.id+'#'+q.id,no:i+1},mode),{lead,rest}=parts(html);
  assert.equal(lead,q.lead);assert.equal(rest,q.a.slice(q.lead.length));assert.equal(lead+rest,q.a);assert.equal(JSON.stringify(q),snapshot);assert.ok(html.includes('data-mode="'+mode+'"'));count++;
 }assert.ok(count>=3);
});
test('deduplication is exact-prefix and authored-only, retaining later repeated facts and mismatched leads',()=>{
 const lead='<p class="md-p">本质：唯一摘要</p>',tail='<p>解释</p>'+lead;
 for(const mode of ['q','lead','full']){
  const base={key:'fixture',no:1,q:'题目',lead,a:lead+tail,leadType:'authored'};
  assert.deepEqual(parts(card(current,base,mode)),{lead,rest:tail});
  assert.deepEqual(parts(card(current,{...base,a:'<p>不同首段</p>'+tail},mode)),{lead,rest:'<p>不同首段</p>'+tail});
  assert.equal(card(current,{...base,leadType:'original'},mode),card(old,{...base,leadType:'original'},mode));
 }
});
test('question-only, lead/collapsed and expanded visibility rules remain intact',async()=>{
 const css=await read('src/styles/main.css');
 assert.ok(css.includes('.qa-list[data-mode="q"] .qa:not(.open) .qa-body { display: none; }'));
 assert.ok(css.includes('.qa-list[data-mode="lead"] .qa:not(.open) .qa-rest { display: none; }'));
 assert.ok(css.includes('.qa-list[data-mode="full"] .qa-foot .more, .qa.open .qa-foot .more.expand { display: none; }'));
 assert.ok(projected.includes('data-act="qa-open"'));assert.ok(projected.includes('data-act="qa-close"'));
});
test('all four source-chip renderer paths suppress only metadata display while retaining body facts',()=>{
 for(const [kind,fn] of [['qa','renderQA'],['algo','renderAlgo'],['scenario','renderScenario'],['handwrite','renderHandwrite'],['database','renderHandwrite']]){
  const candidates=entries.filter(e=>e.kind===kind&&!e.simple&&e.number!==0);
  // The current algorithm corpus uses the simple renderer; exercise its retained generic path too.
  if(kind==='algo'&&!candidates.length)candidates.push({id:'fixture-algo',kind:'algo',mod:'algo',cat:'fixture',number:1,title:'fixture',description:'source-derived algorithm fact',code:'return 1;'});
  assert.ok(candidates.length,kind);
  for(const e of candidates){
   current.e={...e,source:'SOURCE_METADATA_SENTINEL'};const snapshot=JSON.stringify(current.e);
   const withSource=vm.runInContext(fn+'(e)',current);current.e={...e,source:''};const withoutSource=vm.runInContext(fn+'(e)',current);
   assert.equal(withSource,withoutSource,e.id);assert.ok(!withSource.includes('SOURCE_METADATA_SENTINEL'));
   if(kind!=='qa'){old.e={...e,source:'SOURCE_METADATA_SENTINEL'};const original=vm.runInContext(fn+'(e)',old);assert.equal(withSource,original.replace('<span class=\"chip\">SOURCE_METADATA_SENTINEL</span>'.replaceAll('\"','\\\"'),''),e.id+' preserves all other renderer output');}
   assert.equal(JSON.stringify({...current.e,source:'SOURCE_METADATA_SENTINEL'}),snapshot);
  }
 }
 assert.ok(!projected.includes('h(e.source)'));
});
test('baseline bypass and exact whole-file source/output hash guards remain active',()=>{
 assert.equal(projectSource('src/app/renderers.js',source,null,{baselineTest:true}),source);
 assert.throws(()=>projectSource('src/app/renderers.js',source+' ',manifest),/hash mismatch/);
 const altered=structuredClone(manifest);altered.ui.find(u=>u.file==='src/app/renderers.js').new_full_field+=' ';
 assert.throws(()=>projectSource('src/app/renderers.js',source,altered),/hash mismatch/);
});

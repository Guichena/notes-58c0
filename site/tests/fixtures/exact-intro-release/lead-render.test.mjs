import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {projectExactIntroRuntime as candidate} from './exact-intro-runtime.v2-proposal.mjs';
import {projectExactIntroRuntime as original} from './exact-intro-runtime.original.mjs';
import {removeExactIntroRepeat} from './remove-exact-intro.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'../../..');
const read=p=>readFile(path.join(root,p),'utf8');
const json=async p=>JSON.parse(await read(p));
const manifest=await json('content/display-projection.json');
const projected=manifest.ui.find(x=>x.file==='src/app/renderers.js').new_full_field;
const candidateProjected=candidate('src/app/renderers.js',projected);

const app=await read('dist/assets/app.js'),css=await read('dist/assets/styles/main.css');
const actualQa=app.slice(app.indexOf('function splitLead('),app.indexOf('function qaToolbar('));
const baseProjected=original('src/app/renderers.js',projected);
const qa=baseProjected.slice(baseProjected.indexOf('function splitLead('),baseProjected.indexOf('function qaToolbar(')).replaceAll('cmpCard(it.key)','cmpCard(it.key, it)').replace('<div class="qa-tags">','<div class="qa-tags">${priorityChip(it.key)}');
const helper=candidateProjected.slice(candidateProjected.lastIndexOf('function exactLeadAnswerRest('));
const actualHelper=app.slice(app.indexOf('function exactLeadAnswerRest('),app.indexOf('function renderCapacityEstimationPitfalls(')).trim();
assert.equal(actualHelper,helper.trim(),'built helper exactly matches the frozen integrated candidate');
assert.ok(actualQa.includes('exactLeadAnswerRest(it.lead, it.a)'),'new dist invokes the helper');
const before='? removeExactIntroRepeat(it.lead, it.a.slice(it.lead.length)) : it.a;';
const next=actualQa+'\n'+actualHelper;
const h=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const cmp='<div class="cmp"><table id="unique-comparison"><tr><td>Preserved comparison</td></tr></table></div>';
function context(code,extra={}){const c=vm.createContext({...extra,h,statusOf:()=>0,HLC:{},cmpCard:()=>cmp,priorityChip:()=>'',state:{qaMode:'lead'},removeExactIntroRepeat});vm.runInContext(code,c);return c;}
const old=context(qa),current=context(next);
function card(c,it,mode='lead'){c.it=it;c.mode=mode;return vm.runInContext('qaListHtml([it],{mode})',c);}
function parts(html){const body=html.split('<div class="qa-body"><div class="md">')[1].split('</div>\n      <div class="qa-foot">')[0];const split=body.indexOf('<div class="qa-rest">');const head=split<0?body:body.slice(0,split);return {lead:head.startsWith('<div class="qa-lead">')?head.slice(21,-6).replace(cmp,''):'',rest:split<0?'':body.slice(split+21,-6)};}
const make=(lead,a,extra={})=>({key:'fixture#0',anchor:'q-stable-anchor',no:1,q:'Question?',lead,a,...extra});
const lead='<p class="md-p">Unique summary</p>',tail='<p id="unique-tail">Full answer <a href="#target">link</a>.</p>';
function fixture(name,it,expected){test(name,()=>{const snapshot=JSON.stringify(it);for(const mode of ['q','lead','full']){const html=card(current,it,mode);assert.deepEqual(parts(html),expected);assert.ok(html.includes('id="q-q-stable-anchor"'));assert.ok(html.includes('data-key="fixture#0"'));assert.equal(html.split(cmp).length-1,1);assert.ok(html.includes('data-mode="'+mode+'"'));}assert.equal(JSON.stringify(it),snapshot);});}
fixture('no explicit lead preserves the original splitLead result',make(undefined,lead+tail),{lead,rest:tail});
fixture('byte-identical complete paragraph is removed only at the beginning',make(lead,lead+tail+lead),{lead,rest:tail+lead});
fixture('answer equal to lead keeps visible lead and no empty full-answer panel',make(lead,lead),{lead,rest:''});
fixture('different first paragraph is untouched',make(lead,'<p>Different</p>'+tail),{lead,rest:'<p>Different</p>'+tail});
for(const [name,l,a] of [
 ['links','<p><a href="/one">Same</a></p>','<p><a href="/two">Same</a></p>'],
 ['emphasis','<p><b>Same</b></p>','<p><strong>Same</strong></p>'],
 ['entities','<p>A &amp; B</p>','<p>A &#38; B</p>'],
 ['whitespace inside paragraph','<p>A B</p>','<p>A  B</p>'],
 ['unique paragraph anchor','<p>Same</p>','<p id="unique-anchor">Same</p>'],
 ['unique leading anchor','<p>Same</p>','<a id="unique-anchor"></a><p>Same</p>'],
 ['unique inline anchor','<p>Same</p>','<p><a id="unique-anchor"></a>Same</p>']
])fixture('same text preserves distinct '+name,make(l,a+tail),{lead:l,rest:a+tail});
fixture('table-first answer is untouched',make(lead,'<table id="body-table"><tr><td>Unique summary</td></tr></table>'+tail),{lead,rest:'<table id="body-table"><tr><td>Unique summary</td></tr></table>'+tail});
const table='<table id="lead-table"><tr><td>Unique summary</td></tr></table>';
fixture('table lead is conservatively outside paragraph-only deduplication',make(table,table+tail),{lead:table,rest:table+tail});
fixture('outer whitespace is ignored for matching but nonempty remainder bytes are preserved',make(' \n'+lead+'\t ', '\t'+lead+' \n'+tail+'\n'),{lead:' \n'+lead+'\t ',rest:'\t \n'+tail+'\n'});
fixture('whitespace-only remainder does not make an empty qa-rest',make(' '+lead+' ', '\n'+lead+'\t'),{lead:' '+lead+' ',rest:''});
fixture('partial paragraph prefix is not removed',make('<p>Partial','<p>Partial but complete answer</p>'+tail),{lead:'<p>Partial',rest:'<p>Partial but complete answer</p>'+tail});
fixture('multi-paragraph lead is conservatively untouched',make(lead+lead,lead+lead+tail),{lead:lead+lead,rest:lead+lead+tail});
fixture('nested block markup is conservatively untouched',make('<p><table><tr><td>x</td></tr></table></p>','<p><table><tr><td>x</td></tr></table></p>'+tail),{lead:'<p><table><tr><td>x</td></tr></table></p>',rest:'<p><table><tr><td>x</td></tr></table></p>'+tail});
const anchorLead='<p id="anchor-in-lead"><a href="/same"><em>Same</em></a></p>';
fixture('identical anchors links and emphasis stay once in the visible lead',make(anchorLead,anchorLead+tail),{lead:anchorLead,rest:tail});
test('lead-only equality does not leave misleading expand/collapse buttons',()=>{const html=card(current,make(lead,lead),'full');assert.ok(html.includes('<div class="qa-lead">'+lead));assert.ok(!html.includes('class="qa-rest"'));assert.ok(!html.includes('class="mini more'));});
test('current authored behavior, including its separately reviewed intro rule, is unchanged',()=>{for(const it of [make(lead,lead+tail,{leadType:'authored'}),make('<p class="md-p sx-ess"><span class="sx-tag">本质</span>Same</p>','<p class="md-p sx-ess"><span class="sx-tag">本质</span>Same</p><h3>Detail</h3><p class="md-p">Same</p>'+tail,{leadType:'authored'})])for(const mode of ['q','lead','full'])assert.equal(card(current,it,mode),card(old,it,mode));});
test('actual runtime keeps lead visible in short/full/print and keeps the original CSS display contracts',()=>{assert.ok(css.includes('.qa-list[data-mode="lead"] .qa:not(.open) .qa-rest { display: none; }'));assert.ok(css.includes('.qa-list[data-mode="q"] .qa:not(.open) .qa-body { display: none; }'));assert.match(css,/@media print[\s\S]*\.qa-list \.qa \.qa-body, \.qa-list \.qa \.qa-rest \{ display: block !important; \}/);for(const mode of ['lead','full']){const html=card(current,make(lead,lead+tail),mode);assert.equal(html.split(lead).length-1,1);assert.equal(html.split(tail).length-1,1);}assert.ok(!/\.qa-lead\s*\{[^}]*display:\s*none/.test(css));});
test('source projection stays baseline-excluded and guard fails closed on reapplication',()=>{assert.equal(candidate('src/app/renderers.js',projected,{baselineTest:true}),projected);assert.equal(candidate('other.js','unchanged'),'unchanged');assert.throws(()=>candidate('src/app/renderers.js',candidateProjected),/expected exactly one authored lead branch/);assert.ok(candidateProjected.includes('exactLeadAnswerRest(it.lead, it.a)'));assert.equal(original('src/app/renderers.js',projected).replace(before,'? removeExactIntroRepeat(it.lead, it.a.slice(it.lead.length)) : exactLeadAnswerRest(it.lead, it.a);')+helper,candidateProjected);});
const catalog=await json('dist/data/catalog.json'),entries=[];for(const chunk of new Set(catalog.entries.map(x=>x._chunk)))entries.push(...(await json('dist/'+chunk)).entries);
const corpus={cards:0,exactPrefix:0,alreadyAuthored:0,newLegacy:0,changed:[],htmlChecks:0};
test('every real QA card changes only for the 75 newly covered legacy exact-prefix leads',async()=>{for(const entry of entries.filter(e=>e.kind==='qa'))for(const [i,q] of entry.items.entries()){corpus.cards++;const snapshot=JSON.stringify(q),it={...q,key:entry.id+'#'+i,no:i+1,anchor:q.id||i+1};const exact=Boolean(q.lead&&typeof q.a==='string'&&q.a.startsWith(q.lead));if(exact){corpus.exactPrefix++;if(q.leadType==='authored')corpus.alreadyAuthored++;else corpus.newLegacy++;}for(const mode of ['q','lead','full']){const a=card(old,it,mode),b=card(current,it,mode);corpus.htmlChecks++;if(!exact||q.leadType==='authored')assert.equal(a,b,entry.id+'#'+i);else{const expected=parts(a);expected.rest=q.a.slice(q.lead.length);assert.deepEqual(parts(b),expected,entry.id+'#'+i);assert.equal(b.split(q.lead).length-1,1,entry.id+'#'+i+' lead once');assert.deepEqual(b.match(/<table\b[^>]*>[\s\S]*?<\/table>/g),a.match(/<table\b[^>]*>[\s\S]*?<\/table>/g),'all comparison/body tables unchanged');const tokens=x=>[...new Set(x.match(/(?:\bid|\bhref)="[^"]*"/g)||[])].sort();assert.deepEqual(tokens(b),tokens(a),'every unique ID and href survives');if(mode==='lead')corpus.changed.push({entryId:entry.id,index:i,questionId:q.id??null,leadType:q.leadType??null});}}assert.equal(JSON.stringify(q),snapshot);}assert.equal(corpus.exactPrefix,817);assert.equal(corpus.alreadyAuthored,742);assert.equal(corpus.newLegacy,75);assert.equal(corpus.changed.length,75);});
test('protected source and manifest keep hashes; integrated module matches frozen candidate',async()=>{const baselines=JSON.parse(await readFile(path.join(dir,'baseline-hashes.json'),'utf8'));for(const [file,sha] of Object.entries(baselines).filter(([file])=>!['scripts/exact-intro-runtime.mjs','dist/assets/app.js'].includes(file)))assert.equal(createHash('sha256').update(await read(file)).digest('hex'),sha,file);assert.equal(await read('scripts/exact-intro-runtime.mjs'),await readFile(path.join(dir,'exact-intro-runtime.v2-proposal.mjs'),'utf8'));});

test('real compiled cmpCard and all catalog comparison tables remain byte-identical',()=>{
 const cmpSource=app.slice(app.indexOf('function cmpCard('),app.indexOf('function keyCard('));
 const create=code=>{const c=context(code);c.HLC=catalog.HL.cards;c.comparisonVerifier={isDuplicate:()=>false};vm.runInContext(cmpSource,c);return c;};
 const a=create(qa),b=create(next);let count=0;
 for(const entry of entries.filter(e=>e.kind==='qa'))for(const [i,q] of entry.items.entries()){
  const key=entry.id+'#'+i;if(!catalog.HL.cards[key])continue;const it={...q,key,no:i+1};
  for(const mode of ['q','lead','full']){const old=card(a,it,mode),now=card(b,it,mode);assert.deepEqual(now.match(/<table\b[^>]*>[\s\S]*?<\/table>/g),old.match(/<table\b[^>]*>[\s\S]*?<\/table>/g),key);count++;}
 }assert.ok(count>=100);corpus.realComparisonChecks=count;
});

for(const bad of ['<p><em>Unclosed inline</p>','<p><a href="/target"</p>','<p-widget>Not a paragraph</p>'])fixture('incomplete or wrong-tag fragment stays visible: '+bad,make(bad,bad+tail),{lead:bad,rest:bad+tail});

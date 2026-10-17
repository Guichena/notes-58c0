import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,mkdtemp,cp,rm,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {compileAuthoring,validateLegacy} from '../scripts/authoring.mjs';
import {buildSearchRecords} from '../scripts/build-search.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const json=async p=>JSON.parse(await readFile(path.join(root,p),'utf8'));
const identity=await json('content/legacy-identities.json');
const metadata=await json('content/metadata.json');
const chunks=await Promise.all((await readdir(path.join(root,'content/chapters'))).filter(f=>f.endsWith('.json')).map(f=>json('content/chapters/'+f)));
const byId=new Map(chunks.flatMap(c=>c.entries).map(e=>[e.id,e]));
const base=metadata.entryOrder.map(id=>byId.get(id));
const originalQA=base.find(e=>e.kind==='qa');
const q=(id,more={})=>({schemaVersion:1,entryId:originalQA.id,id,question:'示例问题 <plain>',commonPhrasings:['第二种问法'],shortAnswer:'一句话 <safe>',explanation:{format:'text',value:'完整解释\n\n第二段'},followUps:['后续问题'],code:[{language:'java',label:'Example.java',value:'if (a < b) return "value";'}],tags:['测试标签'],related:[],...more});
const doc=(data,type='questions')=>({type,file:'fixture/'+data.id+'.json',data});
const entry=(more={})=>({schemaVersion:1,id:'example-qa',kind:'qa',module:'bagu',part:'示例分区',category:'示例分类',title:'测试专用',questions:[q('q-new',{entryId:undefined})],...more});
// Remove optional undefined values to match authored JSON, which cannot contain them.
const clean=x=>JSON.parse(JSON.stringify(x));
function compile(docs){return compileAuthoring(base,clean(docs),identity);}
function keyContext(entries) {
 const context=vm.createContext({byId:new Map(entries.map(e=>[e.id,e])),ENTRIES:entries,localStorage:{getItem:()=>null,setItem(){}}});
 return readFile(path.join(root,'src/app/storage.js'),'utf8').then(code=>{vm.runInContext(code,context);return context;});
}
test('empty authoring layer preserves all original content exactly',()=>assert.deepEqual(compile([]),base));
test('new question appends to legacy QA and all fields reach the generated search index',()=>{
 const output=compile([doc(q('q-added'))]);const e=output.find(e=>e.id===originalQA.id);
 assert.deepEqual(e.items.slice(0,originalQA.items.length),originalQA.items);assert.equal(e.items.at(-1).id,'q-added');assert.ok(e.items.at(-1).lead.includes('class="md-p sx-ess"'));
 const r=buildSearchRecords(output,{}).find(r=>r.id===e.id&&r.qi===e.items.length-1);
 for(const text of ['第二种问法','一句话','完整解释','后续问题','Example.java','测试标签'])assert.ok(r.text.includes(text),text);
 assert.ok(e.items.at(-1).a.includes('class="code-card md-code-card"'));assert.ok(e.items.at(-1).a.includes('&lt;safe&gt;'));assert.ok(e.items.at(-1).a.includes('a &lt; b'));assert.ok(!e.items.at(-1).q.includes('<plain>'));
});
test('new QA and knowledge entry compile without UI changes, including forward stable references',()=>{
 const qa=entry();const knowledge={schemaVersion:1,id:'example-knowledge',kind:'doc',module:'ai',part:'新增分区',category:'新知识',title:'知识示例',sections:[{id:'section-one',title:'概述',body:{format:'html',value:'<p><strong>显式富文本</strong></p>'}}],related:[{entryId:qa.id,questionId:'q-new',label:'参见问题'}]};
 const out=compile([doc(qa,'entries'),doc(knowledge,'entries')]);assert.equal(out.length,526);assert.ok(out.find(e=>e.id==='example-knowledge').html.includes('#/e/example-qa/q-new'));assert.ok(out.find(e=>e.id==='example-knowledge').html.includes('<strong>显式富文本</strong>'));
});
test('reordering newly authored questions keeps their stable progress keys and anchors',async()=>{
 const documents=[doc(q('q-first',{order:1})),doc(q('q-second',{order:2}))];
 const first=compile(documents);documents[0].data.order=3;const second=compile(documents);
 const a=first.find(e=>e.id===originalQA.id),b=second.find(e=>e.id===originalQA.id);assert.notDeepEqual(a.items.slice(-2).map(q=>q.id),b.items.slice(-2).map(q=>q.id));
 for(const entries of [first,second]){
  const ctx=await keyContext(entries);const e=entries.find(e=>e.id===originalQA.id);
  for(const id of ['q-first','q-second']){ctx.eid=e.id;ctx.qi=e.items.findIndex(q=>q.id===id);assert.equal(vm.runInContext('qKey(eid,qi)',ctx),e.id+'#'+id);assert.equal(vm.runInContext('qAnchor(eid,qi)',ctx),id);}
  assert.equal(vm.runInContext(`qKey(${JSON.stringify(e.id)},0)`,ctx),e.id+'#0');
 }
});
test('legacy question reordering/removal/insertion is rejected but answer edits are allowed',()=>{
 for(const change of [e=>e.items.reverse(),e=>e.items.shift(),e=>e.items.unshift({q:'new'})]){const copy=structuredClone(base);change(copy.find(e=>e.id===originalQA.id));assert.throws(()=>validateLegacy(copy,identity),/original questions|legacy question/);}
 const copy=structuredClone(base);copy.find(e=>e.id===originalQA.id).items[0].a='<p>更新答案</p>';assert.doesNotThrow(()=>validateLegacy(copy,identity));
});
test('drafts are validated but excluded from live entry and review counts',()=>{
 const out=compile([doc(q('q-draft',{draft:true})),doc(entry({draft:true}),'entries')]);assert.deepEqual(out,base);
});
test('duplicate IDs, unknown modules/targets/related links, missing fields and unsafe rich content fail clearly',()=>{
 const cases=[
  [doc(q('q-dup')),doc(q('q-dup'))],
  [doc(entry({id:base[0].id}),'entries')],
  [doc(entry({module:'unknown'}),'entries')],
  [doc(q('q-bad',{entryId:'unknown'}))],
  [doc(q('q-bad',{related:[{entryId:'unknown'}]}))],
  [doc(q('q-bad',{related:[{entryId:originalQA.id,questionId:'q-nope'}]}))],
  [doc(q('q-bad',{shortAnswer:''}))],
  [doc(q('q-bad',{explanation:{format:'html',value:'<img src=x onerror="alert(1)">'}}))],
 ];
 for(const documents of cases)assert.throws(()=>compile(documents),/duplicate|unknown|non-empty|unsafe/i);
});
test('CLI dry run creates no files; scaffold produces a valid excluded draft in a disposable workspace',async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'notes-authoring-'));
 try {
  await cp(path.join(root,'content'),path.join(temp,'content'),{recursive:true});
  const script=path.join(root,'scripts/content.mjs');
  const args=[script,'new-question','--entry',originalQA.id,'--id','q-cli','--root',temp];
  const dry=JSON.parse(execFileSync(process.execPath,[...args,'--dry-run'],{encoding:'utf8'}));assert.equal(dry.dryRun,true);await assert.rejects(stat(path.join(temp,'authoring')),e=>e.code==='ENOENT');
  execFileSync(process.execPath,args,{encoding:'utf8'});const report=execFileSync(process.execPath,[script,'validate','--root',temp],{encoding:'utf8'});assert.match(report,/524 entries, 934 review units/);
  assert.throws(()=>execFileSync(process.execPath,args,{encoding:'utf8',stdio:'pipe'}),/Duplicate question ID|File already exists/);
 }finally{await rm(temp,{recursive:true,force:true});}
});

// Extension tests use synthetic content only; nothing is added to authoring/.
const {originalContentHash,extensionTarget}=await import('../scripts/authoring.mjs');
const originalDoc=base.find(e=>e.kind==='doc');
const originalScenario=base.find(e=>e.kind==='scenario');
function extension(type='answer-additions',overrides={}) {
 const entry=type==='answer-additions'?originalQA:originalDoc;
 const data={schemaVersion:1,draft:false,id:'add-test',entryId:entry.id,...(type==='answer-additions'?{questionId:'0'}:{}),title:'补充 <title>',body:{format:'text',value:'唯一扩展搜索词 <script>alert(1)</script>'},code:[{language:'js',value:'<img src=x onerror=alert(1)>'}],related:[],...overrides};
 data.expectedOriginalHash=originalContentHash(extensionTarget(base,type,data));
 return doc(data,type);
}
test('answer additions preserve original object, identity, lead and order while extending answer/search',async()=>{
 const before=JSON.stringify(base),d=extension(),out=compile([d]);const e=out.find(e=>e.id===originalQA.id),old=originalQA.items[0];
 assert.equal(JSON.stringify(base),before);assert.equal(e.items.length,originalQA.items.length);
 assert.deepEqual({...e.items[0],a:old.a},old);assert.ok(e.items[0].a.startsWith(old.a));
 assert.ok(e.items[0].a.includes('&lt;script&gt;'));assert.ok(!e.items[0].a.includes('<script>'));assert.ok(!e.items[0].a.includes('<img src=x'));
 assert.deepEqual(e.items.slice(1),originalQA.items.slice(1));
 const records=buildSearchRecords(out,{});assert.equal(records.length,1031);assert.ok(records.find(r=>r.id===e.id&&r.qi===0).text.includes('唯一扩展搜索词'));
 const ctx=await keyContext(out);assert.equal(vm.runInContext(`qKey(${JSON.stringify(e.id)},0)`,ctx),e.id+'#0');
 assert.deepEqual(compile([d]),out);assert.deepEqual(compile([extension('answer-additions',{draft:true})]),base);
});
test('doc and scenario supplements append without changing original fields or review counts',()=>{
 const a=extension('supplements'),b=extension('supplements',{id:'add-scenario',entryId:originalScenario.id});
 const out=compile([a,b]),d=out.find(e=>e.id===originalDoc.id),s=out.find(e=>e.id===originalScenario.id);
 assert.equal(d.html,originalDoc.html);const {supplementHtml:docSupplement,...docUnchanged}=d;assert.deepEqual(docUnchanged,originalDoc);assert.ok(docSupplement.includes('唯一扩展搜索词'));
 const {supplementHtml,...unchanged}=s;assert.deepEqual(unchanged,originalScenario);assert.ok(supplementHtml.includes('唯一扩展搜索词'));
 assert.equal(out.length,524);assert.equal(out.reduce((n,e)=>n+(e.items?.length??1),0),934);
 assert.ok(buildSearchRecords(out,{}).find(r=>r.id===s.id).text.includes('唯一扩展搜索词'));
 assert.deepEqual(compile([b,a]),out);
});
test('extensions reject wrong target/hash, unknown fields, duplicate IDs/content and active HTML',()=>{
 const d=extension();
 for(const change of [x=>x.data.entryId='unknown',x=>x.data.questionId='00',x=>x.data.questionId='999999',x=>x.data.expectedOriginalHash='0'.repeat(64),x=>x.data.script='alert(1)',x=>x.data.body={format:'html',value:'<p>passive too</p>'},x=>x.data.body={format:'html',value:'<svg onload=alert(1)>'}]) {
  const bad=structuredClone(d);change(bad);assert.throws(()=>compile([bad]),/unknown|questionId|hash|Hash|prohibited/);
 }
 assert.throws(()=>compile([d,d]),/duplicate addition ID/);
 const duplicate=structuredClone(d);duplicate.data.id='add-other';assert.throws(()=>compile([d,duplicate]),/duplicate addition content/);
 const mismatch=structuredClone(d);mismatch.data.entryId=originalDoc.id;assert.throws(()=>compile([mismatch]),/QA target/);
 assert.throws(()=>extension('supplements',{entryId:originalQA.id}),/non-QA target/);
});
test('extension CLI scaffolds hash-locked excluded drafts without touching original content',async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'notes-extensions-'));
 try {
  await cp(path.join(root,'content'),path.join(temp,'content'),{recursive:true});const script=path.join(root,'scripts/content.mjs');
  for(const args of [['new-answer-addition','--entry',originalQA.id,'--question','0','--id','add-cli-answer'],['new-supplement','--entry',originalScenario.id,'--id','add-cli-scenario']]) {
   const full=[script,...args,'--root',temp];const dry=JSON.parse(execFileSync(process.execPath,[...full,'--dry-run'],{encoding:'utf8'}));
   assert.equal(dry.data.expectedOriginalHash.length,64);execFileSync(process.execPath,full,{encoding:'utf8'});
  }
  assert.match(execFileSync(process.execPath,[script,'validate','--root',temp],{encoding:'utf8'}),/524 entries, 934 review units; 2 authoring files/);
 }finally{await rm(temp,{recursive:true,force:true});}
});
test('active extension build is byte-idempotent and preserves catalog/search routes',async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'notes-extension-build-'));
 try {
  for(const dir of ['scripts','src','public','content'])await cp(path.join(root,dir),path.join(temp,dir),{recursive:true});
  const {mkdir,writeFile}=await import('node:fs/promises');
  for(const d of [blockExtension(),...allKindSupplements(),doc(entry({id:'structured-qa',questions:[questionBlocks('q-nested')]}),'entries'),doc(structuredDoc(),'entries'),doc(questionBlocks('q-separate',{entryId:'structured-qa'}))]) {
   await mkdir(path.join(temp,'authoring',d.type),{recursive:true});await writeFile(path.join(temp,'authoring',d.type,d.data.id+'.json'),JSON.stringify(d.data));
  }
  await mkdir(path.join(temp,'public/assets/imported/java'),{recursive:true});await writeFile(path.join(temp,'public/assets/imported/java/example.png'),Buffer.from('local test image'));
  // The finite wave2 compiled-field registry is production-corpus specific.
  // Stub it only in this disposable compiler fixture; production fails closed.
  await writeFile(path.join(temp,'scripts/wiki-wave2-corrections.mjs'),`export function correctWikiWave2(entries){return entries;}`);
  // These original-only fixtures also exclude the late production-corpus stages.
  await writeFile(path.join(temp,'scripts/late-wiki-corrections.mjs'),`export function correctLateWiki(entries){return entries;} export function appendMerchantSection(documents){return documents;} export function projectLateWikiMetadata(metadata){return metadata;}`);
  await writeFile(path.join(temp,'scripts/extended-wave1-proposal.mjs'),`export function appendWave1(documents){return documents;}`);
  await writeFile(path.join(temp,'scripts/agent-core-corrections.mjs'),`export function correctAgentCore(entries){return entries;}`);
  // This isolated fixture supplies its own authored corpus, not the production reading registry.
  // Compiler fixture deliberately isolates authoring behavior and code rendering.
  // Stub the reading layer only in this disposable test directory; production has no bypass.
  await writeFile(path.join(temp,'scripts/interview-reading.mjs'),`export function projectInterviewReading(entries){return {entries,archivedRoutes:{},sourceArchive:entries,report:null};} export function projectInterviewRuntime(file,text){return text;}`);
  await writeFile(path.join(temp,'scripts/voice-factual-correction.mjs'),`export function projectVoiceEntries(e){return e;} export function projectVoiceMetadata(m){return m;}`);
  // Isolate this synthetic corpus from both finite production reading projections.
  await writeFile(path.join(temp,'scripts/learner-reading-cleanup.mjs'),`export function projectLearnerReadingCleanup(e){return e;}`);
  await writeFile(path.join(temp,'scripts/project-claims-correction.mjs'),`export function projectClaimExamples(e){return e;}`);
  // This disposable synthetic corpus has no reviewed production editorial targets.
  await writeFile(path.join(temp,'scripts/interview-editorial-projection.mjs'),`export function projectInterviewEditorial(e){return e;}`);
  await writeFile(path.join(temp,'scripts/reviewed-content-projection.mjs'),`export function projectReviewedContent(e){return e;}`);
  await writeFile(path.join(temp,'content/reviewed-content-projection.json'),'{}');
  await writeFile(path.join(temp,'scripts/algorithm-corrections.mjs'),`export function projectAlgorithmCorrections(e){return e;}`);
  await writeFile(path.join(temp,'content/algorithm-corrections.json'),'{}');
  await writeFile(path.join(temp,'scripts/learner-reading-runtime.mjs'),`export function projectLearnerReadingRuntime(f,s){return s;}`);
  // This disposable compiler corpus intentionally omits production priority targets.
  // Keep production validation strict; isolate only this fixture's view stage.
  await writeFile(path.join(temp,'scripts/interview-priority-view.mjs'),`export function projectPriorityViewRuntime(f,s){return s;} export function validatePriorityView(){return true;}`);
  // Production voice and consolidation records also belong to the full authored corpus.
  await writeFile(path.join(temp,'scripts/interview-voice-review.mjs'),`export async function readInterviewVoiceReview(){return {schemaVersion:1,records:[]};} export function projectInterviewVoiceReview(e){return e;}`);
  await writeFile(path.join(temp,'scripts/interview-consolidation.mjs'),`export async function readInterviewConsolidation(){return {schemaVersion:1,records:[]};} export function projectInterviewConsolidation(e){return e;}`);
  // Isolate the authoring-only fixture from the mandatory production factual registry.
  await writeFile(path.join(temp,'scripts/learner-factual-corrections.mjs'),`export function projectLearnerFactualCorrections(entries){return entries;}`);
  // The disposable original-only authoring fixture excludes audited production repairs too.
  await writeFile(path.join(temp,'scripts/handwrite-repairs.mjs'),`export function projectHandwriteRepairs(entries){return entries;}`);
  const build=()=>execFileSync(process.execPath,['scripts/build.mjs'],{cwd:temp,encoding:'utf8'});
  build();const first=await readFile(path.join(temp,'dist/build-manifest.json'),'utf8');build();assert.equal(await readFile(path.join(temp,'dist/build-manifest.json'),'utf8'),first);
  const catalog=JSON.parse(await readFile(path.join(temp,'dist/data/catalog.json'),'utf8'));
  assert.deepEqual(catalog.entries.slice(0,base.length).map(e=>e.id),base.map(e=>e.id));assert.equal(catalog.entries.length,526);assert.ok(catalog.entries.some(e=>e.id==='structured-doc'));assert.equal(catalog.entries.find(e=>e.id==='structured-qa').items.length,2);
  const qa=catalog.entries.find(e=>e.id===originalQA.id);assert.equal(qa.items.length,originalQA.items.length);assert.ok(qa.items.every(q=>!q.id));
  const chapter=JSON.parse(await readFile(path.join(temp,'dist',qa._chunk),'utf8'));assert.ok(chapter.entries.find(e=>e.id===qa.id).items[0].a.includes('first();'));
 }finally{await rm(temp,{recursive:true,force:true});}
});

const {structuredBlocks,readAuthoring}=await import('../scripts/authoring.mjs');
const orderedBlocks=[
 {type:'paragraph',text:'段落 <script>first</script>'},
 {type:'code',language:'java',label:'First.java',value:'first(); // <tag>'},
 {type:'heading',level:3,text:'表格 <heading>'},
 {type:'table',headers:['列 A','列 B'],rows:[['<img src=x>','cell'],['last','']]},
 {type:'list',ordered:true,items:['item <b>','second']},
 {type:'code',language:'java',value:'second();'},
 {type:'image',src:'assets/imported/java/example.png',alt:'图像 " onload="alert(1)'},
];
function blockExtension(){const d=extension();delete d.data.body;delete d.data.code;d.data.blocks=structuredClone(orderedBlocks);return d;}
test('structured extension blocks preserve paragraph/code/table/image order with escaped passive output',()=>{
 const html=structuredBlocks(orderedBlocks);let previous=-1;
 for(const marker of ['段落','first();','表格','<table','item &lt;b&gt;','second();','<img src="assets/imported']) {const next=html.indexOf(marker);assert.ok(next>previous,marker);previous=next;}
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('&lt;img src=x&gt;'));
 assert.ok(html.includes('alt="图像 &quot; onload=&quot;alert(1)"'));assert.ok(!html.includes('alt="图像 " onload='));
 assert.equal((html.match(/code-card md-code-card/g)||[]).length,2);assert.ok(html.includes('data-lang="java"'));
 const d=blockExtension(),out=compile([d]);assert.ok(out.find(e=>e.id===originalQA.id).items[0].a.endsWith(html));
 assert.throws(()=>compile([{...d,data:{...d.data,body:'duplicate'}}]),/mutually exclusive/);
 assert.throws(()=>compile([{...d,data:{...d.data,code:[]}}]),/mutually exclusive/);
});
test('structured blocks reject malicious paths, arbitrary attributes, prototypes, unknown types and malformed tables',()=>{
 const urls=['https://example.com/a.png','//example.com/a.png','data:image/png;base64,AA','javascript:alert(1)','assets/imported/../secret.png','assets/imported/a..png','assets/imported/%2e%2e/a.png','assets/imported/a.png?x=1','assets/imported/a.png#x','assets/imported/a.svg','assets/imported/a\\b.png','/assets/imported/a.png'];
 for(const src of urls)assert.throws(()=>structuredBlocks([{type:'image',src,alt:'test'}]),/local raster path/);
 const bad=[{type:'image',src:'assets/imported/a.png',alt:''},{type:'image',src:'assets/imported/a.png',alt:'x',onload:'evil'},
  {type:'paragraph',text:'x',html:'<script>evil</script>'},JSON.parse('{"type":"paragraph","text":"x","__proto__":{"polluted":true}}'),
  {type:'html',value:'<b>raw</b>'},{type:'heading',text:'x',level:2.5},{type:'heading',text:'x',level:1},{type:'list',ordered:false,items:[]},
  {type:'table',headers:['A','B'],rows:[['one']]},{type:'code',language:'java',value:'x',onclick:'evil'}];
 for(const b of bad)assert.throws(()=>structuredBlocks([b]),/unknown|non-empty|heading level|empty|width/);
 assert.equal({}.polluted,undefined);assert.throws(()=>structuredBlocks([]),/at least one/);
});
test('image asset validation rejects missing assets and symlinks without reading external paths',async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'notes-images-'));
 const {mkdir,writeFile,symlink}=await import('node:fs/promises');
 try {
  await mkdir(path.join(temp,'authoring/answer-additions'),{recursive:true});const d=blockExtension();
  await writeFile(path.join(temp,'authoring/answer-additions/add-test.json'),JSON.stringify(d.data));
  await assert.rejects(readAuthoring(temp),/missing imported image asset/);
  await mkdir(path.join(temp,'public/assets/imported/java'),{recursive:true});const image=path.join(temp,'public/assets/imported/java/example.png');
  await writeFile(image,Buffer.from('test local image bytes'));assert.equal((await readAuthoring(temp)).length,1);
  await rm(image);await symlink(path.join(temp,'not-read.png'),image);await assert.rejects(readAuthoring(temp),/cannot contain symlinks/);
 } finally{await rm(temp,{recursive:true,force:true});}
});

function questionBlocks(id='q-structured',overrides={}) {
 const value=q(id,overrides);delete value.explanation;delete value.code;value.blocks=structuredClone(orderedBlocks);return value;
}
function sectionBlocks(){return {id:'section-structured',title:'结构化章节',blocks:structuredClone(orderedBlocks)};}
function structuredDoc(){return {schemaVersion:1,id:'structured-doc',kind:'doc',module:'ai',part:'test',category:'test',title:'Structured doc',sections:[sectionBlocks()]};}
test('standalone and nested QA and doc sections compile ordered blocks while preserving metadata and stable keys',async()=>{
 const nested=entry({id:'structured-qa',questions:[questionBlocks('q-nested')]});
 const documents=[doc(questionBlocks()),doc(nested,'entries'),doc(structuredDoc(),'entries')];
 const out=compile(documents),added=out.find(e=>e.id===originalQA.id).items.at(-1);
 assert.deepEqual(out.find(e=>e.id===originalQA.id).items.slice(0,-1),originalQA.items);
 for(const item of [added,out.find(e=>e.id==='structured-qa').items[0]]) {
  assert.ok(item.a.includes(structuredBlocks(orderedBlocks)));assert.ok(item.a.startsWith(item.lead));
  assert.ok(item.a.includes('常见问法'));assert.ok(item.a.includes('追问'));assert.ok(item.a.includes('标签'));
  assert.ok(item.a.indexOf('first();')<item.a.indexOf('<table'));assert.ok(item.a.indexOf('<table')<item.a.indexOf('second();'));
 }
 assert.ok(out.find(e=>e.id==='structured-doc').html.includes(structuredBlocks(orderedBlocks)));
 const ctx=await keyContext(out);ctx.eid=originalQA.id;ctx.qi=originalQA.items.length;
 assert.equal(vm.runInContext('qKey(eid,qi)',ctx),originalQA.id+'#q-structured');
 assert.ok(buildSearchRecords(out,{}).find(r=>r.id===originalQA.id&&r.qi===originalQA.items.length).text.includes('first();'));
 const draft=questionBlocks('q-draft-blocks',{draft:true});assert.deepEqual(compile([doc(draft)]),base);
});
test('QA and doc block mode rejects mixed legacy fields, raw HTML blocks and invalid identities',()=>{
 for(const field of ['explanation','code']){const bad=questionBlocks();bad[field]=field==='code'?[]:'legacy';assert.throws(()=>compile([doc(bad)]),/mutually exclusive/);}
 for(const field of ['body','code']){const bad=structuredDoc();bad.sections[0][field]=field==='code'?[]:'legacy';assert.throws(()=>compile([doc(bad,'entries')]),/mutually exclusive/);}
 const raw=questionBlocks();raw.blocks=[{type:'html',value:'<script>alert(1)</script>'}];assert.throws(()=>compile([doc(raw)]),/unknown block type/);
 const nested=entry({questions:[questionBlocks('not-q-prefixed')]});assert.throws(()=>compile([doc(nested,'entries')]),/must start with q-/);
 const missing=questionBlocks();delete missing.shortAnswer;assert.throws(()=>compile([doc(missing)]),/non-empty/);
});
test('readAuthoring validates images in standalone questions, nested questions and doc sections including drafts',async()=>{
 const {mkdir,writeFile,symlink}=await import('node:fs/promises');
 for(const d of [doc(questionBlocks('q-image',{draft:true})),doc(entry({questions:[questionBlocks()]}),'entries'),doc(structuredDoc(),'entries')]) {
  const temp=await mkdtemp(path.join(os.tmpdir(),'notes-nested-images-'));
  try {
   await mkdir(path.join(temp,'authoring',d.type),{recursive:true});await writeFile(path.join(temp,'authoring',d.type,'fixture.json'),JSON.stringify(d.data));
   await assert.rejects(readAuthoring(temp),/missing imported image asset/);
   await mkdir(path.join(temp,'public/assets/imported/java'),{recursive:true});const image=path.join(temp,'public/assets/imported/java/example.png');
   await writeFile(image,'test image');assert.equal((await readAuthoring(temp)).length,1);
   await rm(image);await symlink(path.join(temp,'outside.png'),image);await assert.rejects(readAuthoring(temp),/cannot contain symlinks/);
  }finally{await rm(temp,{recursive:true,force:true});}
 }
});

const {SUPPLEMENT_KINDS}=await import('../scripts/authoring.mjs');
function allKindSupplements(){return SUPPLEMENT_KINDS.map(kind=>extension('supplements',{id:'add-kind-'+kind,entryId:base.find(e=>e.kind===kind).id}));}
test('every existing non-QA kind accepts safe supplements with original code, fields and identity intact',async()=>{
 assert.deepEqual([...new Set(base.filter(e=>e.kind!=='qa').map(e=>e.kind))].sort(),[...SUPPLEMENT_KINDS].sort());
 const documents=allKindSupplements(),out=compile(documents);
 assert.deepEqual(compile([...documents].reverse()),out);assert.equal(out.length,base.length);
 const source=await readFile(path.join(root,'src/app/fragments.js'),'utf8');
 const ctx=vm.createContext({TREE:{},h:x=>String(x)});vm.runInContext(source,ctx);
 for(const kind of SUPPLEMENT_KINDS) {
  const original=base.find(e=>e.kind===kind),e=out.find(e=>e.id===original.id);const {supplementHtml,...remaining}=e;
  assert.deepEqual(remaining,original);assert.ok(supplementHtml.includes('&lt;script&gt;'));assert.ok(!supplementHtml.includes('<script>'));
  assert.equal(e.code,original.code);assert.equal(e.progressKey,original.progressKey);
  assert.ok(buildSearchRecords(out,{}).find(r=>r.id===e.id).text.includes('唯一扩展搜索词'));
  ctx.e=e;ctx.TREE={[e.mod]:{all:[e]}};const rendered=vm.runInContext('pager(e)',ctx);
  assert.equal(rendered.split(supplementHtml).length-1,1);assert.ok(rendered.indexOf(supplementHtml)<rendered.indexOf('<nav class="pager">'));
 }
 const renderers=await readFile(path.join(root,'src/app/renderers.js'),'utf8');assert.ok(!renderers.includes('supplementHtml'),'supplements have one common rendering point');
 assert.throws(()=>extensionTarget([{id:'fake',kind:'unapproved'}],'supplements',{entryId:'fake'}),/supported original non-QA/);
 assert.throws(()=>extensionTarget(base,'supplements',{entryId:originalQA.id}),/supported original non-QA/);
});

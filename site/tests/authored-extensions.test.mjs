import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,cp,mkdir,writeFile,readFile,rm,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileAuthoring,compileUnextendedAuthoring,authoredExtensionTarget,extensionTarget,originalContentHash,readAuthoring} from '../scripts/authoring.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const base=[{id:'original',kind:'qa',items:[{q:'Original question',a:'Original answer'}]}];
const identity={entries:[{id:'original',kind:'qa',progressKey:'original',questions:[createHash('sha256').update('Original question').digest('hex')]}]};
const question=(id,more={})=>({id,question:id,shortAnswer:'Conclusion',explanation:{format:'text',value:'Explanation'},...more});
const doc=(type,data)=>({type,file:`authoring/${type}/${data.id}.json`,data});
const authored=doc('entries',{schemaVersion:1,id:'authored',kind:'qa',module:'bagu',part:'Part',category:'Category',title:'Title',questions:[question('q-first',{order:1}),question('q-target',{order:2})],tags:['entry tag']});
const compile=docs=>compileAuthoring(base,docs,identity);
function addition(docs,more={}) {
 const data={schemaVersion:1,id:'add-one',entryId:'authored',targetOrigin:'authored',questionId:'q-target',title:'Extra',body:{format:'text',value:'Additional detail'},...more};
 data.expectedOriginalHash=originalContentHash(authoredExtensionTarget(base,docs,identity,data));
 return doc('answer-additions',data);
}
test('two authored additions share the unextended hash, are deterministic, and do not mutate inputs',()=>{
 const docs=[authored],a=addition(docs),b=addition(docs,{id:'add-two',body:'Second detail'});
 const before=JSON.stringify({base,docs,a,b});
 const out=compile([b,...docs,a]),target=out.at(-1).items.find(q=>q.id==='q-target');
 assert.match(target.a,/Additional detail.*Second detail/);
 assert.equal(a.data.expectedOriginalHash,b.data.expectedOriginalHash);
 assert.deepEqual(compile([...docs,a,b]),out);
 assert.deepEqual(compile([a,b,...docs]),out);
 assert.equal(JSON.stringify({base,docs,a,b}),before);
 assert.deepEqual(out[0],base[0]);
 assert.deepEqual(out.at(-1).items.map(q=>q.id),['q-first','q-target']);
 const snapshot=authoredExtensionTarget(base,[a,b,...docs],identity,a.data);
 assert.equal(originalContentHash(snapshot),a.data.expectedOriginalHash);
 assert.ok(!snapshot.a.includes('Additional detail'));
 assert.deepEqual(compileUnextendedAuthoring(base,[a,b,...docs],identity),compile(docs));
 const invalid=structuredClone(a);invalid.data.expectedOriginalHash='invalid';
 assert.deepEqual(authoredExtensionTarget(base,[invalid,...docs],identity,a.data),snapshot,'helper must not recursively validate/apply extensions');
});
test('authored targets use stable IDs rather than indexes and can be appended to original entries',()=>{
 const docs=[structuredClone(authored),doc('questions',{schemaVersion:1,entryId:'original',...question('q-appended')})];
 const a=addition(docs),b=addition(docs,{id:'add-appended',entryId:'original',questionId:'q-appended'});
 docs[0].data.questions[1].order=-1;
 // Entry tags belong to the first question, so recompute only that changed snapshot.
 a.data.expectedOriginalHash=originalContentHash(authoredExtensionTarget(base,docs,identity,a.data));
 const out=compile([a,b,...docs]);
 assert.equal(out.at(-1).items[0].id,'q-target');assert.match(out.at(-1).items[0].a,/Additional detail/);
 assert.deepEqual(out[0].items[0],base[0].items[0]);assert.equal(out[0].items[1].id,'q-appended');assert.match(out[0].items[1].a,/Additional detail/);
 assert.deepEqual(compile([...docs].reverse().concat([b,a])),out);
 assert.throws(()=>extensionTarget(base,'answer-additions',b.data),/zero-based/);
});
test('authored extensions reject missing/draft targets, wrong scope/hash, duplicates, numeric and implicit origins',()=>{
 const docs=[authored],a=addition(docs);
 for(const fields of [
  {entryId:'missing'}, {questionId:'q-missing'}, {questionId:'0'}, {questionId:'1'},
  {targetOrigin:'original'}, {targetOrigin:undefined}, {targetOrigin:null}, {targetOrigin:'other'},
  {expectedOriginalHash:'0'.repeat(64)}, {entryId:'original',questionId:'0'},
 ])assert.throws(()=>compile([...docs,{...a,data:{...a.data,...fields}}]),/unknown|questionId|targetOrigin|Hash/);
 const draft=structuredClone(authored);draft.data.questions[1].draft=true;
 assert.throws(()=>compile([draft,a]),/draft authored target question/);
 draft.data.draft=true;assert.throws(()=>compile([draft,a]),/draft authored target entry/);
 assert.throws(()=>compile([authored,{...a,type:'supplements',data:{...a.data,questionId:undefined}}]),/answer-additions only/);
 assert.throws(()=>compile([authored,a,{...a,data:{...a.data,id:'add-duplicate'}}]),/duplicate addition content/);
 assert.throws(()=>compile([authored,a,a]),/duplicate addition ID/);
 assert.throws(()=>authoredExtensionTarget(base,docs,identity,{...a.data,targetOrigin:undefined}),/explicit/);
 const draftAddition={...a,data:{...a.data,draft:true}};assert.deepEqual(compile([authored,draftAddition]),compile([authored]));
});
test('authored extensions retain text/HTML and structured image safety checks',()=>{
 const a=addition([authored]);
 for(const body of [{format:'html',value:'<p>Passive</p>'},{format:'html',value:'<script>alert(1)</script>'}])assert.throws(()=>compile([authored,{...a,data:{...a.data,body}}]),/raw HTML/);
 for(const src of ['https://host/a.png','assets/imported/../a.png','assets/imported/a.svg']) {
  const data={...a.data,blocks:[{type:'image',src,alt:'image'}]};delete data.body;
  assert.throws(()=>compile([authored,{...a,data}]),/local raster path/);
 }
});
test('authored CLI scaffold and actual build preserve source, identities and byte determinism',async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'notes-authored-extensions-'));
 try {
  for(const dir of ['scripts','src','public','content'])await cp(path.join(root,dir),path.join(temp,dir),{recursive:true});
  await mkdir(path.join(temp,'authoring/entries'),{recursive:true});
  await writeFile(path.join(temp,authored.file),JSON.stringify(authored.data));
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
  const run=(args)=>execFileSync(process.execPath,args,{cwd:temp,encoding:'utf8',stdio:'pipe'});
  const args=['scripts/content.mjs','new-answer-addition','--entry','authored','--question','q-target','--target-origin','authored','--id','add-cli'];
  const dry=JSON.parse(run([...args,'--dry-run']));assert.equal(dry.data.targetOrigin,'authored');assert.equal(dry.data.questionId,'q-target');
  run(args);const file=path.join(temp,'authoring/answer-additions/add-cli.json');const data=JSON.parse(await readFile(file,'utf8'));
  assert.deepEqual(data,dry.data);data.draft=false;await writeFile(file,JSON.stringify(data));run(['scripts/content.mjs','validate']);
  run(['scripts/build.mjs']);const first=await readFile(path.join(temp,'dist/build-manifest.json'),'utf8');run(['scripts/build.mjs']);assert.equal(await readFile(path.join(temp,'dist/build-manifest.json'),'utf8'),first);
  const catalog=JSON.parse(await readFile(path.join(temp,'dist/data/catalog.json'),'utf8'));
  const entry=catalog.entries.find(e=>e.id==='authored');assert.deepEqual(entry.items.map(q=>q.id),['q-first','q-target']);
  const chapter=JSON.parse(await readFile(path.join(temp,'dist',entry._chunk),'utf8'));assert.match(chapter.entries.find(e=>e.id==='authored').items[1].a,/id="add-cli"/);
  for(const name of await readdir(path.join(root,'content/chapters')))assert.deepEqual(await readFile(path.join(temp,'content/chapters',name)),await readFile(path.join(root,'content/chapters',name)));
  const imageData={...data,blocks:[{type:'image',src:'assets/imported/missing.png',alt:'x'}]};delete imageData.body;delete imageData.code;await writeFile(file,JSON.stringify(imageData));await assert.rejects(readAuthoring(temp),/missing imported image asset/);
 }finally{await rm(temp,{recursive:true,force:true});}
});
test('hash snapshot includes compiled entry tags and references, and multi-entry input permutations preserve order',()=>{
 const other=structuredClone(authored);other.data.id='another';other.file='authoring/entries/another.json';
 other.data.questions=[question('q-ref',{related:[{entryId:'authored',questionId:'q-target'}]})];
 const docs=[authored,other];const a=addition(docs,{questionId:'q-first'});
 const snapshot=authoredExtensionTarget(base,docs,identity,a.data);assert.match(snapshot.a,/entry tag/);
 assert.deepEqual(compile([...docs,a]),compile([a,...docs.reverse()]));
 const changed=structuredClone(authored);changed.data.tags=['changed tag'];
 assert.throws(()=>compile([changed,other,a]),/mismatched expectedOriginalHash/);
});
test('original default and explicit original targeting remain equivalent and share duplicate detection',()=>{
 const data={schemaVersion:1,id:'add-original',entryId:'original',questionId:'0',title:'Extra',body:'Original extra',expectedOriginalHash:originalContentHash(base[0].items[0])};
 const implicit=doc('answer-additions',data),explicit=doc('answer-additions',{...data,targetOrigin:'original'});
 assert.deepEqual(compile([implicit]),compile([explicit]));
 assert.deepEqual(extensionTarget(base,'answer-additions',data),base[0].items[0]);
 assert.throws(()=>compile([implicit,{...explicit,data:{...explicit.data,id:'add-other'}}]),/duplicate addition content/);
 assert.deepEqual(compile([]),base);
});

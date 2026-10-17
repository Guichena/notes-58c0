import {projectPriorityViewRuntime} from '../scripts/interview-priority-view.mjs';
import {projectCapacityPitfallsRuntime} from '../scripts/capacity-pitfalls-runtime.mjs';
import {projectExactIntroRuntime} from '../scripts/exact-intro-runtime.mjs';
import {projectNoteDisplayRuntime} from '../scripts/note-display-cleanup.mjs';
import {expectedNoteDisplay} from './helpers/note-display-oracle.mjs';
import {projectAlgorithmCorrections} from '../scripts/algorithm-corrections.mjs';
import {projectReviewedContent} from '../scripts/reviewed-content-projection.mjs';
import {projectInterviewEditorial} from '../scripts/interview-editorial-projection.mjs';
import {projectClaimExamples} from '../scripts/project-claims-correction.mjs';
import {projectLearnerReadingCleanup} from '../scripts/learner-reading-cleanup.mjs';
import {projectLearnerReadingRuntime} from '../scripts/learner-reading-runtime.mjs';
import {projectHandwriteRepairs} from '../scripts/handwrite-repairs.mjs';
import {projectVoiceEntries} from '../scripts/voice-factual-correction.mjs';
import {projectLearnerFactualCorrections} from '../scripts/learner-factual-corrections.mjs';
import {appendWave1} from '../scripts/extended-wave1-proposal.mjs';
import {correctLateWiki,appendMerchantSection} from '../scripts/late-wiki-corrections.mjs';
import {correctAgentCore} from '../scripts/agent-core-corrections.mjs';
import {correctWikiWave2} from '../scripts/wiki-wave2-corrections.mjs';
import {correctReferenceFields} from '../scripts/reference-field-corrections.mjs';
import {correctReferenceOriginalAnswers} from '../scripts/original-qa-corrections.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {correctMainAnswers} from '../scripts/main-answer-corrections.mjs';
import {correctAIAnswers} from '../scripts/ai-answer-corrections.mjs';
import {projectEntries,projectSource} from '../scripts/display-projection.mjs';
import {compileAuthoring,readAuthoring,originalContentHash,extensionTarget} from '../scripts/authoring.mjs';
import {projectInterviewReading,projectInterviewRuntime} from '../scripts/interview-reading.mjs';
import {buildSearchRecords} from '../scripts/build-search.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const json=async p=>JSON.parse(await readFile(path.join(root,p),'utf8'));
const manifest=await json('content/display-projection.json'), metadata=await json('content/metadata.json'), identity=await json('content/legacy-identities.json');
const originalChapters=new Map(await Promise.all((await readdir(path.join(root,'content/chapters'))).filter(f=>f.endsWith('.json')).map(async f=>['content/chapters/'+f,await json('content/chapters/'+f)])));
const originals=new Map([...originalChapters.values()].flatMap(c=>c.entries).map(e=>[e.id,e]));
const base=metadata.entryOrder.map(id=>originals.get(id));
const awaitableDocs=await readAuthoring(root);
const authored=compileAuthoring(base,awaitableDocs,identity);
const opts={originalChapters};
const projected=projectEntries(authored,manifest,opts);
const target=manifest.fields[0];
const codePre=s=>[...s.matchAll(/<(code|pre)\b[^>]*>[\s\S]*?<\/\1>/g)].map(m=>m[0]);
test('reviewed projection applies 484 standalone, 187 contextual and two UI edits',()=>{
 assert.deepEqual(manifest.approved_counts,{standalone_removals:484,ui_replacements:2,contextual_proposed:187});
 assert.equal(manifest.fields.reduce((n,f)=>n+f.standalone_references.length,0),484);
 assert.equal(manifest.fields.reduce((n,f)=>n+f.contextual_references.length,0),187);
 assert.equal(manifest.ui.length,2);
 for(const f of manifest.fields)assert.equal(projected.find(e=>e.id===f.entry_id)[f.field],f.new_full_field);
});
test('projection changes only explicitly approved fields; leaves IDs, metadata, supplements and input untouched',()=>{
 const restored=structuredClone(projected);
 for(const f of manifest.fields){const e=restored.find(e=>e.id===f.entry_id);e[f.field]=f.old_full_field;assert.equal(originals.get(f.entry_id)[f.field],f.old_full_field);}
 assert.deepEqual(restored,authored);
 for(const f of manifest.fields)assert.deepEqual(codePre(f.new_full_field),codePre(f.old_full_field));
 assert.deepEqual(authored,compileAuthoring(base,awaitableDocs,identity));
});
test('stale compiled/original hashes, wrong identities, duplicate targets, malformed pointers and corrupt output abort',()=>{
 const changed=structuredClone(authored);changed.find(e=>e.id===target.entry_id)[target.field]+='!';assert.throws(()=>projectEntries(changed,manifest,opts),/compiled source.*hash mismatch/);
 const changedOriginal=structuredClone(originalChapters);changedOriginal.get(target.file).entries[Number(target.json_pointer.split('/')[2])][target.field]+='!';assert.throws(()=>projectEntries(authored,manifest,{originalChapters:changedOriginal}),/original source.*hash mismatch/);
 for(const mutate of [m=>m.fields[0].entry_id='missing',m=>m.fields.push(m.fields[0]),m=>m.fields[0].json_pointer='/entries/999/html',m=>m.fields[0].new_full_field+='!',m=>m.fields[0].old_full_field+='!',m=>m.fields[0].field='supplementHtml']){
  const copy=structuredClone(manifest);mutate(copy);assert.throws(()=>projectEntries(authored,copy,opts),/Display projection:/);
 }
});
test('baseline bypass preserves exact original entries and exact UI source without reading manifest',async()=>{
 assert.equal(projectEntries(base,null,{baselineTest:true}),base);
 for(const f of manifest.ui){const source=await readFile(path.join(root,f.file),'utf8');assert.equal(source,f.old_full_field);assert.equal(projectSource(f.file,source,null,{baselineTest:true}),source);}
});
test('UI bundle projection uses exact whole-file guards and preserves unlisted files',()=>{
 for(const f of manifest.ui){assert.equal(projectSource(f.file,f.old_full_field,manifest),f.new_full_field);assert.throws(()=>projectSource(f.file,f.old_full_field+'!',manifest),/UI source.*hash mismatch/);const copy=structuredClone(manifest);copy.ui.find(x=>x.file===f.file).new_full_field+='!';assert.throws(()=>projectSource(f.file,f.old_full_field,copy),/UI result.*hash mismatch/);}
 assert.equal(projectSource('src/app/storage.js','unchanged',manifest),'unchanged');
});
test('authoring original-target hash lock remains valid before projection; supplemental content survives',()=>{
 const d={schemaVersion:1,draft:false,id:'add-display-test-supplement',entryId:target.entry_id,title:'补充',body:{format:'text',value:'独立补充文本'},code:[],related:[]};
 d.expectedOriginalHash=originalContentHash(extensionTarget(base,'supplements',d));
 const compiled=compileAuthoring(base,[{type:'supplements',file:'fixture/display.json',data:d}],identity);
 const final=projectEntries(compiled,manifest,opts);
 assert.equal(final.find(e=>e.id===target.entry_id).supplementHtml,compiled.find(e=>e.id===target.entry_id).supplementHtml);
 assert.ok(final.find(e=>e.id===target.entry_id).supplementHtml.includes('独立补充文本'));
});
test('production chunks and search use projected fields; bundled UI includes only projected source',async()=>{
 const catalog=await json('dist/data/catalog.json');const generated=[];
 for(const file of [...new Set(catalog.entries.map(e=>e._chunk))])generated.push(...(await json('dist/'+file)).entries);
 const waveSources=new Map(originalChapters);for(const d of await readAuthoring(root))waveSources.set(d.file,d.data);
 const merchantAuthored=compileAuthoring(base,appendWave1(appendMerchantSection(awaitableDocs,await json('content/late-wiki-merchant-section.json')),await json('content/extended-wave1-proposal.json')),identity);
 const reading=projectInterviewReading(projectEntries(correctAgentCore(correctLateWiki(correctWikiWave2(correctReferenceOriginalAnswers(correctReferenceFields(correctMainAnswers(correctAIAnswers(merchantAuthored,base,await json('content/ai-answer-corrections.json')),base,await json('content/main-answer-corrections.json')),base,await json('content/reference-field-corrections.json')),base,await json('content/original-qa-corrections.json')),waveSources,await json('content/wiki-wave2-corrections.json')),waveSources,await json('content/late-wiki-corrections.json')),waveSources,await json('content/agent-core-corrections.json')),manifest,opts),await json('content/interview-reading-policy.json'));
 const factualOnly=projectLearnerFactualCorrections(reading.entries,await json('content/learner-factual-corrections.json'));
 const repaired=projectHandwriteRepairs(projectVoiceEntries(factualOnly,base,await json('content/voice-factual-correction.json')),await json('content/handwrite-repairs.json'));
 const claimEntries=projectClaimExamples(projectLearnerReadingCleanup(repaired,await json('content/learner-reading-cleanup.json')),await json('content/project-claims-correction.json'));
 const reviewed=projectReviewedContent(projectInterviewEditorial(claimEntries,await json('content/interview-editorial-projection.json')),await json('content/reviewed-content-projection.json'));
 const factual=expectedNoteDisplay(projectAlgorithmCorrections(reviewed,await json('content/algorithm-corrections.json')));
 const byId=new Map(generated.map(e=>[e.id,e]));assert.deepEqual(catalog.entries.map(e=>byId.get(e.id)),factual);
 assert.deepEqual(await json('dist/data/search.json'),buildSearchRecords(factual,metadata.TOPICS));
 const app=await readFile(path.join(root,'dist/assets/app.js'),'utf8');
 const priority=await json('content/interview-priority-view.json');
 for(const f of manifest.ui){
  const priorRuntime=projectCapacityPitfallsRuntime(f.file,projectExactIntroRuntime(f.file,projectNoteDisplayRuntime(f.file,projectLearnerReadingRuntime(f.file,projectInterviewRuntime(f.file,f.new_full_field)))));
  const expectedRuntime=projectPriorityViewRuntime(f.file,priorRuntime,priority);
  assert.ok(app.includes(expectedRuntime));
  assert.ok(!app.includes(f.old_full_field));
 }
});

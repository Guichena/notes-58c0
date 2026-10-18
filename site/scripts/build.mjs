import {extendFinalAuditReadingPolicy} from './final-audit-reading.mjs';
import {validateFinalAuditMetadata} from './final-audit-metadata.mjs';
import {projectFinalAuditOrderRuntime} from './final-audit-order.mjs';
import {projectFinalAuditCorrections} from './final-audit-corrections.mjs';
import {projectQuestionBankRuntime} from './question-bank-merge.mjs';
import {projectAuditMetadata,readReviewedComparisonCorrections,projectReviewedComparisonMetadata} from './audit-metadata-correction.mjs';
import {readComparisonEquivalence,projectComparisonVisibilityRuntime} from './comparison-visibility.mjs';
import {readPracticeBoundaryCorrections,projectPracticeBoundaryCorrections,projectPracticeBoundaryRuntime} from './practice-boundary-corrections.mjs';
import {readQuestionBankMerge,projectQuestionBankMerge,prepareQuestionBankAuthoring} from './question-bank-merge.mjs';
import {projectPriorityViewRuntime,validatePriorityView} from './interview-priority-view.mjs';
import {readInterviewConsolidation,projectInterviewConsolidation} from './interview-consolidation.mjs';
import {readInterviewVoiceReview,projectInterviewVoiceReview} from './interview-voice-review.mjs';
import {projectCapacityPitfallsRuntime} from './capacity-pitfalls-runtime.mjs';
import {addReadingPresentationLifecycle} from './reading-presentation-runtime.mjs';
import {projectExactIntroRuntime} from './exact-intro-runtime.mjs';
import {projectNoteDisplay,projectNoteDisplayRuntime} from './note-display-cleanup.mjs';
import {projectAlgorithmCorrections} from './algorithm-corrections.mjs';
import {projectReviewedContent} from './reviewed-content-projection.mjs';
import {projectInterviewEditorial} from './interview-editorial-projection.mjs';
import {projectClaimExamples} from './project-claims-correction.mjs';
import {projectLearningOrderRuntime} from './interview-learning-order.mjs';
import {projectLearnerReadingCleanup} from './learner-reading-cleanup.mjs';
import {projectLearnerReadingRuntime} from './learner-reading-runtime.mjs';
import {projectHandwriteRepairs} from './handwrite-repairs.mjs';
import {projectVoiceEntries,projectVoiceMetadata} from './voice-factual-correction.mjs';
import {projectLearnerFactualCorrections} from './learner-factual-corrections.mjs';
import {appendWave1} from './extended-wave1-proposal.mjs';
import {correctLateWiki,projectLateWikiMetadata,appendMerchantSection} from './late-wiki-corrections.mjs';
import {correctAgentCore} from './agent-core-corrections.mjs';
import { readFile, writeFile, mkdir, readdir, rm, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
import { buildSearchRecords } from './build-search.mjs';
import { compileAuthoring, readAuthoring, prepareMergedQuestionAuthoring } from './authoring.mjs';
import {correctReferenceOriginalAnswers} from './original-qa-corrections.mjs';
import {correctReferenceFields} from './reference-field-corrections.mjs';
import {correctMainAnswers} from './main-answer-corrections.mjs';
import {correctWikiWave2} from './wiki-wave2-corrections.mjs';
import {projectReferenceMetadata} from './metadata-card-corrections.mjs';
import {correctAIAnswers} from './ai-answer-corrections.mjs';
import { projectEntries, projectSource } from './display-projection.mjs';
import { projectInterviewReading, projectInterviewRuntime } from './interview-reading.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const src = (...parts) => path.join(root, ...parts);
const baselineTest = process.argv.includes('--baseline-test');
const out = src(baselineTest ? '.compat-dist' : 'dist');
const readJSON = async p => JSON.parse(await readFile(p, 'utf8'));
const write = async (name, text) => { const target = path.join(out, name); await mkdir(path.dirname(target), {recursive:true}); await writeFile(target, text); };
const json = value => JSON.stringify(value) + '\n';
const sha = value => createHash('sha256').update(value).digest('hex');
const displayProjection = baselineTest ? null : await readJSON(src('content/display-projection.json'));
const learningOrder = baselineTest ? null : await readJSON(src('content/interview-learning-order.json'));
const priorityView = baselineTest ? null : await readJSON(src('content/interview-priority-view.json'));
const comparisonEquivalence = baselineTest ? null : await readComparisonEquivalence();
const appFiles = ['catalog', 'storage', 'structure', 'fragments', 'renderers', 'highlight-map', 'dashboard', 'navigation', 'routing', 'questions', 'search', 'events'];
const visualFiles = ['legacy-viz', 'diagram-engine', 'architecture-specs', 'algorithm-traces'];
const bundle = async (dir, files) => {
  const sourceBlocks = await Promise.all(files.map(async name => `\n/* Source: src/${dir}/${name}.js */\n` + projectFinalAuditOrderRuntime(`src/${dir}/${name}.js`, projectLearningOrderRuntime(`src/${dir}/${name}.js`, projectLearnerReadingRuntime(`src/${dir}/${name}.js`, projectInterviewRuntime(`src/${dir}/${name}.js`, projectSource(`src/${dir}/${name}.js`, await readFile(src('src',dir,name+'.js'),'utf8'), displayProjection, {baselineTest}), {baselineTest}), {baselineTest}), learningOrder, {baselineTest}), learningOrder, {baselineTest})));
  const projectedBlocks = sourceBlocks.map((text,i) => projectCapacityPitfallsRuntime('src/'+dir+'/'+files[i]+'.js',projectExactIntroRuntime('src/'+dir+'/'+files[i]+'.js',projectNoteDisplayRuntime('src/'+dir+'/'+files[i]+'.js',text,{baselineTest}),{baselineTest}),{baselineTest}));
  const priorityBlocks = projectedBlocks.map((text,i)=>projectPriorityViewRuntime('src/'+dir+'/'+files[i]+'.js',text,priorityView,{baselineTest}));
  const questionBankBlocks = priorityBlocks.map((text,i)=>projectQuestionBankRuntime('src/'+dir+'/'+files[i]+'.js',text,{baselineTest}));
  const practiceBlocks = questionBankBlocks.map((text,i)=>projectPracticeBoundaryRuntime('src/'+dir+'/'+files[i]+'.js',text,{baselineTest}));
  const comparisonBlocks = practiceBlocks.map((text,i)=>projectComparisonVisibilityRuntime('src/'+dir+'/'+files[i]+'.js',text,comparisonEquivalence,{baselineTest}));
  const blocks = addReadingPresentationLifecycle(dir, files, comparisonBlocks, {baselineTest});
  // Original app and visual engine share classic global bindings. Keep this
  // compatibility boundary explicit; modern loading/caching lives in ES modules.
  const text = '/* Generated deterministically. Edit src/, never dist/. */\nvoid 0;\n' + blocks.join('\n;\n');
  new Script(text, {filename:dir+'.js'});
  return text;
};
const priorMetadata = projectLateWikiMetadata(projectReferenceMetadata(await readJSON(src('content/metadata.json')), baselineTest ? null : await readJSON(src('content/metadata-card-corrections.json')), {baselineTest}), baselineTest ? null : await readJSON(src('content/late-wiki-metadata-corrections.json')), {baselineTest});
const voiceRegistry=baselineTest ? null : await readJSON(src('content/voice-factual-correction.json'));
const metadata=projectAuditMetadata(projectVoiceMetadata(priorMetadata,voiceRegistry,{baselineTest}),{baselineTest});
const entriesById = new Map(), chapters = [];
for (const file of (await readdir(src('content/chapters'))).filter(x=>x.endsWith('.json')).sort()) {
  const chunk = await readJSON(src('content/chapters',file));
  for (const e of chunk.entries) { if(entriesById.has(e.id)) throw new Error('Duplicate entry: '+e.id); entriesById.set(e.id,{entry:e, chunk:'data/chapters/'+file}); }
  chapters.push({file,chunk});
}
const { entryOrder } = metadata;
if (entryOrder.length !== entriesById.size || new Set(entryOrder).size !== entryOrder.length) throw new Error('Entry order does not match content');
const originalEntries = entryOrder.map(id=>{ const hit=entriesById.get(id); if(!hit) throw new Error('Missing entry: '+id); return hit.entry; });
const identity = await readJSON(src('content/legacy-identities.json'));
const authoringDocuments = baselineTest ? [] : await readAuthoring(root);
const questionBankRegistry=baselineTest ? null : await readQuestionBankMerge();
const mergedQuestionAuthoring=prepareMergedQuestionAuthoring(authoringDocuments,questionBankRegistry,{baselineTest});
let authoredEntries = compileAuthoring(originalEntries, appendWave1(appendMerchantSection(mergedQuestionAuthoring.documents, baselineTest ? null : await readJSON(src('content/late-wiki-merchant-section.json')), {baselineTest}), baselineTest ? null : await readJSON(src('content/extended-wave1-proposal.json')), {baselineTest}), identity);
let correctedEntries = correctAIAnswers(authoredEntries, originalEntries, baselineTest ? null : await readJSON(src('content/ai-answer-corrections.json')), {baselineTest});
authoredEntries=null; // Release consumed build intermediates; guards above ran unchanged.
let mainCorrectedEntries = correctMainAnswers(correctedEntries, originalEntries, baselineTest ? null : await readJSON(src('content/main-answer-corrections.json')), {baselineTest});
correctedEntries=null; // Release consumed build intermediates; guards above ran unchanged.
let referenceCorrectedEntries = correctReferenceFields(mainCorrectedEntries, originalEntries, baselineTest ? null : await readJSON(src('content/reference-field-corrections.json')), {baselineTest});
mainCorrectedEntries=null; // Release consumed build intermediates; guards above ran unchanged.
let referenceQACorrectedEntries = correctReferenceOriginalAnswers(referenceCorrectedEntries, originalEntries, baselineTest ? null : await readJSON(src('content/original-qa-corrections.json')), {baselineTest});
referenceCorrectedEntries=null; // Release consumed build intermediates; guards above ran unchanged.
const wave2Sources = new Map(chapters.map(({file,chunk})=>['content/chapters/'+file,chunk]));
for(const document of authoringDocuments) wave2Sources.set(document.file, document.data);
let wave2CorrectedEntries = correctWikiWave2(referenceQACorrectedEntries, wave2Sources, baselineTest ? null : await readJSON(src('content/wiki-wave2-corrections.json')), {baselineTest});
referenceQACorrectedEntries=null; // Release consumed build intermediates; guards above ran unchanged.
let lateCorrectedEntries = correctLateWiki(wave2CorrectedEntries, wave2Sources, baselineTest ? null : await readJSON(src('content/late-wiki-corrections.json')), {baselineTest});
wave2CorrectedEntries=null; // Release consumed build intermediates; guards above ran unchanged.
let coreCorrectedEntries = correctAgentCore(lateCorrectedEntries, wave2Sources, baselineTest ? null : await readJSON(src('content/agent-core-corrections.json')), {baselineTest});
lateCorrectedEntries=null; // Release consumed build intermediates; guards above ran unchanged.
let displayEntries = projectEntries(coreCorrectedEntries, displayProjection, {baselineTest, originalChapters: new Map(chapters.map(({file,chunk})=>['content/chapters/'+file,chunk]))});
coreCorrectedEntries=null; // Release consumed build intermediates; guards above ran unchanged.
const finalReadingPolicy = extendFinalAuditReadingPolicy(baselineTest ? null : await readJSON(src('content/interview-reading-policy.json')), baselineTest ? null : await readJSON(src('content/final-audit-code-companions.json')), {baselineTest});
const reading = projectInterviewReading(displayEntries, finalReadingPolicy, {baselineTest});
displayEntries=null; // Release consumed build intermediates; guards above ran unchanged.
let factualEntries = projectLearnerFactualCorrections(reading.entries, baselineTest ? null : await readJSON(src('content/learner-factual-corrections.json')), {baselineTest});
reading.entries=null; // Release consumed build intermediates; guards above ran unchanged.
let voiceEntries=projectVoiceEntries(factualEntries,originalEntries,voiceRegistry,{baselineTest});
factualEntries=null; // Release consumed build intermediates; guards above ran unchanged.
let repairedEntries=projectHandwriteRepairs(voiceEntries,baselineTest ? null : await readJSON(src('content/handwrite-repairs.json')),{baselineTest});
voiceEntries=null; // Release consumed build intermediates; guards above ran unchanged.
let cleanedEntries=projectLearnerReadingCleanup(repairedEntries,baselineTest ? null : await readJSON(src('content/learner-reading-cleanup.json')),{baselineTest});
repairedEntries=null; // Release consumed build intermediates; guards above ran unchanged.
let claimEntries=projectClaimExamples(cleanedEntries,baselineTest ? null : await readJSON(src('content/project-claims-correction.json')),{baselineTest});
cleanedEntries=null; // Release consumed build intermediates; guards above ran unchanged.
let editorialEntries=projectInterviewEditorial(claimEntries,baselineTest ? null : await readJSON(src('content/interview-editorial-projection.json')),{baselineTest});
claimEntries=null; // Release consumed build intermediates; guards above ran unchanged.
let reviewedEntries=projectReviewedContent(editorialEntries,baselineTest ? null : await readJSON(src('content/reviewed-content-projection.json')),{baselineTest});
editorialEntries=null; // Release consumed build intermediates; guards above ran unchanged.
let algorithmEntries=projectAlgorithmCorrections(reviewedEntries,baselineTest ? null : await readJSON(src('content/algorithm-corrections.json')),{baselineTest});
reviewedEntries=null; // Release consumed build intermediates; guards above ran unchanged.
let noteDisplayEntries=projectNoteDisplay(algorithmEntries,{baselineTest});
algorithmEntries=null; // Release consumed build intermediates; guards above ran unchanged.
let questionBankAuthoring=prepareQuestionBankAuthoring(noteDisplayEntries,questionBankRegistry,{baselineTest});
noteDisplayEntries=null; // Release consumed build intermediates; guards above ran unchanged.
let interviewVoiceEntries=projectInterviewVoiceReview(questionBankAuthoring.entries,baselineTest ? null : await readInterviewVoiceReview(root),{baselineTest});
let consolidatedEntries=projectInterviewConsolidation(interviewVoiceEntries,baselineTest ? null : await readInterviewConsolidation(),{baselineTest});
interviewVoiceEntries=null; // Release consumed build intermediates; guards above ran unchanged.
let questionBankEntries=projectNoteDisplay(mergedQuestionAuthoring.compile(questionBankAuthoring.restore(projectQuestionBankMerge(consolidatedEntries,questionBankRegistry,{baselineTest}))),{baselineTest});
consolidatedEntries=null; questionBankAuthoring=null; // Release consumed build intermediates; guards above ran unchanged.
const practiceEntries=projectPracticeBoundaryCorrections(questionBankEntries,baselineTest ? null : await readPracticeBoundaryCorrections(),{baselineTest});
questionBankEntries=null; // Release consumed build intermediates; guards above ran unchanged.
const entries=projectFinalAuditCorrections(practiceEntries,baselineTest ? null : await readJSON(src('content/final-audit-corrections.json')),{baselineTest});
const reviewedMetadata=projectReviewedComparisonMetadata(metadata,practiceEntries,baselineTest ? null : await readReviewedComparisonCorrections(),{baselineTest});
const {entryOrder: reviewedEntryOrder,...meta}=validateFinalAuditMetadata(reviewedMetadata,practiceEntries,entries,baselineTest ? null : await readJSON(src('content/final-audit-comparison-review.json')),{baselineTest});
if (!baselineTest) validatePriorityView(entries,priorityView);
// The CLI validator uses the same complete, guarded content pipeline without
// touching dist. Asset bundling/publication is intentionally not requested.
if(process.argv.includes('--validate-only')) {
 if(baselineTest)throw new Error('validate-only requires the complete current pipeline');
 console.log(JSON.stringify({mode:'validate-only',entries:entries.length,reviewUnits:entries.reduce((n,e)=>n+(e.kind==='qa'?e.items.length:1),0),qaQuestions:entries.filter(e=>e.kind==='qa').reduce((n,e)=>n+e.items.length,0),authoringFiles:authoringDocuments.length,deferredQuestionFiles:authoringDocuments.filter(doc=>!mergedQuestionAuthoring.documents.includes(doc)).map(doc=>doc.file)}));
 process.exit(0);
}
// Preserve existing chunk URLs; new categories receive deterministic group IDs.
const groupPaths = new Map(originalEntries.map(e=>[JSON.stringify([e.mod,e.part,e.cat]), entriesById.get(e.id).chunk]));
const compiledChunks = new Map();
for(const entry of entries) {
 const group=JSON.stringify([entry.mod,entry.part,entry.cat]);
 const chunk=groupPaths.get(group)||'data/chapters/'+entry.mod+'-'+sha(group).slice(0,12)+'.json';
 groupPaths.set(group,chunk);
 entriesById.set(entry.id,{entry,chunk});
 if(!compiledChunks.has(chunk))compiledChunks.set(chunk,{entries:[]});
 compiledChunks.get(chunk).entries.push(entry);
}
const fields = ['id','kind','mod','part','cat','title','number','progressKey'];
const catalog = {...meta, ...(baselineTest ? {} : {archivedRoutes:reading.archivedRoutes}), entries: entries.map(e => {
  const record = Object.fromEntries(fields.filter(k=>Object.hasOwn(e,k)).map(k=>[k,e[k]]));
  if(e.items) record.items=e.items.map(it=>({mk:it.mk,...(it.id?{id:it.id}:{})}));
  record._chunk=entriesById.get(e.id).chunk;
  return record;
})};
await rm(out,{recursive:true,force:true}); await mkdir(out,{recursive:true});
await cp(src('public'),out,{recursive:true});
await cp(src('src/runtime'),path.join(out,'assets/runtime'),{recursive:true});
await cp(src('src/styles'),path.join(out,'assets/styles'),{recursive:true});
// Keep preserved source CSS and the parity build unchanged; append reviewed UI fixes.
if (!baselineTest) await write('assets/styles/main.css',
  await readFile(src('src/styles/main.css'), 'utf8') + '\n' +
  await readFile(src('src/style-overrides/prose-wrap.css'), 'utf8'));
// Additive presentation layer. The parity target receives an empty stylesheet.
await write('assets/styles/reading-layout.css', baselineTest ? '' :
  await readFile(src('src/style-overrides/reading-layout.css'), 'utf8'));
await write('index.html',await readFile(src('src/index.html')));
await write('assets/app.js',await bundle('app',appFiles));
await write('assets/visuals.js',await bundle('visuals',visualFiles));
await write('data/catalog.json',json(catalog));
if(!baselineTest) {
 await write('data/archives/source-entries.json',json(reading.sourceArchive));
 await write('reading-report.json',json(reading.report));
}
await write('data/search.json',json(buildSearchRecords(entries,meta.TOPICS)));
for(const [file,chunk] of compiledChunks) await write(file,json(chunk));
const files=[];
async function walk(dir) { for(const name of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))){ const p=path.join(dir,name.name); if(name.isDirectory()) await walk(p); else {const b=await readFile(p); files.push({path:path.relative(out,p).split(path.sep).join('/'),bytes:b.length,sha256:sha(b)});}} }
await walk(out);
const report={sourceCommit:'a1b8e212f32e23c7a29c1a695bb1255d93ee18a4',entries:entries.length,reviewUnits:entries.reduce((n,e)=>n+(e.kind==='qa'?e.items.length:1),0),chapters:compiledChunks.size,files};
await write('build-manifest.json',json(report));
console.log(`Built ${entries.length} entries, ${report.reviewUnits} review units, ${compiledChunks.size} lazy chapters.`);
for(const name of ['index.html','data/catalog.json','data/search.json','assets/app.js','assets/visuals.js']) console.log(name,files.find(f=>f.path===name).bytes+' bytes');

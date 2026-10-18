import {correctReferenceFields} from './reference-field-corrections.mjs';
import {correctReferenceOriginalAnswers} from './original-qa-corrections.mjs';
// Read-only preview of policy drift. Never updates content, registry or hash locks.
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {compileAuthoring,readAuthoring,prepareMergedQuestionAuthoring} from './authoring.mjs';
import {correctMainAnswers} from './main-answer-corrections.mjs';
import {correctAIAnswers} from './ai-answer-corrections.mjs';
import {projectInterviewReading} from './interview-reading.mjs';
import {projectEntries} from './display-projection.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const json=async p=>JSON.parse(await readFile(path.join(root,p),'utf8'));
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const authoringDocuments=await readAuthoring(root);
const preparedAuthoring=prepareMergedQuestionAuthoring(authoringDocuments,await json('content/question-bank-merge.json'));
const deferredQuestionFiles=authoringDocuments.filter(doc=>!preparedAuthoring.documents.includes(doc)).map(doc=>doc.file);
let deferredValidation={status:'not-applicable',files:[]};
if(deferredQuestionFiles.length) {
 const validationScript=path.join(root,'scripts/build.mjs');
   let validationSource;try{validationSource=await readFile(validationScript,'utf8');}catch(error){throw new Error('Selected root lacks scripts/build.mjs for complete merge-target validation: '+root+'; '+error.message);}
   if(!validationSource.includes("if(process.argv.includes('--validate-only'))"))throw new Error('Selected root build lacks validate-only support: '+root);
   const checked=JSON.parse(execFileSync(process.execPath,[validationScript,'--validate-only'],{encoding:'utf8'}));
 if(checked.mode!=='validate-only'||JSON.stringify(checked.deferredQuestionFiles)!==JSON.stringify(deferredQuestionFiles))throw new Error('complete deferred-question validation mismatch');
 deferredValidation={status:'passed',mode:'complete-final-compile',files:deferredQuestionFiles,entries:checked.entries,reviewUnits:checked.reviewUnits};
}
// The drift oracle below deliberately retains its original pre-reading stage.
// Deferred questions were validated separately, never substituted into policy hashes.
const chapters=new Map(await Promise.all((await readdir(path.join(root,'content/chapters'))).filter(x=>x.endsWith('.json')).sort().map(async f=>['content/chapters/'+f,await json('content/chapters/'+f)])));
const originals=new Map([...chapters.values()].flatMap(x=>x.entries).map(e=>[e.id,e]));
const metadata=await json('content/metadata.json'),identity=await json('content/legacy-identities.json');
const compiled=compileAuthoring(metadata.entryOrder.map(id=>originals.get(id)),preparedAuthoring.documents,identity);
const entries=projectEntries(correctReferenceOriginalAnswers(correctReferenceFields(correctMainAnswers(correctAIAnswers(compiled,metadata.entryOrder.map(id=>originals.get(id)),await json('content/ai-answer-corrections.json')),metadata.entryOrder.map(id=>originals.get(id)),await json('content/main-answer-corrections.json')),metadata.entryOrder.map(id=>originals.get(id)),await json('content/reference-field-corrections.json')),metadata.entryOrder.map(id=>originals.get(id)),await json('content/original-qa-corrections.json')),await json('content/display-projection.json'),{originalChapters:chapters});
const byId=new Map(entries.map(e=>[e.id,e])),policy=await json('content/interview-reading-policy.json');
const drift=[];
for(const f of policy.fields){let current=byId.get(f.entryId);for(const p of f.path)current=current?.[p];if(current===undefined||sha(current)!==f.sha256)drift.push({entryId:f.entryId,path:f.path,expectedSha256:f.sha256,currentSha256:current===undefined?null:sha(current),previousBefore:f.before,previousAfter:f.after,currentBefore:current??null});}
for(const t of policy.knowledgeTransfers||[]){const source=byId.get(t.sourceId);let sourceHtml=source;for(const key of t.sourcePath||['html'])sourceHtml=sourceHtml?.[key];if(!source||typeof sourceHtml!=='string'||sha(sourceHtml)!==t.sourceHtmlSha256)drift.push({sourceId:t.sourceId,kind:'transfer-source',expectedSha256:t.sourceHtmlSha256,currentSha256:typeof sourceHtml==='string'?sha(sourceHtml):null});}
for(const rule of policy.knowledgeRestorations||[]){let field=byId.get(rule.sourceId);for(const key of rule.sourcePath||[])field=field?.[key];if(typeof field!=='string'||sha(field)!==rule.sourceFieldSha256)drift.push({sourceId:rule.sourceId,kind:'knowledge-restoration-source',id:rule.id,expectedSha256:rule.sourceFieldSha256,currentSha256:typeof field==='string'?sha(field):null});}
const targets=new Set(policy.fields.map(f=>f.entryId+'/'+JSON.stringify(f.path))),archived=new Set(policy.archivedEntries.map(e=>e.id));
const newListings=[];
function scan(e,value,p=[]){if(typeof value==='string'){if(/<pre\b|class="[^"]*\bcode-card\b/.test(value)&&!targets.has(e.id+'/'+JSON.stringify(p)))newListings.push({entryId:e.id,path:p,sha256:sha(value)});}else if(value&&typeof value==='object')for(const [k,v]of Object.entries(value))scan(e,v,[...p,Array.isArray(value)?Number(k):k]);}
for(const e of entries.filter(e=>policy.theoryModules.includes(e.mod)&&!archived.has(e.id)))scan(e,e);
const companionCandidates=entries.filter(e=>!archived.has(e.id)&&e.kind==='doc'&&e.id.startsWith('own-')&&/<pre\b/.test(e.html||'')).map(e=>({id:e.id,mod:e.mod,title:e.title}));
let policyValidationError=null;try{projectInterviewReading(entries,policy);}catch(error){policyValidationError=error.message;}
const report={entries:entries.length,drift,newListings,companionCandidates,policyValidationError,policyChanged:false,deferredValidation};
await mkdir(path.join(root,'reports'),{recursive:true});await writeFile(path.join(root,'reports/reading-policy-preview.json'),JSON.stringify(report,null,2)+'\n');
console.log(`${drift.length} hash drifts; ${newListings.length} unprojected theory fields; ${companionCandidates.length} companion candidates. Review reports/reading-policy-preview.json; no policy/source changes made. Policy validation: ${policyValidationError||'passed'}.`);

if(deferredQuestionFiles.length)console.log(`Deferred merged questions: ${deferredQuestionFiles.length}; complete compile validation passed separately; policy drift inputs retain their original stage.`);

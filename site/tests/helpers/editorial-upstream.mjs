import {projectInterviewEditorial} from '../../scripts/interview-editorial-projection.mjs';
import {projectClaimExamples} from '../../scripts/project-claims-correction.mjs';
import {projectLearnerReadingCleanup} from '../../scripts/learner-reading-cleanup.mjs';
import {projectLearnerReadingRuntime} from '../../scripts/learner-reading-runtime.mjs';
import {projectHandwriteRepairs} from '../../scripts/handwrite-repairs.mjs';
import {projectVoiceEntries} from '../../scripts/voice-factual-correction.mjs';
import {projectLearnerFactualCorrections} from '../../scripts/learner-factual-corrections.mjs';
import {appendWave1} from '../../scripts/extended-wave1-proposal.mjs';
import {correctLateWiki,appendMerchantSection} from '../../scripts/late-wiki-corrections.mjs';
import {correctAgentCore} from '../../scripts/agent-core-corrections.mjs';
import {correctWikiWave2} from '../../scripts/wiki-wave2-corrections.mjs';
import {correctReferenceFields} from '../../scripts/reference-field-corrections.mjs';
import {correctReferenceOriginalAnswers} from '../../scripts/original-qa-corrections.mjs';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {correctMainAnswers} from '../../scripts/main-answer-corrections.mjs';
import {correctAIAnswers} from '../../scripts/ai-answer-corrections.mjs';
import {projectEntries,projectSource} from '../../scripts/display-projection.mjs';
import {compileAuthoring,readAuthoring,originalContentHash,extensionTarget} from '../../scripts/authoring.mjs';
import {projectInterviewReading,projectInterviewRuntime} from '../../scripts/interview-reading.mjs';
import {buildSearchRecords} from '../../scripts/build-search.mjs';async function buildUpstream(){
const root=fileURLToPath(new URL('../../',import.meta.url));
const json=async p=>JSON.parse(await readFile(path.join(root,p),'utf8'));
const manifest=await json('content/display-projection.json'), metadata=await json('content/metadata.json'), identity=await json('content/legacy-identities.json');
const originalChapters=new Map(await Promise.all((await readdir(path.join(root,'content/chapters'))).filter(f=>f.endsWith('.json')).map(async f=>['content/chapters/'+f,await json('content/chapters/'+f)])));
const originals=new Map([...originalChapters.values()].flatMap(c=>c.entries).map(e=>[e.id,e]));
const base=metadata.entryOrder.map(id=>originals.get(id));
const awaitableDocs=await readAuthoring(root);
const opts={originalChapters};
 const waveSources=new Map(originalChapters);for(const d of awaitableDocs)waveSources.set(d.file,d.data);
 const merchantAuthored=compileAuthoring(base,appendWave1(appendMerchantSection(awaitableDocs,await json('content/late-wiki-merchant-section.json')),await json('content/extended-wave1-proposal.json')),identity);
 const reading=projectInterviewReading(projectEntries(correctAgentCore(correctLateWiki(correctWikiWave2(correctReferenceOriginalAnswers(correctReferenceFields(correctMainAnswers(correctAIAnswers(merchantAuthored,base,await json('content/ai-answer-corrections.json')),base,await json('content/main-answer-corrections.json')),base,await json('content/reference-field-corrections.json')),base,await json('content/original-qa-corrections.json')),waveSources,await json('content/wiki-wave2-corrections.json')),waveSources,await json('content/late-wiki-corrections.json')),waveSources,await json('content/agent-core-corrections.json')),manifest,opts),await json('content/interview-reading-policy.json'));
 const factualOnly=projectLearnerFactualCorrections(reading.entries,await json('content/learner-factual-corrections.json'));
 const repaired=projectHandwriteRepairs(projectVoiceEntries(factualOnly,base,await json('content/voice-factual-correction.json')),await json('content/handwrite-repairs.json'));
 const claimEntries=projectClaimExamples(projectLearnerReadingCleanup(repaired,await json('content/learner-reading-cleanup.json')),await json('content/project-claims-correction.json'));

return {claimEntries,reading,metadata,base,identity};
}
// Keep only the exported oracle graphs; construction intermediates can be collected.
export const upstream=await buildUpstream();

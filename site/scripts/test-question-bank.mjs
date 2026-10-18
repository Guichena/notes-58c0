// Verify the current imported corpus, then run the unchanged prior acceptance
// suite on a byte-pinned reconstruction of the preceding release's sources.
import {execFileSync} from 'node:child_process';
import {cp,mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const run=(args,cwd=root)=>execFileSync(process.execPath,args,{cwd,stdio:'inherit'});
const sha=x=>createHash('sha256').update(x).digest('hex');
const originals=[['fragments.js','src/app/fragments.js','d63df7e512c75413e3e8a40c37437ff07b95e7303f4af29a061ab32009d31eb7'],['build.mjs','scripts/build.mjs','dd8ef967e7cd2547846dbb6ec950b4a71e41c4c44090d20e48ea417e987572f6'],['package.json','package.json','174d2938bf3caee391aa97970e032f386a446123c49697ace397e7cab135e08e']];
const additions=['scripts/question-bank-merge.mjs','scripts/test-question-bank.mjs','content/question-bank-merge.json','tests/question-bank-merge.test.mjs','tests/question-bank-merge-corpus.test.mjs','tests/fixtures/question-bank-baseline',
 'scripts/comparison-visibility.mjs','content/comparison-equivalence.json','tests/comparison-visibility.test.mjs','tests/seo-boundary.test.mjs','content/comparison-card-factual-corrections.json','tests/comparison-factual-corrections.test.mjs','tests/interview-presentation-residue.test.mjs','tests/responsive-content-images.test.mjs',
 'scripts/practice-boundary-corrections.mjs','content/practice-boundary-corrections.json','tests/practice-boundary-corrections.test.mjs','tests/reviewed-increments.test.mjs','tests/post-review-dedup.test.mjs','tests/huang-concept-batch.test.mjs','tests/helpers/reviewed-audit-authoring.mjs','authoring/entries/aa-own-practice-es-write-visibility.json','scripts/audit-metadata-correction.mjs','tests/audit-metadata-correction.test.mjs',
 'authoring/questions/ai-agent-6--q-agent-extension-lifecycle.json','authoring/questions/ai-agent-9--q-no-gold-relational-evaluation.json','authoring/questions/ai-模型与评测-7--q-multimodal-admission-budget.json'];
let isolated;
try {
 run(['scripts/build.mjs']);
 run(['scripts/check-build.mjs']);
 // Like the historical suite, bound concurrent registry-heavy workers while
 // retaining every test and assertion in the current layer.
 run(['--test','--test-concurrency=1','tests/question-bank-merge.test.mjs','tests/question-bank-merge-corpus.test.mjs','tests/practice-boundary-corrections.test.mjs','tests/reviewed-increments.test.mjs','tests/post-review-dedup.test.mjs','tests/huang-concept-batch.test.mjs','tests/audit-metadata-correction.test.mjs','tests/comparison-visibility.test.mjs','tests/seo-boundary.test.mjs','tests/comparison-factual-corrections.test.mjs','tests/interview-presentation-residue.test.mjs','tests/responsive-content-images.test.mjs']);
 isolated=await mkdtemp(path.join(tmpdir(),'question-bank-prior-release-'));
 await cp(root,isolated,{recursive:true,filter:s=>!['dist','.compat-dist','.git','node_modules'].includes(path.basename(s))});
 for(const [name,target,hash] of originals){
  const bytes=await readFile(path.join(root,'tests/fixtures/question-bank-baseline',name));
  if(sha(bytes)!==hash)throw Error('Prior-release fixture changed: '+name);
  await writeFile(path.join(isolated,target),bytes);
 }
 for(const file of additions)await rm(path.join(isolated,file),{recursive:true,force:true});
 run(['scripts/test-interview-voice-review.mjs'],isolated);
 console.log('Current question-bank invariants and unchanged prior-release acceptance suite passed.');
} finally {if(isolated)await rm(isolated,{recursive:true,force:true});}

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Installed at site/tests/final-lora.test.mjs. The verifier always reads this
// site's actual dist. No candidate mode, cwd/env override, fallback or overlay.
const siteRoot=fileURLToPath(new URL('../',import.meta.url));
const finalDist=path.join(siteRoot,'dist');
const fixtures=path.join(siteRoot,'tests','fixtures','lora');
const verifier=path.join(fixtures,'verify-lora.mjs');
const expectedHashes={
 'verify-lora.mjs':'1b3042af26d0c80f518ae099ae4aa7cf48c842cf539df3cf659a27998334ecd1',
 'records.json':'887c95900abd2b444709d11d0574dd6639f43e6fa6dbd328b80d690ef0813bcd',
 'preservation-map.json':'49fd8fcd4abf63d7a40ff38c4394d91eb306e1c1cec85e57dfa76f408046aac5',
 'identity-baseline.json':'0286c2c1a423776e390f907c8c71c4a5df281f0b912c4307d802a2b791f98290',
 'technical-refs.json':'149ed3bee06e67faf85dd558ff04cf8ea6fe235a958e550dcdc82483ea453c06',
};
const oracleNames=[
 'exact-eight-leaf-guards-and-package-hashes',
 'preserve-identities-indexes-question-wording-and-other-fields',
 'complete-before-block-to-exact-destination-map',
 'html-balance-anchors-variants-and-existing-routes',
 'canonical-ownership-and-unique-conditions',
 'factor-shape-parameter-budget-and-forward-merge-fixtures',
 'analytic-gradients-finite-differences-and-zero-initialization',
 'pissa-residual-scaling-and-original-base-conversion',
 'rank-scaling-and-quantized-merge-counterexamples',
 'source-documentation-and-read-only-input-stability',
];
const shaFile=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');

test('actual final dist satisfies all ten pinned LoRA checks without overlays',async t=>{
 for(const [file,expected] of Object.entries(expectedHashes)){
  assert.equal(shaFile(path.join(fixtures,file)),expected,`${file} changed; explicitly review and repin the complete package`);
 }
 const result=spawnSync(process.execPath,[verifier,'--mode','final','--dist',finalDist],{
  cwd:siteRoot,encoding:'utf8',timeout:60_000,maxBuffer:4*1024*1024,
 });
 assert.ifError(result.error);
 assert.equal(result.signal,null,`Verifier terminated by ${result.signal}`);
 assert.equal(result.stderr,'',`Unexpected verifier stderr: ${result.stderr}`);
 let report;
 try{report=JSON.parse(result.stdout);}catch(error){
  assert.fail(`Verifier did not return JSON (exit ${result.status}): ${result.stdout}\n${error.message}`);
 }
 assert.equal(report.mode,'final');
 assert.equal(report.dist,finalDist);
 assert.equal(report.recordsSha256,expectedHashes['records.json']);
 assert.equal(report.verifierSha256,expectedHashes['verify-lora.mjs']);
 assert.deepEqual(report.checks.map(c=>c.name),oracleNames,'All ten original checks must run once in order, without omissions');
 for(const name of oracleNames){
  // Use the fixed oracle list, not a filtered passing-only list. No skip option.
  await t.test(name,()=>{
   const check=report.checks.find(c=>c.name===name);
   assert.ok(check,`Missing check: ${name}`);
   assert.equal(check.status,'passed',check.error||name);
   if(name==='exact-eight-leaf-guards-and-package-hashes'){
    assert.equal(check.stagedInMemory,0,'Final acceptance must never overlay candidate leaves');
    assert.equal(check.alreadyApplied,8,'All eight reviewed leaves must already exist in actual dist');
    assert.equal(check.siteWrites,0);
   }
   if(name==='preserve-identities-indexes-question-wording-and-other-fields'){
    assert.equal(check.entryItemCount,10);assert.equal(check.targetQuestions,4);
    assert.equal(check.changedTitles,0);assert.equal(check.unownedEdits,0);
   }
   if(name==='complete-before-block-to-exact-destination-map'){
    assert.equal(check.sourceBlocks,78);assert.equal(check.bodyBlocks,70);assert.equal(check.leadBlocks,8);
   }
   if(name==='html-balance-anchors-variants-and-existing-routes'){
    assert.equal(check.originalFoldedVariants,16);assert.equal(check.originalInlineFollowups,10);
    assert.equal(check.displayVariants,26);assert.equal(check.compoundVariantSplit,1);
   }
   if(name==='source-documentation-and-read-only-input-stability'){
    assert.equal(check.siteWrites,0);assert.equal(check.networkRequests,0);
   }
  });
 }
 assert.equal(report.passed,10);
 assert.equal(report.failed,0);
 assert.equal(result.status,0,'Final-mode verifier must exit successfully');
});

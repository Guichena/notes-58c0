import {ninthExecutablePath,ninthExecutionHash} from './fixtures/ninth-small-repairs/verify-reference.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),dist=path.join(root,'dist'),fixtures=path.join(root,'tests/fixtures/model-alignment');
const pins={
  "verify-model-alignment.mjs": "404f0674df72cb20576d4cf6e62241ce4bd1c52951fb670702af186b18974a98",
  "records.json": "d3f68823f2b4ca79cb2a80ec0a7428b94c74e14e4af475c81674afeb361d3e01",
  "append-manifest.json": "0ddfc0a6bc0fed543fe31497eff883ee3df34d0c24b7308f29bcd1db72802e27",
  "identity-baseline.json": "25a299dcf0ea496819a87ae1631c04e59668c3a63baea6283dceb3279e5e0cb4",
  "preservation-map.json": "c62732ec553fa1da87d8c8b64c9947f4f3e04552476a6847723e0bcfa578707e",
  "variant-map.json": "5624ad2a7bb358b3e068e1b4c17eb37a60048701118958222c9c4aa63fd70464",
  "source-row-map.json": "7da064722074c83b6e65257a3e81e01a61435040732a70bfc696c8254a7f9f16"
},names=[
  "twelve-exact-final-leaves-no-overlay",
  "three-exact-stable-appends",
  "thirty-old-identities-and-prefix-indexes",
  "all210-source-blocks-resolve-to-substantive-exact-destinations",
  "all25-variants-and32-inline-question-blocks-preserved",
  "all25-original-source-rows-have-compound-coverage",
  "html-aliases-and-all-internal-routes-resolve",
  "key-conditions-and-no-duplicate-major-mechanisms",
  "dpo-relative-probability-counterexample",
  "ppo-four-sign-branches-and-loss-sign",
  "bias-variance-conditions-and-finetuning-break-even"
];
test('actual final dist satisfies all model-alignment preservation and arithmetic contracts',async t=>{
 let report,error;
 try{for(const [name,hash]of Object.entries(pins))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(fixtures,name))).digest('hex'),hash,`fixture integrity: ${name}`);
 const run=spawnSync(process.execPath,[ninthExecutablePath(path.join(fixtures,'verify-model-alignment.mjs')),'--dist',dist],{cwd:root,encoding:'utf8',timeout:60000,maxBuffer:16*1024*1024});assert.ifError(run.error);assert.equal(run.signal,null);assert.equal(run.stderr,'');report=JSON.parse(run.stdout);assert.equal(report.mode,'final');assert.equal(report.dist,dist);assert.equal(report.recordsSha256,pins['records.json']);assert.equal(report.verifierSha256,ninthExecutionHash("tests/fixtures/model-alignment/verify-model-alignment.mjs",pins['verify-model-alignment.mjs']));assert.deepEqual(report.checks.map(x=>x.name),names);assert.equal(report.siteWrites,0);assert.equal(report.stagedInMemory,0);
 }catch(e){error=e;}
 for(const name of names)await t.test(name,()=>{assert.ifError(error);const check=report.checks.find(x=>x.name===name);assert.equal(check.status,'passed',check.error||name);if(name==='twelve-exact-final-leaves-no-overlay'){assert.equal(check.alreadyApplied,12);assert.equal(check.stagedInMemory,0);}if(name==='thirty-old-identities-and-prefix-indexes'){assert.equal(check.oldQuestions,30);assert.equal(check.mathOldObjects,6);assert.equal(check.mathFinalObjects,7);assert.equal(check.exactPrefixExtensions,1);assert.equal(check.metricsAppendIndex,6);}});
 assert.ifError(error);assert.equal(report.failed,0);assert.equal(report.passed,11);assert.equal(report.actualFinalDistAcceptance,true);
});

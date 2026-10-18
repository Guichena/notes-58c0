import {ninthExecutablePath,ninthExecutionHash} from './fixtures/ninth-small-repairs/verify-reference.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),dist=path.join(root,'dist'),fixtures=path.join(root,'tests/fixtures/agent-evaluation');
const pins={
  "verify-agent-evaluation.mjs": "49558c6bd50771f83ec5be235a7507932530dcc66422dab09293d6119dd6f159",
  "records.json": "240f0ad81bce8bd871f0445a7a240edd3a499a74b8f472d27ed2c37b141031ee",
  "append-manifest.json": "444646fd8b5095dca0e5882ecb60906927163dfc479f71fcd782bb5430998496",
  "identity-baseline.json": "e6bfde69ae6573760964c7f4802d49a05d4b36f148879801a80aeda17312a6d4",
  "preservation-map.json": "493a44533d6c368e9592ba743bfef2da939d8bbad90c47c2b9aa15611c4b4c41",
  "variant-map.json": "1aaf85037ec6b85dd9aead775719b5f749699436efcf097248dde57baeb04b70",
  "sections.json": "91b60714e385576be53cd55a819402545d4c98b3241ea89bc4d617db4e3c0986"
},names=[
  "two-exact-final-leaves",
  "six-stable-appends-at-15-through-20",
  "fifteen-old-identities-and-progress-unchanged",
  "fourteen-other-answers-including-protected-skill-unchanged",
  "all222-original-blocks-have-substantive-destinations",
  "all119-plus34-folded-wordings-retained-with-links",
  "unique-topic-details-live-in-their-substantive-answers",
  "main-answer-keeps-case-run-grader-isolation-and-sample-boundaries",
  "html-and-stable-routes-resolve-with-no-anchor-loss",
  "numeric-example-is-exact-and-repeated-runs-not-independent-cases"
];
test('actual final dist satisfies Agent evaluation consolidation',async t=>{
 let report,error;
 try {for(const [name,hash] of Object.entries(pins))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(fixtures,name))).digest('hex'),hash,`fixture integrity: ${name}`);
 const run=spawnSync(process.execPath,[ninthExecutablePath(path.join(fixtures,'verify-agent-evaluation.mjs')),'--dist',dist],{cwd:root,encoding:'utf8',timeout:60000,maxBuffer:16*1024*1024});assert.ifError(run.error);assert.equal(run.signal,null);assert.equal(run.stderr,'');report=JSON.parse(run.stdout);assert.equal(report.mode,'final');assert.equal(report.dist,dist);assert.equal(report.recordsSha256,pins['records.json']);assert.equal(report.verifierSha256,ninthExecutionHash("tests/fixtures/agent-evaluation/verify-agent-evaluation.mjs",pins['verify-agent-evaluation.mjs']));assert.equal(report.siteWrites,0);assert.equal(report.stagedInMemory,0);assert.deepEqual(report.checks.map(x=>x.name),names);
 } catch(e){error=e;}
 for(const name of names)await t.test(name,()=>{assert.ifError(error);const c=report.checks.find(x=>x.name===name);assert.equal(c.status,'passed',c.error||name);});
 assert.ifError(error);assert.equal(report.failed,0);assert.equal(report.passed,10);assert.equal(report.actualFinalDistAcceptance,true);
});

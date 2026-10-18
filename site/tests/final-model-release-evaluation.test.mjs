import {ninthExecutablePath,ninthExecutionHash} from './fixtures/ninth-small-repairs/verify-reference.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
// Only this installed test's actual dist. No cwd, environment override,
// fallback fixture, candidate overlay, or optional oracle skipping.
const siteRoot=fileURLToPath(new URL('../',import.meta.url));
const dist=path.join(siteRoot,'dist');
const fixtures=path.join(siteRoot,'tests/fixtures/model-release-evaluation');
const pinned={
  "records.json": "fae9b33628cb4ec85a0b75076488e935ab048d17546a209d9212bcf19e980b35",
  "append-manifest.json": "0949ad89c381cf4a90a3958dd70879e1dc2c07400ca116c8d1bfbc2a2ae8230a",
  "identity-baseline.json": "01b703c3c06cd51e67803a3bf88a52ff511b9e99b83aa5486b20f88ccfdd7b0b",
  "preservation-map.json": "668a65cf54adc66dab58ffe9a498a5ceb66b7ae8f24d5cf3478c8791054b0566",
  "variant-map.json": "105842e763a0dc640e3f8b1aea6ca8850224c25d8c79058d2af1afa55d44724a",
  "sections.json": "f3d4476a3564a32576b7914991471530bb26a90e7a0aa84dea83b8fba02ad507",
  "external-dependencies.json": "20098921b979fb478c4e91fe4079565523191b855ceacc14be967af027750302",
  "verify-final-dist.mjs": "707e77b07f4fd5cac0e870a0ad60090e4d6cce80f5cdc23486971d6ce308eb97"
};
const names=[
  "seven guarded leaves are actually applied",
  "one real-compiler append preserves complete old prefix",
  "old identities and all unowned fields are unchanged",
  "all 163 source blocks retain substantive destinations",
  "all 70 exact source wordings remain on original questions",
  "read-only canonical and explicit candidate dependencies exist",
  "Judge denominators and kappa calculation are correct",
  "unique release Prompt and video conditions are retained",
  "HTML anchors and internal routes are valid",
  "public prose does not claim unrun experiments or expose editing labels"
];
const shaFile=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
test('actual dist satisfies all ten model release/evaluation contracts',async t=>{
  let report,result,preflightError;
  try {
    for(const [n,sha] of Object.entries(pinned))assert.equal(shaFile(path.join(fixtures,n)),sha,'unreviewed fixture drift: '+n);
    result=spawnSync(process.execPath,[ninthExecutablePath(path.join(fixtures,'verify-final-dist.mjs')),'--dist',dist],{cwd:siteRoot,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});
    assert.ifError(result.error);assert.equal(result.signal,null);assert.equal(result.stderr,'');
    report=JSON.parse(result.stdout);
    assert.equal(report.mode,'actual-dist-only');assert.equal(report.dist,dist);
    assert.equal(report.overlay,false);assert.equal(report.siteWrites,0);
    assert.deepEqual(report.checks.map(x=>x.name),names,'all ten original oracles run once in order');
  }catch(e){preflightError=e;}
  // Register and execute every named oracle even if loading fixtures fails.
  for(const [i,name] of names.entries())await t.test(name,()=>{
    assert.ifError(preflightError);const c=report.checks[i];assert.equal(c.passed,true,c.error||name);
  });
  assert.ifError(preflightError);assert.equal(report.passed,true);assert.equal(result.status,0);
});

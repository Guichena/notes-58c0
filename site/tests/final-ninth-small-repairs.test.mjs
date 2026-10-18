import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {verifySources} from './fixtures/eleventh-algorithm-interruption/aggregate/verify-ninth-source-transitions.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const pins={
  "tests/fixtures/ninth-small-repairs/bridged/tests/fixtures/agent-answer-contracts/verify-phase3-migration.mjs": "6a40c15ac7db6ae2b7bc37c634925b60c93f2e14b75982186e2bfb3a9a042c5c",
  "tests/fixtures/ninth-small-repairs/bridged/tests/fixtures/agent-answer-contracts/verify-phase5-capacity-prefix.mjs": "a493661432b5d13e5a28948d098073ed5da6a784c31b16a0ffdc6e9920e63e7c",
  "tests/fixtures/ninth-small-repairs/bridged/tests/fixtures/agent-clarity/verify-final.mjs": "2f4462513a9fdc859995edce4183d951afe6eb39445fc7a376597db3f2653b74",
  "tests/fixtures/ninth-small-repairs/bridged/tests/fixtures/agent-dag-dispatch/verify-final.mjs": "8c167ea326b7ccc20b936ff1d2102f458698386c36cd1d9e87ef8450875b7062",
  "tests/fixtures/ninth-small-repairs/bridged/tests/fixtures/agent-evaluation/verify-agent-evaluation.mjs": "5685e83dccc226524b86e5c0d4e4fc1c4ecb7a13c7b47465ca4933f924dc4124",
  "tests/fixtures/ninth-small-repairs/bridged/tests/fixtures/agent-foundations/verify-final-dist.mjs": "e50511453b0ed0e3e8af312476398c1cb7e80c88fdc98de6dfb7ae4d25e8388d",
  "tests/fixtures/ninth-small-repairs/bridged/tests/fixtures/agent-frameworks/verify-final-dist.mjs": "5b7205a6bdb4dcf1c5d72324b430ff4987914c276ab7ea75bf95b57ebc8b6fe6",
  "tests/fixtures/ninth-small-repairs/bridged/tests/fixtures/agent-workflow/verify-final-dist.mjs": "36b4798c8a4a082c8685c77c573d05cefa87cad22d60f4848d591def0b5a088f",
  "tests/fixtures/ninth-small-repairs/bridged/tests/fixtures/agent-workflow/verify-phase4-physical-repair.mjs": "08cb5702a8bf0618a842de53394bab2b2ac3d1d9431d4e21a6d8f537fde11f09",
  "tests/fixtures/ninth-small-repairs/bridged/tests/fixtures/eighth-metadata-buildfix/verify.mjs": "f14e5d84647f06962ff34be44a6e5ac504a013cab08a9ba96238e832edc0ad1e",
  "tests/fixtures/ninth-small-repairs/bridged/tests/fixtures/eighth-reconciliation/verify-dependencies.mjs": "2f41ecc74b53c7e4524db9209b6c8e23bb8bdbd627e1ee5215f44eb45e140f03",
  "tests/fixtures/ninth-small-repairs/bridged/tests/fixtures/model-alignment/verify-model-alignment.mjs": "88623572ec9cdb69d74f941d91efc883f3c75e8104ae73c1d1422c4fa71a07a5",
  "tests/fixtures/ninth-small-repairs/bridged/tests/fixtures/model-comparison-metrics/verify-final-dist.mjs": "eca470c782fe2fbe5542c6dc29ede80e18542900cf36d79eb7ef95a23b8b33b7",
  "tests/fixtures/ninth-small-repairs/bridged/tests/fixtures/model-contracts/verify-model-contracts.mjs": "6eaa92e5810d6100991c3d4328c307da9bc1eea293b2754ae56c61bcebd375bf",
  "tests/fixtures/ninth-small-repairs/bridged/tests/fixtures/model-contracts/verify-sixth-reconciliation.mjs": "8f303594505e8ba33fd5caad74d68641540071d9055fff6255f3c65f6bc6ead1",
  "tests/fixtures/ninth-small-repairs/bridged/tests/fixtures/model-release-evaluation/verify-final-dist.mjs": "5ef63d8b34b8a88d2a4412d182a5ccd26bb4250079a97492a376b14f9110e7cd",
  "tests/fixtures/ninth-small-repairs/bridged/tests/fixtures/multiagent-context/verify-final.mjs": "a391308768f5e96412605e7542c0a8ce8bff9d605ceddf48694ba5ae56cabf71",
  "tests/fixtures/ninth-small-repairs/bridged/tests/fixtures/reasoning-variant-cleanup/verify-final-dist.mjs": "da98faaf622c54582150898861454cd0b449bec37de108e93ec0fb5cf3ba2cf0",
  "tests/fixtures/ninth-small-repairs/bridged/tests/fixtures/reasoning-variant-cleanup/verify-negative-dist.mjs": "cfb4c6d219659672c4fa8c58f8780e77db4e83519e99a97e52491738a1b371c1",
  "tests/fixtures/ninth-small-repairs/bridged/tests/fixtures/service-protocol/verify-phase4-migration.mjs": "7e3ad5be0644a2105ae6d79966211322fb483abe5800d0b61f38c284b0ce9272",
  "tests/fixtures/ninth-small-repairs/bridged/tests/fixtures/service-protocol/verify-service-protocol.mjs": "ff4eeab9ea2b7a26d0cdf2068333dca66c6b80f39f16db2c87602958024e97ed",
  "tests/fixtures/ninth-small-repairs/bridged/tests/fixtures/seventh-reconciliation/verify-dependencies.mjs": "57ef580a3545680b02fb81d50871fcdd2766cf75a4bd585c0a25e9d2c5f6c83d",
  "tests/fixtures/ninth-small-repairs/bridged/tests/fixtures/skill-boundaries/verify-final-dist.mjs": "1f63e5a71997269c981a654c9d7f39ca677b124ccf461b03fd583ff4106bfb32",
  "tests/fixtures/ninth-small-repairs/framework-legacy-dependency-index.json": "a8b97d7ca9807ef3e6a7641373c9f720a6cf15db921b6c09277992ddcb09e3df",
  "tests/fixtures/ninth-small-repairs/metadata-contracts.json": "e21d2462e30115fd0e1815e0f7121e58c7416b8a93f7ba7798fb4293e36c4369",
  "tests/fixtures/ninth-small-repairs/original500-registry.json": "f440ab82fa2a990b4dc6cb031061980003e0dd5f6d5812f69d1cdc9ecf2763bc",
  "tests/fixtures/ninth-small-repairs/preservation-proof.json": "5abbaf894040a3a61e08f29b3599afc882710860ea9ef1bdfe26a8ac1d2043b2",
  "tests/fixtures/ninth-small-repairs/source-proposals/approved-lead-contract.json": "5d677bdd098399d5c7c952fe62a394876cdbb6b4427cafa59223a343ee74c637",
  "tests/fixtures/ninth-small-repairs/source-proposals/context-boundary-clarity.json": "039e3a29fe0a91bb6fe6dd494738d322e7e7bc67e70b4e41d7b446cec797c95b",
  "tests/fixtures/ninth-small-repairs/source-proposals/evaluation-method-clarity.json": "c388a0fdba562db8510524aefaf40001ac511a5900dd930e83a045a422c89c47",
  "tests/fixtures/ninth-small-repairs/source-proposals/model-narrow-clarity.json": "9ca1c36cab6cbd5e25c76c6bebb343e20d86a2e2df835503872985109ab673e4",
  "tests/fixtures/ninth-small-repairs/source-proposals/plan-small-clarity.json": "016725978cd4d0f8e755084426df1df3a960990783ce5f5046df9c02a337fe1a",
  "tests/fixtures/ninth-small-repairs/source-proposals/rag-boundary-clarity.json": "2e5bfab57002469039390fe78d628da156a058c33b89a8818e832faf9b4f1ba0",
  "tests/fixtures/ninth-small-repairs/source-proposals/scheduler-wording-clarity.json": "4b225128915ecefbe6967f6d17b4f9b1d8cda5bb5c379f748473db22807c857b",
  "tests/fixtures/ninth-small-repairs/source-transitions.json": "3acd3e17ab20eb99f94d53c7ec2dd9ac4dd836da939e4ae32d55ecaa71d07318",
  "tests/fixtures/ninth-small-repairs/transition-proof.json": "5b1b868277336269c106ce1abbbcbd505fef1085d13d5ef776831869bd73bbf9",
  "tests/fixtures/ninth-small-repairs/verify-framework-reference.mjs": "03c41657758bf371381a1cb5ec264e9de9b789a8a374fc66a0b5467809896c0b",
  "tests/fixtures/ninth-small-repairs/verify-reference-negatives.mjs": "66531481edd75007c02b31e6ef96a936ac1fe91f2937dfbdcad8ef4c337fe9df",
  "tests/fixtures/ninth-small-repairs/verify-reference.mjs": "34dba95c8d1747751809c66a24fee49b8d008a09b78f00c68ca2c932546ac2ed",
  "tests/fixtures/ninth-small-repairs/verify-source-transitions.mjs": "73f3c34add2f74b1b58a406a0dc4789e186716ae76b5fcccdaa3225b72ba868d",
  "tests/fixtures/ninth-small-repairs/verify-transition.py": "be37e02e104534dcee765dc53aa777204ffe44aebda5197da8bd55fe9d849d26"
};
test('ninth exact current31 leaves preserve803 complete entries, original conditions and frozen evidence',()=>{
 for(const [rel,expected]of Object.entries(pins))assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root,rel))).digest('hex'),expected,'ninth portable input '+rel);
 const sources=verifySources();assert.equal(sources.clones,23);assert.equal(sources.replacements,26);assert.equal(sources.originalFixtureWrites,0);
 const negatives=spawnSync(process.execPath,[path.join(root,'tests/fixtures/ninth-small-repairs/verify-reference-negatives.mjs')],{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:1024*1024});assert.ifError(negatives.error);assert.equal(negatives.status,0,negatives.stderr);const checks=JSON.parse(negatives.stdout);assert.equal(checks.coreNegativeChecks.length,4);assert.equal(checks.actualAcceptance,false);
 const run=spawnSync('python3',[path.join(root,'tests/fixtures/eleventh-algorithm-interruption/aggregate/verify-ninth-transition.py'),'--site',root,'--mode','after'],{cwd:root,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});
 assert.ifError(run.error);assert.equal(run.signal,null);assert.equal(run.status,0,run.stderr);const result=JSON.parse(run.stdout);assert.equal(result.status,'PASS_SUPPLIED_JOINT_SITE_INPUTS');assert.equal(result.actualAcceptance,false);assert.equal(result.validatedSuppliedSiteInputs,true);assert.equal(result.historicalStageRegistryRecords,541);assert.equal(result.siteWrites,0);assert.equal(result.fields,31);assert.equal(result.entries,21);assert.equal(result.corpusEntries,803);assert.equal(result.registryRecords,527,'immutable ninth historical registry fact');assert.equal(result.currentRegistryRecords,558,'separately gated complete supplied current registry');assert.equal(result.site,path.resolve(root));
 for(const rel of ['multiagent-context/verify-final.mjs','reasoning-variant-cleanup/verify-final-dist.mjs']){
  const clone=path.join(root,'tests/fixtures/ninth-small-repairs/bridged/tests/fixtures',rel),dist=path.join(root,'dist');
  const direct=spawnSync(process.execPath,[clone,'--dist',dist],{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});assert.ifError(direct.error);assert.equal(direct.signal,null);assert.equal(direct.status,0,direct.stderr);assert.equal(direct.stderr,'');const report=JSON.parse(direct.stdout);assert.equal(report.status,'PASS_ACTUAL_FINAL_DIST');assert.equal(report.dist,path.resolve(dist));
  const missing=path.join(root,'dist','.ninth-absent-cli-check-'+process.pid);assert.equal(fs.existsSync(missing),false);
  const negative=spawnSync(process.execPath,[clone,'--dist',missing],{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});assert.ifError(negative.error);assert.equal(negative.signal,null);assert.notEqual(negative.status,0,'direct CLI must execute and reject a missing dist');assert.ok(negative.stderr.includes(missing),'failure must identify the explicitly supplied invalid dist');
 }

});

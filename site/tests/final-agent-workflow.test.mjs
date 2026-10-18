import {ninthExecutablePath,ninthExecutionHash} from './fixtures/ninth-small-repairs/verify-reference.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const site=fileURLToPath(new URL('../',import.meta.url)),fixture=path.join(site,'tests/fixtures/agent-workflow'),dist=path.join(site,'dist');
const deps={
  "phase4-physical-condition-reconciliation.json": "512d4843d5becec35c8ad6f3554ce2d7c8f8b1bff80a2aeb26df20ea847c631e",
  "verify-final-dist.mjs": "6135db764b60b25ded890be1beabf0cc6e5ca446dfc3ceb5f1192b9dc4a073f9",
  "source-block-map.json": "8f89bdafe9b859525ec2bab01799e5f3516c599574006a769e984acb1711561d",
  "destinations.json": "43c7a61187dd6660aed40a1d9dfb3a1143af9ed28e6459b41005b3b9bef9e03d",
  "phase2-dag-witness-reconciliation.json": "3b3e2df97891509c96b714d905513fba5a7d6ed2e9175fedd98ffd09cafc1f58",
  "append-manifest.json": "cbd7948a27fb49a431a445d3fc00e636349f6cafbfe2e379ed32e5a50b402a8a",
  "identity-baseline.json": "498f0486fca5551c3aed1fc052fed2899be75958d2cbaf60130ac136c0169fec",
  "variant-map.json": "9034651c3b2d4c2feacde1041a0222908f713daf6a463edc79ccde461a7fe0ed",
  "records.json": "8aab90a5e8402bd4bf29177bcdfa6ce1186f6c46b3aeb81e31b2ee8a58173076",
  "fifth-workflow-after-prefix.json": "dae3889096cbb6889658457f06acb652b53b1ca2048445b6c443bfb31a7aec20"
};
const names=['dag-old-witness-reconciliation','workflow-composed-after-prefix','four-exact-after-leaves','two-real-authored-appends','old-identities-and-append-prefix','247-blocks-exact-source-and-semantic-witnesses','151-exact-folded-wordings-and-real-targets','routes-html-and-legacy-anchors','separate-scenarios-and-unique-contracts','new-conceptual-prose-has-no-code-or-provenance'];
test('actual final dist preserves Agent workflow blocks, wording and stable identities',async t=>{
 for(const [name,sha]of Object.entries(deps))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(fixture,name))).digest('hex'),sha,'changed verifier dependency '+name);
 const run=spawnSync(process.execPath,[ninthExecutablePath(path.join(fixture,'verify-final-dist.mjs')),'--dist',dist],{cwd:site,encoding:'utf8',timeout:60000,maxBuffer:4000000});assert.ifError(run.error);assert.equal(run.signal,null);assert.equal(run.stderr,'');const r=JSON.parse(run.stdout);assert.equal(r.mode,'final');assert.equal(r.dist,dist);assert.equal(r.overlays,0);assert.equal(r.siteWrites,0);assert.equal(r.total,10);assert.deepEqual(r.checks.map(x=>x.name),names);assert.equal(r.recordsSha256,deps['records.json']);assert.equal(r.verifierSha256,ninthExecutionHash("tests/fixtures/agent-workflow/verify-final-dist.mjs",deps['verify-final-dist.mjs']));
 for(const [i,name]of names.entries())await t.test(name,()=>{assert.equal(r.checks[i].status,'passed',r.checks[i].error||name);});
 assert.equal(r.passed,10);assert.equal(r.failed,0);assert.equal(r.actualFinalDistAcceptance,true);assert.equal(run.status,0);
});

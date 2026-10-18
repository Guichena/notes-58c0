import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const site=fileURLToPath(new URL('../',import.meta.url)),fixtures=path.join(site,'tests/fixtures/agent-capacity'),dist=path.join(site,'dist');
const deps={
  "verify-final-dist.mjs": "fd0861508582641febdadaaf14476c82899bbf7af9f845705716d6a9f14bfa8c",
  "records.json": "df7d9609b463d71a5296e48abc72c45762a0f6a44b1a3610daf17b6bdd98d978",
  "next-batch-sandbox-record.json": "a7fa5f9615143ad4c8201ba58b25dc01ee182120afc4bc8023d7b6de55208c1c",
  "append-manifest.json": "c4515e44dac5647e0189cf4eb68d157b431bb617a807b12f0e30452a54d07e15",
  "source-block-map.json": "c1d070f7fd0677a5a50893bc818230cd8ad38a4b131d9debc938b008a6b63756",
  "variant-map.json": "fe50099866df315a4b2aa0ddb6db11d1db229d66dda0ecc66dab2c0df8ba5218",
  "destinations.json": "cbe36000071bdab6999d79fd97c28833a443afbc3a858d0998af0a9431b8be86",
  "identity-baseline.json": "a1a622577db4200c8f4200ee138e14f397ab20d09d2cc399d10bd13163375cf9",
  "lead-map.json": "40ebef49f72ef6f4718b42df5815acfd4ced6c6d52f162f682aa08a512b21b40"
};
test('actual final dist preserves capacity, monthly budgets and all source destinations',()=>{
 for(const[name,sha]of Object.entries(deps))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(fixtures,name))).digest('hex'),sha,'changed fixture '+name);
 const r=spawnSync(process.execPath,[path.join(fixtures,'verify-final-dist.mjs'),'--dist',dist,'--fixtures',fixtures],{encoding:'utf8',timeout:60000,maxBuffer:4000000});assert.ifError(r.error);assert.equal(r.signal,null);assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(r.stderr,'');const out=JSON.parse(r.stdout);assert.equal(out.status,'PASS_ACTUAL_FINAL_DIST');assert.equal(out.actualFinalDistAcceptance,true);assert.equal(out.dist,dist);assert.equal(out.overlays,0);assert.equal(out.siteWrites,0);assert.equal(out.guardedLeaves,7);assert.equal(out.actualAuthoredQuestions,1);assert.equal(out.sourceBlocks,110);assert.equal(out.leadBlocks,2);assert.equal(out.exactQuestionWordings,51);assert.equal(out.substantiveWitnesses,93);assert.equal(out.recordsSha256,deps['records.json']);assert.equal(out.verifierSha256,deps['verify-final-dist.mjs']);
});

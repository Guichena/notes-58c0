import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import{createHash}from'node:crypto';import{spawnSync}from'node:child_process';import{fileURLToPath}from'node:url';
// Installed site's actual dist only. No cwd/environment override, fallback,
// candidate overlay, feature flag or optional oracle skipping.
const root=fileURLToPath(new URL('../',import.meta.url)),dist=path.join(root,'dist'),fixtures=path.join(root,'tests/fixtures/moe-architecture');
const pins={
  "records.json": "07b60ebaba3a22752768c6a5e577d575e5a1f505b6332229b059f3bbfaed4cca",
  "append-manifest.json": "6b24dfbe6df5b00c9fbc8567817cef5818578b0c5ae1cbd6ac3efe6e061107bd",
  "identity-baseline.json": "070d0390d3d9ce22536febf47a58ab8f181998ecf0d66d839457c56b12de272f",
  "preservation-map.json": "ec59005202a80bbdfd591b96fb003a6012bd974671bf0cf8f197541fc123be23",
  "variant-map.json": "d8eb9aed4de2c0dfaf94509be78817d9505d0f54ed002c1c3437e065069ba523",
  "sections.json": "8035fa5e5a731fb57ab22eea32c38ec611f960ed0d11addda8b2bd69f256f299",
  "external-dependencies.json": "28ef6c7afb423b50d2357c4e0ba609daa8b18cee0b10f6774cf6ae15a6edeb3e",
  "semantic-contracts.json": "dca3f4470971f12688fa5de8e889e6ed1e0380fa3a185c31031477cf070b848c",
  "verify-final-dist.mjs": "6e82354bc140167ea49cfd62e415809bac5f19bd0c42b5414f66bd38dd9af15a"
},names=[
  "two guarded original leaves are actually applied",
  "one real authoring append preserves every complete old prefix item",
  "original item identity and unowned source fields are unchanged",
  "all 31 exact source blocks have substantive actual destinations",
  "all 11 original question phrasings remain exactly available",
  "existing canonical bodies and full paragraph witnesses are fixed",
  "unique mechanism classification and fair-comparison conditions survive",
  "correct-route superiority does not imply end-to-end superiority",
  "passive HTML old anchors and all actual routes are valid",
  "public answer contains no fabricated experiments or internal evidence labels"
],sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
test('actual dist satisfies all ten MoE and sequence architecture contracts',async t=>{
 let report,result,error;try{
  for(const[n,h]of Object.entries(pins))assert.equal(sha(path.join(fixtures,n)),h,'unreviewed fixture drift '+n);
  result=spawnSync(process.execPath,[path.join(fixtures,'verify-final-dist.mjs'),'--dist',dist],{cwd:root,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});assert.ifError(result.error);assert.equal(result.signal,null);assert.equal(result.stderr,'');report=JSON.parse(result.stdout);
  assert.equal(report.mode,'actual-dist-only');assert.equal(report.dist,dist);assert.equal(report.overlay,false);assert.equal(report.siteWrites,0);assert.deepEqual(report.checks.map(c=>c.name),names);
 }catch(e){error=e;}
 for(const[i,name]of names.entries())await t.test(name,()=>{assert.ifError(error);assert.equal(report.checks[i].passed,true,report.checks[i].error||name);});
 assert.ifError(error);assert.equal(report.passed,true);assert.equal(result.status,0);
});

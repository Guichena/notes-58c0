import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {interruptionProof,interruptionRegistryBefore,interruptionLeaf,interruptionHash,interruptionEntry,interruptionReferenceEntry,interruptionAssetHash,interruptionSourceText,interruptionSourceHash,interruptionExpectedRegistry,interruptionEntryHash,interruptionCanon} from './fixtures/interruption-observation/verify-reference.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const sha=x=>createHash('sha256').update(x).digest('hex');
const pins={
  "tests/fixtures/interruption-observation/backend_runtime.py": "59f8bc4719aa235c6a1a2df66690f34aacfe58b4bd6c659587255d0c2cf8a728",
  "tests/fixtures/interruption-observation/remaining_practice.py": "ffc17d15cc4e5866881561afc3cc4594208105dd3f0c2ce0529aa4b0b79881e3",
  "tests/fixtures/interruption-observation/bridge.py": "7380503123f22e40a7b15823e5e04a7aafd047da05437ede4b9fd1d5702426f2",
  "tests/fixtures/interruption-observation/verify-reference.mjs": "7895cdbd9742379ddf3315a8ddaf739930ab6df1b60d9d8c49612f35b5c77e6a",
  "tests/fixtures/interruption-observation/verify-current.py": "e64e4d2e710679df431312d98bbf420cde9e3d7a3b7dce704e6e1b2675d1657a",
  "tests/fixtures/interruption-observation/backend-verifier.mjs": "316d7ccb6a67f0e34bca315a0388e465c89856ddb40543e3aea9204ccdf3d6fe",
  "tests/fixtures/interruption-observation/source-transitions.json": "685597c5f1def03e66edc15894bc6af983056ad8b4243ba30ffbd9234e15e056",
  "tests/fixtures/interruption-observation/transition-proof.json": "049585793a2a5878490447ee5775e566e33b6015ff3ab2239f8ce40e7b960736"
};
test('exact interruption bridge preserves originals and runs current code with twelve negative mutants',()=>{
 for(const [relative,h]of Object.entries(pins))assert.equal(sha(fs.readFileSync(path.join(root,relative))),h,'interruption pinned file '+relative);
 for(const [relative,h]of Object.entries(interruptionProof.originalFixtures))assert.equal(sha(fs.readFileSync(path.join(root,relative))),h,'immutable historical expected/oracle '+relative);
 for(const [relative,pin]of Object.entries(interruptionProof.originalConsumers))assert.equal(sha(fs.readFileSync(path.join(root,relative))),pin.sha256,'immutable original runtime oracle '+relative);
 const sources=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/interruption-observation/source-transitions.json'),'utf8'));
 for(const r of sources.replacements){assert.equal(sha(fs.readFileSync(path.join(root,r.target))),r.afterSha256,'installed exact replacement '+r.target);if(r.before!==undefined){assert.equal(sha(r.before),r.beforeSha256);assert.equal(sha(r.after),r.afterSha256);assert.equal(interruptionSourceText(r.target,r.before),r.after);assert.equal(interruptionSourceHash(r.target,r.beforeSha256),r.afterSha256);}}
 for(const r of sources.clones){const before=fs.readFileSync(path.join(root,r.originalTarget),'utf8');assert.equal(before,r.before);assert.equal(sha(before),r.beforeSha256);let after=before;for(const e of r.edits){assert.equal(after.split(e.before).length,2);after=after.replace(e.before,e.after);}after=r.prefix+after;assert.equal(after,r.after);assert.equal(fs.readFileSync(path.join(root,r.target),'utf8'),after);}
 const run=spawnSync(process.env.PYTHON||'python3',[path.join(root,'tests/fixtures/interruption-observation/verify-current.py'),'--dist',path.join(root,'dist')],{encoding:'utf8',timeout:150000,maxBuffer:8*1024*1024});assert.ifError(run.error);assert.equal(run.signal,null);assert.equal(run.status,0,run.stdout+'\n'+run.stderr);const r=JSON.parse(run.stdout);assert.equal(r.status,'PASS_EXPLICIT_CURRENT_DIST');assert.equal(r.dist,path.join(root,'dist'));assert.equal(r.positiveRuns,4);assert.equal(r.mutantsRejectedOnMain,12);assert.equal(r.siteWrites,0);
});
test('interruption adapters reject stale or altered leaves, records, assets and source pins',()=>{
 const p=interruptionProof;
 for(const r of p.records){assert.equal(interruptionLeaf(r.entryId,r.path,r.before),r.after);assert.equal(interruptionHash(r.entryId,r.path,r.beforeSha256),r.afterSha256);assert.equal(interruptionLeaf(r.entryId,r.path,r.before+' drift'),r.before+' drift');const e=structuredClone(p.afterEntries[r.entryId]);e[r.path[0]]=r.before;assert.throws(()=>interruptionReferenceEntry(e));e[r.path[0]]=r.after+' drift';assert.throws(()=>interruptionReferenceEntry(e));assert.deepEqual(interruptionReferenceEntry(p.afterEntries[r.entryId]),p.beforeEntries[r.entryId]);assert.deepEqual(interruptionEntry(p.beforeEntries[r.entryId]),p.afterEntries[r.entryId]);}
 for(const [id,e]of Object.entries(p.beforeEntries))assert.equal(interruptionEntryHash(id,sha(interruptionCanon(e))),sha(interruptionCanon(p.afterEntries[id])));
 const current={records:p.registryRecords.map(r=>structuredClone(r.after))};const prior=interruptionRegistryBefore(current);assert.deepEqual(prior.records,p.registryRecords.map(r=>r.before));assert.deepEqual(interruptionExpectedRegistry(prior),current);assert.equal(current.records.length,prior.records.length);
 const extra={entryId:'independent541-entry',path:['unchanged'],before:'A',after:'B'};current.records.push(extra);assert.deepEqual(interruptionRegistryBefore(current).records.at(-1),extra,'independent appended records survive exactly');const bad=structuredClone(current);bad.records[0].after+=' drift';assert.throws(()=>interruptionRegistryBefore(bad));assert.throws(()=>interruptionRegistryBefore({records:[...current.records,current.records[0]]}));
 for(const a of p.assets){assert.equal(interruptionAssetHash(a.distRelativePath,a.beforeSha256),a.afterSha256);assert.equal(interruptionAssetHash(a.distRelativePath,'unapproved'),'unapproved');}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {jointProof as p,jointSha as sha,jointCanon as canon,jointEntry,jointEntryHash,jointLeaf,jointHash,jointExpectedRegistry,jointSourceProof,jointSourceText,jointSourceHash,verifyJointSourceRow,assertJointEntries,assertJointRegistry,assertJointSources} from './fixtures/eleventh-algorithm-interruption/verify-reference.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),read=r=>JSON.parse(fs.readFileSync(path.join(root,r),'utf8'));
const pins={
  "tests/fixtures/eleventh-algorithm-interruption/bridge.py": "4e6e154d6f21cd5ff8104b34481e6db1550db868d6642f3a0cbb6632030606b8",
  "tests/fixtures/eleventh-algorithm-interruption/verify-reference.mjs": "f20e7f50728e8bb50cf441d242dc758231866eb247eb6ba1df551d8b075f23f8",
  "tests/fixtures/eleventh-algorithm-interruption/joint-proof.json": "0df8a71700b464299001989104676992fdda9a454b038de19c7b171c0c2c96a0",
  "tests/fixtures/eleventh-algorithm-interruption/source-transitions.json": "502d6a220928e5c5a4f5d9d7774b0bccc5ff110b479571960604e812bb99e545",
  "tests/fixtures/eleventh-algorithm-interruption/aggregate/verify-ninth-transition.py": "28d550805c57a259a8467459f7ca7d4a49269162c2f9243c11ef1359d236c1e2",
  "tests/fixtures/eleventh-algorithm-interruption/aggregate/verify-ninth-source-transitions.mjs": "05fa01ce2e4e21983a9b1e607e3f2a65c226ab067689e9968bb2b8e618b388c5",
  "tests/fixtures/eleventh-algorithm-interruption/aggregate/eighth-dependencies.mjs": "6565a0624b32fa2c44ad10fa80f7cf59ac4bb07b5b7f4a9b390cf6eef66dc2e0",
  "tests/fixtures/eleventh-algorithm-interruption/aggregate/verify-tenth.py": "6b0de035bd47a79936a637605c228282899fe91fcc32d1b54fc52c1e20c7caad",
  "tests/fixtures/eleventh-algorithm-interruption/aggregate/tenth-reference.mjs": "8cb690b2ed4c30fbe6b29094e73f2d357be9efdf0b7fd75bd06df50b768cf5a5",
  "tests/fixtures/eleventh-algorithm-interruption/aggregate/tenth_expected.py": "6368fcdb4edd27205ea8290c74ce46abd60ce4d74fe3e742e1cadf594065d30c",
  "tests/fixtures/eleventh-algorithm-interruption/aggregate/metadata.mjs": "1638877e1ca789efb23d5875600fbfaf4ae45bf30068c0bb73086f4c1e844f61",
  "tests/fixtures/algorithm-residuals/verify-component.mjs": "1ca2e7fa9c8ca769c4a26771da01d10cd37014a24d92f4a222d664b98ebee772",
  "tests/fixtures/algorithm-residuals/ownership-map.json": "6cb03c8ac185b512efba52de1bb17ddeb00b37996d273e1567cbe8d564fb35bc",
  "tests/fixtures/algorithm-residuals/asset-manifest.json": "adc966bd9891e4fc8a4a8850fc589b2fb12680f20fe4dfb29d6a0bc0dd9b4f33",
  "tests/fixtures/algorithm-residuals/component.json": "5c0922960781238ab0f77911fe50a0db311fe66fe9de0d9264ebb71d198e81e5",
  "tests/fixtures/interruption-observation/backend_runtime.py": "59f8bc4719aa235c6a1a2df66690f34aacfe58b4bd6c659587255d0c2cf8a728",
  "tests/fixtures/interruption-observation/remaining_practice.py": "ffc17d15cc4e5866881561afc3cc4594208105dd3f0c2ce0529aa4b0b79881e3",
  "tests/fixtures/interruption-observation/bridge.py": "7380503123f22e40a7b15823e5e04a7aafd047da05437ede4b9fd1d5702426f2",
  "tests/fixtures/interruption-observation/verify-reference.mjs": "7895cdbd9742379ddf3315a8ddaf739930ab6df1b60d9d8c49612f35b5c77e6a",
  "tests/fixtures/interruption-observation/verify-current.py": "e64e4d2e710679df431312d98bbf420cde9e3d7a3b7dce704e6e1b2675d1657a",
  "tests/fixtures/interruption-observation/backend-verifier.mjs": "316d7ccb6a67f0e34bca315a0388e465c89856ddb40543e3aea9204ccdf3d6fe",
  "tests/fixtures/interruption-observation/source-transitions.json": "685597c5f1def03e66edc15894bc6af983056ad8b4243ba30ffbd9234e15e056",
  "tests/fixtures/interruption-observation/transition-proof.json": "049585793a2a5878490447ee5775e566e33b6015ff3ab2239f8ce40e7b960736"
};
const entries=()=>fs.readdirSync(path.join(root,'dist/data/chapters')).filter(x=>x.endsWith('.json')).sort().flatMap(f=>read('dist/data/chapters/'+f).entries);
const set=(e,a,v)=>a.slice(0,-1).reduce((x,k)=>x[k],e)[a.at(-1)]=v;
test('joint558 pins both independent components, original oracles and seven exact consumer clones',()=>{
 for(const [relative,h]of Object.entries(pins))assert.equal(sha(fs.readFileSync(path.join(root,relative))),h,'complete joint delivery '+relative);
 assert.deepEqual(assertJointSources(root),{clones:7,replacements:9,assets:19,originalFixtures:Object.keys(p.originalFixturePins).length,originalFixtureWrites:0});
 for(const r of jointSourceProof().replacements){assert.equal(jointSourceText(r.target,r.before),r.after);assert.equal(jointSourceHash(r.target,r.beforeSha256),r.afterSha256);assert.throws(()=>jointSourceText(r.target,r.before+' drift'));assert.throws(()=>jointSourceHash(r.target,'unapproved'));}
 for(const original of [...jointSourceProof().clones,...jointSourceProof().replacements]){const bad=structuredClone(original);bad.after+='\n// unapproved';assert.throws(()=>verifyJointSourceRow(bad));const edit=structuredClone(original);if(edit.edits.length){edit.edits[0].after+=' drift';assert.throws(()=>verifyJointSourceRow(edit));}else{edit.edits.push({beforeStartByte:0,beforeEndByte:0,before:'',after:'drift'});assert.throws(()=>verifyJointSourceRow(edit));}}
});
test('joint558 validates all803 ordered full entries and the entire composed558 registry',()=>{
 const E=entries();assert.deepEqual(assertJointEntries(E),{leaves:20,changedEntries:17,corpusEntries:803});assertJointEntries(new Map(E.map(e=>[e.id,e])));
 const current=read('content/final-audit-corrections.json');assert.deepEqual(assertJointRegistry(current),{before:541,after:558,composed:3,appended:17});
 const row=jointSourceProof().replacements.find(r=>r.target==='content/final-audit-corrections.json'),prior=JSON.parse(row.before);assert.equal(sha(row.before),p.registryBeforeSha256);assert.equal(sha(row.after),p.registryAfterSha256);assert.deepEqual(jointExpectedRegistry(prior),current);
 for(const [id,before]of Object.entries(p.beforeEntries)){assert.deepEqual(jointEntry(before),p.afterEntries[id]);assert.equal(jointEntryHash(id,sha(canon(before))),p.afterCanonicalHashes[id]);assert.throws(()=>jointEntryHash(id,'unapproved'));const bad=structuredClone(before);bad.unapproved='field';assert.throws(()=>jointEntry(bad));}
 for(const r of p.records){assert.equal(jointLeaf(r.entryId,r.path,r.before),r.after);assert.equal(jointHash(r.entryId,r.path,r.beforeSha256),r.afterSha256);assert.throws(()=>jointLeaf(r.entryId,r.path,r.before+' drift'));assert.throws(()=>jointHash(r.entryId,r.path,'unapproved'));}
});
test('joint558 rejects each restored leaf, any sibling or order drift, and all three registry composition failures',()=>{
 const E=entries();for(const r of p.records){const bad=E.slice(),i=bad.findIndex(e=>e.id===r.entryId);bad[i]=structuredClone(bad[i]);set(bad[i],r.path,r.before);assert.throws(()=>assertJointEntries(bad),'restored leaf '+r.entryId+JSON.stringify(r.path));}
 for(const id of Object.keys(p.afterEntries)){const bad=E.slice(),i=bad.findIndex(e=>e.id===id);bad[i]={...bad[i],unreviewedSibling:'drift'};assert.throws(()=>assertJointEntries(bad));}
 const untouched=E.find(e=>!Object.hasOwn(p.afterEntries,e.id)),bad=E.slice();bad[bad.indexOf(untouched)]={...untouched,unreviewedSibling:'drift'};assert.throws(()=>assertJointEntries(bad));assert.throws(()=>assertJointEntries(E.slice(1)));assert.throws(()=>assertJointEntries([E[1],E[0],...E.slice(2)]));assert.throws(()=>assertJointEntries([...E.slice(0,-1),E[0]]));
 const current=read('content/final-audit-corrections.json');for(const r of p.registryCompositions){const bad=structuredClone(current);bad.records[r.index]=r.before;assert.throws(()=>assertJointRegistry(bad));}
 for(const mutate of [r=>r.records.pop(),r=>r.records.push(r.records[0]),r=>r.records[0].unapproved='field',r=>r.unapproved='field',r=>{[r.records[541],r.records[542]]=[r.records[542],r.records[541]];}]){const bad=structuredClone(current);mutate(bad);assert.throws(()=>assertJointRegistry(bad));}
 const prior=JSON.parse(jointSourceProof().replacements.find(r=>r.target==='content/final-audit-corrections.json').before);assert.throws(()=>assertJointRegistry(prior));prior.records[0].unapproved='field';assert.throws(()=>jointExpectedRegistry(prior));
});
test('joint historical projection preserves every old test and restoration and removes every new fixture and asset',()=>{
 const row=jointSourceProof().replacements.find(r=>r.target==='scripts/test-final-audit.mjs'),before=row.before,after=fs.readFileSync(path.join(root,row.target),'utf8');
 const statement=(source,name)=>{const m=source.match(new RegExp('const '+name+'=(\\[[^\\n]*\\]);'));assert.ok(m,name);return m[1];};
 for(const name of ['originals','additions','tenthHistoricalRestores','tenthAdditions'])assert.equal(statement(after,name),statement(before,name),'immutable prior '+name);
 const newAdds=Function('return '+statement(after,'eleventhAdditions'))();assert.deepEqual(newAdds,['tests/fixtures/interruption-observation','tests/final-interruption-observation.test.mjs','tests/fixtures/algorithm-residuals','tests/final-algorithm-residuals.test.mjs','tests/fixtures/eleventh-algorithm-interruption','tests/final-eleventh-algorithm-interruption.test.mjs','public/assets/examples/algorithm-shared']);
 assert.ok(after.includes('[...additions,...tenthAdditions,...eleventhAdditions]'));assert.equal(after.match(/run\(\['scripts\/test-question-bank.mjs'\],isolated\)/g)?.length,1);
 const beforeTests=[...before.matchAll(/'tests\/[^']+\.test\.mjs'/g)].map(m=>m[0]);for(const t of beforeTests)assert.ok(after.includes(t),'old test preserved '+t);
 const removed=[...Function('return '+statement(before,'additions'))(),...Function('return '+statement(before,'tenthAdditions'))(),...newAdds];
 for(const r of [...jointSourceProof().replacements,...jointSourceProof().assets])assert.ok(removed.some(d=>r.target===d||r.target.startsWith(d+'/')),'modified current-only input removed from historical view '+r.target);
 for(const r of jointSourceProof().clones)assert.ok(newAdds.some(d=>r.target.startsWith(d+'/')),'new executable removed from historical view');
});

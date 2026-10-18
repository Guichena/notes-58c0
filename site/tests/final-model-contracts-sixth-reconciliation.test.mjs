import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {verify,names} from './fixtures/ninth-small-repairs/bridged/tests/fixtures/model-contracts/verify-sixth-reconciliation.mjs';
const siteRoot=fileURLToPath(new URL('../',import.meta.url));
const verifier=path.join(siteRoot,'tests/fixtures/model-contracts/verify-sixth-reconciliation.mjs');
const verifierSha='634073a6c7eb1453aaee156e67e1507ce7e73fe42541077feb5abc90d4cab350';
const sha=b=>createHash('sha256').update(b).digest('hex');
test('model-contracts retains exact parallel/metrics migration and all original fixtures',async t=>{
 assert.equal(sha(fs.readFileSync(verifier)),verifierSha,'Reconciliation verifier changed without review');
 const report=verify(path.join(siteRoot,'dist'));
 assert.equal(report.mode,'actual-final-dist-only');assert.equal(report.stagedInMemory,0);assert.equal(report.siteWrites,0);
 assert.deepEqual(report.checks.map(x=>x.name),names);assert.equal(names.length,9);
 for(const c of report.checks)await t.test(c.name,()=>assert.equal(c.status,'passed',c.error||c.name));
 assert.equal(report.passed,9);assert.equal(report.failed,0);
});

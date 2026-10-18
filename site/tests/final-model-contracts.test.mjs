import {ninthExecutablePath,ninthExecutionHash} from './fixtures/ninth-small-repairs/verify-reference.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Resolve the installed test's own site root. There is deliberately no dist
// override, fallback fixture, candidate mode, or dependency on the caller's cwd.
const siteRoot = fileURLToPath(new URL('../', import.meta.url));
const finalDist = path.join(siteRoot, 'dist');
const fixtures = path.join(siteRoot, 'tests', 'fixtures', 'model-contracts');
const verifier = path.join(fixtures, 'verify-model-contracts.mjs');
const sourceRecordsSha256 = '248f020ff8c49a149cac3b10a1a52da7b295ee40c545ccb8101ccb8a6c2a68d9';
const sourceVerifierSha256 = 'ea0349481b8ee83741557bb1b9ef35ae0cc45f0faef49483f5396480e15719ae';
const shaFile = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const oracleNames = [
  'exact-eight-leaves-and-input-state',
  'entry-identities-indexes-and-untouched-fields',
  'independent-full-paragraph-destination-map',
  'html-variants-anchors-and-routes',
  'narrow-truth-fix-boundaries-and-no-broad-rewrite',
  'outcome-is-not-step-truth-fixture',
  'masked-observation-context-gradient-fixture',
  'two-level-read-ttl-invalidation-and-authorization-fixtures',
  'billing-attempt-dedup-unknown-and-used-plus-reserved-fixtures',
  'actual-over-reservation-recorded-without-clamping',
  'kv-capacity-migration-and-rollout-conditions',
];

test('actual final dist satisfies the unchanged eleven model-contract oracles', async t => {
  assert.equal(shaFile(verifier), sourceVerifierSha256, 'Source verifier changed; review its assertions explicitly');
  assert.equal(shaFile(path.join(fixtures, 'records.json')), sourceRecordsSha256, 'Eight-record source package changed');
  const result = spawnSync(process.execPath, [ninthExecutablePath(verifier), '--dist', finalDist, '--mode', 'final'], {
    cwd: siteRoot,
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, `Verifier terminated by ${result.signal}`);
  assert.equal(result.stderr, '', `Unexpected verifier stderr: ${result.stderr}`);
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch (error) {
    assert.fail(`Verifier did not return JSON (exit ${result.status}): ${result.stdout}\n${error.message}`);
  }
  assert.equal(report.mode, 'final');
  assert.equal(report.dist, finalDist);
  assert.equal(report.recordsSha256, sourceRecordsSha256);
  assert.equal(report.verifierSha256, ninthExecutionHash("tests/fixtures/model-contracts/verify-model-contracts.mjs",sourceVerifierSha256));
  assert.deepEqual(report.checks.map(check => check.name), oracleNames, 'Every original oracle must run exactly once in order');
  for (const check of report.checks) {
    await t.test(check.name, () => {
      assert.equal(check.status, 'passed', check.error || check.name);
      if (check.name === 'exact-eight-leaves-and-input-state') {
        assert.equal(check.leaves, 8);
        assert.equal(check.stagedInMemory, 0, 'Final acceptance must not overlay proposed leaves');
        assert.equal(check.alreadyApplied, 8);
        assert.equal(check.siteWrites, 0);
      }
      if (check.name === 'entry-identities-indexes-and-untouched-fields') {
        assert.equal(check.entries, 4);
        assert.equal(check.itemIdentities, 40);
      }
      if (check.name === 'independent-full-paragraph-destination-map') assert.equal(check.mappedBlocks, 193);
    });
  }
  assert.equal(report.passed, 11);
  assert.equal(report.failed, 0);
  assert.equal(result.status, 0, 'The final-mode verifier must exit successfully');
});

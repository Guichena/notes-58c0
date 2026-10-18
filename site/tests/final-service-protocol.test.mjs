import {ninthExecutablePath,ninthExecutionHash} from './fixtures/ninth-small-repairs/verify-reference.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Resolve only this installed test's own site/dist. No environment override,
// caller-cwd fallback, candidate flag, overlay, or synthetic-data fallback.
const siteRoot=fileURLToPath(new URL('../',import.meta.url));
const finalDist=path.join(siteRoot,'dist');
const fixtures=path.join(siteRoot,'tests','fixtures','service-protocol');
const verifier=path.join(fixtures,'verify-service-protocol.mjs');
const shaFile=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const sourceRecordsSha256='655eab82a26049cb7020abc8e0ce1bfe1869667a87995a6c1646fe14346f2640';
const sourceVerifierSha256='b932cbc2d3bcf638ca3ad65cb4dd1807e1ffbf1c10acadc23e718b07ebdffff9';
const dependencySha256={
  "phase4-workflow-migration.json": "5735798a9f05d576ceac08faa9f6c0894046c05c14567e613ecf70ef8f063f97",
  "verify-phase4-migration.mjs": "3eb8f6181cdcfd6c26b489b8b635796e8b40900549321dba7045fa449d92c4fd",
  "verify-service-protocol.mjs": "b932cbc2d3bcf638ca3ad65cb4dd1807e1ffbf1c10acadc23e718b07ebdffff9",
  "records.json": "655eab82a26049cb7020abc8e0ce1bfe1869667a87995a6c1646fe14346f2640",
  "append-manifest.json": "612bb7d91121db34def0804bbf967c70b76c9cd743db328ee02fbb3e0748b157",
  "identity-baseline.json": "e55950f7c49f63399bf7283374919fd40cf943c4766c31d6fbba4bb07132d372",
  "paragraph-map.json": "67f604278f35294ee0d1c13340b9f86d6dd6a7c96a47cb0c31adad757c1beb13",
  "variant-map.json": "be777827fb24f0eaedcdb76ba933d696d6493ddbef5469632ec8159a43d8d238"
};
const oracleNames=[
  "three-exact-leaf-guards",
  "two-approved-authored-appends",
  "old-identity-prefix-is-unchanged",
  "agent5-only-owned-six-block-span-changed",
  "all322-old-semantic-blocks-have-exact-destinations",
  "all20-variants-plus-inline-duplex-are-mapped",
  "html-anchors-and-all-internal-routes-resolve",
  "core-boundaries-and-no-new-compatibility-duplicate",
  "illustrative-durable-ack-does-not-skip-gaps",
  "illustrative-local-commit-and-external-unknown",
  "illustrative-generation-and-side-effect-order"
];

test('actual final dist satisfies all eleven service-protocol oracles without overlay',async t=>{
  let result,report,guardError;
  try {
    // Do not run a changed/unreviewed verifier. All eleven subtests still report
    // the guard failure rather than disappearing behind an early skipped run.
    for(const [name,expected] of Object.entries(dependencySha256))
      assert.equal(shaFile(path.join(fixtures,name)),expected,`Fixture changed: ${name}`);
    assert.equal(shaFile(verifier),sourceVerifierSha256);
    assert.equal(shaFile(path.join(fixtures,'records.json')),sourceRecordsSha256);
    result=spawnSync(process.execPath,[ninthExecutablePath(verifier),'--dist',finalDist,'--mode','final'],{
      cwd:siteRoot,encoding:'utf8',timeout:60_000,maxBuffer:4*1024*1024,
    });
    assert.ifError(result.error);
    assert.equal(result.signal,null,`Verifier terminated by ${result.signal}`);
    assert.equal(result.stderr,'',`Unexpected verifier stderr: ${result.stderr}`);
    report=JSON.parse(result.stdout);
    assert.equal(report.mode,'final');
    assert.equal(report.dist,finalDist);
    assert.equal(report.recordsSha256,sourceRecordsSha256);
    assert.equal(report.verifierSha256,ninthExecutionHash("tests/fixtures/service-protocol/verify-service-protocol.mjs",sourceVerifierSha256));
    assert.equal(report.siteWrites,0);
    assert.equal(report.total,11);
    assert.deepEqual(report.checks.map(c=>c.name),oracleNames,'All eleven oracles must execute exactly once and in order');
  } catch(error) { guardError=error; }

  for(const [i,name] of oracleNames.entries()) {
    await t.test(name,()=>{
      assert.ifError(guardError);
      const check=report.checks[i];
      assert.equal(check.name,name);
      assert.equal(check.status,'passed',check.error||name);
      if(name==='three-exact-leaf-guards') {
        assert.equal(check.leaves,3);
        assert.equal(check.stagedInMemory,0,'Final acceptance must not overlay answer leaves');
        assert.equal(check.alreadyApplied,3);
        assert.equal(check.siteWrites,0);
      }
      if(name==='two-approved-authored-appends') {
        assert.equal(check.expectedAppends,2);
        assert.equal(check.stagedInMemory,0,'Final acceptance must not append questions in memory');
        assert.equal(check.alreadyApplied,2);
      }
      if(name==='old-identity-prefix-is-unchanged') assert.equal(check.oldQuestionsChecked,34);
      if(name==='agent5-only-owned-six-block-span-changed') {
        assert.equal(check.changedSourceBlocks,6);
        assert.equal(check.otherBytesPreserved,true);
        assert.equal(check.laterWorkflowMigrationVerified,true);
        assert.equal(check.migrationSummary.oldWorkflowSourceBlocks,247);
        assert.equal(check.migrationSummary.oldWorkflowWordings,151);
        assert.equal(check.migrationSummary.explicitDestinationRemaps,246);
        assert.equal(check.migrationSummary.conditionReviews,68);
        assert.equal(check.migrationSummary.physicalDelayAndSensorErrorRestored,true);
      }
      if(name==='all322-old-semantic-blocks-have-exact-destinations') assert.equal(check.mappedBlocks,322);
      if(name==='all20-variants-plus-inline-duplex-are-mapped') {
        assert.equal(check.oldVariants,20);
        assert.equal(check.remainingEquivalentVariants,14);
      }
      if(name==='html-anchors-and-all-internal-routes-resolve') assert.equal(check.resolvedRoutes,23);
      if(name==='core-boundaries-and-no-new-compatibility-duplicate') {
        assert.equal(check.newProtobufDuplicates,0);
        assert.equal(check.publicExternalReferences,0);
      }
    });
  }
  assert.ifError(guardError);
  assert.equal(report.passed,11);
  assert.equal(report.failed,0);
  assert.equal(report.actualFinalDistAcceptance,true);
  assert.equal(result.status,0,'Final-mode verifier must exit successfully');
});

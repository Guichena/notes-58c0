import {ninthExecutablePath,ninthExecutionHash} from './fixtures/ninth-small-repairs/verify-reference.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Resolve the installed test's own site, never the proposal package or process cwd.
const root=fileURLToPath(new URL('../',import.meta.url));
const fixture=path.join(root,'tests/fixtures/agent-foundations');
const dist=path.join(root,'dist');
const reconciliationContract=JSON.parse(await readFile(path.join(fixture,'reconciliation-contract.json'),'utf8'));

test('actual final dist preserves Agent foundation answers, authored entries and all source destinations',async()=>{
 const temporary=await mkdtemp(path.join(tmpdir(),'final-agent-foundations-'));
 try{
  const reportFile=path.join(temporary,'verification.json');
  const child=spawnSync(process.execPath,[ninthExecutablePath(path.join(fixture,'verify-final-dist.mjs')),'--mode','final','--dist',dist,'--out',reportFile],{cwd:root,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
  let report;
  try{report=JSON.parse(await readFile(reportFile,'utf8'));}catch(error){assert.fail('Verifier did not produce a readable temporary report: '+error.message+'\n'+(child.error?.message??'')+'\n'+child.stdout+'\n'+child.stderr);}
  const diagnostic=JSON.stringify({error:child.error?.message,status:child.status,signal:child.signal,failedChecks:report.failedChecks,failures:report.failures?.slice(0,12)},null,2);
  assert.equal(child.status,0,diagnostic);
  assert.equal(child.signal,null,diagnostic);
  assert.equal(report.status,'passed',diagnostic);
  assert.equal(report.mode,'final');
  assert.equal(path.resolve(report.dist),path.resolve(dist),'Must verify actual installed site/dist');
  assert.equal(report.actualFinalDistValidated,true);
  assert.equal(report.preflightUsesInMemoryProposalOverlay,false,'A proposal overlay is not final acceptance');
  assert.equal(report.siteFilesModified,false);
  assert.equal(report.failedChecks,0);
  assert.equal(report.phase4PhysicalConditionRepairVerified,true);
  assert.equal(report.tests.filter(row=>row.name==='phase4 only exact physical condition addition'&&row.passed).length,1);
  assert.deepEqual(report.existingBodyDrift,[]);
  assert.ok(Number.isInteger(report.checks)&&report.checks>=3000,'All preservation checks must execute');
  assert.equal(report.tests.length,report.checks);
  assert.ok(report.tests.every(row=>row.passed===true));
  const count=prefix=>report.tests.filter(row=>row.name.startsWith(prefix)).length;
  assert.equal(count('actual after leaf '),2);
  assert.equal(count('exact compiled current entry '),4,'Full exact expected entries remain enforced, including number and style fields');
  assert.equal(count('reviewed existing body exact '),reconciliationContract.existingQuestionDestinationCount);
  assert.equal(count('reviewed existing document exact '),reconciliationContract.existingHtmlDestinationCount);
  assert.equal(count('approved append exact answer '),reconciliationContract.approvedAppendDestinationCount);
  assert.equal(count('approved append stable index and exact question '),reconciliationContract.approvedAppendDestinationCount);
  assert.equal(count('original tool witness exact '),19);
  assert.equal(count('dependency old witness exact toolcall/'),25);
  assert.equal(count('dependency old witness exact architecture/'),42);
  assert.equal(count('architecture original source block exact '),42);
  assert.equal(count('explicit dependency leaf exact '),6);
  assert.equal(count('dependency public archive exact '),1);
  assert.ok(report.tests.some(row=>row.name==='approved runtime compiled rebase only one leaf'&&row.passed));
  assert.equal(count('old tool witness has explicit substantive destinations '),19);
  assert.equal(count('phase2 whole final entry exact '),2);
  assert.equal(count('phase2 original complete question objects prefix exact '),2);
  assert.equal(report.phase2RuntimeFinalCount,8);
  assert.equal(report.phase2CollaborationFinalCount,7);
  assert.equal(count('fifth old witness exact multi/'),23);
  assert.equal(count('fifth old witness exact roles/'),57);
  assert.equal(count('fifth explicit dependency leaf exact '),9);
  assert.equal(count('fifth complete old dependency body prefix '),5);
  assert.equal(count('fifth final compiled composite exact '),2);
  assert.equal(count('fifth old complete objects prefix stable '),2);
  assert.equal(count('fifth appended scenario exact object '),2);
  assert.equal(count('fifth collaboration appended exact object '),2);
  assert.equal(report.fifthOldMultiWitnessesReconciled,23);
  assert.equal(report.fifthOldRolesWitnessesReconciled,57);
  assert.equal(count('preserved source text and HTML hash '),550);
  assert.equal(count('all destination keys resolve '),550);
  assert.equal(count('excluded original retained in public archive '),2);
  assert.ok(report.tests.some(row=>row.name==='exact 21 stable new question IDs'));
  assert.ok(report.tests.some(row=>row.name==='482 source-wording records preserved'));
  assert.ok(report.routeChecks.length>0&&report.routeChecks.every(route=>route.exists));
 }finally{await rm(temporary,{recursive:true,force:true});}
});

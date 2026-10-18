import {ninthExecutablePath,ninthExecutionHash} from './fixtures/ninth-small-repairs/verify-reference.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Once installed, resolve this test's own site, independent of the caller's cwd.
const site=fileURLToPath(new URL('../',import.meta.url));
const dist=path.join(site,'dist');
const fixture=path.join(site,'tests/fixtures/skill-boundaries');

test('actual final dist preserves Skill boundaries, new questions and every mapped semantic block',async()=>{
 const temporary=await mkdtemp(path.join(tmpdir(),'final-skill-boundaries-'));
 try{
  const reportFile=path.join(temporary,'verification.json');
  const child=spawnSync(process.execPath,[ninthExecutablePath(path.join(fixture,'verify-final-dist.mjs')),'--mode','final','--dist',dist,'--out',reportFile],{cwd:site,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
  let report;
  try{report=JSON.parse(await readFile(reportFile,'utf8'));}catch(error){assert.fail('Verifier did not produce a readable temporary report: '+error.message+'\n'+(child.error?.message??'')+'\n'+child.stdout+'\n'+child.stderr);}
  const diagnostic=JSON.stringify({error:child.error?.message,status:child.status,signal:child.signal,failedChecks:report.failedChecks,failures:report.failures?.slice(0,12)},null,2);
  assert.equal(child.status,0,diagnostic);
  assert.equal(child.signal,null,diagnostic);
  assert.equal(report.status,'passed',diagnostic);
  assert.equal(report.mode,'final');
  assert.equal(path.resolve(report.dist),path.resolve(dist),'Must inspect the installed site actual dist');
  assert.equal(report.actualFinalDistValidated,true);
  assert.equal(report.preflightUsesInMemoryProposalOverlay,false,'Overlay preflight cannot count as final acceptance');
  assert.equal(report.siteFilesModified,false);
  assert.equal(report.failedChecks,0);
  assert.ok(Number.isInteger(report.checks)&&report.checks>=1500,'All semantic preservation checks must run');
  assert.equal(report.tests.length,report.checks,'Full check inventory must be present');
  assert.ok(report.tests.every(row=>row.passed===true));
  const count=prefix=>report.tests.filter(row=>row.name.startsWith(prefix)).length;
  assert.equal(count('Actual applied after '),11,'All exact guarded leaf changes must be present');
  assert.equal(count('Actual compiled authored question '),2,'Exact actual compiler outputs must be present');
  assert.equal(count('Appended stable index '),2);
  assert.equal(count('Exact original source '),310);
  assert.equal(count('Explicit semantic destinations '),310);
  assert.equal(count('Substantive section retained '),45);
  assert.equal(count('Append preserves canonical original '),8);
  assert.ok(count('Actual semantic coverage ')>=310);
  assert.ok(count('Link from ')>0);
  for(const name of ['All 13 original question identities stay at original indexes','All 310 source blocks accounted','All 197 original variants accounted'])assert.ok(report.tests.some(row=>row.name===name&&row.passed));
 }finally{await rm(temporary,{recursive:true,force:true});}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
const site=fileURLToPath(new URL('../',import.meta.url));
const fixtures=join(site,'tests/fixtures/remaining-practice-defects');
test('actual final dist: mature retention, shared JSON budget, already-waiting wake paths and selected shard',()=>{
 const run=spawnSync(process.env.PYTHON||'python3',[join(site,'tests/fixtures/interruption-observation/remaining_practice.py'),'--dist',resolve(site,'dist'),'--fixtures',fixtures],{encoding:'utf8',timeout:120000,maxBuffer:5*1024*1024});
 assert.equal(run.status,0,run.stdout+'\n'+run.stderr);const result=JSON.parse(run.stdout);
 assert.equal(result.status,'PASS_EXPLICIT_DIST_ONLY');assert.equal(result.guardedLeaves,7);
 assert.equal(result.sql.liveMySQL,false);assert.ok(result.java.some(s=>s.includes('JsonBudgetOracle PASS 9711')));
 console.log(run.stdout);
});

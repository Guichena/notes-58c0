const JOINT_SOURCE_URL=new URL("../../tenth-low-coupling/bridged/verify-ninth-source-transitions.mjs",import.meta.url);
const NINTH_ORIGINAL_URL=new URL('../../ninth-small-repairs/verify-source-transitions.mjs',JOINT_SOURCE_URL);
import {tenthSourceText} from './tenth-reference.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../../../',NINTH_ORIGINAL_URL),sha=b=>createHash('sha256').update(b).digest('hex');
const proof=JSON.parse(fs.readFileSync(new URL('./source-transitions.json',NINTH_ORIGINAL_URL),'utf8'));
export function verifyRow(r){
 assert.equal(sha(r.before),r.beforeSha256);assert.equal(sha(r.after),r.afterSha256);
 const before=Buffer.from(r.before),parts=[];let pos=0;
 for(const e of r.edits){assert.ok(e.beforeStartByte>=pos);assert.ok(e.beforeEndByte>=e.beforeStartByte);assert.equal(before.subarray(e.beforeStartByte,e.beforeEndByte).toString(),e.before);parts.push(before.subarray(pos,e.beforeStartByte),Buffer.from(e.after));pos=e.beforeEndByte;}
 parts.push(before.subarray(pos));assert.equal(Buffer.concat(parts).toString(),r.after,'complete exact reviewed source reconstruction');
}
export function verifySources(){
 const seen=new Set();
 for(const r of proof.clones){verifyRow(r);assert.ok(!seen.has(r.target));seen.add(r.target);assert.ok(r.originalTarget.startsWith('tests/fixtures/'));assert.equal(fs.readFileSync(new URL(r.originalTarget,root),'utf8'),r.before,'immutable original executable '+r.originalTarget);assert.equal(fs.readFileSync(new URL(r.target,root),'utf8'),r.after,'exact current bridge '+r.target);}
 for(const r of proof.replacements){verifyRow(r);assert.ok(!r.target.startsWith('tests/fixtures/'));assert.ok(!seen.has(r.target));seen.add(r.target);assert.equal(fs.readFileSync(new URL(r.target,root),'utf8'),tenthSourceText(r.target,r.after),'exact installed source transition '+r.target);}
 const altered=structuredClone(proof.clones[0]);altered.after+='\n// unreviewed';assert.throws(()=>verifyRow(altered));const badEdit=structuredClone(proof.clones[0]);badEdit.edits[0].after+=' drift';assert.throws(()=>verifyRow(badEdit));
 return {clones:proof.clones.length,replacements:proof.replacements.length,originalFixtureWrites:0,negativeChecks:2};
}

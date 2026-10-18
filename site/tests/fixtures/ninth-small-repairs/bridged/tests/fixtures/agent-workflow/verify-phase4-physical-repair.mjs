const NINTH_ORIGINAL_URL=new URL("../../../../../agent-workflow/verify-phase4-physical-repair.mjs",import.meta.url);
import assert from 'node:assert/strict';
import {eighthLeaf} from '../eighth-reconciliation/verify-dependencies.mjs';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const sha=s=>createHash('sha256').update(s).digest('hex');
const raw=fs.readFileSync(new URL('./phase4-physical-condition-reconciliation.json',NINTH_ORIGINAL_URL));
assert.equal(sha(raw),'512d4843d5becec35c8ad6f3554ce2d7c8f8b1bff80a2aeb26df20ea847c631e','reviewed single-string repair proof');
export const physical=JSON.parse(raw);
assert.equal(physical.entryId,'ai-agent-5');assert.deepEqual(physical.path,['items',3,'a']);
assert.equal(physical.beforeSha256,'1b4a30e17e0ff32e6fa74b7d8771c9bc7d8b28c616b1e01f765240d7e408b1f5');
assert.equal(physical.afterSha256,'6fcee17c3e6ed8753810221308a4562d36c91154cdf0856bf49b0f8a9c29f9de');
assert.equal(sha(physical.beforeBody),physical.beforeSha256);assert.equal(sha(physical.afterBody),physical.afterSha256);
assert.equal(physical.beforeBody.split(physical.oldExactSubstring).length,2);
assert.equal(physical.oldExactSubstring,'独立设计感知、执行器、安全限制、断网恢复和紧急停止');
assert.equal(physical.newExactSubstring,'独立设计感知、执行器、安全限制、断网恢复、延迟与传感器错误处理和紧急停止');
assert.equal(physical.afterBody,physical.beforeBody.replace(physical.oldExactSubstring,physical.newExactSubstring));
assert.equal(physical.newExactParagraph,physical.oldExactParagraph.replace(physical.oldExactSubstring,physical.newExactSubstring));
assert.ok(physical.beforeBody.includes(physical.oldExactParagraph));assert.ok(physical.afterBody.includes(physical.newExactParagraph));
const sourceRaw=fs.readFileSync(new URL('./source-block-map.json',NINTH_ORIGINAL_URL));
assert.equal(sha(sourceRaw),physical.sourceBlockMapSha256);assert.deepEqual(JSON.parse(sourceRaw).blocks[47],physical.sourceBlock47);
assert.ok(physical.sourceBlock47.sourceText.includes('断网、延迟、传感器错误和紧急停止'));
assert.equal(sha(fs.readFileSync(new URL('./variant-map.json',NINTH_ORIGINAL_URL))),physical.variantMapSha256);
const originalWitness=JSON.parse(fs.readFileSync(new URL('./destinations.json',NINTH_ORIGINAL_URL))).destinations.roles.witnesses[1];
assert.deepEqual(originalWitness,physical.originalRolesWitness);assert.equal(originalWitness.html,physical.oldExactParagraph);assert.equal(sha(originalWitness.html),originalWitness.sha256);
const prefix=JSON.parse(fs.readFileSync(new URL('./fifth-workflow-after-prefix.json',NINTH_ORIGINAL_URL)));
assert.equal(prefix.composedRecord.after,physical.beforeBody);assert.equal(prefix.composedRecord.after,prefix.originalRecord.after+prefix.exactAppendixHtml);
assert.equal(Array.from(prefix.exactAppendixHtml).length,735);assert.equal(sha(prefix.exactAppendixHtml),prefix.appendixSha256);
assert.ok(physical.afterBody.endsWith(prefix.exactAppendixHtml));
export function assertPhysicalBody(actual){assert.equal(actual,eighthLeaf(physical.entryId,physical.path,physical.afterBody),'actual body must equal exact approved condition repair and eighth transition');return true;}
export function physicalHash(entryId,index,oldHash){
 if(entryId==='ai-agent-5'&&index===3&&oldHash===physical.beforeSha256)return physical.afterSha256;
 return oldHash;
}
export function physicalWitness(entryId,index,oldHtml){
 if(entryId==='ai-agent-5'&&String(index)==='3'&&oldHtml===physical.oldExactParagraph)return physical.newExactParagraph;
 return oldHtml;
}
export function physicalPrefix(entryId,index,oldPrefix){
 if(entryId!=='ai-agent-5'||index!==3)return oldPrefix;
 assert.equal(oldPrefix,prefix.originalRecord.after,'only the complete original workflow after may be rebased');
 return oldPrefix.replace(physical.oldExactSubstring,physical.newExactSubstring);
}

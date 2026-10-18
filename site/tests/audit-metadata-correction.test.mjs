import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {projectAuditMetadata} from '../scripts/audit-metadata-correction.mjs';
const source=JSON.parse(await readFile(new URL('../content/metadata.json',import.meta.url)));
test('audit card agrees with the reviewed multi-file capabilities; input and unrelated cards unchanged',()=>{
 const saved=JSON.stringify(source); const out=projectAuditMetadata(source);
 assert.equal(JSON.stringify(source),saved);
 assert.equal(out.HL.cards['ai-agent-6#9'].rows[1].cells[1],'补全、代码库理解、多文件修改与任务执行');
 for(const [key,card] of Object.entries(source.HL.cards)) if(key!=='ai-agent-6#9') assert.strictEqual(out.HL.cards[key],card);
 assert.deepEqual(out.HL.cards['ai-agent-6#9'].cols,source.HL.cards['ai-agent-6#9'].cols);
});
test('baseline bypass and drift fail closed',()=>{
 assert.strictEqual(projectAuditMetadata(source,{baselineTest:true}),source);
 const drift=structuredClone(source);drift.HL.cards['ai-agent-6#9'].title='changed';
 assert.throws(()=>projectAuditMetadata(drift),/comparison changed/);
 assert.throws(()=>projectAuditMetadata(projectAuditMetadata(source)),/comparison changed/);
});

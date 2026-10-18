import {eighthLeaf,eighthHash,eighthEntry,eighthQuestion,eighthReferenceQuestion,eighthSourceHash,eighthSourceText,eighthReasoningIncludes} from './fixtures/ninth-small-repairs/bridged/tests/fixtures/eighth-reconciliation/verify-dependencies.mjs';
// Independent acceptance tests: read the built artifacts, never import a projection helper.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const site=fileURLToPath(new URL('../',import.meta.url));
const dist=path.join(site,'dist');
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const entries=(await Promise.all((await readdir(path.join(dist,'data/chapters'))).filter(x=>x.endsWith('.json')).map(x=>json(path.join(dist,'data/chapters',x))))).flatMap(x=>x.entries);
const map=new Map(entries.map(x=>[x.id,x]));
const q=(id,i)=>{const e=map.get(id);assert.ok(e,id);assert.ok(e.items[i],id+'#'+i);return e.items[i];};
const hash=s=>createHash('sha256').update(s).digest('hex');
const fixture=await json(fileURLToPath(new URL('./fixtures/agent-answer-contracts/expected.json',import.meta.url)));
assert.equal(fixture.schemaVersion,1);
import {verifyMigration,migrationRecord,acceptedLeafHash,assertMigratedStructure} from './fixtures/ninth-small-repairs/bridged/tests/fixtures/agent-answer-contracts/verify-phase3-migration.mjs';
const migrationRaw=await readFile(new URL('./fixtures/agent-answer-contracts/phase3-migration-reconciliation.json',import.meta.url),'utf8');
assert.equal(hash(migrationRaw),'1ade703eae8f6c0aa03068dde795cab3be126b25bccfc88f1da2fb5ebbc823a9','exact reviewed migration evidence');
const migration=JSON.parse(migrationRaw);
assert.equal(hash(await readFile(new URL('./fixtures/agent-answer-contracts/expected.json',import.meta.url),'utf8')),migration.originalExpectedSha256,'unchanged historical fixture');
const snapshots=fixture.snapshots;
const expectedLeaves=fixture.expectedLeaves;
const get=(o,p)=>p.reduce((a,k)=>a[k],o);

test('six stable question identities and all non-answer/lead fields remain intact',()=>{
 assert.equal(snapshots.length,6);
 for(const {entryId,index,item} of snapshots){
  const now=q(entryId,index);
  assert.deepEqual({...now,a:null,lead:null},{...eighthQuestion(entryId,index,item),a:null,lead:null},entryId+'#'+index);
  assert.equal(Object.keys(now).join('|'),Object.keys(item).join('|'));
 }
});
test('all eight corrected built leaves have exact accepted hashes',()=>{
 assert.equal(expectedLeaves.length,8);
 for(const r of expectedLeaves){
  assert.equal(hash(get(map.get(r.entryId),r.path)),acceptedLeafHash(migration,r),r.entryId+' '+r.path.join('.'));
 }
});
test('arbitration lead states evidence and decision exit, not a universal conflict cause',()=>{
 const x=q('ai-agent-5',6);
 assert.match(x.lead,/先核对事实、对象与版本/);
 assert.match(x.lead,/证据核验和裁决出口/);
 assert.doesNotMatch(x.lead,/本质是缺裁决/);
 assert.match(x.a,/仲裁 Agent 不能凭身份制造事实/);
 assert.equal(hash(x.a),migrationRecord(migration,'ai-agent-5',6).afterSha256);
 assert.equal(hash(migrationRecord(migration,'ai-agent-5',6).before),snapshots.find(s=>s.entryId==='ai-agent-5').answerBeforeSha256);
});
test('latency lead preserves quality and distinguishes perceived wait from completion',()=>{
 const x=q('ai-agent-7',3);
 assert.doesNotMatch(x.lead,/少想|短想|模型侧少想/);
 assert.match(x.lead,/质量与安全门槛/);
 assert.match(x.lead,/无效轮次与无关输入/);
 assert.match(x.a,/吞吐与资源占用、用户感知等待/);
 assert.match(x.a,/异步化或流式并不自动缩短任务完成时间/);
 assert.match(x.a,/而不是一概让模型少推理/);
 assert.match(x.a,/任务是否更快完成仍要单独测量/);
});
test('invalid event frames and valid failure terminal events have different cursor behavior',()=>{
 const x=q('ai-agent-7',7).a;
 assert.doesNotMatch(x,/错误帧不推进游标/);
 assert.match(x,/无法验证或无法应用的坏帧不推进应用游标/);
 assert.match(x,/合法 RunError 失败终态仍须按序应用并推进游标/);
 assert.match(x,/持久终态保持可查询/);
 assert.match(x,/批次持久成功后才向客户端发布/);
 assert.match(x,/不是给所有 AG-UI 实现增加强制规范/);
});
test('model error, guardrail consequences and trusted host identity remain distinct',()=>{
 const x=q('ai-agent-8',5);
 assert.match(x.lead,/模型能力或生成误差/);
 assert.match(x.lead,/护栏负责限制后果/);
 assert.doesNotMatch(x.lead+x.a,/三类根因|缺用户 ID、资源 ID|模型就会自己补/);
 assert.match(x.a,/完善描述和 schema 也不能保证不再误选/);
 assert.match(x.a,/用户 ID、租户与权限身份由可信宿主从已认证上下文注入/);
 assert.match(x.a,/不能让模型猜填或覆盖/);
 assert.match(x.a,/应澄清或经授权查询/);
});
test('UNKNOWN recovery distinguishes pure computation, no-effect failure, endpoint idempotence and unresolved effects',()=>{
 const x=map.get(migration.unknownContractTarget.entryId).html; // Same exact contract assertions, now at the verified practice destination.
 assert.doesNotMatch(x,/只有第三类允许重新排队|无法核对，就保持UNKNOWN/);
 assert.match(x,/无外部副作用、输入固定的纯函数可在预算内重新计算/);
 assert.match(x,/失败无效果且旧请求以后也不会生效/);
 assert.match(x,/覆盖该操作与重试窗口的幂等保证/);
 assert.match(x,/沿用相同operationId和原载荷重试/);
 assert.match(x,/不可核实且不满足安全重做条件的副作用保持UNKNOWN/);
 assert.match(x,/局部内存模型仍只实现第三类核对后重排/);
 assert.match(x,/其他分支需另行实现和测试/);
 // Preserve the intentionally narrower experiment and its operational limits.
 for(const fact of ['最多领取3次','47 个明确断言','40 个 HTTP 与进程断言','不能暴露到公网','不保证计算只发生一次']) assert.ok(x.includes(fact),fact);
});
test('failed trajectories are diagnostic cases, corrected outputs are SFT targets, and preference pairs are labeled',()=>{
 const x=q('ai-agent-9',1).a;
 assert.match(x,/用于诊断和评测的困难样本/);
 assert.match(x,/原始失败轨迹不能原样当作 SFT 正例/);
 assert.match(x,/经纠正和验收的合格动作与输出/);
 assert.match(x,/有明确优劣标注的配对样本/);
 assert.match(x,/正确拒答和纠正后的困难场景示范可成为 SFT 目标/);
 assert.match(x,/按用户、任务或时间隔离训练与评测/);
});
test('all original structures remain exact or have exhaustive reviewed destination mappings',()=>{
 const patterns=[/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/g,/<pre\b[^>]*>[\s\S]*?<\/pre>/g,/<a\b[^>]*>[\s\S]*?<\/a>/g,/<details\b[^>]*>[\s\S]*?<\/details>/g];
 for(const {entryId,index,preservedStructure} of snapshots){
  const x=q(entryId,index);
  if(migrationRecord(migration,entryId,index)){assertMigratedStructure(migration,{entryId,index,preservedStructure});continue;}
  patterns.forEach((re,i)=>{
   const values=x.a.match(re),expected=preservedStructure[i];
   assert.equal(values?.length??0,expected.count,entryId+'#'+index+' '+expected.name+' count');
   assert.equal(hash(JSON.stringify(values)),expected.sha256,entryId+'#'+index+' '+expected.name+' hash');
  });
 }
});

test('phase3 relocations retain all source evidence, structures and exact old-object prefixes',()=>{
 const result=verifyMigration(map,migration,fixture);
 assert.equal(result.sourceBlocks,170);assert.equal(result.conflictSegments,10);assert.equal(result.structures,62);assert.equal(result.prefixes,3);
});

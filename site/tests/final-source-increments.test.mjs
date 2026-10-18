import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const catalog=JSON.parse(await readFile(new URL('../dist/data/catalog.json',import.meta.url),'utf8')),entries=new Map();
for(const chunk of new Set(catalog.entries.map(e=>e._chunk)))for(const e of JSON.parse(await readFile(new URL('../dist/'+chunk,import.meta.url),'utf8')).entries)entries.set(e.id,e);
test('MCP optional capabilities stay explicitly version-scoped and do not imply sandbox or model access',()=>{
 const a=entries.get('own-tools-protocol').items[0].a,start=a.indexOf('2025-11-25 的 Sampling'),end=a.indexOf('3.3 2026-07-28');assert.ok(start>0&&end>start);const section=a.slice(start,end);
 for(const x of ['Sampling','Roots','Completion','roots/list','completion/complete','客户端','用户拒绝','不会给进程套上沙箱','不是模型生成答案','2026-07-28已弃用Roots和Sampling'])assert.ok(section.includes(x),x);
 assert.ok(a.includes('server/discover'));assert.ok(a.includes('initialize'));
});
test('scheduler comparison preserves clustering and practical library versus control-plane tradeoff',()=>{
 const a=entries.get('bg-分布式-4').items[0].a;
 for(const x of ['Quartz 和 XXL-JOB 怎么选','JDBCJobStore','可持久化并配置集群','调度中心与执行器分开','3.3.1','业务最终生效'])assert.ok(a.includes(x),x);
});
test('Skill deployability isolates undeclared authoring state without removing declared case history',()=>{
 const a=entries.get('ai-agent-9').items[8].a;
 for(const x of ['没有编写时额外解释的新会话','部署合同声明','未打包依赖','多轮 Case 仍按规定恢复必要历史','不能因一次新会话成功就声称可稳定部署','高风险与历史严重事故切片'])assert.ok(a.includes(x),x);
});

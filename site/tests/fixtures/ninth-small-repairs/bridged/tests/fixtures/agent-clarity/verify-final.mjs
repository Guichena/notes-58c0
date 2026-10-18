const NINTH_ORIGINAL_URL=new URL("../../../../../agent-clarity/verify-final.mjs",import.meta.url);
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';import{fileURLToPath}from'node:url';
import {eighthLeaf} from '../eighth-reconciliation/verify-dependencies.mjs';
const here=path.dirname(fileURLToPath(NINTH_ORIGINAL_URL));assert.equal(process.argv.length,4);assert.equal(process.argv[2],'--dist');const dist=path.resolve(process.argv[3]);const records=JSON.parse(fs.readFileSync(path.join(here,'records.json'))).records;const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const es=new Map();for(const f of fs.readdirSync(path.join(dist,'data/chapters')))if(f.endsWith('.json'))for(const e of JSON.parse(fs.readFileSync(path.join(dist,'data/chapters',f))).entries)es.set(e.id,e);
assert.equal(records.length,9);for(const r of records){assert.equal(sha(r.before),r.beforeSha256);assert.equal(sha(r.after),r.afterSha256);let e=es.get(r.entryId);assert.ok(e);assert.equal(e.items[r.path[1]].q,r.questionGuard);for(const k of r.path)e=e[k];assert.equal(e,eighthLeaf(r.entryId,r.path,r.after),`${r.entryId}/${r.path.join('/')} not applied`);for(const m of r.before.matchAll(/(?:href|id)="[^"]*"/g))assert.ok(r.after.includes(m[0]),'lost link/anchor');}
const state=es.get('ai-agent-4').items[5].a,blackbox=es.get('ai-agent-4').items[6].a;
assert.ok(state.indexOf('一组可解释的状态')<state.indexOf('会话表和消息表具体存什么'));
assert.ok(state.indexOf('用户又发来一句话怎么办')<state.indexOf('会话表和消息表具体存什么'));
for(const t of ['client_message_id','next_message_seq','content_version','WAITING_APPROVAL','Operation','Outbox','mailbox','Future','client_message_id','thread_id'])assert.ok(state.includes(t),t);
assert.ok(!state.includes('全部完成后再落'));assert.ok(state.includes('不能要求所有步骤都跑完才报告失败'));
for(const t of ['UNKNOWN','退出码','心跳','回执','CPU','最近产物','事件序号'])assert.ok(blackbox.includes(t));
assert.ok(!es.get('ai-agent-2').items[10].a.includes('不要把 CLI 和 MCP 讲成替代关系'));
for(const k of ['lead','a'])assert.ok(!es.get('ai-agent-2').items[12][k].includes('持续重规划'));
console.log(JSON.stringify({passed:true,leaves:9,actualDist:dist,overlays:0}));

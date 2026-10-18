import {eighthLeaf,eighthHash,eighthEntry,eighthQuestion,eighthReferenceQuestion,eighthSourceHash,eighthSourceText,eighthReasoningIncludes} from '../fixtures/ninth-small-repairs/bridged/tests/fixtures/eighth-reconciliation/verify-dependencies.mjs';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const sha=x=>createHash('sha256').update(x).digest('hex');
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const blocks=s=>[...s.matchAll(/<(p|h2|h3|h4|li|summary)\b[^>]*>[\s\S]*?<\/\1>/g)].map(x=>x[0]);
export async function verifyFinal({dist,fixtures}){
 const records=(await read(join(fixtures,'records.json'))).records;
 const maps=await read(join(fixtures,'paragraph-destinations.json'));
 const variants=(await read(join(fixtures,'variant-destinations.json'))).variants;
 const identities=(await read(join(fixtures,'identity-baseline.json'))).entries;
 const all=new Map();
 for(const f of await readdir(join(dist,'data/chapters'))){if(!f.endsWith('.json'))continue;for(const e of (await read(join(dist,'data/chapters',f))).entries){assert.ok(!all.has(e.id),'duplicate entry '+e.id);all.set(e.id,e);}}
 assert.equal(records.length,5);assert.equal(records.filter(x=>x.path.at(-1)==='a').length,4);
 const permitted=new Set(['ai-agent-3:2:a','ai-agent-3:6:a','ai-agent-3:3:a','ai-agent-2:2:a','ai-agent-2:2:lead']);
 for(const r of records){assert.ok(permitted.has(r.entryId+':'+r.itemIndex+':'+r.path.at(-1)));assert.equal(sha(r.before),r.beforeSha256);assert.equal(sha(r.after),r.afterSha256);const it=all.get(r.entryId)?.items[r.itemIndex];assert.ok(it,'missing original question');assert.equal(it.id??null,r.questionId??null);assert.ok(it[r.path.at(-1)]===eighthLeaf(r.entryId,r.path,r.after),'UNAPPLIED_OR_CHANGED '+r.entryId+'#'+r.itemIndex+'.'+r.path.at(-1));}
 for(const e of identities){const actual=all.get(e.entryId);assert.ok(actual);for(const q of e.items){assert.equal(actual.items[q.index]?.q,q.q,'question moved or rewritten');assert.equal(actual.items[q.index]?.id??null,q.id??null);for(const [field,value]of Object.entries(q.unchangedFields))assert.deepEqual(actual.items[q.index][field],value,'unapproved metadata change '+field);}}
 for(const r of records.filter(x=>x.path.at(-1)==='a')){
  const bs=blocks(r.before),ms=maps.maps.filter(m=>m.sourceEntryId===r.entryId&&m.sourceItemIndex===r.itemIndex);
  assert.equal(ms.length,bs.length,'source block cardinality');assert.equal(new Set(ms.map(x=>x.sourceIndex)).size,bs.length);
  for(const m of ms){assert.equal(m.sourceHtml,bs[m.sourceIndex]);assert.equal(sha(m.sourceHtml),m.sourceSha256);assert.ok(m.destinations.length);}
  const origAnchors=[...r.before.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);for(const id of origAnchors)assert.ok(r.after.includes('id="'+id+'"'),'lost anchor '+id);
  assert.doesNotMatch(r.after,/<pre\b/,'no theory code dump');
  for(const m of r.after.matchAll(/href="#\/e\/([^"/]+)(?:\/([^"]+))?"/g)){const e=all.get(decodeURIComponent(m[1]));assert.ok(e,'broken entry link '+m[1]);if(m[2]){const q=decodeURIComponent(m[2]);assert.ok(/^\d+$/.test(q)?e.items?.[Number(q)]:e.items?.some(x=>x.id===q),'broken question link '+m[0]);}}
 }
 const tableSource=records.find(x=>x.entryId==='ai-agent-3'&&x.itemIndex===2&&x.path.at(-1)==='a').before;
 const rows=[...tableSource.matchAll(/<tr\b[\s\S]*?<\/tr>/g)].map(x=>x[0]);assert.equal(maps.tableRows.length,rows.length);for(const [i,m]of maps.tableRows.entries())assert.equal(m.sourceHtml,rows[i]);
 for(const m of [...maps.maps,...maps.tableRows])for(const d of m.destinations){assert.equal(sha(d.html),d.sha256);assert.ok(eighthReasoningIncludes(all,d.entryId,d.itemIndex,d.html),'missing mapped destination');}
 for(const v of variants){const r=records.find(r=>r.entryId===v.sourceEntryId&&r.itemIndex===v.sourceItemIndex&&r.path.at(-1)==='a');assert.equal(blocks(r.before)[v.sourceBlockIndex],v.sourceHtml);assert.equal(sha(v.sourceHtml),v.sourceSha256);assert.equal(sha(v.destinationHtml),v.destinationSha256);assert.ok(eighthReasoningIncludes(all,v.destinationEntryId,v.destinationItemIndex,v.destinationHtml));}
 const loop=all.get('ai-agent-3').items[6].a,react=all.get('ai-agent-3').items[2].a,tool=all.get('ai-agent-2').items[2];
 for(const x of ['四类停止条件','目标已验收','需要等待','不能继续','无进展边界','终止工具','文本相似度','tenant, run, plan_revision','step_id','Lua','TTL','持久账本','UNKNOWN','两次明确购买','二乘二实验','无副作用的隔离工具 fixture','合法重复被误阻止','不确定区间','snapshotId/hash','同一业务操作 ID'])assert.ok(loop.includes(x),'missing loop condition '+x);
 for(const x of ['价值估计器','奖励模型','模型自报','独立测试','Checker','CodeAct','解释器','权限','总预算'])assert.ok(react.includes(x),'missing architecture distinction '+x);
 assert.ok(tool.lead.includes('受限代码'));assert.ok(tool.a.includes('训练'));assert.ok(tool.a.includes('2.0.1'));
 assert.match(react,/追问：CodeAct 会取代 Function Calling 吗？<\/h[34]><p class="md-p">不会。/);
 assert.match(react,/追问：一段代码组合十个动作，只算一步是不是更安全、更省预算？<\/h[34]><p class="md-p">模型交互轮数可能减少/);
 assert.match(tool.a,/没有做过工具专项微调，就完全不能调用工具吗？<\/h[34]><p class="md-p">不能这样判断。/);
 assert.ok(!loop.includes('副作用守卫要原子登记操作身份与结果：成功回执可复用'),'duplicated recovery pathway');
 assert.ok(loop.includes('操作身份与结果要原子登记'));assert.ok(loop.includes('任意 shell 脚本'));
 const planning=all.get('ai-agent-3').items[3].a;
 assert.ok(planning.includes('是否跨多次请求、是否组合工具是另一维度'));
 assert.ok(planning.includes('让外部结果影响下一步'));
 assert.ok(!planning.includes('CoT 以中间步骤组织求解；'),'duplicate CoT primer');

 return {status:'PASS_ACTUAL_FINAL_DIST',dist:resolve(dist),changedLeaves:records.length,sourceBlocks:maps.maps.length,tableRows:maps.tableRows.length,variants:variants.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2),get=n=>{const i=args.indexOf(n);return i>=0?args[i+1]:null;};
 const dist=get('--dist');if(!dist)throw Error('Explicit --dist pointing to an actual built dist is required; overlays are not supported.');
 const fixtures=get('--fixtures')||fileURLToPath(new URL('.',import.meta.url));
 try{console.log(JSON.stringify(await verifyFinal({dist:resolve(dist),fixtures:resolve(fixtures)}),null,2));}catch(e){console.error(e.stack);process.exitCode=1;}
}

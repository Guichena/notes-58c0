const INTERRUPTION_ORIGINAL_URL=new URL('../../helpers/agent-backend-relocation-verifier.mjs',import.meta.url);
import {interruptionAssetHash,interruptionRuntimePath} from './verify-reference.mjs';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
const sha=s=>createHash('sha256').update(s).digest('hex');
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const blocks=s=>[...s.matchAll(/<(p|h2|h3|h4|li|summary|pre|tr)\b[^>]*>[\s\S]*?<\/\1>/g)].map(m=>m[0]);
export async function verifyFinal({dist,fixtures}) {
 assert.ok(dist&&fixtures,'explicit actual dist and fixtures required');
 const R=(await json(join(fixtures,'records.json'))).records, M=(await json(join(fixtures,'paragraph-destinations.json'))).maps, V=(await json(join(fixtures,'variant-destinations.json'))).variants, I=(await json(join(fixtures,'identity-baseline.json'))).items;
 const E=new Map();for(const f of await readdir(join(dist,'data/chapters')))if(f.endsWith('.json'))for(const e of(await json(join(dist,'data/chapters',f))).entries){assert.ok(!E.has(e.id),'duplicate entry');E.set(e.id,e);}
 const catalog=await json(join(dist,'data/catalog.json'));
 const item=(e,n)=>{const it=E.get(e)?.items?.[n];assert.ok(it,`missing question ${e}/${n}`);return it;};
 const value=r=>r.path.reduce((x,k)=>x[k],E.get(r.entryId));
 assert.equal(R.length,5);const allowed=new Set(['ai-agent-5:0:a','ai-agent-5:0:lead','ai-agent-5:10:a','bg-redis-8:9:a','own-juc-coordination:6:a']);
 for(const r of R) {
  assert.ok(allowed.has(`${r.entryId}:${r.itemIndex}:${r.path[2]}`),'scope expansion');assert.deepEqual(r.path,['items',r.itemIndex,r.path[2]]);
  assert.equal(sha(r.before),r.beforeSha256);assert.equal(sha(r.after),r.afterSha256);assert.equal(sha(r.questionGuard),r.questionSha256);
  assert.equal(item(r.entryId,r.itemIndex).q,r.questionGuard);assert.equal(item(r.entryId,r.itemIndex).id??null,r.questionId??null);
  assert.ok(value(r)===r.after,`UNAPPLIED_OR_CHANGED ${r.entryId}/${r.itemIndex}/${r.path[2]}`);
  assert.ok(catalog.entries.some(e=>e.id===r.entryId),'missing catalog route');
  if(r.mode==='append-only-unique-detail')assert.ok(r.after.startsWith(r.before),'canonical existing answer changed');
  if(r.path[2]==='a')for(const m of r.before.matchAll(/\bid="([^"]+)"/g))assert.ok(r.after.includes('id="'+m[1]+'"'),'lost old anchor');
  for(const m of r.after.matchAll(/href="#\/e\/([^"/]+)(?:\/([^"]+))?"/g)) {
   const e=E.get(decodeURIComponent(m[1]));assert.ok(e||catalog.archivedRoutes?.[m[1]],'missing link '+m[0]);
   if(e&&m[2])assert.ok(/^\d+$/.test(m[2])?e.items?.[Number(m[2])]:e.items?.some(x=>x.id===decodeURIComponent(m[2])),'missing question link '+m[0]);
  }
 }
 for(const x of I)for(const[k,v]of Object.entries(x.unchangedFields))assert.deepEqual(item(x.entryId,x.itemIndex)[k],v,'identity/index/owned metadata changed '+x.entryId+'/'+x.itemIndex+'/'+k);
 const checkDest=d=>{assert.equal(sha(d.html),d.sha256);assert.ok(item(d.entryId,d.itemIndex).a.includes(d.html),'missing exact semantic witness '+d.entryId+'/'+d.itemIndex+'/'+d.key);};
 assert.equal(M.length,243);assert.equal(V.length,174);
 for(const n of[0,10]) {
  const r=R.find(x=>x.entryId==='ai-agent-5'&&x.itemIndex===n&&x.path[2]==='a'),bs=blocks(r.before),ms=M.filter(m=>m.sourceItemIndex===n);
  assert.equal(ms.length,bs.length);assert.deepEqual(ms.map(m=>m.sourceBlockIndex),bs.map((_,i)=>i));
  for(const m of ms){assert.equal(m.sourceHtml,bs[m.sourceBlockIndex]);assert.equal(sha(m.sourceHtml),m.sourceSha256);assert.ok(m.destinations.length);m.destinations.forEach(checkDest);}
 }
 for(const v of V){const r=R.find(x=>x.entryId===v.sourceEntryId&&x.itemIndex===v.sourceItemIndex&&x.path[2]==='a');assert.equal(blocks(r.before)[v.sourceBlockIndex],v.sourceHtml);assert.equal(sha(v.sourceHtml),v.sourceSha256);assert.equal(v.destination.html,'<li>'+v.sourceHtml.replace(/^<[^>]+>|<\/[^>]+>$/g,'')+'</li>');checkDest(v.destination);}
 const intro=item('ai-agent-5',0).a,stuck=item('ai-agent-5',10).a,queue=item('own-juc-coordination',6).a,redis=item('bg-redis-8',9).a;
 assert.doesNotMatch(intro,/SCRIPT KILL|BUSY|cursor\/批次|OpenResty/,'Redis internals remain in Agent introduction');
 assert.doesNotMatch(stuck,/Ring Buffer|None\/False\/0|head 指针的设计|固定容量队列，支持 push\/pop/,'queue interview remains in stuck-agent answer');
 assert.doesNotMatch(intro+stuck,/<a href="https?:\/\//,'public source-reference footer reintroduced');
 for(const s of['去中心化协商','独立验收','同一个模型串行切换角色','S + P/N','inputCommit','planVersion','UNKNOWN','operationId','租约/epoch'])assert.ok(intro.includes(s),'lost Agent boundary '+s);
 assert.ok(stuck.indexOf('错误分类决定恢复动作')<stuck.indexOf('Resilience4j 怎样落到 Java 调用链'));
 for(const s of['kPermissionDeny','不等于必须立即打开依赖熔断器','max_attempts=1','CompletionStage','Future.get(40','排队期间也消耗','进程重启','取消成功、取消请求已接收、远端结果未知'])assert.ok(stuck.includes(s),'lost recovery boundary '+s);
 for(const s of['插入只推进 tail 和 count，不移动 head','Java 实现禁止 null','Boolean false','仅有一个 head','容量为 1','notEmpty','notFull','closeable-ring-contract.zip'])assert.ok(queue.includes(s),'lost queue contract '+s);
 for(const s of['cursor/批次','整段原子快照','OpenResty','BUSY','脚本 SHA','p99'])assert.ok(redis.includes(s),'lost Redis unique detail '+s);
 const assets=(await json(join(fixtures,'asset-copy-manifest.json'))).files;
 const transition=await json(join(fixtures,'remaining-practice-reconciliation.json'));
 assert.equal(transition.schemaVersion,1);assert.equal(transition.assets.length,2);
 for(const change of transition.assets){const a=assets.find(a=>a.distRelativePath===change.distRelativePath);assert.ok(a,'unknown transitioned asset');assert.equal(a.sha256,change.beforeSha256,'historical asset contract drift');a.sha256=change.afterSha256;}
 for(const f of assets)assert.equal(sha(await readFile(join(dist,f.distRelativePath))),interruptionAssetHash(f.distRelativePath,f.sha256),'missing/changed real dist asset '+f.distRelativePath);
 const run=spawnSync(process.env.PYTHON||'python3',[interruptionRuntimePath(fixtures),'--dist',resolve(dist),'--fixtures',resolve(fixtures)],{encoding:'utf8',timeout:80000});
 assert.equal(run.status,0,'actual final-dist Java failed\n'+run.stdout+run.stderr);assert.match(run.stdout,/RingContractTest PASS 528/);assert.match(run.stdout,/CloseableRing OK/);
 return {status:'PASS_ACTUAL_FINAL_DIST',dist:resolve(dist),changedLeaves:R.length,sourceBlocks:M.length,variantOccurrences:V.length,appendOnlyCanonicals:2,javaAssertions:528,mpmcItems:4000,assets:assets.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2),get=k=>{const i=args.indexOf(k);return i<0?null:args[i+1];};if(!get('--dist'))throw Error('Explicit actual built --dist required. No synthetic final mode exists.');
 try{console.log(JSON.stringify(await verifyFinal({dist:resolve(get('--dist')),fixtures:resolve(get('--fixtures')||fileURLToPath(new URL('.',INTERRUPTION_ORIGINAL_URL)))}),null,2));}catch(e){console.error(e.stack);process.exitCode=1;}
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {readPracticeBoundaryCorrections,projectPracticeBoundaryCorrections as project} from '../scripts/practice-boundary-corrections.mjs';
import {projectInterviewVoiceReview} from '../scripts/interview-voice-review.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8'),json=async p=>JSON.parse(await read(p)),sha=x=>createHash('sha256').update(x).digest('hex');
const registry=await readPracticeBoundaryCorrections(),records=registry.postReviewRecords.filter(r=>r.review.purpose==='huang-reviewed-concept-batch');
const catalog=await json('dist/data/catalog.json'),byId=new Map();
for(const file of new Set(catalog.entries.map(e=>e._chunk)))for(const e of (await json('dist/'+file)).entries)byId.set(e.id,e);
const entries=catalog.entries.map(e=>byId.get(e.id)),prior=projectInterviewVoiceReview(entries,{schemaVersion:1,records},{reverse:true});
const expected=[
 ['huang-network-traceroute-boundaries','own-network-transport',10,'0cce3e4fc75c52f61585ffc53ae2dc54e766b243e0721f9b0e4283bec1a98fcc','0b1a751b044409a7369f7011bc67fe9389c47d28b9e8b9c23cba40158a9549d7',3],
 ['huang-os-mesi-basics','own-os-hardware',0,'fe27d5633d291438bdf3e1952c32701d921b7da7c152c5f73aa2fa48b60ebaee','207a307b107ba3223d41b0f4ad5660d0bb3233b8096055858e3eb417b665281b',3],
 ['huang-jvm-age-encoding','q-own-jvm-collectors',0,'6a4d5df34a88b92fdfc123092ee27d841780a13bfea2537502147f059e0db78c','4befef9f298be5db276af1c94d5a4f1fa964cfed57476f93f0c2298303532d5b',1],
 ['huang-spring-executable-jar','own-spring-boot',7,'bb21d82e015336881ba6dae81faaa7adc996d26c5ceb848bdbc18a9ece6c1f4d','9f1a7ceb1d257416e1112b62476721f2bc899133f6e1a8be334c5494fbc23c4f',2],
 ['huang-spring-aop-theory-crosslink','own-spring-mvc',3,'5b6ae2cdd9ef0c389c9a539416652e94c30938f946d7e5fe4add4c5ccf198adc','f1e80f412455fa323767a352e558bd70603d6489d33dc60638f2d4ec0b0948c0',1]
];
test('five approved insertions preserve the exact frozen registry and every previous answer byte',()=>{
 const previous={...registry,postReviewRecords:registry.postReviewRecords.filter(r=>r.review.purpose!=='huang-reviewed-concept-batch')};
 assert.equal(sha(JSON.stringify(previous)),'91cd9771cbc759a8368ee032267a8bac1a2cd9aa397385961d064d15100e4723');
 assert.deepEqual(records.map(r=>[r.review.proposalId,r.entryId,r.path[1],sha(r.before),sha(r.after),(r.insertion.insertHtml.match(/<p /g)||[]).length]),expected);
 for(const r of records){
  const {insertHtml,anchorHtml}=r.insertion;
  assert.equal(r.before.split(anchorHtml).length,2);assert.equal(r.after.split(insertHtml).length,2);
  assert.equal(r.after.replace(insertHtml,''),r.before);assert.equal(r.before.replace(anchorHtml,insertHtml+anchorHtml),r.after);
  assert.doesNotMatch(insertHtml,/<pre\b|<code\b|```/);
  assert.equal(byId.get(r.entryId).items[r.path[1]].a,r.after);
 }
 assert.deepEqual(projectInterviewVoiceReview(prior,{schemaVersion:1,records}),entries);
 const targets=new Set(records.map(r=>r.entryId+'#'+r.path[1]));
 for(const [i,e] of entries.entries()){
  const old=prior[i];assert.deepEqual({...e,items:undefined},{...old,items:undefined});
  if(e.items)for(const [j,q] of e.items.entries()){
   assert.deepEqual({...q,a:undefined},{...old.items[j],a:undefined});
   if(!targets.has(e.id+'#'+j))assert.equal(q.a,old.items[j].a);
  }
 }
});
test('traceroute keeps protocol, RTT, no-response and multipath interpretation boundaries',()=>{
 const s=records[0].insertion.insertHtml;
 for(const term of ['IPv4 的 TTL','IPv6 的 Hop Limit','UDP','ICMP 或 TCP','Windows tracert','不是相邻两跳间的单链路耗时','星号只表示','后续和目标却正常','ECMP','回程也可能与去程不同','授权范围内控制探测速率'])assert.ok(s.includes(term),term);
});
test('MESI keeps the conditional ownership example and hardware versus JMM boundary',()=>{
 const s=records[1].insertion.insertHtml;
 for(const term of ['基本MESI写回模型','同一一致性域','Modified','Exclusive','Shared','Invalid','也可能只剩本方一份','若写前仍保持E','E→M','完成对B等副本的失效','不要求每次修改都直达DRAM','happens-before','不能把MESI四态当作所有CPU'])assert.ok(s.includes(term),term);
});
test('JVM age distinguishes the versioned field, declaration default and collector policy',()=>{
 const s=records[2].insertion.insertHtml;
 for(const term of ['OpenJDK 21 HotSpot','4 位','0～15','声明默认值也是 15','参数声明范围包含 16','会饱和','不靠年龄位溢出','不表示每个对象恰好经历 15 次 GC'])assert.ok(s.includes(term),term);
 assert.ok(records[2].after.indexOf(s)>records[2].after.indexOf('在使用相应机制的 HotSpot 收集器中'));
 assert.ok(records[2].after.indexOf(s)<records[2].after.indexOf('年龄阈值为什么可能低于配置上限'));
});
test('Boot explains typical nested archive startup without a universal launcher name',()=>{
 const s=records[3].insertion.insertHtml;
 for(const term of ['典型的 Spring Boot','repackage','BOOT-INF/classes','BOOT-INF/lib','META-INF/MANIFEST.MF','Main-Class','Start-Class','类加载器','再调用应用的 main','不会自动递归加载','按 Boot 版本和插件配置核对'])assert.ok(s.includes(term),term);
 assert.doesNotMatch(s,/JarLauncher|PropertiesLauncher/);
});
test('single AOP link resolves through the real router and preserves destination supplement and transactions',async()=>{
 const s=records[4].after;assert.equal((s.match(/href="#\/e\/handwrite-55"/g)||[]).length,1);
 assert.equal(sha(byId.get('handwrite-55').supplementHtml),'12536d0413f8a6709d5c6e28d9e720e79a9e761ee822585a68870c10333383cd');
 assert.equal(sha(byId.get('own-spring-transactions').items[3].a),'ac5deeb15dac92686f80a82557f58b8823fe7e5bf1200087537d1883d424d96a');
 const routing=(await read('src/app/routing.js')).split('let renderSequence')[0];
 const route=JSON.parse(JSON.stringify(runInNewContext(routing+';parseHash()',{location:{hash:'#/e/handwrite-55'},TREE:{},HL_MODS:[],ALGO_ALIAS:{},DATA:{},byId,history:{replaceState(){throw Error('Unexpected rewrite');}}})));
 assert.deepEqual(route,{view:'entry',id:'handwrite-55',q:null});
});
test('stale inputs, changed identities and duplicate applications fail closed; baseline excludes additions',()=>{
 const original=project(entries,registry,{reverse:true});assert.deepEqual(project(original,registry),entries);
 for(const r of records)for(const key of ['a','q','id']){
  const drift=structuredClone(original);drift.find(e=>e.id===r.entryId).items[r.path[1]][key]+='drift';
  assert.throws(()=>project(drift,registry),/stale input|question identity drift/);
 }
 assert.throws(()=>project(entries,registry),/stale input/);
 const tampered=structuredClone(registry);tampered.postReviewRecords.at(-1).insertion.insertHtml+='changed';assert.throws(()=>project(original,tampered),/registry integrity/);
 assert.strictEqual(project(original,null,{baselineTest:true}),original);
});

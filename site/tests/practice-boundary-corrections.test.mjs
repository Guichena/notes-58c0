import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {readPracticeBoundaryCorrections,projectPracticeBoundaryCorrections as project,restoreBeforePracticeBoundary,projectPracticeBoundaryRuntime} from '../scripts/practice-boundary-corrections.mjs';
import {validatePriorityView,priorityQuestionView} from '../scripts/interview-priority-view.mjs';

const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const json=async p=>JSON.parse(await read(p));
const registry=await readPracticeBoundaryCorrections(),catalog=await json('dist/data/catalog.json');
const byId=new Map();
for(const file of new Set(catalog.entries.map(entry=>entry._chunk)))for(const entry of (await json('dist/'+file)).entries)byId.set(entry.id,entry);
const entries=catalog.entries.map(entry=>byId.get(entry.id));
const before=project(entries,registry,{reverse:true});
const sha=value=>createHash('sha256').update(value).digest('hex');
const practice=byId.get('own-practice-es-write-visibility');

test('finite reviewed scope reverses exactly without changing original question positions, IDs, progress or unrelated fields',()=>{
  assert.equal(registry.records.length,11);
  assert.deepEqual(project(before,registry),entries);
  assert.deepEqual(project(project(before,registry),registry,{reverse:true}),before);
  assert.deepEqual(entries.map(entry=>entry.id),before.map(entry=>entry.id));
  const targets=new Map([...registry.records,...registry.postReviewRecords||[]].map(record=>[record.entryId+'#'+record.path[1],record]));
  for(const [index,old] of before.entries()) {
    const current=entries[index];
    if(!old.items) { assert.deepEqual(current,old);continue; }
    assert.deepEqual({...current,items:undefined},{...old,items:undefined});
    assert.equal(current.items.length,old.items.length);
    for(const [qi,question] of old.items.entries()) {
      const updated=current.items[qi],record=targets.get(old.id+'#'+qi);
      assert.deepEqual({...updated,a:undefined},{...question,a:undefined});
      assert.equal(updated.a,record?record.after:question.a);
      assert.equal((question.id||String(qi)),(updated.id||String(qi)));
    }
  }
  const original=before.find(entry=>entry.id==='bg-elasticsearch-3').items[1];
  assert.equal(original.q,'为什么刚写入 ES 的数据，有时查不到？');
  assert.equal(Object.hasOwn(original,'id'),false);
  assert.equal(Object.hasOwn(byId.get('bg-elasticsearch-3').items[1],'id'),false);
});

test('all five ES request experiments retain their exact payload once, with only explicitly reviewed conceptual wording changes',()=>{
  assert.equal(practice.kind,'doc');assert.equal(practice.mod,'code');
  assert.equal(registry.practiceEntries[0].transfers.length,5);
  let movedRequests=0,movedTables=0;
  for(const transfer of registry.practiceEntries[0].transfers) {
    const record=registry.records.find(record=>record.entryId===transfer.sourceEntryId&&record.path[1]===transfer.sourceQuestionIndex);
    let untouched=record.before;
    for(const payload of transfer.payloads) {
      const exact=record.before.slice(payload.start,payload.end);
      assert.equal(sha(exact),payload.sha256);
      assert.equal(practice.html.split(exact).length,2,'one byte-exact retained payload');
      assert.equal(record.after.includes(exact),false);
      untouched=untouched.replace(exact,'');
      movedRequests+=(exact.match(/请求步骤：方法 /g)||[]).length;
      movedTables+=(exact.match(/<th>请求数据位置<\/th>/g)||[]).length;
    }
    const link=record.after.match(/<p class="md-p">请求步骤、实验条件与字段清单见<a href="[^"]+">[^<]+<\/a>；这里保留原理与排查思路。<\/p>/g);
    assert.equal(link?.length,1);
    for(const edit of transfer.conceptualEdits) {
      assert.equal(sha(edit.before),edit.beforeSha256);assert.equal(sha(edit.after),edit.afterSha256);
      assert.equal(untouched.split(edit.before).length,2);untouched=untouched.replace(edit.before,edit.after);
    }
    assert.equal(record.after.replace(link[0],''),untouched,'all unedited conceptual prose is exact');
    assert.equal(record.after.includes('请求步骤：方法 '),false);
    assert.equal(record.after.includes('<th>请求数据位置</th>'),false);
  }
  assert.equal(movedRequests,36);assert.equal(movedTables,30);
  assert.equal((practice.html.match(/请求步骤：方法 /g)||[]).length,36);
  assert.equal((practice.html.match(/<th>请求数据位置<\/th>/g)||[]).length,30);
  assert.ok(practice.html.includes('实际结果需在获准的独立测试环境中验证'));
  assert.ok(practice.html.includes('仅使用未占用的练习索引名，不要在生产索引执行'));
  assert.ok(!practice.html.includes('本次整理'));
  assert.ok(practice.html.includes('不能把示例数字当固定令牌'));
  for(const entry of entries.filter(entry=>entry.mod==='bagu'))assert.doesNotMatch(JSON.stringify(entry),/请求步骤：方法 |<th>请求数据位置<\/th>/);
});

test('theory answers have no dangling experimental setup, payload introductions or placeholder examples',()=>{
  const mapping=byId.get('bg-elasticsearch-2').items[0].a;
  assert.doesNotMatch(mapping,/分析器与映射的教学验证|逐项观察的目标|这个实验没有覆盖权限系统/);
  assert.ok(mapping.includes('tenant_id 只是数据过滤字段'));
  assert.ok(mapping.includes('例如 body 开启 store:true 时可独立取回'));
  const filter=byId.get('bg-elasticsearch-2').items[3].a;
  assert.doesNotMatch(filter,/interview_java_demo|这个条件表示：demo 租户|下面的字段合同假设/);
  assert.ok(filter.includes('明确至少满足一项'));
  assert.ok(filter.includes('正文放到 must、标签保留在 should'));
  assert.ok(filter.includes('tenant_id 与 acl 必须来自可信身份和授权计算'));
  const aggregation=byId.get('bg-elasticsearch-2').items[5].a;
  assert.doesNotMatch(aggregation,/聚合字段合同沿用|若实际响应 after_key 为|下一页的 composite 部分是：/);
  assert.ok(aggregation.includes('不能自行假定它一定等于最后一个桶的 key'));
  const pagination=byId.get('bg-elasticsearch-5').items[1].a;
  assert.doesNotMatch(pagination,/PIT 的概念验证|后续仍发 POST|若真实响应最后值是|最新上下文：<\/p>/);
  assert.ok(pagination.includes('结束、取消或异常时尽力关闭最新上下文。'));
  assert.ok(pagination.includes('带 pit 的 search 不再指定 index、routing、preference'));
  assert.ok(pagination.includes('敏感系统需要明确由哪一层负责最终放行'));
});

test('stable forward section links and old-index backlinks resolve to existing targets',async()=>{
  const routing=(await read('src/app/routing.js')).split('let renderSequence')[0];
  const parse=hash=>JSON.parse(JSON.stringify(runInNewContext(routing+';parseHash()',{
    location:{hash},TREE:{},HL_MODS:[],ALGO_ALIAS:{},DATA:{},byId,history:{replaceState(){throw Error('Unexpected rewrite');}}
  })));
  for(const transfer of registry.practiceEntries[0].transfers) {
    assert.ok(practice.html.includes('id="'+transfer.sectionId+'"'));
    assert.deepEqual(parse(transfer.forwardHref),{view:'entry',id:practice.id,q:transfer.sectionId});
    assert.deepEqual(parse(transfer.backlinkHref),{view:'entry',id:transfer.sourceEntryId,q:String(transfer.sourceQuestionIndex)});
    assert.ok(practice.html.includes('href="'+transfer.backlinkHref+'"'));
  }
  assert.deepEqual(parse('#/e/ai-rag-3/9'),{view:'entry',id:'ai-rag-3',q:'9'});
});

test('section navigation scrolls the requested workbook section and leaves old question focus and baseline untouched',()=>{
  const source='if (r.q != null) focusQuestion(r.q, true);';
  const projected=projectPracticeBoundaryRuntime('src/app/routing.js',source);
  const calls=[],context={document:{getElementById:id=>({scrollIntoView:options=>calls.push(['section',id,options.block])})},focusQuestion:(q,scroll)=>calls.push(['question',q,scroll])};
  runInNewContext(projected,{...context,e:{id:practice.id},r:{q:'s-es-filter'}});
  runInNewContext(projected,{...context,e:{id:'bg-elasticsearch-3'},r:{q:'1'}});
  runInNewContext(projected,{...context,e:{id:'ai-rag-3'},r:{q:'9'}});
  assert.deepEqual(calls,[['section','s-es-filter','start'],['question','1',true],['question','9',true]]);
  assert.equal(projectPracticeBoundaryRuntime('src/app/routing.js',source,{baselineTest:true}),source);
  assert.equal(projectPracticeBoundaryRuntime('src/app/questions.js',source),source);
  assert.throws(()=>projectPracticeBoundaryRuntime('src/app/routing.js','drift'),/anchor drift/);
});

test('RAG retains unique explanations, canonical stable link, old internal anchor and all nine valid variants',()=>{
  const [definition,canonical]=[byId.get('ai-rag-3').items[0].a,byId.get('ai-rag-3').items[9].a];
  assert.ok(definition.includes('id="add-own-algo-ai-rag-3-0"'));
  assert.ok(definition.includes('href="#/e/ai-rag-3/9"'));
  assert.ok(!definition.includes('#/e/ai-rag-3/q/9'));
  for(const value of ['Late Chunking','Late Interaction','ExactCosine','4096','50,000','对称','不可变','困难负例'])assert.ok((definition+canonical).includes(value),value);
  assert.ok(canonical.includes('不能直接套用未平方L2距离的阈值'));
  assert.ok(canonical.includes('也不能把它当作余弦阈值'));
  assert.ok(canonical.includes('x·y/(||x||×||y||)'));
  assert.ok(!canonical.includes('\\|'));
  assert.ok(canonical.includes('<summary>其他问法（9）</summary>'));
  assert.ok(canonical.includes('<li>向量相似度计算距离有哪几种方式？</li>'));
  assert.ok(!canonical.includes('多个 prompt 怎么管理？'));
  assert.ok(byId.get('ai-模型与评测-6').items[0].a.includes('多个 Prompt 如何管理'));
});

test('fails closed on stale input, moved question identity, missing or modified practice payload, and registry tampering',()=>{
  for(const change of [
    entries=>{entries.find(entry=>entry.id==='bg-elasticsearch-3').items[1].a+='drift';},
    entries=>{entries.find(entry=>entry.id==='bg-elasticsearch-3').items[1].q='changed';},
    entries=>{entries.find(entry=>entry.id==='bg-elasticsearch-3').items[1].id='q-new';},
    entries=>{const items=entries.find(entry=>entry.id==='bg-elasticsearch-3').items;[items[0],items[1]]=[items[1],items[0]];},
    entries=>{entries.find(entry=>entry.id==='bg-elasticsearch-3').number='999 问';},
    entries=>{entries.find(entry=>entry.id===practice.id).html+='drift';},
    entries=>{entries.splice(entries.findIndex(entry=>entry.id===practice.id),1);}
  ]) {const input=structuredClone(before);change(input);assert.throws(()=>project(input,registry),/Practice boundary|Interview voice review/);}
  const changed=structuredClone(registry);changed.records[0].after+='drift';
  assert.throws(()=>project(before,changed),/registry integrity/);
  assert.throws(()=>project([...before,before[0]],registry),/duplicate entry/);
});

test('independent future questions and entries retain exact tails while guarded old answers stay protected',()=>{
  const futureQuestion={id:'q-future-es-independent',q:'Future question?',a:'Future answer.',sub:'',mk:false};
  const futureEntry={id:'future-practice-independent',kind:'doc',mod:'code',part:'Future',cat:'Future',title:'Future',html:'Future'};
  const input=before.map(entry=>entry.id==='bg-elasticsearch-3'?{...entry,number:entry.number.replace(/\d+/,String(entry.items.length+1)),items:[...entry.items,futureQuestion]}:entry).concat(futureEntry);
  const snapshot=JSON.stringify(input),out=project(input,registry);
  assert.equal(out.at(-1),futureEntry);
  assert.equal(out.find(entry=>entry.id==='bg-elasticsearch-3').items.at(-1),futureQuestion);
  assert.deepEqual(project(out,registry,{reverse:true}),input);
  assert.equal(JSON.stringify(input),snapshot);
  assert.equal(project(input,null,{baselineTest:true}),input);
});

test('priority ordering and catalog/search include the practice entry without new old-question keys',async()=>{
  const priority=await json('content/interview-priority-view.json');
  assert.equal(validatePriorityView(entries,priority),true);
  assert.deepEqual(priorityQuestionView(byId.get('bg-elasticsearch-3'),priority).map(row=>row.key),priorityQuestionView(before.find(entry=>entry.id==='bg-elasticsearch-3'),priority).map(row=>row.key));
  assert.equal(catalog.entries.find(entry=>entry.id===practice.id).mod,'code');
  assert.equal(catalog.HL.cards['ai-agent-6#9'].rows[1].cells[1],'补全、代码库理解、多文件修改与任务执行');
  assert.ok((await read('dist/data/search.json')).includes(practice.id));
  assert.equal(restoreBeforePracticeBoundary(entries,registry).length,entries.length-1);
});

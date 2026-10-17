import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {projectSource} from '../scripts/display-projection.mjs';
import {projectInterviewRuntime} from '../scripts/interview-reading.mjs';
import {buildSearchRecords} from '../scripts/build-search.mjs';
import {projectLearnerReadingRuntime, LEARNER_READING_DISPLAY_ALIASES, LEARNER_READING_RUNTIME_AUDIT} from '../scripts/learner-reading-runtime.mjs';

const root = new URL('../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
const plain = value => JSON.parse(JSON.stringify(value));
const manifest = JSON.parse(await read('content/display-projection.json'));
const appFiles = ['catalog','storage','structure','fragments','renderers','highlight-map','dashboard','navigation','routing','questions','search','events'];
const raw = new Map(), prior = new Map(), projected = new Map();
for (const name of appFiles) {
  const file = 'src/app/' + name + '.js';
  const source = await read(file);
  raw.set(file, source);
  const before = projectInterviewRuntime(file, projectSource(file, source, manifest));
  prior.set(file, before);
  projected.set(file, projectLearnerReadingRuntime(file, before));
}
const runtimeModule = await read('scripts/learner-reading-runtime.mjs');
const registryMatch = /const RULES = freeze\(([\s\S]*?)\);\nfunction validateRegistry/.exec(runtimeModule);
assert.ok(registryMatch);
const registry = JSON.parse(registryMatch[1]);
const importVariant = text => import('data:text/javascript;base64,' + Buffer.from(text).toString('base64'));
const withRegistry = mutator => {
  const changed = structuredClone(registry);
  mutator(changed);
  return runtimeModule.replace(registryMatch[1], JSON.stringify(changed));
};

const expectedAliases = {
  part: {'Agent Runtime 工程合同':'Agent Runtime 工程机制','学习参考':'学习指南'},
  cat: {
    '证据、图关系与评价合同':'证据、图关系与评价约束',
    '数据库工具的查询合同':'数据库工具的查询规则',
    '跨册场景补充':'场景分析与追问',
    '实现参考与验证边界':'学习路线与实践条件',
    '查询计划、融合与重排合同':'查询计划、融合与重排约束',
    '向量服务与版本化数据合同':'向量服务与版本化数据契约',
    '教学参考与验证边界':'学习路线与实践条件',
    '补充算法合同':'算法题与解题条件',
    'MySQL 教学参考':'MySQL 学习指南',
    '教学程序与阅读参考':'配套练习与学习指南',
    '身份、隔离与业务状态合同':'身份、隔离与业务状态契约',
    '教学参考与完整代码':'练习环境与完整示例',
    '流处理与数据合同':'流处理与数据约束',
    '完整来源变体':'来源变体与完整解法',
  },
};

function fixtureEntries() {
  return [
    {id:'fixture-doc',kind:'doc',mod:'ai',part:'Agent Runtime 工程合同',cat:'实现参考与验证边界',title:'学习文档',number:1,source:'EDITORIAL_SOURCE_SENTINEL',html:'<p>机制正文</p>'},
    {id:'fixture-qa',kind:'qa',mod:'ai',part:'Agent Runtime 工程合同',cat:'跨册场景补充',title:'场景问题',number:'QA',source:'EDITORIAL_SOURCE_SENTINEL',items:[{q:'如何解释机制？',a:'<p>保持数据身份。</p>',id:'stable-question',from:{href:'https://leetcode.cn/problems/two-sum/',label:'原题'}}]},
    {id:'fixture-algo',kind:'algo',mod:'algo',part:'算法题',cat:'补充算法合同',title:'算法练习',number:12,source:'EDITORIAL_SOURCE_SENTINEL',slug:'two-sum',code:'int main() { return 0; }',description:'练习正文'},
    {id:'fixture-scenario',kind:'scenario',mod:'design',part:'场景题',cat:'教学参考与完整代码',title:'场景练习',number:'场景 1',source:'EDITORIAL_SOURCE_SENTINEL'},
    {id:'fixture-handwrite',kind:'handwrite',mod:'code',part:'代码',cat:'教学程序与阅读参考',title:'代码练习',number:1,source:'EDITORIAL_SOURCE_SENTINEL',questionHtml:'<p>问题</p>',answerHtml:'<pre>original code</pre>'},
    {id:'fixture-db',kind:'database',mod:'code',part:'代码',cat:'MySQL 教学参考',title:'SQL 练习',number:2,source:'EDITORIAL_SOURCE_SENTINEL'},
    {id:'fixture-syntax',kind:'syntax',mod:'syntax',part:'Java',cat:'教学程序与阅读参考',title:'语法练习',number:1,html:'<p>语法正文</p>'},
    {id:'fixture-ptopic',kind:'ptopic',mod:'algo',part:'算法题',cat:'补充算法合同',title:'专题练习',number:0,groups:[],recognize:[],notApplicable:[],templates:[],variants:[],pitfalls:[],folds:[]},
  ];
}
function harness(entries = fixtureEntries()) {
  const elements = new Map();
  const node = selector => {
    if (!elements.has(selector)) elements.set(selector,{innerHTML:'',textContent:'',value:'',hidden:false,querySelector:()=>null,querySelectorAll:()=>[],classList:{toggle(){}},scrollIntoView(){}});
    return elements.get(selector);
  };
  const values = new Map([['iv8-progress','{}']]);
  const context = vm.createContext({
    window:{__NOTES_DATA__:{entries:structuredClone(entries),TOPICS:{},HL:{cards:{},core:{}}}},
    document:{getElementById:id=>node('#'+id),querySelector:node,querySelectorAll:()=>[]},
    localStorage:{getItem:key=>values.get(key) ?? null,setItem:(key,value)=>values.set(key,value)},
    console, SCENARIO_COUNTERFACTUALS:{}, TRACES:{},
    diagramFor:()=>'',vizFigure:()=>'',pitchBlock:()=>'',sentencePitch:()=>'',deepenBlock:()=>'',
  });
  const run = code => vm.runInContext(code, context);
  for (const name of appFiles.filter(name=>!['routing','events'].includes(name))) run(projected.get('src/app/'+name+'.js'));
  // Visual engines are a separate unchanged bundle, outside this text-rendering harness.
  run('diagramFor = () => \'\'; vizFigure = () => \'\'; deepenBlock = () => \'\';');
  return {context,run,elements,node,values};
}

test('registry pins exactly the reviewed 16 aliases and 103 reviewed identities',()=>{
  assert.deepEqual(LEARNER_READING_DISPLAY_ALIASES,expectedAliases);
  assert.equal(LEARNER_READING_RUNTIME_AUDIT.reviewedAliasRows,103);
  assert.equal(LEARNER_READING_RUNTIME_AUDIT.distinctDisplayAliases,16);
  assert.equal(LEARNER_READING_RUNTIME_AUDIT.reviewedAliasRegistrySha256,'c754cb52fb8438983fdfdbd4c6d738b5df7a4fc044d54a77415a5ba104419521');
  assert.equal(sha(JSON.stringify(LEARNER_READING_DISPLAY_ALIASES)),LEARNER_READING_RUNTIME_AUDIT.aliasMapSha256);
  assert.ok(Object.isFrozen(LEARNER_READING_DISPLAY_ALIASES.cat));
  assert.ok(Object.isFrozen(LEARNER_READING_RUNTIME_AUDIT.files));
});

test('seven projected files and all exact replacement occurrences have pinned input/output hashes',()=>{
  assert.equal(LEARNER_READING_RUNTIME_AUDIT.files.length,7);
  assert.equal(LEARNER_READING_RUNTIME_AUDIT.files.reduce((n,f)=>n+f.replacementRules,0),20);
  assert.equal(LEARNER_READING_RUNTIME_AUDIT.files.reduce((n,f)=>n+f.replacementOccurrences,0),26);
  for (const record of LEARNER_READING_RUNTIME_AUDIT.files) {
    assert.equal(sha(prior.get(record.file)),record.sourceSha256,record.file);
    assert.equal(sha(projected.get(record.file)),record.resultSha256,record.file);
    assert.notEqual(prior.get(record.file),projected.get(record.file));
    new vm.Script(projected.get(record.file),{filename:record.file});
  }
  new vm.Script(appFiles.map(name=>projected.get('src/app/'+name+'.js')).join('\n;\n'));
});

test('baseline bypass and unrelated files remain byte-identical',async()=>{
  for (const [file,source] of raw) assert.equal(projectLearnerReadingRuntime(file,source,{baselineTest:true}),source);
  for (const file of ['src/app/structure.js','src/app/storage.js','src/app/routing.js','src/app/questions.js','src/app/events.js']) assert.equal(projected.get(file),prior.get(file));
  for (const name of await readdir(new URL('src/visuals/',root))) {
    const file = 'src/visuals/'+name;
    const source = await read(file);
    assert.equal(projectLearnerReadingRuntime(file,source),source);
  }
  assert.equal(projectLearnerReadingRuntime('unlisted-file','unchanged'),'unchanged');
  assert.equal(projectLearnerReadingRuntime('src/app/catalog.js',null,{baselineTest:true}),null);
});

test('stale inputs, missing/duplicated anchors, wrong transformation order, and repeat application fail closed',()=>{
  for (const rule of registry) {
    const source = prior.get(rule.file), anchor = rule.replacements[0].before;
    for (const bad of [source+'\n',source.replace(anchor,''),source.replace(anchor,anchor+anchor),null,projected.get(rule.file)]) {
      assert.throws(()=>projectLearnerReadingRuntime(rule.file,bad),/source hash mismatch/);
    }
    if (raw.get(rule.file)!==source) assert.throws(()=>projectLearnerReadingRuntime(rule.file,raw.get(rule.file)),/source hash mismatch/);
  }
});

test('registry rejects alias drift, invalid files, duplicate rules, corrupt replacement text, and invalid counts',async()=>{
  await assert.rejects(()=>importVariant(runtimeModule.replace('"Agent Runtime 工程机制"','"未审核别名"')),/alias map hash mismatch/);
  for (const mutate of [
    r=>r[0].file='src/app/unreviewed.js',
    r=>r[1].file=r[0].file,
    r=>r[0].replacements.push(r[0].replacements[0]),
    r=>r[0].replacements[0].before+='!',
    r=>r[0].replacements[0].after+='!',
    r=>r[0].replacements[0].count=0,
    r=>r[0].replacements[0].count=1.5,
  ]) await assert.rejects(()=>importVariant(withRegistry(mutate)),/Learner reading runtime:/);
});

test('anchor-count and result-hash guards remain active after valid registry parsing',async()=>{
  const wrongCount = await importVariant(withRegistry(r=>r[0].replacements[0].count++));
  assert.throws(()=>wrongCount.projectLearnerReadingRuntime(registry[0].file,prior.get(registry[0].file)),/anchor count mismatch/);
  const wrongOutput = await importVariant(withRegistry(r=>r[0].resultSha256='0'.repeat(64)));
  assert.throws(()=>wrongOutput.projectLearnerReadingRuntime(registry[0].file,prior.get(registry[0].file)),/result hash mismatch/);
});

test('display helper matches exact field/string pairs only, without trimming or partial substitution',()=>{
  const {run,context} = harness();
  for (const [field,map] of Object.entries(expectedAliases)) for (const [before,after] of Object.entries(map)) {
    context.input = before;
    assert.equal(run(`learnerLabel(${JSON.stringify(field)}, input)`),after);
    context.input = before+' 附加文本';
    assert.equal(run(`learnerLabel(${JSON.stringify(field)}, input)`),context.input);
    context.input = ' '+before;
    assert.equal(run(`learnerLabel(${JSON.stringify(field)}, input)`),context.input);
  }
  assert.equal(run("learnerLabel('title', '跨册场景补充')"),'跨册场景补充');
  assert.equal(run("learnerLabel('part', '跨册场景补充')"),'跨册场景补充');
  for (const field of ['__proto__','constructor','toString']) assert.equal(run(`learnerLabel(${JSON.stringify(field)}, 'toString')`),'toString');
  assert.equal(run("learnerLabel('cat', null)"),null);
  assert.equal(run("learnerLabel('cat', 3)"),3);
  assert.equal(run("learnerLabel('cat', undefined)"),undefined);
  assert.equal(run("(() => { const x={toString:()=> '跨册场景补充'}; return learnerLabel('cat', x) === x; })()"),true);
});

test('sidebar, breadcrumbs, module cards, map headings, pager, recent card and search use aliases but preserve keys',()=>{
  const {run,node,values} = harness();
  const before = run('JSON.stringify(ENTRIES)');
  const doc = "byId.get('fixture-doc')", qa = "byId.get('fixture-qa')";
  const crumbs = run(`crumbs(${doc})`);
  assert.ok(crumbs.includes('Agent Runtime 工程机制'));
  assert.ok(crumbs.includes('学习路线与实践条件'));
  assert.ok(!crumbs.includes('工程合同'));
  const mod = run("renderModHome('ai')");
  assert.ok(mod.includes('Agent Runtime 工程机制'));
  assert.ok(mod.includes('场景分析与追问'));
  assert.ok(mod.includes('href="#/e/fixture-qa"'));
  run("state.mod = 'ai'; state.route = {view:'entry',id:'fixture-doc'}; renderSidebar();");
  assert.ok(node('#side-list').innerHTML.includes('Agent Runtime 工程机制'));
  assert.ok(node('#side-list').innerHTML.includes('data-key="ai|实现参考与验证边界"'));
  assert.ok(node('#side-list').innerHTML.includes('学习路线与实践条件'));
  run("state.filter='场景分析与追问'; renderSidebar();");
  assert.ok(node('#side-list').innerHTML.includes('fixture-qa'));
  run("state.filter='跨册场景补充'; renderSidebar();");
  assert.ok(node('#side-list').innerHTML.includes('fixture-qa'));
  values.set('iv15-hm-closed-ai',JSON.stringify(['跨册场景补充']));
  const map = run("renderMap('ai')");
  assert.ok(map.includes('data-cat="跨册场景补充"'));
  assert.ok(map.includes('class="hm-cat"'));
  assert.ok(map.includes('<b>场景分析与追问</b>'));
  assert.ok(map.includes('Agent Runtime 工程机制'));
  const pager = run(`pager(${doc})`);
  assert.ok(pager.includes('场景分析与追问'));
  assert.ok(pager.includes('href="#/e/fixture-qa"'));
  values.set('iv8-recent',JSON.stringify(['fixture-qa']));
  assert.ok(run('renderHome()').includes('场景分析与追问'));
  assert.ok(run(`plItem({e:${qa}},0,[])`).includes('场景分析与追问'));
  assert.equal(run('JSON.stringify(ENTRIES)'),before);
  assert.equal(run(`qKey(${qa}.id,0)`),'fixture-qa#stable-question');
});

test('all renderer category chips/headings alias while editorial chrome stays hidden and exercise links/code stay exact',()=>{
  const {run} = harness();
  const before = run('JSON.stringify(ENTRIES)');
  for (const [fn,id,label] of [
    ['renderDoc','fixture-doc','学习路线与实践条件'],
    ['renderQA','fixture-qa','场景分析与追问'],
    ['renderAlgo','fixture-algo','算法题与解题条件'],
    ['renderScenario','fixture-scenario','练习环境与完整示例'],
    ['renderHandwrite','fixture-handwrite','配套练习与学习指南'],
    ['renderHandwrite','fixture-db','MySQL 学习指南'],
    ['renderSyntax','fixture-syntax','配套练习与学习指南'],
    ['renderPTopic','fixture-ptopic','算法题与解题条件'],
  ]) {
    const html = run(`${fn}(byId.get(${JSON.stringify(id)}))`);
    assert.ok(html.includes(label),fn);
    assert.ok(!html.includes('EDITORIAL_SOURCE_SENTINEL'),fn);
    assert.ok(!html.includes('class="src-note"'),fn);
  }
  const algo = run("renderAlgo(byId.get('fixture-algo'))");
  assert.ok(algo.includes('https://leetcode.cn/problems/two-sum/'));
  assert.ok(algo.includes('原题'));
  const qa = run("renderQA(byId.get('fixture-qa'))");
  assert.ok(qa.includes('class="lc-link" href="https://leetcode.cn/problems/two-sum/"'));
  assert.ok(qa.includes('q-stable-question'));
  assert.equal(run('JSON.stringify(ENTRIES)'),before);
  assert.equal(run("byId.get('fixture-algo').code"),'int main() { return 0; }');
  assert.equal(run("byId.get('fixture-handwrite').answerHtml"),'<pre>original code</pre>');
  const codeStart = 'function codeLines(', codeEnd = '// 把笔记里的';
  const originalCode = prior.get('src/app/fragments.js').split(codeStart)[1].split(codeEnd)[0];
  const finalCode = projected.get('src/app/fragments.js').split(codeStart)[1].split(codeEnd)[0];
  assert.equal(finalCode,originalCode);
});

test('search prefix projection is exact and leaves QA answers, later body mentions and unrelated prefixes untouched',()=>{
  const {run,context} = harness();
  const e = fixtureEntries()[0];
  e.html = '<p>正文仍然讨论实现参考与验证边界和 Agent Runtime 工程合同。</p>';
  const record = buildSearchRecords([e],{})[0];
  context.record = {...record,e};
  const before = JSON.stringify(context.record);
  const result = run('learnerSearchText(record)');
  assert.ok(result.startsWith('学习文档 1 学习路线与实践条件 Agent Runtime 工程机制 '));
  assert.ok(result.endsWith('正文仍然讨论实现参考与验证边界和 Agent Runtime 工程合同。'));
  assert.equal(JSON.stringify(context.record),before);
  context.record = {...context.record,qi:0};
  assert.equal(run('learnerSearchText(record)'),record.text);
  context.record = {...context.record,qi:undefined,text:'前缀不同 '+record.text};
  assert.equal(run('learnerSearchText(record)'),context.record.text);
  context.record = {...context.record,text:record.text.replace('工程合同 ', '工程合同X ')};
  assert.equal(run('learnerSearchText(record)'),context.record.text);
  context.record = {e,text:undefined};
  assert.equal(run('learnerSearchText(record)'),undefined);
  context.record = {e,text:['学习文档',1,e.cat,e.part].join(' ')};
  assert.equal(run('learnerSearchText(record)'),'学习文档 1 学习路线与实践条件 Agent Runtime 工程机制');
});

test('search finds both reviewed alias and original label without mutating records or IDs',async()=>{
  const {run,node,context} = harness();
  const e = plain(run("byId.get('fixture-qa')"));
  const records = buildSearchRecords([e],{}).map(record=>({...record,e,tl:record.title.toLowerCase(),tx:record.text.toLowerCase()}));
  context.records = records;
  const before = JSON.stringify(records);
  run('INDEX = records;');
  for (const query of ['场景分析与追问','跨册场景补充','Agent Runtime 工程机制']) {
    node('#palette-q').value = query;
    node('#palette').hidden = false;
    await run('runSearch()');
    assert.ok(node('#palette-list').innerHTML.includes('href="#/e/fixture-qa'),query);
    assert.ok(node('#palette-list').innerHTML.includes('场景分析与追问'),query);
    assert.ok(plain(run('pal.results.map(r=>r.e.id)')).every(id=>id==='fixture-qa'));
  }
  assert.equal(JSON.stringify(records),before);
});

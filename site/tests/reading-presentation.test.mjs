import {normalizeReadingPreservationFile,reviewedAddedPaths} from './helpers/reading-preservation-layers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {enhanceReadingPage} from '../src/runtime/reading-presentation.js';
import {READING_PRESENTATION_LIFECYCLE} from '../scripts/reading-presentation-runtime.mjs';
import {createPage} from './helpers/reading-dom-fixture.mjs';
import {projectSource} from '../scripts/display-projection.mjs';
import {projectInterviewRuntime} from '../scripts/interview-reading.mjs';
import {projectLearnerReadingRuntime} from '../scripts/learner-reading-runtime.mjs';
import {projectLearningOrderRuntime} from '../scripts/interview-learning-order.mjs';

const root = new URL('../', import.meta.url);
const read = file => readFile(new URL(file,root),'utf8');
const fixture = JSON.parse(await read('tests/fixtures/reading-presentation-targets.json'));
const wildcard = JSON.parse(await read('tests/fixtures/reading-wildcard-markup.json'));
const sha = value => createHash('sha256').update(value).digest('hex');
const enhance = (html,entry) => { const context=createPage(html);enhanceReadingPage(context.page,Object.freeze(entry));return context; };
const sourceText = node => node.tagName === 'A' ? `[${node.textContent}](${node.getAttribute('href')})` : node.nodeType === 3 ? node.textContent : node.childNodes.map(sourceText).join('');
const qaWrap = (t,html) => `<div class="qa" data-key="${t.unitId}"><div class="md">${html}</div></div>`;

// Every reviewed example is exercised, not just one example per repair class.
test('38 reviewed adjacent heading duplicates collapse without losing original anchors or body/code',()=>{
  const targets=fixture.targets.filter(t=>t.kind==='adjacent_identical_heading');assert.equal(targets.length,38);
  for(const t of targets) {
    const body='<p class="md-p">Unique knowledge.</p><pre id="original-code">  int x = 1;\n</pre>';
    const {page}=createPage(`<div class="md">${t.outerHTML}${t.nextOuterHTML}${body}</div>`);
    const original=page.querySelector('h2,h3,h4');const originalHTML=original.outerHTML;
    const code=page.querySelector('pre');const codeHTML=code.outerHTML;
    enhanceReadingPage(page,{id:t.entryId,kind:t.entryKind});
    assert.equal(page.querySelectorAll('h2,h3,h4').length,1,t.entryId);assert.equal(original.outerHTML,originalHTML);assert.equal(code.outerHTML,codeHTML);
    assert.equal(page.querySelector('.md-p').textContent,'Unique knowledge.');
    const after=page.innerHTML;enhanceReadingPage(page,{id:t.entryId,kind:t.entryKind});assert.equal(page.innerHTML,after);
  }
});

test('headings keep distinct text, nested markup, intervening content and any duplicate destination ID',()=>{
  const {page}=enhance('<div class="md"><h2 id="first">Same</h2><h3 id="second">Same</h3><h3>Different</h3><h3><code>Different</code></h3><h3>Visible</h3>unique text<h3>Visible</h3></div>',{});
  assert.equal(page.querySelectorAll('h2,h3').length,5);assert.equal(page.querySelector('#first').tagName,'H2');
  const anchor=page.querySelector('#second');assert.equal(anchor.tagName,'SPAN');assert.equal(anchor.getAttribute('aria-hidden'),null);
  assert.ok(page.textContent.includes('unique text'));assert.equal(page.querySelector('code').textContent,'Different');
});

test('52 reviewed tables receive one labelled wrapper with exact table tree retained',()=>{
  const targets=fixture.targets.filter(t=>t.kind==='table_without_scroll_wrapper');assert.equal(targets.length,52);
  for(const t of targets) {
    const {page}=createPage(`<div class="md">${t.outerHTML}</div>`);const table=page.querySelector('table'),before=table.outerHTML;
    enhanceReadingPage(page,{id:t.entryId,title:'A technical table'});
    const wrap=page.querySelector('.reading-table-scroll');assert.equal(table.parentNode,wrap);assert.equal(table.outerHTML,before,t.entryId);
    assert.equal(wrap.getAttribute('role'),'region');assert.ok(wrap.getAttribute('aria-label').includes('A technical table'));
    const after=page.innerHTML;enhanceReadingPage(page,{id:t.entryId,title:'A technical table'});assert.equal(page.innerHTML,after);
  }
});

test('existing wrappers stay singular; new scroll regions are focusable only while overflowing',()=>{
  const {page,observers}=createPage('<div class="md"><div class="md-table-wrap"><table><tr><td>Keep me</td></tr></table></div><table><tr><td>Wide</td></tr></table><table><tr><td>Second</td></tr></table></div>');
  const existing=page.querySelector('.md-table-wrap'),before=existing.outerHTML;
  enhanceReadingPage(page,{title:'Test'});assert.equal(existing.outerHTML,before);
  const wrappers=page.querySelectorAll('.reading-table-scroll');assert.equal(wrappers.length,2);assert.notEqual(wrappers[0].getAttribute('aria-label'),wrappers[1].getAttribute('aria-label'));
  const wrap=wrappers[0];assert.equal(wrap.getAttribute('tabindex'),null);
  wrap.clientWidth=300;wrap.scrollWidth=800;observers.at(-1).callback();assert.equal(wrap.getAttribute('tabindex'),'0');
  wrap.scrollWidth=300;observers.at(-1).callback();assert.equal(wrap.getAttribute('tabindex'),null);
  wrap.clientWidth=0;wrap.scrollWidth=800;observers.at(-1).callback();assert.equal(wrap.getAttribute('tabindex'),null);
  const old=observers.at(-1);enhanceReadingPage(page,{});assert.equal(old.disconnected,true);
});

test('27 reviewed empty panels are omitted only for patterns; populated/media/code content survives',()=>{
  const targets=fixture.targets.filter(t=>t.kind==='empty_optional_panel');assert.equal(targets.length,27);
  for(const t of targets) {
    const {page}=enhance(`<div class="grid2">${t.outerHTML}<div class="panel"><h4>Knowledge</h4><p>Keep.</p></div></div>`,{id:t.entryId,kind:'pattern'});
    assert.equal(page.querySelectorAll('.panel').length,1);assert.ok(page.querySelector('.grid2').classList.contains('reading-single-panel'));
    assert.equal(page.querySelector('p').textContent,'Keep.');
  }
  const shell='<div class="panel"><h4>O复杂度备忘</h4></div>';
  assert.equal(enhance(`<div class="grid2">${shell}</div>`,{kind:'doc'}).page.querySelectorAll('.panel').length,1);
  const {page}=enhance('<div class="grid2"><div class="panel"><h4>O复杂度备忘</h4><pre> </pre></div><div class="panel"><h4>!必测边界</h4><img src="x"></div><div class="panel"><h4>?看到这些关键词就想到它</h4>important</div></div>',{kind:'pattern'});
  assert.equal(page.querySelectorAll('.panel').length,3);
});

test('focused table arrows retain native scrolling without reaching entry navigation hotkeys',()=>{
  const {page}=enhance('<div class="md"><table><tr><td>Wide table</td></tr></table></div>',{});
  const wrapper=page.querySelector('.reading-table-scroll');
  let stopped=0, prevented=0;
  const press=(key,modifiers={})=>wrapper.dispatch('keydown',{key,...modifiers,stopPropagation(){stopped++;},preventDefault(){prevented++;}});
  press('ArrowRight');press('ArrowLeft');assert.equal(stopped,2);assert.equal(prevented,0);
  for(const key of ['Home','End','Tab','Escape','ArrowUp','ArrowDown'])press(key);
  for(const modifier of ['ctrlKey','metaKey','altKey'])press('ArrowRight',{[modifier]:true});
  assert.equal(stopped,2);assert.equal(prevented,0);
  enhanceReadingPage(page,{});press('ArrowRight');assert.equal(stopped,3,'Repeated enhancement installs only one arrow handler');
});

test('empty optional section leaves a usable original anchor but no blank TOC heading',()=>{
  const html='<section class="sec"><h2 class="sec-h" id="s-2"><span class="n">02</span>正确性 · 复杂度 · 边界</h2><div class="grid2"><div class="panel"><h4>O复杂度备忘</h4></div><div class="panel"><h4>!必测边界</h4></div></div></section>';
  const {page}=enhance(html,{kind:'pattern'});assert.equal(page.querySelector('.sec-h'),null);assert.equal(page.querySelector('#s-2').tagName,'SPAN');
  assert.equal(enhance(html.replace('<div class="grid2">','<p>Proof must remain.</p><div class="grid2">'),{kind:'pattern'}).page.querySelector('p').textContent,'Proof must remain.');
});

test('two reviewed Markdown links and five inline-code tokens render only in the audited leaves',()=>{
  const targets=fixture.targets.filter(t=>['raw_markdown_link','raw_inline_backticks'].includes(t.kind));assert.equal(targets.length,5);
  for(const t of targets) {
    const html=t.entryId==='doc-29'?`<div class="callout plain">${t.outerHTML}</div>`:qaWrap(t,t.kind==='raw_inline_backticks'?`<div class="cmp"><table><tr>${t.outerHTML}</tr></table></div>`:t.outerHTML);
    const {page}=createPage(html);const before=page.textContent;
    enhanceReadingPage(page,{id:t.entryId});
    const expected=t.matches.reduce((text,token)=>text.replace(token,t.kind==='raw_markdown_link'?/^\[([^\]]+)\]/.exec(token)[1]:token.slice(1,-1)),before);
    assert.equal(page.textContent,expected,t.entryId);
    if(t.kind==='raw_markdown_link') { const a=page.querySelector('a');assert.ok(a.getAttribute('href').startsWith('https://my.feishu.cn/wiki/'));assert.equal(a.getAttribute('rel'),'noopener noreferrer'); }
    else assert.equal(page.querySelectorAll('code').length,t.matches.length,t.entryId);
    const after=page.innerHTML;enhanceReadingPage(page,{id:t.entryId});assert.equal(page.innerHTML,after);
    const other=enhance(html,{id:'unreviewed'}).page;assert.equal(other.textContent,before);
  }
  const {page}=enhance('<div class="qa" data-key="bg-redis-8#2"><div class="md"><div class="cmp"><table><tr><td><code>命令先入队，`EXEC` 时按顺序跑</code></td></tr></table></div></div></div>',{id:'bg-redis-8'});
  assert.equal(page.querySelectorAll('code').length,1);assert.ok(page.textContent.includes('`EXEC`'));
});

test('ten reviewed paragraph splits preserve every text byte and avoid arbitrary Markdown or code rewriting',()=>{
  assert.equal(fixture.paragraphs.length,10);
  for(const t of fixture.paragraphs) {
    assert.equal(t.segments.join(''),t.originalText);assert.equal(sha(t.originalText),t.sha256OriginalText);
    const html=t.unitId.includes('#')?qaWrap(t,t.originalHTML):`<div class="md">${t.originalHTML}</div>`;
    const {page}=enhance(html,{id:t.entryId});const ps=page.querySelectorAll('p');
    assert.equal(ps.length,t.segments.length,t.entryId);assert.equal(sourceText(page),t.originalText,t.entryId);
    assert.deepEqual(ps.map(sourceText),t.segments);
    const after=page.innerHTML;enhanceReadingPage(page,{id:t.entryId});assert.equal(page.innerHTML,after);
    const other=enhance(html,{id:'unreviewed'}).page;assert.equal(other.querySelectorAll('p').length,1);
    const marked=enhance(html.replace('<p class="md-p">','<p class="md-p"><b></b>'),{id:t.entryId}).page;assert.equal(marked.querySelectorAll('p').length,1);
  }
});

test('literal bullet styling preserves prose text, inline code, and all unapproved/code examples',()=>{
  const html='<div class="md"><p class="md-p">- Explain <code>count</code> clearly.</p><p class="md-p">-5 is an expression.</p><p class="md-p">ordinary paragraph</p><pre><p class="md-p">- code</p></pre><div class="code-card"><p class="md-p">- still code</p></div></div>';
  const {page}=createPage(html);const before=page.textContent;enhanceReadingPage(page,{id:'ai-agent-6'});
  assert.equal(page.querySelectorAll('.reading-literal-bullet').length,1);assert.equal(page.textContent,before);assert.equal(page.querySelector('code').textContent,'count');
  assert.equal(enhance(html,{id:'not-reviewed'}).page.querySelectorAll('.reading-literal-bullet').length,0);
});


test('one exact legacy malformed inline-code item restores both wildcard stars and only its emphasis nesting',async()=>{
  const entry={id:wildcard.entryId,items:Array.from({length:6},()=>({a:''}))};entry.items[5].a=wildcard.originalHTML;
  const frozen=JSON.stringify(entry);
  const wrap=(html,key=wildcard.questionKey)=>`<div class="qa" data-key="${key}"><div class="md"><ol class="md-list">${html}</ol><pre>du -sh * | sort -h</pre><p><code>unrelated * text</code></p></div></div>`;
  for(const html of [wildcard.normalizedHTML,wildcard.browserNormalizedHTML]) {
    const {page}=enhance(wrap(html),entry);
    assert.equal(page.querySelector('li').outerHTML,wildcard.expectedHTML);
    assert.deepEqual(page.querySelectorAll('li code').map(c=>c.textContent),['du -sh * | sort -h','du -sh /var/log/*']);
    assert.equal(page.querySelectorAll('li i').length,0);
    assert.equal(page.querySelector('pre').textContent,'du -sh * | sort -h');
    assert.equal(page.querySelector('p code').textContent,'unrelated * text');
    const after=page.innerHTML;enhanceReadingPage(page,entry);assert.equal(page.innerHTML,after);
    assert.equal(enhance(wrap(html),{...entry,id:'unreviewed'}).page.querySelector('li').outerHTML,html);
    assert.equal(enhance(wrap(html),{...entry,items:[]}).page.querySelector('li').outerHTML,html);
    assert.equal(enhance(wrap(html,'bg-线上排障-2#4'),entry).page.querySelector('li').outerHTML,html);
    const changed=html.replace('临时文件','别的文件');assert.equal(enhance(wrap(changed),entry).page.querySelector('li').outerHTML,changed);
  }
  assert.equal(JSON.stringify(entry),frozen);
  const catalog=JSON.parse(await read('dist/data/catalog.json'));const meta=catalog.entries.find(e=>e.id===entry.id);
  const live=JSON.parse(await read('dist/'+meta._chunk)).entries.find(e=>e.id===entry.id);
  assert.equal(live.items[5].a.split(wildcard.originalHTML).length,2);
  assert.ok(live.items[4].a.includes(wildcard.corroboratingHTML));
});

test('separate adapter keeps the entire projected router contiguous and baseline untouched',async()=>{
  const raw=await read('src/app/routing.js');assert.equal(sha(raw),'6593119702ef7a989119b3b87f7d68150674c57b20d5ceb9730fa162e0ef1f3d');
  const file='src/app/routing.js';
  const source='\n/* Source: src/app/routing.js */\n'+projectLearningOrderRuntime(file,projectLearnerReadingRuntime(file,projectInterviewRuntime(file,projectSource(file,raw,JSON.parse(await read('content/display-projection.json'))))),JSON.parse(await read('content/interview-learning-order.json')));
  const built=await read('dist/assets/app.js');
  assert.ok(built.includes(source),'Existing projected router remains a byte-contiguous substring');
  assert.equal(built.split(READING_PRESENTATION_LIFECYCLE).length,2);
  assert.ok(built.indexOf(READING_PRESENTATION_LIFECYCLE)>built.indexOf(source)+source.length);
  assert.ok(built.indexOf(READING_PRESENTATION_LIFECYCLE)<built.indexOf('/* Source: src/app/events.js */'));
  if(process.env.NOTES_TEST_DIST) {
    const baseline=await read(process.env.NOTES_TEST_DIST+'/assets/app.js');
    assert.ok(!baseline.includes(READING_PRESENTATION_LIFECYCLE));
    assert.ok(baseline.includes(raw));
  }
  assert.ok((await read('src/runtime/bootstrap.js')).includes("import { enhanceReadingPage } from './reading-presentation.js'"));
});

async function digestTree(dir) {
  const files=[];
  const visit=async path=>{for(const item of (await readdir(new URL(path+'/',root),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))){const file=path+'/'+item.name;if(item.isDirectory())await visit(file);else {const bytes=normalizeReadingPreservationFile(file,await readFile(new URL(file,root)));if(bytes!==null)files.push([file,sha(bytes)]);}}};
  await visit(dir);return {files:files.length,sha256:sha(JSON.stringify(files))};
}
test('all source knowledge, frozen renderers/visuals and generated chapter/search identities stay byte-identical',async()=>{
  const expected=JSON.parse(await read('tests/fixtures/reading-presentation-preservation.json'));
  for(const [dir,record] of Object.entries(expected))assert.deepEqual(await digestTree(dir),record,dir);
});

// The old aggregate hash remains the oracle. These adversarial checks ensure the
// normalization cannot conceal new files or unrelated existing-file mutations.
test('historical normalization allows only sealed additions and exact reviewed permutations',async()=>{
 const current=await read('content/interview-learning-order.json');
 const old=normalizeReadingPreservationFile('content/interview-learning-order.json',Buffer.from(current));
 assert.equal(sha(old),'a06f45eced530f9c78031a8731b9ff637ebc3b8857a0f281f1c4d1ba2bcc0fe7');
 for(const mutate of [r=>r.modules[0].parts[0].categories[0].entryIds.reverse(),r=>r.modules[0].parts[0].categories[0].entryIds.push('unreviewed'),r=>r.moduleOrder.reverse(),r=>r.modules[0].parts[0].currentPart='drift']){
  const r=JSON.parse(current);mutate(r);assert.throws(()=>normalizeReadingPreservationFile('content/interview-learning-order.json',Buffer.from(JSON.stringify(r,null,2)+'\n')),/reviewed entry permutations/);
 }
 const data=Buffer.from('unreviewed bytes');
 for(const path of ['content/interview-voice-review/unreviewed-new.json','content/interview-consolidation/unreviewed-new.json','content/new.json','content/metadata.json','src/app/renderers.js','dist/data/search.json'])assert.equal(normalizeReadingPreservationFile(path,data),data);
 for(const path of reviewedAddedPaths)assert.equal(normalizeReadingPreservationFile(path,data),null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import {priorityQuestionView, projectPriorityViewRuntime} from '../scripts/interview-priority-view.mjs';

// In an installed checkout no environment override is needed. The candidate run
// reads the real checkout's sources and current built chapters without building.
const root = process.env.LEGACY_FOCUS_SITE_ROOT || fileURLToPath(new URL('../', import.meta.url));
const read = file => readFile(path.join(root, file), 'utf8');
const registry = JSON.parse(await read('content/interview-priority-view.json'));
const catalog = JSON.parse(await read('dist/data/catalog.json'));
const chunks = await Promise.all([...new Set(catalog.entries.map(e => e._chunk))].map(file => read('dist/' + file).then(JSON.parse)));
const byId = new Map(chunks.flatMap(chunk => chunk.entries).map(e => [e.id, e]));
const rawQuestions = await read('src/app/questions.js');
const questions = process.env.LEGACY_FOCUS_UNPATCHED === '1' ? rawQuestions : projectPriorityViewRuntime('src/app/questions.js', rawQuestions, registry);
const routing = await read('src/app/routing.js');
const renderers = projectPriorityViewRuntime('src/app/renderers.js', await read('src/app/renderers.js'), registry);
const storage = await read('src/app/storage.js');
const identities = storage.match(/^const qAnchor = .*;$/m)[0] + '\n' + storage.match(/^const qKey = .*;$/m)[0];
const helper = projectPriorityViewRuntime('src/app/structure.js', '', registry);
const {projectPracticeBoundaryRuntime} = await import(pathToFileURL(path.join(root, 'scripts/practice-boundary-corrections.mjs')));

function element(id, key) {
  const classes = new Set();
  return {id, dataset: {key}, classes, scrolls: [], classList: {
    add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name), toggle() {},
  }, scrollIntoView(options) { this.scrolls.push(options); }};
}
function fixture(entry, {reverse = false, sections = [], source = questions} = {}) {
  const entries = new Map(byId).set(entry.id, entry);
  const context = vm.createContext({
    entry, byId: entries, DATA: {}, HLC: {}, state: {route: {view: 'entry', id: entry.id}, mod: entry.mod, curQ: -1, qaMode: 'lead'},
    TREE: {[entry.mod]: {all: [entry]}}, h: value => String(value ?? ''), statusOf: () => 0,
    unitsOf: () => ({ok: 0, fuzzy: 0, total: entry.items?.length || 0}), pageHead: () => '', keyCard: () => '',
    sec: () => '', relatedLinks: () => '', pager: () => '', cmpCard: () => '', requestAnimationFrame: fn => fn(),
  });
  vm.runInContext(identities + '\n' + helper + '\n' + renderers.slice(renderers.indexOf('function splitLead(')), context);
  context.qaToolbar = () => '';
  const html = entry.kind === 'qa' ? vm.runInContext('renderQA(entry)', context) : entry.html || '';
  let cards = [...html.matchAll(/class="qa s\d" id="([^"]+)" data-key="([^"]+)"/g)].map(([, id, key]) => element(id, key));
  if (reverse) cards.reverse();
  const nodes = new Map([...cards, ...sections].map(node => [node.id, node]));
  context.document = {getElementById: id => nodes.get(String(id)) || null, body: {dataset: {rendered: '1'}}};
  context.$$ = selector => selector === '#page .qa' ? cards : [];
  vm.runInContext(source, context);
  return {context, cards, nodes, html, focus: (anchor, scroll = true) => context.focusQuestion(anchor, scroll)};
}
function current(f) { return f.cards[f.context.state.curQ]; }
function unchanged(f, before) {
  assert.equal(f.context.state.curQ, before.curQ);
  assert.deepEqual(f.cards.map(card => [...card.classes]), before.classes);
  assert.deepEqual(f.cards.map(card => card.scrolls.length), before.scrolls);
}
function snapshot(f) { return {curQ: f.context.state.curQ, classes: f.cards.map(card => [...card.classes]), scrolls: f.cards.map(card => card.scrolls.length)}; }

// These are direct executions of current renderer/storage/router/question source,
// with a small DOM adapter. They do not duplicate the focus algorithm in tests.
test('every current priority entry resolves stable and old numeric bookmarks to the same canonical key', () => {
  let stable = 0, idless = 0, reorderedStable = 0;
  for (const rule of registry.records) {
    const entry = byId.get(rule.entryId), before = JSON.stringify(entry.items), f = fixture(entry);
    const rows = priorityQuestionView(entry, registry);
    assert.deepEqual(f.cards.map(card => card.dataset.key), rows.map(row => row.key));
    for (let index = 0; index < entry.items.length; index++) {
      const item = entry.items[index], anchor = item.id || index, expected = entry.id + '#' + anchor;
      f.focus(anchor); assert.equal(current(f)?.dataset.key, expected, `${entry.id}/${anchor}`);
      f.focus(String(index)); assert.equal(current(f)?.dataset.key, expected, `old numeric ${entry.id}/${index}`);
      item.id ? stable++ : idless++;
      if (item.id && f.context.state.curQ !== index) reorderedStable++;
    }
    assert.equal(JSON.stringify(entry.items), before, 'canonical content/order unchanged');
  }
  assert.ok(stable > 0 && idless > 0 && reorderedStable > 0);
});

test('stable-id and idless cards keep canonical focus with reversed DOM, while J/K still follows display order', () => {
  for (const id of ['own-mysql-ch22', 'bg-kafka-3']) {
    const entry = {...byId.get(id), id: id + '-reversed-test'}, f = fixture(entry, {reverse: true});
    assert.equal(f.cards[0].dataset.key, entry.id + '#' + (entry.items.at(-1).id || entry.items.length - 1));
    for (let index = 0; index < entry.items.length; index++) {
      f.focus(String(index));
      assert.equal(current(f)?.dataset.key, entry.id + '#' + (entry.items[index].id || index));
      assert.ok(current(f).classes.has('open'));
    }
    f.context.state.curQ = 0; f.context.moveQuestion(1); assert.equal(f.context.state.curQ, 1);
    f.context.moveQuestion(-1); assert.equal(f.context.state.curQ, 0);
  }
});

test('invalid, fractional, signed, nondecimal and out-of-range numeric anchors never select a display position', () => {
  const f = fixture(byId.get('own-mysql-ch22'), {reverse: true});
  f.focus('q-own-mysql-s2288'); const before = snapshot(f);
  for (const anchor of ['', ' ', '-1', '+1', '0.0', '1.5', '1e0', '0x0', 'NaN', 'Infinity', '999', '9007199254740993']) {
    f.focus(anchor); unchanged(f, before);
  }
});

test('missing canonical card and missing current entry do not fall back to another visible card', () => {
  const f = fixture(byId.get('own-mysql-ch22'), {reverse: true});
  f.nodes.delete('q-q-own-mysql-s2288');
  let before = snapshot(f); f.focus('0'); unchanged(f, before);
  f.context.state.route = {view: 'entry', id: 'not-a-loaded-entry'};
  before = snapshot(f); f.focus('1'); unchanged(f, before);
});

test('exact question id wins over both a numeric interpretation and a raw HTML section id', () => {
  const entry = {id: 'focus-numeric-id', kind: 'qa', mod: 'bagu', items: [
    {id: '1', q: 'Exact numeric id', a: ''}, {id: 'stable-second', q: 'Canonical index one', a: ''},
  ]};
  const section = element('1'); const f = fixture(entry, {reverse: true, sections: [section]});
  f.focus('1'); assert.equal(current(f).dataset.key, entry.id + '#1'); assert.equal(section.scrolls.length, 0);
  f.focus('stable-second'); assert.equal(current(f).dataset.key, entry.id + '#stable-second');
});

test('real section HTML ids scroll without changing question focus or treating an anchor as a number', () => {
  const entry = byId.get('own-practice-es-write-visibility');
  assert.ok(entry.html.includes('id="s-es-mapping"'));
  const section = element('s-es-mapping'), f = fixture(entry, {sections: [section]});
  f.focus('s-es-mapping', false); assert.equal(section.scrolls.length, 0);
  f.focus('s-es-mapping'); assert.equal(section.scrolls.length, 1); assert.equal(section.scrolls[0].block, 'start');
  assert.equal(f.context.state.curQ, -1); assert.deepEqual([...section.classes], []);
  f.focus('missing-section'); assert.equal(section.scrolls.length, 1);
  const qaSection = element('s-es-mapping');
  const qa = fixture(byId.get('own-mysql-ch22'), {sections: [qaSection]});
  qa.focus('q-own-mysql-s2288'); const before = snapshot(qa);
  qa.focus('s-es-mapping'); unchanged(qa, before); assert.equal(qaSection.scrolls.length, 1);
});

async function renderRoute(f, hash, source) {
  const c = f.context, loads = [];
  Object.assign(c, {location: {hash}, HL_MODS: [], ALGO_ALIAS: {}, history: {replaceState() { throw Error('Unexpected rewrite'); }},
    window: {__NOTES_RUNTIME__: {repository: {loaded: new Set([c.entry._chunk]), async loadEntry(id) { loads.push(id); }, async loadMap() {}}, async loadVisuals() {} }},
    $: () => ({}), renderModnav() {}, renderSidebar() {}, closeNav() {},
  });
  vm.runInContext(source, c); await c.render();
  assert.deepEqual(loads, [c.entry.id]); assert.equal(c.state.route.q, hash.split('/').at(-1));
}
test('actual routing establishes current entry before old numeric focus and composes with existing ES section routing', async () => {
  const qa = byId.get('own-mysql-ch22'), f = fixture(qa);
  await renderRoute(f, '#/e/' + qa.id + '/0', routing);
  assert.equal(current(f)?.dataset.key, qa.id + '#q-own-mysql-s2288');
  for (const source of [routing, projectPracticeBoundaryRuntime('src/app/routing.js', routing)]) {
    const entry = byId.get('own-practice-es-write-visibility'), section = element('s-es-mapping');
    const doc = fixture(entry, {sections: [section]});
    await renderRoute(doc, '#/e/' + entry.id + '/s-es-mapping', source);
    assert.equal(section.scrolls.length, 1); assert.equal(section.scrolls[0].block, 'start');
    assert.equal(doc.context.state.curQ, -1);
  }
});

test('projection preserves baseline and unrelated source and rejects missing or duplicate focus target', () => {
  assert.equal(projectPriorityViewRuntime('src/app/questions.js', rawQuestions, null, {baselineTest: true}), rawQuestions);
  assert.equal(projectPriorityViewRuntime('src/app/routing.js', routing, registry), routing);
  assert.equal(projectPriorityViewRuntime('src/app/events.js', 'unchanged', registry), 'unchanged');
  assert.throws(() => projectPriorityViewRuntime('src/app/questions.js', 'drift', registry), /exactly one runtime target/);
  assert.throws(() => projectPriorityViewRuntime('src/app/questions.js', rawQuestions + rawQuestions, registry), /exactly one runtime target/);
  assert.throws(() => projectPriorityViewRuntime('src/app/questions.js', rawQuestions, {}), /unreviewed registry drift/);
});

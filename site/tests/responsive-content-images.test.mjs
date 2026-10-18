import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {createPage} from './helpers/reading-dom-fixture.mjs';

const root = new URL('../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const css = await read('src/style-overrides/reading-layout.css');
const plainCSS = css.replace(/\/\*[\s\S]*?\*\//g, '');
const imagePath = 'assets/imported/own-mq/figure-0.png';
const catalog = JSON.parse(await read('dist/data/catalog.json'));
const descriptor = catalog.entries.find(entry => entry.id === 'own-mq-tasks');
const entry = JSON.parse(await read('dist/' + descriptor._chunk)).entries.find(entry => entry.id === descriptor.id);
const questionIndex = entry.items.findIndex(item => item.id === 'q-own-mq-durable-pipeline');
const item = {...entry.items[questionIndex], key: entry.id + '#' + questionIndex, no: questionIndex + 1};

test('content image sizing caps wide diagrams without forcing small images to expand or cropping them', () => {
  const rules = [...plainCSS.matchAll(/(?:^|[}\n])\s*\.md img\s*\{([^}]+)\}/g)];
  assert.equal(rules.length, 1);
  assert.deepEqual(rules[0][1].trim().split(';').map(value => value.trim()).filter(Boolean), ['max-width: 100%', 'height: auto']);
  assert.ok(plainCSS.trim().endsWith('.md img {\n  max-width: 100%;\n  height: auto;\n}'), 'the rule applies at every viewport and in print');
  assert.doesNotMatch(rules[0][1], /(?:^|;)\s*(?:width|min-width|display|overflow|object-fit)\s*:/);
});

test('the published stylesheet is exact and historical compatibility output excludes the override', async () => {
  assert.equal(await read('dist/assets/styles/reading-layout.css'), css);
  const index = await read('dist/index.html');
  assert.equal(index.split('href="./assets/styles/reading-layout.css"').length, 2);
  assert.equal(sha(await read('src/styles/main.css')), 'c0d6e85869ebe2027c332b2e1acf3e1207c1e5571617b650ffc15830198dc8bb');
  if (process.env.NOTES_TEST_DIST) assert.equal(await read(process.env.NOTES_TEST_DIST + '/assets/styles/reading-layout.css'), '');
});

test('the original 1839 by 391 diagram is copied byte-for-byte with its source URL unchanged', async () => {
  const original = await readFile(new URL('public/' + imagePath, root));
  const published = await readFile(new URL('dist/' + imagePath, root));
  assert.equal(original.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.deepEqual([original.readUInt32BE(16), original.readUInt32BE(20)], [1839, 391]);
  assert.equal(sha(original), '3c2f741eb94ea108aa0a2cb6df01e8cc6c30147abf0e9cd1ee2b4542b416ae42');
  assert.deepEqual(published, original);
  assert.equal(item.a.split(imagePath).length, 2);
});

test('the actual QA renderer keeps the image inside the responsive selector in question, lead and full modes', async () => {
  const app = await read('dist/assets/app.js');
  const qa = app.slice(app.indexOf('function splitLead('), app.indexOf('function qaToolbar('));
  const context = {HLC: {}, cmpCard: () => '', h: String, statusOf: () => 0, priorityChip: () => '', removeExactIntroRepeat: (_lead, rest) => rest, state: {qaMode: 'lead'}};
  for (const mode of ['q', 'lead', 'full']) {
    const html = runInNewContext(qa + ';qaListHtml([item],{mode})', {...context, item, mode});
    const {page} = createPage(html);
    const images = page.querySelectorAll('.qa .md img').filter(image => image.getAttribute('src') === imagePath);
    assert.equal(images.length, 1, mode);
    assert.ok(html.includes('data-mode="' + mode + '"'));
    assert.equal(images[0].getAttribute('style'), null, 'no inline sizing defeats the responsive rule');
  }
  // The DOM fixture checks selector scope, not browser geometry. Real layout is
  // verified separately; small images are not enlarged and interface icons are
  // outside the content selector.
  const {page} = createPage('<header><img src="avatar.png"></header><div class="md"><details><a><img src="small.png" width="24" height="12"></a></details></div>');
  assert.deepEqual(page.querySelectorAll('.md img').map(image => image.getAttribute('src')), ['small.png']);
  assert.equal(page.querySelector('.md img').getAttribute('width'), '24');
});

test('all 58 current content images, including 11 non-QA diagrams, match the rule through actual compiled renderers', async t => {
  const entries = [];
  for (const chunk of new Set(catalog.entries.map(value => value._chunk))) entries.push(...JSON.parse(await read('dist/' + chunk)).entries);
  const app = await read('dist/assets/app.js');
  const qa = app.slice(app.indexOf('function splitLead('), app.indexOf('function qaToolbar('));
  const pager = app.slice(app.indexOf('function pager('), app.indexOf('function relatedLinks('));
  const doc = app.slice(app.indexOf('function renderDoc('), app.indexOf('function splitLead('));
  const sources = html => [...String(html || '').matchAll(/<img\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].map(match => match[1]);
  const renderedSources = html => createPage(html).page.querySelectorAll('.md img').map(image => image.getAttribute('src'));
  const context = {HLC: {}, cmpCard: () => '', h: String, statusOf: () => 0, priorityChip: () => '', removeExactIntroRepeat: (_lead, rest) => rest, state: {qaMode: 'full'}, learnerLabel: (_kind, value) => value, pageHead: () => '', callout: () => '', ICON: {img: ''}, href: () => '#'};
  let qaCount = 0, otherCount = 0;
  const kinds = new Set(), assetPaths = new Set();
  for (const entry of entries) {
    if (entry.kind === 'qa') {
      for (const [index, value] of entry.items.entries()) {
        const expected = [...sources(value.lead), ...sources(value.a)];
        if (!expected.length) continue;
        const item = {...value, key: entry.id + '#' + index, no: index + 1};
        const html = runInNewContext(qa + ';qaListHtml([item], {mode: "full"})', {...context, item});
        assert.deepEqual(renderedSources(html), expected, item.key);
        qaCount += expected.length;
        expected.forEach(src => assetPaths.add(src));
      }
    } else {
      const expected = [...sources(entry.html), ...sources(entry.readingNotesHtml), ...sources(entry.supplementHtml)];
      if (!expected.length) continue;
      assert.ok(['algo', 'handwrite', 'database', 'doc'].includes(entry.kind), entry.id);
      if (sources(entry.html).length) assert.equal(entry.kind, 'doc', entry.id);
      const html = runInNewContext(pager + doc + (entry.kind === 'doc' ? ';renderDoc(entry)' : ';pager(entry)'), {...context, entry, TREE: {[entry.mod]: {all: [entry]}}});
      assert.deepEqual(renderedSources(html), expected, entry.id);
      otherCount += expected.length;
      kinds.add(entry.kind);
      expected.forEach(src => assetPaths.add(src));
    }
  }
  // Lower bounds preserve coverage of the reviewed 58-image corpus while
  // allowing independently authored future diagrams to use the same rule.
  assert.ok(qaCount >= 47); assert.ok(otherCount >= 11);
  const countImages = value => typeof value === 'string' ? sources(value).length : value && typeof value === 'object' ? Object.values(value).reduce((sum, child) => sum + countImages(child), 0) : 0;
  assert.equal(qaCount + otherCount, countImages(entries), 'every raw content image is exercised through its real renderer');
  t.diagnostic(`Matched ${qaCount} QA and ${otherCount} non-QA content images; no raw image left outside the rendered selector checks.`);
  assert.deepEqual([...kinds].sort(), ['algo', 'database', 'doc', 'handwrite']);
  for (const src of assetPaths) {
    assert.ok(src.startsWith('assets/imported/'));
    assert.deepEqual(await readFile(new URL('dist/' + src, root)), await readFile(new URL('public/' + src, root)), src);
  }
});

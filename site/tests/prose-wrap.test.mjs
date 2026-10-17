import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
const source = await read('src/styles/main.css');
const override = await read('src/style-overrides/prose-wrap.css');
const built = await read('dist/assets/styles/main.css');
// Structural CSS contract tests, not a substitute for a real narrow-window check.
const rules = [...override.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]+)\}/g)]
  .map(([, selector, declarations]) => ({
    selectors: selector.split(',').map(s => s.trim()),
    declarations: declarations.trim().replace(/\s+/g, ' '),
  }));

test('normal build appends only the maintained prose wrap override to preserved CSS', () => {
  assert.equal(createHash('sha256').update(source).digest('hex'),
    'c0d6e85869ebe2027c332b2e1acf3e1207c1e5571617b650ffc15830198dc8bb');
  assert.equal(built, source + '\n' + override);
  assert.deepEqual(rules, [
    {selectors:['.md .md-p', '.md .md-list li'], declarations:'overflow-wrap: anywhere;'},
    {selectors:['.md pre', '.md .code-card'], declarations:'overflow-wrap: normal;'},
  ]);
  assert.ok(!override.includes('break-all'));
});

test('code preformatted whitespace, max-content lines and card scrolling remain intact', () => {
  const rule = selector => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return built.match(new RegExp('(?:^|\\n)' + escaped + ' \\{([^}]+)\\}'))?.[1];
  };
  assert.match(rule('.code-scroll'), /overflow: auto;/);
  assert.match(rule('.code-scroll > code'), /min-width: max-content;/);
  assert.match(rule('.code-line'), /grid-template-columns: 46px max-content;/);
  assert.match(rule('.code-text'), /white-space: pre;/);
  assert.match(rule('.md-pre'), /white-space: pre;/);
  assert.deepEqual(rules[1].selectors, ['.md pre', '.md .code-card']);
});

test('compatibility build keeps original CSS bytes without prose overrides', async () => {
  // npm test builds this isolated target; direct focused runs use current normal output only.
  if (process.env.NOTES_TEST_DIST) {
    assert.equal(await read(process.env.NOTES_TEST_DIST + '/assets/styles/main.css'), source);
    assert.equal(await read(process.env.NOTES_TEST_DIST + '/index.html'), await read('src/index.html'));
  }
  assert.equal(await read('dist/index.html'), await read('src/index.html'));
});

test('RPC historical URL wrapping fixture and exact approved current paragraphs retain wrapping contracts', async () => {
  const catalog = JSON.parse(await read('dist/data/catalog.json'));
  const record = catalog.entries.find(e => e.id === 'scenario-rpc-framework');
  const chapter = JSON.parse(await read('dist/' + record._chunk));
  const entry = chapter.entries.find(e => e.id === record.id);
  const hash = value => createHash('sha256').update(value).digest('hex');
  const primaryRaw = await read('tests/fixtures/backend-scenario/scenario-02-staged-leaf-replacements.json');
  const spansRaw = await read('tests/fixtures/backend-scenario/backend-scenario-independent-scenario02-additional-spans.json');
  assert.equal(hash(primaryRaw), '5719bcccb378571aa87429c61d14ad06feeee134209c169ac1e14c466a96aa84');
  assert.equal(hash(spansRaw), 'd77de868ed8fef7ee3af8eff895a281ce3c269d86b59d5e88f536b7dbfef6306');
  const leaves = JSON.parse(primaryRaw).filter(r => r.entryId === record.id && JSON.stringify(r.field) === '["supplementHtml"]');
  assert.equal(leaves.length, 1);
  const leaf = leaves[0];
  assert.equal(hash(JSON.stringify(leaf.before)), leaf.beforeSha256);
  assert.equal(hash(JSON.stringify(leaf.after)), leaf.afterSha256);
  const spans = JSON.parse(spansRaw).filter(r => r.entryId === record.id && JSON.stringify(r.field) === '["supplementHtml"]');
  assert.equal(spans.length, 2);
  let expected = leaf.after;
  for (const span of spans) {
    assert.equal(span.occurrences, 1);
    assert.equal(expected.split(span.before).length - 1, span.occurrences);
    expected = expected.split(span.before).join(span.after);
  }
  assert.equal(entry.supplementHtml, expected, 'Entire current supplement permits only frozen approved changes');
  const currentParagraphs = entry.supplementHtml.match(/<p class="md-p">[\s\S]*?<\/p>/g);
  for (const span of spans) {
    assert.ok(currentParagraphs.some(p => p.includes(span.after)), 'Approved replacement remains in a wrapping prose paragraph');
    assert.ok(!entry.supplementHtml.includes(span.before));
  }
  // The approved self-contained prose replaces the two external chapter promises.
  // Retain their exact historical long-URL regression fixture and CSS contract.
  const paragraphs = leaf.before.match(/<p class="md-p">[\s\S]*?<\/p>/g);
  for (const anchor of ['doxcnscZbuw68LczSu2kC4g7Msm', 'doxcnXkQN5IVmzPI2hOUzSn3oyh']) {
    const url = 'https://my.feishu.cn/wiki/IBIsw3LiEifgaOkFnrCcquA1nQH#' + anchor;
    const paragraph = paragraphs.find(p => p.includes(url));
    assert.ok(paragraph, 'Long URL must remain byte-exact in the original paragraph');
    assert.ok(!paragraph.includes('<a '), 'Regression covers plain prose, not already-wrapping anchors');
    assert.ok(rules[0].selectors.includes('.md .md-p'));
    assert.equal(rules[0].declarations, 'overflow-wrap: anywhere;');
  }
});

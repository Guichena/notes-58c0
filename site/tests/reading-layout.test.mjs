import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
const css = await read('src/style-overrides/reading-layout.css');
const index = await read('src/index.html');
const sourceCSS = await read('src/styles/main.css');
const plainCSS = css.replace(/\/\*[\s\S]*?\*\//g, '');
const selectorRule = selector => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const found = [...plainCSS.matchAll(new RegExp('(?:^|[}\\n])\\s*' + escaped + '\\s*\\{([^}]+)\\}', 'g'))];
  assert.ok(found.length, `Missing exact rule: ${selector}`);
  return found.map(match => match[1]).join('\n');
};
const luminance = hex => {
  const rgb = hex.replace('#', '').match(/../g).map(x => parseInt(x, 16) / 255)
    .map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
};
const contrast = (a, b) => {
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
};

test('reading stylesheet is explicit, ordered, deterministic and separate from immutable main CSS', async () => {
  const href = './assets/styles/reading-layout.css';
  assert.equal(index.split(`href="${href}"`).length - 1, 1);
  assert.ok(index.indexOf(href) > index.indexOf('./assets/styles/loading.css'));
  assert.equal(await read('dist/index.html'), index);
  assert.equal(await read('dist/assets/styles/reading-layout.css'), css);
  assert.equal(createHash('sha256').update(sourceCSS).digest('hex'),
    'c0d6e85869ebe2027c332b2e1acf3e1207c1e5571617b650ffc15830198dc8bb');
  assert.equal(await read('dist/assets/styles/main.css'), sourceCSS + '\n' + await read('src/style-overrides/prose-wrap.css'));
  if (process.env.NOTES_TEST_DIST) {
    assert.equal(await read(process.env.NOTES_TEST_DIST + '/assets/styles/reading-layout.css'), '');
    assert.equal(await read(process.env.NOTES_TEST_DIST + '/assets/styles/main.css'), sourceCSS);
  }
});

test('normal-size secondary text and comments meet 4.5:1 on their theme surfaces', () => {
  const light = selectorRule(':root');
  const dark = selectorRule(':root[data-theme="dark"]');
  const automaticDark = selectorRule(':root:not([data-theme="light"])');
  const token = (rule, name) => rule.match(new RegExp(name + ':\\s*(#[0-9a-f]{6})'))?.[1];
  for (const [theme, rule, surfaces, code] of [
    ['light', light, ['#ffffff', '#f6f5f1', '#f7f6f2', '#eeede7'], ['#f8f7f4', '#efeee9']],
    ['dark', dark, ['#18191c', '#131416', '#1d1e22', '#25272c'], ['#111214', '#1a1b1f']],
  ]) {
    for (const background of surfaces) {
      assert.ok(contrast(token(rule, '--muted'), background) >= 4.5, `${theme} secondary text on ${background}`);
    }
    for (const background of code) {
      assert.ok(contrast(token(rule, '--tk-com'), background) >= 4.5, `${theme} code comments on ${background}`);
    }
  }
  assert.equal(token(dark, '--muted'), token(automaticDark, '--muted'));
  assert.equal(token(dark, '--tk-com'), token(automaticDark, '--tk-com'));
});

test('all overview grids cap minimum column width to the available reading column', () => {
  for (const selector of ['.mod-grid', '.cat-grid', '.weeks', '.method', '.hm-home']) {
    assert.match(selectorRule(selector), /repeat\(auto-fit, minmax\(min\(100%, \d+em\), 1fr\)\)/);
  }
  assert.match(selectorRule('.grid2.reading-single-panel'), /grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(selectorRule('.mod-card p'), /font-size: \.92em;/);
  assert.match(selectorRule('.mod-card p'), /color: var\(--text-2\);/);
  assert.match(selectorRule('.mod-card .nums'), /font-size: max\(12px, \.8em\);/);
});

test('font controls, full answers, QA modes and preformatted code are not overridden', () => {
  assert.doesNotMatch(plainCSS, /--fs\s*:/);
  assert.doesNotMatch(plainCSS, /data-font|data-mode|visibility\s*:\s*hidden|line-clamp|break-all/);
  const hiddenRules = [...plainCSS.matchAll(/([^{}]+)\{([^{}]*display\s*:\s*none[^{}]*)\}/g)];
  assert.deepEqual(hiddenRules.map(match => match[1].trim()), ['.brand-mark']);
  assert.doesNotMatch(plainCSS, /white-space\s*:\s*pre-wrap/);
  assert.match(selectorRule('.md'), /line-height: 1\.82;/);
  assert.match(plainCSS, /\.md pre, \.md \.code-card\s*\{\s*overflow-wrap: normal;/);
  assert.match(plainCSS, /\.qa-rest b, \.qa-lead b\s*\{\s*color: var\(--text\);/);
});

test('tables stay semantic and scroll inside their container, with visible keyboard focus', () => {
  assert.match(selectorRule('.md table'), /border-collapse: collapse;/);
  assert.doesNotMatch(selectorRule('.md table'), /display\s*:/);
  assert.match(plainCSS, /\.md-table-wrap, \.tbl-wrap, \.sx-tbl-wrap, \.reading-table-scroll\s*\{[^}]*max-width: 100%;[^}]*overflow-x: auto;/);
  assert.match(plainCSS, /\.reading-table-scroll:focus-visible,[\s\S]*?outline: 2px solid var\(--accent\);/);
  assert.match(selectorRule('.reading-heading-anchor'), /scroll-margin-top: calc\(var\(--top-h\) \+ 24px\);/);
  assert.match(plainCSS, /@media \(prefers-reduced-motion: reduce\)/);
});


test('320px header keeps all action buttons and accessible names while reducing decorative width', () => {
  const narrow = plainCSS.match(/@media \(max-width: 360px\) \{([\s\S]+?)\n\}/)?.[1];
  assert.ok(narrow);
  assert.match(narrow, /\.topbar \{ gap: 6px; padding-inline: 8px; \}/);
  assert.match(narrow, /\.brand-mark \{ display: none; \}/);
  assert.match(narrow, /\.topbar \.icon-btn, \.topbar \.search-trigger \{ flex-shrink: 0; \}/);
  assert.doesNotMatch(narrow, /font-size:|width:|height:/);
  for (const id of ['nav-toggle', 'search-trigger', 'font-btn', 'theme-btn']) {
    assert.match(index, new RegExp('<button[^>]*id="' + id + '"[^>]*aria-label="[^" >][^"]*"'));
  }
  assert.match(index, /<a class="brand"[^>]*aria-label="回到冲刺台"/);
});


test('literal prose bullets receive hanging indentation without generated or suppressed text', () => {
  const rule = selectorRule('.md p.reading-literal-bullet');
  assert.match(rule, /margin-block: \.35em;/);
  assert.match(rule, /padding-inline-start: \.8em;/);
  assert.match(rule, /text-indent: -\.8em;/);
  assert.doesNotMatch(plainCSS, /reading-literal-bullet(?:\s*::|[^}]*content\s*:)/);
});


test('search palette protects filter chips and controls while only its results shrink and scroll', () => {
  assert.match(plainCSS, /\.palette-input, \.palette-scope, \.palette-foot \{ flex-shrink: 0; \}/);
  const results = selectorRule('.palette-list');
  assert.match(results, /min-height: 0;/);
  assert.match(results, /overflow-y: auto;/);
  assert.match(results, /overscroll-behavior-y: contain;/);
  assert.doesNotMatch(results, /(?:^|;)\s*(?:height|max-height):/);
  // Retain viewport-bound height, mobile placement, horizontal scope scrolling,
  // and the existing 26px chips. Fixed-height controls must not collapse to 19px.
  assert.match(sourceCSS, /\.palette-box \{[^}]*max-height: 78vh;/);
  assert.match(sourceCSS, /\.palette-scope \{[^}]*overflow-x: auto;/);
  assert.match(sourceCSS, /\.palette-scope button \{[^}]*height: 26px;/);
  assert.match(sourceCSS, /\.palette \{ padding-top: 12px; \}/);
  assert.doesNotMatch(plainCSS, /\.palette(?:-box|-scope)?\s*\{[^}]*\b(?:height|max-height|overflow):/);
});

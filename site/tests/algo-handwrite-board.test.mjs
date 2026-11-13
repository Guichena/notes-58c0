import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {attachHandwriteBoard, parseHandwriteRanking} from '../scripts/algo-handwrite-board.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const markdown = await readFile(new URL('../content/algo-board/handwrite-ranking.md', import.meta.url), 'utf8');
const catalog = JSON.parse(await readFile(new URL('../dist/data/catalog.json', import.meta.url), 'utf8'));

test('the checked-in ranking is the 65-problem original board', () => {
  const rows = parseHandwriteRanking(markdown);
  assert.equal(rows.length, 65);
  assert.equal(rows[0].title, 'LRU 缓存');
  assert.equal(rows[0].frequency, 70);
  assert.equal(rows.filter((row) => row.type === '链表').length, 15);
  assert.ok(markdown.includes('1015 个题目簇'));
});

test('every ranked problem opens a real page, except the two written on the board', () => {
  const entries = catalog.entries.filter((entry) => entry.id !== 'algo-handwrite-board').map((entry) => ({...entry}));
  const rows = attachHandwriteBoard(entries, markdown);
  const page = entries.find((entry) => entry.id === 'algo-handwrite-board');
  assert.equal(page.mod, 'algo');
  assert.equal(page.part, '考频速览');
  assert.equal(page.cat, '原题榜');
  assert.equal((page.html.match(/class="kb-point"/g) || []).length, 65);
  assert.equal((page.html.match(/href="#\/e\//g) || []).length >= 63, true);
  for (const id of ['146', '3', '25', 'lc-face-extra-20', 'own-algo-gap-kth-list-node', 'nonlc-4-1', 'singleton-dcl', '225', 'lc-face-extra-23']) {
    assert.ok(page.html.includes('#/e/' + id), id);
  }
  assert.ok(page.html.includes('id="algo-gap-435"'));
  assert.ok(page.html.includes('id="algo-gap-ip-port"'));
  assert.ok(page.html.includes('eraseOverlapIntervals'));
  assert.ok(page.html.includes('seg[0] &gt;= end') || page.html.includes('seg[0] >= end'));
  assert.ok(page.html.includes('ip &lt;&lt; 16') || page.html.includes('ip << 16'));
  assert.equal(rows.filter((row) => row.lc === '435').length, 1);
  assert.throws(() => attachHandwriteBoard(entries, markdown), /duplicate/);
});

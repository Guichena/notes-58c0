import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {attachHandwriteBoard, boardRankIds, parseHandwriteRanking, projectHandwriteBoardRuntime} from '../scripts/algo-handwrite-board.mjs';

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
  assert.equal((page.html.match(/class="ab-row/g) || []).length, 65);
  assert.ok(!page.html.includes('kb-top-table'));
  assert.ok(page.html.indexOf('LRU 缓存') < page.html.indexOf('无重复字符的最长子串'));
  assert.ok(page.html.indexOf('无重复字符的最长子串') < page.html.indexOf('K 个一组翻转链表'));
  assert.ok(page.html.includes('#/e/handwrite-47'));
  assert.equal((page.html.match(/href="#\/e\//g) || []).length >= 63, true);
  const rank = boardRankIds(markdown);
  assert.equal(rank.length, 63);
  assert.deepEqual(rank.slice(0, 3), ['146', '3', '25']);
  const pager = projectHandwriteBoardRuntime('src/app/fragments.js', 'function pager(e) {\n  const list = TREE[e.mod].all;\n  const i = list.indexOf(e);\n  return list;\n}\n');
  assert.ok(pager.includes('const ALGO_RANK = '));
  assert.ok(pager.includes("e.id === 'algo-handwrite-board'"));
  const side = projectHandwriteBoardRuntime('src/app/navigation.js', "  list.innerHTML = html || '<div class=\"side-empty\">没有匹配的条目</div>';\n");
  assert.ok(side.includes('按考频'));
  assert.ok(side.includes('data-ab-type'));
  const catalogJs = projectHandwriteBoardRuntime('src/app/catalog.js', "start: ['p-hash', '1'],\nstart: ['handwrite-45', 'database-71'],\n");
  assert.ok(catalogJs.includes("start: ['algo-handwrite-board']"));
  assert.ok(catalogJs.includes("start: ['handwrite-47', 'handwrite-46', 'handwrite-50']"));
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

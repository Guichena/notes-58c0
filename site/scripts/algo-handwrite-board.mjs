// Interview original-problem board. The ranking markdown is the source of
// truth; each row opens the existing problem page. Two problems have no page
// of their own, so their solution is written here instead of a dead link.
import {readFileSync} from 'node:fs';

const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const TYPE_ORDER = ['链表','动态规划','二叉树 / 树','双指针 / 贪心 / 单调栈','哈希 / 前缀和 / 位运算','字符串 / 大数','栈 / 队列','回溯','图 / 网格 / 并查集','其他','滑动窗口','堆 / Top-K','二分','随机 / 数学','并发手撕'];
const TYPE_SLUG = {
  '链表': 'list', '动态规划': 'dp', '二叉树 / 树': 'tree', '双指针 / 贪心 / 单调栈': 'two',
  '哈希 / 前缀和 / 位运算': 'hash', '字符串 / 大数': 'str', '栈 / 队列': 'stack', '回溯': 'back',
  '图 / 网格 / 并查集': 'graph', '其他': 'other', '滑动窗口': 'window', '堆 / Top-K': 'heap',
  '二分': 'binary', '随机 / 数学': 'math', '并发手撕': 'concurrent'
};
const TYPE_TOPIC = {
  '链表': 'p-list',
  '动态规划': 'p-dp',
  '二叉树 / 树': 'p-tree',
  '双指针 / 贪心 / 单调栈': 'p-twoptr',
  '哈希 / 前缀和 / 位运算': 'p-hash',
  '字符串 / 大数': 'p-array',
  '栈 / 队列': 'p-stack',
  '回溯': 'p-backtrack',
  '图 / 网格 / 并查集': 'p-graph',
  '其他': 'p-array',
  '滑动窗口': 'p-window',
  '堆 / Top-K': 'p-heap',
  '二分': 'p-bsearch',
  '随机 / 数学': 'p-math',
  '并发手撕': 'p-special'
};
// No LC id, or the LC number is not the entry id.
const SPECIAL = {
  '链表倒数第 K 个节点': 'own-algo-gap-kth-list-node',
  '线程安全的 LRU': 'nonlc-4-1',
  '单例模式': 'singleton-dcl',
  '用队列实现栈、用栈实现队列': '225',
  '长度最小的子数组': 'lc-face-extra-20'
};
const CODE_TWIN = {
  'LRU 缓存': 'handwrite-47',
  '线程安全的 LRU': 'handwrite-47',
  '数组中第 K 个最大元素': 'handwrite-46',
  '单例模式': 'handwrite-50'
};

export function parseHandwriteRanking(markdown) {
  const rows = [];
  for (const line of String(markdown).replace(/\r\n?/g,'\n').split('\n')) {
    const cells = line.split('|').map((cell) => cell.trim());
    if (cells.length < 7 || cells[0] !== '' || !/^\d+$/.test(cells[1])) continue;
    const rank = Number(cells[1]);
    const title = cells[2];
    const lc = cells[3];
    const frequency = Number(cells[4]);
    const type = cells[5];
    if (!title || !Number.isInteger(frequency) || !type) throw new Error('Handwrite board: bad row ' + line);
    rows.push({rank, title, lc, frequency, type});
  }
  if (rows.length !== 65) throw new Error('Handwrite board: expected 65 problems, got ' + rows.length);
  if (rows.some((row, index) => row.rank !== index + 1)) throw new Error('Handwrite board: ranks are not 1..65');
  for (const row of rows) if (!TYPE_ORDER.includes(row.type)) throw new Error('Handwrite board: unknown type ' + row.type);
  return rows;
}

function gapHtml(row) {
  if (row.title === '无重叠区间') {
    return `<section class="kb-lecture" id="algo-gap-435"><h3 class="md-h md-h3">${row.rank}. 无重叠区间</h3><p class="md-p">LC435。榜单把它归在链表里，题本身是区间贪心：删掉最少的区间，使剩下的互不重叠。端点相接不算重叠。</p><p class="md-p">按结束时间升序。已经保留的区间里，结束最早的那个最容易接上下一个。当前起点不早于上一个结束，就保留，否则丢掉。答案是总数减去保留数。</p><p class="md-p">按起点排序会错：先碰到一个拉得很长的区间，会挡住后面很多短区间。和 LC56 合并区间不是同一问，56 要输出合并后的段，这题只问删几个。</p><div class="code-card md-code-card"><div class="code-toolbar"><span class="file-label">Solution.java</span></div><div class="code-scroll"><pre class="md-pre" data-lang="java">${esc(`int eraseOverlapIntervals(int[][] a) {
    Arrays.sort(a, (x, y) -> Integer.compare(x[1], y[1]));
    int keep = 0, end = Integer.MIN_VALUE;
    for (int[] seg : a) {
        if (seg[0] >= end) { keep++; end = seg[1]; }
    }
    return a.length - keep;
}`)}</pre></div></div><p class="md-p">排序 O(n log n)，扫描 O(n)。区间端点用 int 比较，不要减出来比较，极端值会溢出。<a href="#/e/p-greedy">贪心与区间专题 →</a></p></section>`;
  }
  if (row.title === 'IP + 端口转成 uint64') {
    return `<section class="kb-lecture" id="algo-gap-ip-port"><h3 class="md-h md-h3">${row.rank}. IP + 端口转成 uint64</h3><p class="md-p">IPv4 是 4 个 0~255 的字节，端口是 0~65535。放进一个 64 位无符号数时要先说布局：这里把 IP 放在低 32 位之上的 16 位空档之外，也就是 IP 占 [47,16]，端口占 [15,0]，最高 16 位是 0。</p><p class="md-p">每一段先校验再移位。Java 的 int 是有符号的，单字节左移前要转成 long，否则 192&lt;&lt;24 会变成负数，再或端口时高位被符号扩展。</p><div class="code-card md-code-card"><div class="code-toolbar"><span class="file-label">Solution.java</span></div><div class="code-scroll"><pre class="md-pre" data-lang="java">${esc(`long pack(int a, int b, int c, int d, int port) {
    if ((a | b | c | d) < 0 || a > 255 || b > 255 || c > 255 || d > 255)
        throw new IllegalArgumentException("ip");
    if (port < 0 || port > 65535) throw new IllegalArgumentException("port");
    long ip = ((long) a << 24) | ((long) b << 16) | ((long) c << 8) | d;
    return (ip << 16) | port;
}`)}</pre></div></div><p class="md-p">拆开是反向移位再掩 0xff / 0xffff。如果面试官要把端口放在高 16 位，先改布局再写，不要默默换。只转 IP、不带端口的写法在 <a href="#/e/nonlc-5-4">IP 转 32 位无符号整数 →</a></p></section>`;
  }
  throw new Error('Handwrite board: no lecture for ' + row.title);
}

function resolveTarget(row, byId, byNumber) {
  if (Object.hasOwn(SPECIAL, row.title)) {
    const id = SPECIAL[row.title];
    if (!byId.has(id)) throw new Error('Handwrite board: missing special target ' + id);
    return {id, gap: false};
  }
  if (row.lc !== '—' && byId.has(row.lc)) return {id: row.lc, gap: false};
  if (row.lc !== '—') {
    const hits = byNumber.get(row.lc) || [];
    if (hits.length === 1) return {id: hits[0], gap: false};
    if (hits.length > 1) throw new Error('Handwrite board: ambiguous LC ' + row.lc);
  }
  if (row.title === '无重叠区间' || row.title === 'IP + 端口转成 uint64') return {id: '', gap: true};
  throw new Error('Handwrite board: no problem page for ' + row.title);
}

function gapAnchor(row) {
  return row.title === '无重叠区间' ? 'algo-gap-435' : 'algo-gap-ip-port';
}
export function handwriteBoardHtml(rows, entries) {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const byNumber = new Map();
  for (const entry of entries) {
    if (entry.mod !== 'algo') continue;
    const number = String(entry.number ?? '');
    if (!/^\d+$/.test(number)) continue;
    if (!byNumber.has(number)) byNumber.set(number, []);
    byNumber.get(number).push(entry.id);
  }
  const resolved = rows.map((row) => ({...row, target: resolveTarget(row, byId, byNumber)}));
  const maxFreq = resolved[0]?.frequency || 1;
  const filters = `<div class="ab-filters"><button type="button" class="on" data-ab-type="all">全部 65</button>${TYPE_ORDER.map((type) => {
    const n = resolved.filter((row) => row.type === type).length;
    return `<button type="button" data-ab-type="${esc(type)}">${esc(type.split(' / ')[0])} <b>${n}</b></button>`;
  }).join('')}</div>`;
  const list = `<ol class="ab-list">${resolved.map((row) => {
    const href = row.target.gap ? '#' + gapAnchor(row) : '#/e/' + encodeURIComponent(row.target.id);
    const twin = CODE_TWIN[row.title];
    const twinLink = twin && byId.has(twin) ? `<a class="ab-twin" href="#/e/${twin}">工程手撕</a>` : '';
    const pairId = row.title.includes('用栈实现队列') ? (byNumber.get('232') || [])[0] : '';
    const pair = pairId ? `<a class="ab-twin" href="#/e/${encodeURIComponent(pairId)}">LC232</a>` : '';
    const lc = row.lc === '—' ? '无题号' : 'LC ' + row.lc;
    return `<li class="ab-row${row.rank <= 3 ? ' ab-top' : ''}" data-type="${esc(row.type)}" style="--w:${Math.max(8, Math.round(row.frequency / maxFreq * 100))}%"><a class="ab-hit" href="${href}"><span class="ab-rank">${String(row.rank).padStart(2, '0')}</span><span class="ab-main"><span class="ab-title">${esc(row.title)}</span><span class="ab-sub"><span class="ab-chip">${esc(row.type.split(' / ')[0])}</span><span>${esc(lc)}</span>${row.target.gap ? '<span>解法在本页</span>' : ''}</span></span><span class="ab-freq"><b>${row.frequency}</b><i class="ab-bar"></i></span></a>${twinLink}${pair}</li>`;
  }).join('')}</ol>`;
  const lectures = resolved.filter((row) => row.target.gap).map((row) => `<div class="ab-gap" data-type="${esc(row.type)}">${gapHtml(row)}</div>`).join('');
  return `<div class="ab-page"><p class="ab-lead">按面经出现次数从高到低。点一行进入题解，上一题 / 下一题也按这个顺序。工程向的 LRU、Top-K、单例另外链到代码手撕。</p>${filters}${list}<div class="ab-gaps">${lectures}</div></div>`;
}
export function boardRankIds(markdown) {
  return parseHandwriteRanking(markdown).flatMap((row) => {
    if (row.title === '无重叠区间' || row.title === 'IP + 端口转成 uint64') return [];
    if (Object.hasOwn(SPECIAL, row.title)) return [SPECIAL[row.title]];
    if (/^\d+$/.test(row.lc)) return [row.lc];
    return [];
  });
}

export function attachHandwriteBoard(entries, markdown = readFileSync(new URL('../content/algo-board/handwrite-ranking.md', import.meta.url), 'utf8')) {
  if (entries.some((entry) => entry.id === 'algo-handwrite-board')) throw new Error('Handwrite board: duplicate entry');
  const rows = parseHandwriteRanking(markdown);
  const html = handwriteBoardHtml(rows, entries);
  entries.push({
    id: 'algo-handwrite-board',
    kind: 'doc',
    mod: 'algo',
    part: '考频速览',
    cat: '原题榜',
    title: '手撕算法原题榜',
    number: '原题',
    source: '手撕算法原题榜',
    lead: '65 道按面经出现次数从高到低排好。点进去就是题解，上一题和下一题也沿着这个顺序走。',
    html
  });
  return rows;
}

const PAGER_FROM = `function pager(e) {
  const list = TREE[e.mod].all;
  const i = list.indexOf(e);`;
const SIDE_FROM = `  list.innerHTML = html || '<div class="side-empty">没有匹配的条目</div>';`;
const ALGO_START_FROM = `start: ['p-hash', '1']`;
const CODE_START_FROM = `start: ['handwrite-45', 'database-71']`;

export function projectHandwriteBoardRuntime(file, text, {baselineTest = false} = {}) {
  if (baselineTest) return text;
  const markdown = readFileSync(new URL('../content/algo-board/handwrite-ranking.md', import.meta.url), 'utf8');
  const algoRank = boardRankIds(markdown);
  const codeRank = [
    {id: 'handwrite-47', n: 1},
    {id: 'handwrite-46', n: 11},
    {id: 'handwrite-50', n: 59}
  ];
  if (file === 'src/app/fragments.js') {
    if (!text.includes(PAGER_FROM)) throw new Error('Handwrite board: pager boundary missing');
    const decl = `const ALGO_RANK = ${JSON.stringify(algoRank)};
const CODE_RANK = ${JSON.stringify(codeRank.map((row) => row.id))};
const CODE_RANK_NO = ${JSON.stringify(codeRank.map((row) => row.n))};
function handwriteChain(ids, head) {
  return (head ? [byId.get(head)] : []).concat(ids.map((id) => byId.get(id))).filter(Boolean);
}
`;
    return text.replace(PAGER_FROM, decl + `function pager(e) {
  let list = TREE[e.mod].all;
  let i = list.indexOf(e);
  if (e.id === 'algo-handwrite-board') {
    list = handwriteChain(ALGO_RANK, 'algo-handwrite-board');
    i = 0;
  } else if (ALGO_RANK.indexOf(e.id) >= 0) {
    list = handwriteChain(ALGO_RANK, 'algo-handwrite-board');
    i = list.findIndex((item) => item.id === e.id);
  } else if (CODE_RANK.indexOf(e.id) >= 0) {
    list = handwriteChain(CODE_RANK);
    i = list.findIndex((item) => item.id === e.id);
  }`);
  }
  if (file === 'src/app/navigation.js') {
    if (!text.includes(SIDE_FROM)) throw new Error('Handwrite board: sidebar boundary missing');
    const injected = `  if ((state.mod === 'algo' || state.mod === 'code') && typeof ALGO_RANK !== 'undefined' && sf === '') {
    const source = state.mod === 'algo' ? ALGO_RANK : CODE_RANK;
    const links = source.map((id, index) => {
      const entry = byId.get(id);
      if (!entry) return '';
      if (q && !(entry.title + ' ' + (entry.number || '')).toLowerCase().includes(q)) return '';
      const n = state.mod === 'algo' ? index + 1 : CODE_RANK_NO[index];
      return \`<a class="side-item ab-side\${cur === entry ? ' active' : ''}" href="\${href(entry)}"><span class="ab-side-n">\${n}</span><span class="t">\${h(entry.title)}</span><span class="n">\${h(entry.number || '')}</span></a>\`;
    }).join('');
    if (links) html = \`<div class="side-part">按考频</div><div class="ab-side-list">\${links}</div>\` + html;
  }
  ` + SIDE_FROM;
    const listener = `
document.addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-ab-type]');
  if (!btn) return;
  const page = btn.closest('.ab-page');
  if (!page) return;
  const type = btn.getAttribute('data-ab-type');
  page.querySelectorAll('.ab-filters button').forEach((item) => item.classList.toggle('on', item === btn));
  page.querySelectorAll('.ab-row, .ab-gap').forEach((item) => { item.hidden = type !== 'all' && item.getAttribute('data-type') !== type; });
});
`;
    return text.replace(SIDE_FROM, injected) + listener;
  }
  if (file === 'src/app/catalog.js') {
    if (!text.includes(ALGO_START_FROM) || !text.includes(CODE_START_FROM)) throw new Error('Handwrite board: module start boundary missing');
    return text.replace(ALGO_START_FROM, `start: ['algo-handwrite-board']`).replace(CODE_START_FROM, `start: ['handwrite-47', 'handwrite-46', 'handwrite-50']`);
  }
  return text;
}

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
  '用队列实现栈、用栈实现队列': '225'
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
  const href = (row) => row.target.gap
    ? '#' + (row.title === '无重叠区间' ? 'algo-gap-435' : 'algo-gap-ip-port')
    : '#/e/' + encodeURIComponent(row.target.id);
  const intro = `<div class="kb-map-intro"><a href="#algo-board-top">原题总榜 65</a><a href="#algo-board-types">按题型汇总</a>${TYPE_ORDER.map((type) => `<a href="#algo-type-${TYPE_SLUG[type]}">${esc(type.split(' / ')[0])}</a>`).join('')}</div>`;
  const top = `<h2 class="md-h md-h2" id="algo-board-top">原题总榜</h2><p class="md-p">同一篇面经里重复出现只算一次。带题号的按 LC 归并。点题目进入这道题的题解；没有独立题页的两道，解法写在本页。</p><div class="tbl-wrap kb-top-table"><table class="tbl"><thead><tr><th>#</th><th>题目</th><th>LC</th><th>题型</th><th>次数</th></tr></thead><tbody>${resolved.map((row) => `<tr><td class="kb-rank">${row.rank}</td><td><a href="${href(row)}">${esc(row.title)}</a></td><td>${esc(row.lc)}</td><td><span class="kb-direction">${esc(row.type)}</span></td><td class="kb-frequency"><b>${row.frequency}</b></td></tr>`).join('')}</tbody></table></div>`;
  const groups = TYPE_ORDER.map((type) => {
    const items = resolved.filter((row) => row.type === type);
    const times = items.reduce((sum, row) => sum + row.frequency, 0);
    const hottest = [...items].sort((a, b) => b.frequency - a.frequency || a.rank - b.rank).slice(0, 3)
      .map((row) => `${row.title}（${row.frequency}）`).join('、');
    return {type, items, times, hottest};
  });
  const summary = `<h2 class="md-h md-h2" id="algo-board-types">按题型汇总</h2><div class="tbl-wrap kb-top-table"><table class="tbl"><thead><tr><th>#</th><th>题型</th><th>题数</th><th>最常考</th><th>次数</th></tr></thead><tbody>${groups.map((group, index) => {
    const topic = TYPE_TOPIC[group.type];
    const topicLink = byId.has(topic) ? `<a href="#/e/${topic}">${esc(group.type)}</a>` : esc(group.type);
    return `<tr><td class="kb-rank">${index + 1}</td><td>${topicLink}</td><td>${group.items.length}</td><td>${esc(group.hottest)}</td><td class="kb-frequency"><b>${group.times}</b></td></tr>`;
  }).join('')}</tbody></table></div>`;
  const detail = groups.map((group) => {
    const topic = TYPE_TOPIC[group.type];
    const more = byId.has(topic) ? `<a href="#/e/${topic}">打开${esc(byId.get(topic).title)} →</a>` : '';
    const cards = group.items.map((row) => {
      const pairId = (byNumber.get('232') || [])[0];
      const pair = row.title.includes('用栈实现队列') && pairId ? ` · <a href="#/e/${encodeURIComponent(pairId)}">另一半 LC232</a>` : '';
      return `<article class="kb-point" id="algo-board-${row.rank}"><div class="kb-point-main"><span class="kb-point-no">${row.rank}</span><div><a class="kb-point-title" href="${href(row)}">${esc(row.title)}</a><p>${row.lc === '—' ? '无 LC 题号' : 'LC ' + esc(row.lc)}${row.target.gap ? ' · 解法在本页' : ''}${pair}</p></div></div><div class="kb-point-meta"><span class="kb-frequency"><b>${row.frequency}</b> 次</span><span>${row.target.gap ? '本页题解 →' : '题解 →'}</span></div></article>`;
    }).join('');
    const lectures = group.items.filter((row) => row.target.gap).map(gapHtml).join('');
    return `<section class="kb-map-section"><h3 class="md-h md-h3" id="algo-type-${TYPE_SLUG[group.type]}">${esc(group.type)}（${group.items.length} 道）</h3><p class="md-p">${more}</p><div class="kb-points">${cards}</div>${lectures}</section>`;
  }).join('');
  return intro + top + summary + `<h2 class="md-h md-h2" id="algo-board-all">按题型展开</h2>` + detail;
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
    lead: '按面经里这道题被问到的次数排序，收录出现不少于 5 次的 65 道。点题目进入对应题解。这是原题榜，不是考点地图里的 20 个手撕题型。',
    html
  });
  return rows;
}

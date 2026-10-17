/* ---------------- 通用片段 ---------------- */
const ICON = {
  ext: '<svg viewBox="0 0 24 24"><path d="M14 5h5v5M10 14 19 5M19 14v5H5V5h5"/></svg>',
  link: '<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  focus: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24"><path d="M16 4h4v4M4 20 20 4M20 16v4h-4M15 15l5 5M4 4l5 5"/></svg>',
  img: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m3 16 5-5 5 5 3-3 5 5"/><circle cx="15.5" cy="9" r="1.5"/></svg>',
};
const href = (e, q) => `#/e/${encodeURIComponent(e.id)}${q != null ? '/' + qAnchor(e.id, q) : ''}`;
const bullets = (items, ordered) => (items && items.length) ? `<${ordered ? 'ol' : 'ul'} class="bullets">${items.map((x) => `<li>${h(x)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>` : '';
const entryNum = (e) => {
  if (e.kind === 'algo') return String(e.number);
  if (e.kind === 'qa') return e.number;
  if (e.number === 0) return '总览';
  if (e.kind === 'scenario') return String(e.number).replace('场景 ', '#').replace('场景总纲', '总纲');
  if (e.kind === 'pattern') return '模板';
  if (e.kind === 'ptopic') return '专题';
  return typeof e.number === 'number' ? '' : String(e.number || '');
};

let secNo = 0;
function sec(title, body, opts = {}) {
  if (!body) return '';
  secNo += 1;
  const id = opts.id || `s-${secNo}`;
  return `<section class="sec" ${opts.attr || ''}><h2 class="sec-h" id="${id}"><span class="n">${pad2(secNo)}</span>${h(title)}${opts.aside ? `<span class="aside">${opts.aside}</span>` : ''}</h2>${body}</section>`;
}
const callout = (k, text, tone = '', raw = false) => text ? `<div class="callout ${tone}"><span class="k">${h(k)}</span><p>${raw ? text : h(text)}</p></div>` : '';
const fold = (title, body, open, note) => body ? `<details class="fold"${open ? ' open' : ''}><summary>${h(title)}${note ? `<span class="note">${h(note)}</span>` : ''}</summary><div class="fold-body md">${body}</div></details>` : '';

function crumbs(e) {
  const m = MOD[e.mod];
  return `<nav class="crumbs" style="${modColor(e.mod)}"><span class="mdot"></span><a href="#/m/${e.mod}">${h(m.full || m.name)}</a><span class="sep">/</span><span>${h(e.part)}</span>${e.cat !== e.part ? `<span class="sep">/</span><span>${h(e.cat)}</span>` : ''}</nav>`;
}
function masteryCtl(key) {
  const s = statusOf(key);
  return `<div class="mastery"><span>掌握度</span><div class="seg" data-master="${h(key)}">
    <button type="button" data-s="0" class="${s === 0 ? 'on' : ''}">未学</button>
    <button type="button" data-s="1" class="${s === 1 ? 'on' : ''}">模糊</button>
    <button type="button" data-s="2" class="${s === 2 ? 'on' : ''}">掌握</button></div></div>`;
}
function pageHead(e, o = {}) {
  const num = o.num != null ? o.num : '';
  return `${crumbs(e)}
    <h1 class="page-title">${num ? `<span class="num">${h(num)}</span>` : ''}${h(o.title || e.title)}</h1>
    ${o.sub ? `<p class="page-sub">${o.sub}</p>` : ''}
    ${o.chips ? `<div class="meta">${o.chips}</div>` : ''}
    <div class="head-actions">${o.noMastery ? (o.left || '') : masteryCtl(e.progressKey || e.id)}<span class="grow"></span>${o.actions || ''}
      <button type="button" class="btn ghost" data-act="copy-link" title="复制本页链接">${ICON.link}链接</button>
      <button type="button" class="btn ghost" data-act="focus" title="专注模式（F）">${ICON.focus}专注</button></div>`;
}
function pager(e) {
  const list = TREE[e.mod].all;
  const i = list.indexOf(e);
  const prev = list[i - 1], next = list[i + 1];
  return `${e.kind!=='qa'&&e.supplementHtml ? `<div class="md sec">${e.supplementHtml}</div>` : ''}<nav class="pager">${prev ? `<a href="${href(prev)}"><span>← 上一条 · ${h(prev.cat)}</span><strong>${h(prev.title)}</strong></a>` : '<span class="ph"></span>'}
    ${next ? `<a class="next" href="${href(next)}"><span>${h(next.cat)} · 下一条 →</span><strong>${h(next.title)}</strong></a>` : '<span class="ph"></span>'}</nav>`;
}
function relatedLinks(list) {
  if (!list.length) return '';
  return `<div class="related">${list.map((x) => `<a href="${href(x)}"><span class="dot s${entryStatus(x)}"></span>${h((x.kind === 'algo' ? x.number + '. ' : '') + x.title)}</a>`).join('')}</div>`;
}
/* ---------------- 代码高亮：单遍分词，不会出现替换结果被二次替换 ---------------- */
const HL_KW = new Set('public private protected class static final abstract synchronized volatile transient return for while do if else new int long double float boolean char byte short void null true false this super throw throws try catch finally break continue extends implements interface enum instanceof package import switch case default assert native var record sealed permits yield local function then end elseif nil not and or'.split(' '));
const HL_TYPE = new Set('String StringBuilder StringBuffer Object List Map Set Deque Queue PriorityQueue ArrayList LinkedList HashMap LinkedHashMap TreeMap HashSet LinkedHashSet TreeSet ArrayDeque Arrays Math Integer Long Character Double Boolean Byte Short Float Collections Comparator Comparable Optional Stream Collectors IntStream TreeNode ListNode Node Thread Runnable Callable Future CompletableFuture ExecutorService Executors ThreadPoolExecutor TimeUnit CountDownLatch CyclicBarrier Semaphore ReentrantLock ReentrantReadWriteLock Condition Lock AtomicInteger AtomicLong AtomicReference AtomicBoolean LongAdder ConcurrentHashMap CopyOnWriteArrayList BlockingQueue ArrayBlockingQueue LinkedBlockingQueue DelayQueue ThreadLocal Iterator Iterable StringJoiner Objects System Exception RuntimeException InterruptedException IllegalArgumentException IllegalStateException Scanner BufferedReader InputStreamReader PrintWriter Random Entry'.split(' '));
const HL_SQL = new Set('SELECT FROM WHERE JOIN LEFT RIGHT INNER OUTER CROSS ON GROUP BY HAVING ORDER LIMIT OFFSET INSERT UPDATE DELETE CREATE TABLE INDEX PRIMARY KEY UNIQUE FOREIGN REFERENCES AND OR NOT AS WITH OVER PARTITION RANK DENSE_RANK ROW_NUMBER LAG LEAD DISTINCT INTO VALUES SET EXPLAIN ANALYZE COMMIT ROLLBACK TRANSACTION BEGIN START COUNT SUM AVG MAX MIN CASE WHEN THEN ELSE END UNION ALL EXISTS BETWEEN LIKE IN IS ASC DESC ALTER DROP TRUNCATE FORCE USING NULL DEFAULT AUTO_INCREMENT ENGINE CHARSET COLLATE VARCHAR CHAR INT BIGINT TINYINT TEXT DATETIME DATE TIMESTAMP DECIMAL JSON BLOB IF IFNULL COALESCE DATEDIFF DATE_SUB INTERVAL DAY FOR SHARE LOCK MODE SHOW STATUS'.split(' '));
function highlightCode(line, lang) {
  const isSql = lang === 'sql' || (!lang && /^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|WITH|EXPLAIN|BEGIN|COMMIT)\b/i.test(line));
  const commentRe = isSql ? /--|#(?=\s)/ : (lang === 'lua' ? /--/ : null);
  let out = '', i = 0;
  const n = line.length;
  const push = (cls, s) => { out += cls ? `<span class="${cls}">${escapeHtml(s)}</span>` : escapeHtml(s); };
  while (i < n) {
    const c = line[i];
    const rest = line.slice(i);
    if ((c === '/' && (line[i + 1] === '/' || line[i + 1] === '*')) || (commentRe && commentRe.test(rest) && rest.search(commentRe) === 0) || (c === '*' && /^\s*\*/.test(line) && line.slice(0, i).trim() === '')) {
      push('tok-comment', rest); break;
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < n && line[j] !== c) j += line[j] === '\\' ? 2 : 1;
      push('tok-string', line.slice(i, j + 1)); i = j + 1; continue;
    }
    if (c === '@' && /[A-Za-z]/.test(line[i + 1] || '')) {
      const m = rest.match(/^@\w+/); push('tok-anno', m[0]); i += m[0].length; continue;
    }
    if (/[0-9]/.test(c) && !/[\w$]/.test(line[i - 1] || '')) {
      const m = rest.match(/^(0x[0-9a-fA-F_]+|\d[\d_]*(\.\d+)?([eE][+-]?\d+)?[lLfFdD]?)/); push('tok-number', m[0]); i += m[0].length; continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      const m = rest.match(/^[\w$]+/); const w = m[0];
      let cls = '';
      if (isSql) cls = HL_SQL.has(w.toUpperCase()) ? 'tok-sql' : '';
      else if (HL_KW.has(w)) cls = 'tok-keyword';
      else if (HL_TYPE.has(w)) cls = 'tok-type';
      else if (/^[A-Z][A-Z0-9_]{2,}$/.test(w) && HL_SQL.has(w)) cls = 'tok-sql';
      push(cls, w); i += w.length; continue;
    }
    push('', c); i += 1;
  }
  return out || '&nbsp;';
}

/* ---------------- 代码块 ---------------- */
function codeLines(code, lang) {
  return String(code || '').replace(/\s+$/, '').split('\n').map((line, i) => `<div class="code-line"><span class="line-number">${i + 1}</span><span class="code-text">${highlightCode(line, lang)}</span></div>`).join('');
}
function codeCard(code, label, opts = {}) {
  return `<section class="code-card${opts.blind ? ' blind' : ''}" data-code="1"><div class="code-toolbar"><div class="toolbar-left"><span class="file-label">${h(label)}</span></div>
    <button type="button" data-act="blind" class="${opts.blind ? 'on' : ''}" title="遮住代码，先自己默写一遍">默写</button><button type="button" data-act="copy-code">复制</button></div>
    <div class="code-scroll"><code>${codeLines(code, opts.lang || (/.sql$/.test(label) ? 'sql' : ''))}</code></div>
    <div class="blind-cover"><strong>默写模式</strong><span>先在纸上 / IDE 里写一遍，再点击对照</span><button type="button" class="btn primary" data-act="unblind">显示代码</button></div></section>`;
}
// 把笔记里的 <pre class="md-pre"> 转成带行号高亮，并补上「默写 / 复制」
function hydrateCode(root) {
  $$('.md-code-card', root).forEach((card) => {
    if (card.dataset.code) return;
    const pre = card.querySelector('.md-pre');
    if (!pre) return;
    card.dataset.code = '1';
    const code = pre.textContent;
    card._code = code;
    const lang = pre.dataset.lang || '';
    const scroll = pre.parentElement;
    pre.outerHTML = `<code>${codeLines(code, lang)}</code>`;
    const tb = card.querySelector('.code-toolbar');
    const oldBtn = tb && tb.querySelector('.md-copy');
    if (oldBtn) oldBtn.remove();
    if (tb) tb.insertAdjacentHTML('beforeend', `${lang === 'text' || lang === 'txt' ? '' : '<button type="button" data-act="blind" title="遮住代码，先自己默写一遍">默写</button>'}<button type="button" data-act="copy-code">复制</button>`);
    if (scroll) scroll.insertAdjacentHTML('afterend', '<div class="blind-cover"><strong>默写模式</strong><span>先自己写一遍，再点击对照</span><button type="button" class="btn primary" data-act="unblind">显示代码</button></div>');
  });
}

/* ---------------- 图解 ---------------- */
function vizBuild(key, p) {
  const tpl = VIZ_TPL[key] || VIZ_TPL.fallback;
  let built;
  try { built = tpl(p || {}); } catch (err) { built = VIZ_TPL.fallback(p || {}); }
  const motion = VIZ_MOTION[key];
  const inner = built.inner + (motion ? moverSvg(key, motion) : '');
  return `<figure class="viz" data-viz="${h(key)}"><div class="viz-head">图解 <span>${h(built.name || '思路示意')}</span>${motion ? '<span class="viz-anim">动态</span>' : ''}<button class="viz-replay" type="button">重播</button></div>
    ${SV(built.w, built.h, inner)}${built.cap ? `<figcaption>${h(built.cap)}</figcaption>` : ''}</figure>`;
}
// 手撕 / 数据库题复用算法演示或场景架构图
const DIAGRAM_ALIAS = {
  /* v13: face/nonlc reuse existing demos */
  'nonlc-1-5': ['trace', '排序 2'],
  'nonlc-5-5': ['trace', '43'],
  'nonlc-1-14': ['trace', '215'],
  'nonlc-5-2': ['trace', 'LCR / Offer'],
  'nonlc-1-12': ['trace', '145'],
  'handwrite-46': ['arch', 'scenario-massive-topk'],
  'handwrite-47': ['trace', '146'],
  'handwrite-60': ['arch', 'scenario-distributed-rate-limit'],
  'handwrite-61': ['arch', 'scenario-redis-mysql-consistency'],
  'handwrite-62': ['arch', 'scenario-distributed-lock'],
  'handwrite-63': ['arch', 'scenario-unique-id'],
  'database-90': ['arch', 'database-93'],
  'database-94': ['arch', 'scenario-order-timeout-close'],
};
function diagramFor(e) {
  const tkey = e.kind === 'algo' ? String(e.number) : e.id;
  if (TRACES[tkey] || TRACES[e.id]) return DG.renderAlgo(TRACES[tkey] ? tkey : e.id, TRACES[tkey] || TRACES[e.id]);
  if (ARCH[e.id]) return DG.renderArch(e.id, ARCH[e.id]);
  const al = DIAGRAM_ALIAS[e.id];
  if (al && al[0] === 'trace' && TRACES[al[1]]) return DG.renderAlgo(al[1], TRACES[al[1]]);
  if (al && al[0] === 'arch' && ARCH[al[1]]) return DG.renderArch(al[1], ARCH[al[1]]);
  return '';
}
function vizFigure(e) {
  return diagramFor(e) || vizBuild(pickVizKey(e), e).replace('<figure class="viz"', '<figure class="viz viz-generic"');
}

function deepenBlock(e) {
  const d = DEEPEN[e.id];
  if (!d) return '';
  const out = [];
  if (d.extraViz && !diagramFor(e)) out.push(vizBuild(d.extraViz, {}));
  const panels = [];
  if (d.points && d.points.length) panels.push(`<div class="panel span2 tone-accent"><h4><span class="ic">+</span>${h(d.title || '深入补强')}</h4>${bullets(d.points)}</div>`);
  if (d.dbDesign && d.dbDesign.length) panels.push(`<div class="panel span2"><h4><span class="ic">DB</span>数据库与表设计</h4>${bullets(d.dbDesign)}</div>`);
  if (d.formulas && d.formulas.length) panels.push(`<div class="panel span2"><h4><span class="ic">∑</span>${h(d.formulaTitle || '容量估算公式')}</h4>${bullets(d.formulas)}</div>`);
  if (d.steps && d.steps.length) panels.push(`<div class="panel span2"><h4><span class="ic">→</span>${h(d.stepTitle || '落地步骤')}</h4>${bullets(d.steps, true)}</div>`);
  if (panels.length) out.push(`<div class="grid2">${panels.join('')}</div>`);
  if (d.table && d.table.headers) {
    out.push(`<div class="tbl-wrap"><table class="tbl"><thead><tr>${d.table.headers.map((x) => `<th>${h(x)}</th>`).join('')}</tr></thead><tbody>${d.table.rows.map((r) => `<tr>${r.map((c) => `<td>${h(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
  }
  if (d.sql && d.sql.length) d.sql.forEach((s) => out.push(codeCard(s.code, s.label || 'query.sql')));
  if (d.links && d.links.length) out.push(relatedLinks(d.links.map((l) => byId.get(l.id)).filter(Boolean)));
  return out.join('');
}

/* 结构化口述：按句切分并标注 */
const KW = ['关键', '核心', '本质', '瓶颈', 'trade-off', '取舍', '权衡', '不变量', '幂等', '最终一致', '降级', '兜底', '事实源'];
function markKw(s) {
  let x = h(s);
  KW.forEach((k) => { x = x.split(k).join(`<mark>${k}</mark>`); });
  return x.replace(/(\d+(?:\.\d+)?\s*(?:QPS|TPS|TB|GB|MB|KB|ms|万|亿|%|倍|毫秒|秒|分钟|小时|天|次|条|个|并发|连接|节点|副本|分片))/gi, '<mark>$1</mark>');
}
function pitchBlock(rows, headNote) {
  if (!rows || !rows.length) return '';
  return `<div class="pitch">${headNote ? `<div class="pitch-head"><span>${h(headNote)}</span><span>总分结构 · 先给结论</span></div>` : ''}${rows.map(([lb, tx]) => `<div class="pitch-row"><div class="lb">${h(lb)}</div><div class="tx">${markKw(tx)}</div></div>`).join('')}</div>`;
}
function sentencePitch(text) {
  const segs = String(text || '').split('。').map((s) => s.trim()).filter(Boolean).slice(0, 5);
  const labels = ['结论', '论据', '关键设计', '取舍', '记忆点'];
  return segs.map((s, i) => [labels[i] || `要点 ${i + 1}`, s + '。']);
}

/* ==========================================================================
   各类页面
   ========================================================================== */

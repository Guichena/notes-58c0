// Late, additive UI refinement layer for the main SPA:
// - Removes all mastery/progress tracking chrome & algo "见过 +1" local counters
// - Fixes QA toolbar stat (#qa-stat) to show clean question count
// - Upgrades handwrite-45 / database-71 dead TOCs into clickable chapter card grids
//   and expands code sidebar high-frequency shortcuts to Top 10 with seamless pager
// - Adds Scenario "考前速扫" skim toggle + Design module Top-10 classic strip
// - Adds Syntax 5-minute quick-jump bar & slim code cards (no blind button on 1-liners)
// - Highlights Plan "考前必看 4 件事" and folds brainteasers cleanly
// - Indexes the 3 project/handbook-* interview handbooks in Ctrl+K search
// - Mounts floating back-to-top button across long pages
// Runs on src/app/search.js (after all renderers/navigation/dashboard globals
// are defined and before events.js starts rendering), keeping every earlier
// source-hash guard and release test slice byte-identical.

const CLEAN_UI_SCRIPT = String.raw`
/* Clean reading UI & interview-learner workflow upgrades */
(() => {
  if (window.__NOTES_CLEAN_UI__) return;
  window.__NOTES_CLEAN_UI__ = true;

  // Hide legacy mastery filter immediately so events.js listener stays safe.
  const sfEl = document.getElementById('status-filter');
  if (sfEl) sfEl.hidden = true;
  if (typeof state === 'object' && state) state.sfilter = '';

  const CODE_TOP10 = [
    'handwrite-47', 'handwrite-46', 'handwrite-50', 'handwrite-56', 'handwrite-58',
    'handwrite-60', 'handwrite-62', 'handwrite-63', 'database-76', 'database-78'
  ];

  const DESIGN_TOP10 = [
    ['scenario-design-framework', '答题框架', '高扩展/高性能/高可用'],
    ['scenario-seckill-system', '秒杀系统', '扣库存与抗瞬时峰值'],
    ['scenario-short-url', '短链系统', '发号/布隆/跳转缓存'],
    ['scenario-unique-id', '分布式 ID', 'Snowflake/号段/时钟回拨'],
    ['scenario-order-timeout-close', '订单超时关闭', '时间轮/延迟队列/幂等关单'],
    ['scenario-distributed-rate-limit', '分布式限流', '令牌桶/Lua/热点退避'],
    ['scenario-redis-mysql-consistency', '缓存 DB 一致', '先库后删/Binlog 补偿'],
    ['scenario-distributed-lock', '分布式锁', '租约/续期/Fencing'],
    ['scenario-feed-system', 'Feed 流设计', '推拉结合/大V热点'],
    ['scenario-search-recommendation', '混合检索服务', 'ES/向量召回与重排']
  ];

  const SYNTAX_QUICK = [
    ['syntax-1', '先背这一页'],
    ['syntax-2', 'ACM 输入输出'],
    ['syntax-3', '数组/二维数组'],
    ['syntax-4', 'StringBuilder'],
    ['syntax-7', 'HashMap'],
    ['syntax-8', 'Deque / 堆'],
    ['syntax-10', '排序与比较器'],
    ['syntax-14', '高频易错点']
  ];

  const PLAN_MUST = [
    ['doc-02', '总规划', '四周打通简历、项目、八股与表达'],
    ['doc-01', '简历包装', '从「做过什么」改成「为什么招我」'],
    ['doc-27', '研发流程', '团队协作、上线排障与工程规范表达'],
    ['plan-日常与ai使用-1', '职业表达', '高频日常追问与边界判断']
  ];

  const HANDBOOK_INDEX = [
    { href: 'project/handbook-noteweave/', title: 'NoteWeave｜AI 资料研究工作台 · 面试精炼手册', sub: '面试精炼手册 · 个人项目 · 5 章 · 12 图', kw: 'noteweave 面试手册 简历 个人项目 java python kafka redis mysql es' },
    { href: 'project/handbook-noteweave/#sec-1', title: 'NoteWeave 01：Table-as-State 深度研究与双状态机', sub: 'NoteWeave 面试手册 · 第 1 章', kw: 'noteweave table-as-state deep research redis 持久化 防脑裂 fencing token epoch 租约 verifier 67% 83%' },
    { href: 'project/handbook-noteweave/#sec-2', title: 'NoteWeave 02：QA / Note / Wiki 三链路与撤销一致性', sub: 'NoteWeave 面试手册 · 第 2 章', kw: 'noteweave qa note wiki 撤销 一致性 墓碑 tombstone elasticsearch hybrid rag recall 0.87 mrr 0.78 rrf' },
    { href: 'project/handbook-noteweave/#sec-3', title: 'NoteWeave 03：16k 七段上下文编译与长期 Memory', sub: 'NoteWeave 面试手册 · 第 3 章', kw: 'noteweave 16k 上下文 context memory 记忆 压缩 token 34% 92% 缓存' },
    { href: 'project/handbook-noteweave/#sec-4', title: 'NoteWeave 04：128 MB 四阶段异步接入与 SSE 续读', sub: 'NoteWeave 面试手册 · 第 4 章', kw: 'noteweave 128mb 512mb full gc 流式 分块 kafka outbox sse redis stream 断线续读' },
    { href: 'project/handbook-noteweave/#sec-5', title: 'NoteWeave 05：Schema 产物框架与双工具 MCP', sub: 'NoteWeave 面试手册 · 第 5 章', kw: 'noteweave schema artifact 产物 框架 mcp 工具调用 幂等 校验' },
    { href: 'project/handbook-manufacturing/', title: '制造业生产事件可靠触达与智能维修平台 · 面试精炼手册', sub: '面试精炼手册 · 后端实习 · 4 章 · 7 图', kw: '制造业 生产事件 实习 面试手册 rabbitmq mysql redis pgvector outbox hitl' },
    { href: 'project/handbook-manufacturing/#sec-1', title: '制造业 01：通知可靠性闭环（Outbox + SKIP LOCKED + 8s 租约）', sub: '制造业平台面试手册 · 第 1 章', kw: '制造业 outbox skip locked rc 隔离级别 rabbitmq 仲裁队列 租约 8.9s 5200 30s 原号对账 幂等' },
    { href: 'project/handbook-manufacturing/#sec-2', title: '制造业 02：告警降噪与分级流控（双维状态机 + Redis Lua 令牌桶）', sub: '制造业平台面试手册 · 第 2 章', kw: '制造业 告警 降噪 双维状态机 防抖 redis lua 令牌桶 限流 60% 99.4% p0 p1' },
    { href: 'project/handbook-manufacturing/#sec-3', title: '制造业 03：四层隔离式工业三路 RAG 与可追溯诊断卡', sub: '制造业平台面试手册 · 第 3 章', kw: '制造业 隔离 旁路 pg16 pgvector bm25 三路 rag 诊断卡 85% 95% 35%' },
    { href: 'project/handbook-manufacturing/#sec-4', title: '制造业 04：HITL 维修工单（3/3/6 自排空池与三阶段双短事务）', sub: '制造业平台面试手册 · 第 4 章', kw: '制造业 hitl 维修工单 审批 线程池 3/3/6 双短事务 40.4s 15.2s 80.9%' },
    { href: 'project/handbook-tencentdb/', title: 'TencentDB Agent Memory · 开源经历面试精炼手册', sub: '面试精炼手册 · 犀牛鸟开源 · 4 章 · 5 图', kw: 'tencentdb agent memory 犀牛鸟 开源 腾讯 面试手册 fcr test1k prefix cache' },
    { href: 'project/handbook-tencentdb/#sec-1', title: 'TencentDB 01：透明代理边界与四阶段提示词注入层', sub: 'TencentDB 开源手册 · 第 1 章', kw: 'tencentdb 透明代理 边界 信息缺口 门控 误调用 fcr 87.14% 31.94%' },
    { href: 'project/handbook-tencentdb/#sec-2', title: 'TencentDB 02：三层契约编译器与固定五段 Prefix Cache 装配', sub: 'TencentDB 开源手册 · 第 2 章', kw: 'tencentdb 三层契约 编译器 prefix cache kv cache 五段 前缀 27.02% 3518 2567.5' },
    { href: 'project/handbook-tencentdb/#sec-3', title: 'TencentDB 03：test1k 1,140 配对基准与五级确定性漏斗', sub: 'TencentDB 开源手册 · 第 3 章', kw: 'tencentdb test1k 39 1140 配对 基准 漏斗 74.07% 55.77% 辛普森 183 单测' },
    { href: 'project/', title: '项目总览（3 份面试精炼手册 + 2 份架构展示板）', sub: '项目专题入口', kw: '项目 总览 展示板 面试手册 noteweave 制造业 tencentdb' }
  ];

  // 1. Strip mastery controls AND algo "见过 +1" counter from page headers.
  if (typeof pageHead === 'function') {
    const _pageHead = pageHead;
    pageHead = function (e, o) {
      const opts = Object.assign({}, o || {}, { noMastery: true });
      if (typeof opts.left === 'string' && /掌握|模糊/.test(opts.left)) {
        opts.left = '';
      }
      let html = _pageHead(e, opts);
      html = html.replace(/<button[^>]*data-act="seen-add"[\s\S]*?<\/button>/g, '');
      return html;
    };
  }

  // 1b. Fix leaked mastery text in QA sticky toolbar (#qa-stat).
  if (typeof updateQaStat === 'function') {
    updateQaStat = function () {
      const el = document.getElementById('qa-stat');
      if (!el) return;
      const cards = document.querySelectorAll('#page .qa');
      el.textContent = '共 ' + cards.length + ' 问';
    };
  }

  // 2. Clean related links (no empty mastery dots).
  if (typeof relatedLinks === 'function') {
    relatedLinks = function (list) {
      if (!list || !list.length) return '';
      return '<div class="related">' + list.map((x) =>
        '<a href="' + href(x) + '">' + h((x.kind === 'algo' ? x.number + '. ' : '') + x.title) + '</a>'
      ).join('') + '</div>';
    };
  }

  // 2b. Remove 3-item dead-end pager loop in code module so learners flow naturally.
  if (typeof pager === 'function') {
    const _pager = pager;
    pager = function (e) {
      if (e && e.mod === 'code' && TREE.code && Array.isArray(TREE.code.all)) {
        const list = TREE.code.all;
        const i = list.indexOf(e);
        const prev = list[i - 1], next = list[i + 1];
        return (e.kind !== 'qa' && e.supplementHtml ? '<div class="md sec">' + e.supplementHtml + '</div>' : '') +
          '<nav class="pager">' +
          (prev ? '<a href="' + href(prev) + '"><span>← 上一条 · ' + h(prev.cat) + '</span><strong>' + h(prev.title) + '</strong></a>' : '<span class="ph"></span>') +
          (next ? '<a class="next" href="' + href(next) + '"><span>' + h(next.cat) + ' · 下一条 →</span><strong>' + h(next.title) + '</strong></a>' : '<span class="ph"></span>') +
          '</nav>';
      }
      return _pager(e);
    };
  }

  // 2c. Upgrade handwrite-45 & database-71 dead TOCs into clickable chapter card grids + 5-step cards.
  if (typeof renderHandwrite === 'function') {
    const _renderHandwrite = renderHandwrite;
    renderHandwrite = function (e) {
      const html = _renderHandwrite(e);
      if (!e || (e.id !== 'handwrite-45' && e.id !== 'database-71')) return html;
      const isCode = e.id === 'handwrite-45';
      const prefix = isCode ? 'handwrite-' : 'database-';
      const baseNum = isCode ? 45 : 71;
      const box = document.createElement('div');
      box.innerHTML = html;

      // Upgrade 5-step framework <ol> into numbered step cards
      box.querySelectorAll('.md-list-wrap > ol.md-list').forEach((ol) => {
        ol.classList.add('hw-steps');
      });

      // Upgrade dead TOC <ul> into interactive chapter card grid
      const headings = Array.from(box.querySelectorAll('h2.md-h2'));
      const tocHeading = headings.find((el) => el.textContent.trim() === '目录');
      const tocWrap = tocHeading && tocHeading.nextElementSibling;
      const rootUl = tocWrap && tocWrap.querySelector('ul.md-depth-0');
      if (rootUl) {
        const chapters = [];
        let cur = null;
        Array.from(rootUl.children).forEach((node) => {
          if (node.tagName === 'LI') {
            cur = { title: node.textContent.trim(), items: [] };
            chapters.push(cur);
          } else if (node.tagName === 'UL' && cur) {
            Array.from(node.children).forEach((li) => {
              const txt = li.textContent.trim();
              const m = /^题\s*(\d+)[：:]\s*(.+)$/.exec(txt);
              if (m) {
                const n = Number(m[1]);
                const targetId = prefix + (baseNum + n);
                cur.items.push({ no: n, title: m[2].trim(), id: byId.has(targetId) ? targetId : '' });
              } else {
                cur.items.push({ no: null, title: txt, id: '' });
              }
            });
          }
        });
        if (!isCode && byId.has('database-recharge-schema') && chapters.length) {
          chapters[chapters.length - 1].items.push({
            no: '补充',
            title: byId.get('database-recharge-schema').title,
            id: 'database-recharge-schema'
          });
        }
        if (chapters.length) {
          const grid = document.createElement('div');
          grid.className = 'hw-toc-chapters';
          grid.innerHTML = chapters.map((ch) =>
            '<section class="hw-toc-ch">' +
              '<h3 class="hw-toc-ch-h">' + h(ch.title) + '<small>' + ch.items.length + ' 题</small></h3>' +
              '<div class="hw-toc-grid">' + ch.items.map((it) => {
                const badge = it.no != null ? '<span class="hw-toc-no">' + h(String(it.no).padStart(2, '0')) + '</span>' : '';
                if (it.id) {
                  return '<a class="hw-toc-card" href="#/e/' + encodeURIComponent(it.id) + '">' + badge + '<span class="hw-toc-t">' + h(it.title) + '</span><span class="hw-toc-arr">→</span></a>';
                }
                return '<div class="hw-toc-card is-static">' + badge + '<span class="hw-toc-t">' + h(it.title) + '</span></div>';
              }).join('') + '</div>' +
            '</section>'
          ).join('');
          tocWrap.replaceWith(grid);
        }
      }
      return box.innerHTML;
    };
  }

  // 3. Scenario "考前速扫" skim mode toggle
  if (typeof renderScenario === 'function') {
    const _renderScenario = renderScenario;
    renderScenario = function (e) {
      const html = _renderScenario(e);
      const skimOn = Boolean(store.get('iv8-sc-skim', false));
      const box = document.createElement('div');
      box.innerHTML = html;
      const actions = box.querySelector('.head-actions');
      if (actions) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn sc-skim-btn' + (skimOn ? ' on' : '');
        btn.setAttribute('data-act', 'sc-skim');
        btn.setAttribute('aria-pressed', skimOn ? 'true' : 'false');
        btn.title = '只留设计主线、60秒话术、架构图与反事实，收起 11 维详解与长讲义';
        btn.textContent = skimOn ? '考前速扫：已开启' : '考前速扫模式';
        const copyBtn = actions.querySelector('[data-act="copy-link"]');
        if (copyBtn) actions.insertBefore(btn, copyBtn);
        else actions.appendChild(btn);
      }
      const deepTitles = new Set(['架构详解', '深入补强', '架构伪代码', '知识点精讲']);
      let firstDeep = null;
      box.querySelectorAll('section.sec').forEach((secEl) => {
        const h2 = secEl.querySelector('h2.sec-h');
        if (!h2) return;
        const label = Array.from(h2.childNodes)
          .filter((nd) => !(nd.classList && (nd.classList.contains('n') || nd.classList.contains('aside'))))
          .map((nd) => nd.textContent).join('').trim();
        if (deepTitles.has(label)) {
          secEl.setAttribute('data-sc-deep', '1');
          if (!firstDeep) firstDeep = secEl;
        }
      });
      if (firstDeep) {
        const banner = document.createElement('div');
        banner.className = 'sc-skim-banner';
        banner.innerHTML = '<span>当前为<b>考前速扫视图</b>（已收起 11 维架构详解、伪代码与长讲义，聚焦核心话术与图解）</span>' +
          '<button type="button" class="btn primary" data-act="sc-skim">展开完整精读 ↓</button>';
        firstDeep.parentNode.insertBefore(banner, firstDeep);
      }
      return '<div class="sc-wrap' + (skimOn ? ' sc-skim-on' : '') + '">' + box.innerHTML + '</div>';
    };
  }

  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-act="sc-skim"]');
    if (!btn) return;
    const wrap = document.querySelector('#page .sc-wrap');
    if (!wrap) return;
    const next = !wrap.classList.contains('sc-skim-on');
    wrap.classList.toggle('sc-skim-on', next);
    store.set('iv8-sc-skim', next);
    document.querySelectorAll('#page .sc-skim-btn').forEach((b) => {
      b.classList.toggle('on', next);
      b.setAttribute('aria-pressed', next ? 'true' : 'false');
      b.textContent = next ? '考前速扫：已开启' : '考前速扫模式';
    });
    if (typeof toast === 'function') toast(next ? '已切换考前速扫：聚焦主线、60秒话术、图解与反事实' : '已恢复完整精读视图');
  });

  // 4. Syntax 5-minute quick-jump bar & slim code cards (remove blind button & verbose filename)
  if (typeof renderSyntax === 'function') {
    const _renderSyntax = renderSyntax;
    renderSyntax = function (e) {
      const html = _renderSyntax(e);
      const nav = '<nav class="sx-quick-bar" aria-label="手撕前 5 分钟高频速跳"><span class="sx-quick-lb">考前 5 分钟速跳</span>' +
        SYNTAX_QUICK.filter(([id]) => byId.has(id)).map(([id, label]) =>
          '<a class="sx-quick-chip' + (e && e.id === id ? ' on' : '') + '" href="#/e/' + encodeURIComponent(id) + '">' + h(label) + '</a>'
        ).join('') + '</nav>';
      const box = document.createElement('div');
      box.innerHTML = html;
      box.querySelectorAll('.file-label').forEach((fl) => {
        if (/java_容器与api|深度速查/.test(fl.textContent)) fl.textContent = 'Java';
      });
      const headActs = box.querySelector('.head-actions');
      if (headActs) headActs.insertAdjacentHTML('afterend', nav);
      return '<div class="sx-slim">' + box.innerHTML + '</div>';
    };
  }

  // 5. Clean Home Dashboard: remove mastery progress bars/chips/checkboxes,
  //    add quick-access strip for the 3 resume-oriented interview handbooks.
  if (typeof renderHome === 'function') {
    const CLEAN_WEEKS = (typeof WEEKS !== 'undefined' ? WEEKS : []).map((w) => ({
      ...w,
      items: w.items.map((it) => it.replace('（看冲刺台「模糊」项）', '（按高频考点榜查漏补缺）'))
    }));
    const HANDBOOK_CARDS = [
      {
        href: 'project/handbook-noteweave/',
        cls: 'hb-nw',
        tag: '个人项目 · 5 章 · 12 图',
        title: 'NoteWeave 面试精炼手册',
        desc: 'Table-as-State 深度研究、三链路撤销一致、16k 上下文编译、128MB 流式接入与双工具 MCP。'
      },
      {
        href: 'project/handbook-manufacturing/',
        cls: 'hb-mfg',
        tag: '后端实习 · 4 章 · 7 图',
        title: '制造业生产事件平台手册',
        desc: 'Outbox + SKIP LOCKED 通知闭环、双维状态机与 Lua 限流、PG16 三路 RAG 与 HITL 双短事务。'
      },
      {
        href: 'project/handbook-tencentdb/',
        cls: 'hb-tdb',
        tag: '开源贡献 · 4 章 · 5 图',
        title: 'TencentDB Agent Memory 手册',
        desc: '信息缺口门控、三层契约与五段 Prefix Cache 装配、test1k 1,140 配对基准与五级轨迹漏斗。'
      }
    ];
    renderHome = function () {
      const recent = store.get('iv8-recent', []).map((id) => byId.get(id)).filter((x) => x && x.id !== 'my-seen');
      const last = recent[0];
      const activeMods = MODS.filter((m) => TREE[m.id]);
      const mods = activeMods.map((m) => {
        const list = TREE[m.id].all.filter((e) => e.id !== 'my-seen');
        const qaN = list.reduce((s, e) => s + (e.items ? e.items.length : 0), 0);
        const stat = qaN ? (list.length + ' 篇 · ' + qaN + ' 问') : (list.length + ' 篇内容');
        return '<a class="mod-card" href="#/m/' + m.id + '" style="' + modColor(m.id) + '">' +
          '<div class="top"><span class="mi">' + m.icon + '</span><h3>' + h(m.full) + '</h3></div>' +
          '<p>' + h(m.desc) + '</p>' +
          '<span class="nums">' + stat + '</span></a>';
      }).join('');

      const hbHtml = '<h2 class="dash-h">面试精炼手册 <small>面向简历脱稿主背 · 含流程图、全中间件实况、优劣权衡与折叠自测</small><a class="act dash-link" href="project/">项目总览 →</a></h2>' +
        '<div class="home-hb-grid">' + HANDBOOK_CARDS.map((c) =>
          '<a class="home-hb-card ' + c.cls + '" href="' + c.href + '">' +
          '<span class="home-hb-tag">' + h(c.tag) + '</span>' +
          '<strong>' + h(c.title) + '</strong>' +
          '<p>' + h(c.desc) + '</p>' +
          '<span class="home-hb-go">打开手册 →</span></a>'
        ).join('') + '</div>';

      const weeksHtml = CLEAN_WEEKS.length ? (
        '<h2 class="dash-h">四周冲刺路线 <small>按阶段聚焦简历、八股、手撕与项目表达</small></h2>' +
        '<div class="weeks">' + CLEAN_WEEKS.map((w) =>
          '<div class="week"><header><b>' + w.n + '</b><strong>' + h(w.t) + '</strong></header>' +
          '<p class="goal">' + h(w.goal) + '</p>' +
          '<ul class="week-list">' + w.items.map((it) => '<li>' + h(it) + '</li>').join('') + '</ul>' +
          (byId.get(w.doc) ? '<a class="more" href="' + href(byId.get(w.doc)) + '">本周精讲 →</a>' : '') +
          '</div>'
        ).join('') + '</div>'
      ) : '';

      const hmHtml = (typeof HL_MODS !== 'undefined' && HL_MODS.length) ? (
        '<h2 class="dash-h">重点地图 <small>按模块与小节铺开全部问答，每题提炼一句「本质」，方便考前速扫</small></h2>' +
        '<div class="hm-home">' + HL_MODS.map((id) => {
          const es = TREE[id].all.filter((e) => e.kind === 'qa');
          const totalQ = es.reduce((s, e) => s + (e.items ? e.items.length : 0), 0);
          const nc = new Set(es.map((e) => e.cat)).size;
          return '<a class="hm-home-card" href="#/hl/' + id + '" style="' + modColor(id) + '">' +
            '<span class="mi">' + MOD[id].icon + '</span>' +
            '<span class="t"><b>' + h(MOD[id].full) + '</b><small>' + nc + ' 个小节 · ' + totalQ + ' 问</small></span>' +
            '<span class="go">打开 →</span></a>';
        }).join('') + '</div>'
      ) : '';

      return '<section class="hero"><h1>冲刺台</h1>' +
        '<p>简历负责吸引追问，项目负责承载追问，八股负责支撑追问，面试技巧负责把答案讲清楚。这里把算法手撕、场景设计、高频考点、项目手册和面试策略串成一套直接可查、可背的复习资料库。</p>' +
        '<div class="meta">' +
          '<span class="chip">' + ENTRIES.length + ' 篇笔记</span>' +
          '<span class="chip">' + activeMods.length + ' 大模块</span>' +
          '<a class="chip accent link" href="#/e/interview-map">传统后端高频速过 →</a>' +
          '<a class="chip accent link" href="#/e/kb-agent-board">AI Agent 高频速过 →</a>' +
          '<a class="chip link" href="project/">3 份面试精炼手册 →</a>' +
        '</div></section>' +
        (last ? '<h2 class="dash-h">继续上次</h2><div class="today"><a href="' + href(last) + '" style="' + modColor(last.mod) + '"><span class="t">' + h(last.title) + '<span class="why">' + h(MOD[last.mod].full) + ' · ' + h(last.cat) + '</span></span><span class="w">继续阅读 →</span></a></div>' : '') +
        hbHtml +
        '<h2 class="dash-h">知识模块</h2><div class="mod-grid">' + mods + '</div>' +
        weeksHtml +
        '<h2 class="dash-h">答题心法 <small>来自《春招准备总规划》第 6 节</small></h2>' +
        '<div class="method">' + METHOD.map(([n, t, p, eg]) =>
          '<div><h4><i>' + n + '</i>' + h(t) + '</h4><p>' + h(p) + '</p><p class="eg">' + h(eg) + '</p></div>'
        ).join('') + '</div>' +
        hmHtml;
    };
  }

  // 6. Clean Module Overview (with Design Top-10 strip, Plan Must-Read + folded brainteasers, Algo hide my-seen)
  if (typeof renderModHome === 'function') {
    renderModHome = function (modId) {
      const m = MOD[modId], tree = TREE[modId];
      const visibleAll = tree.all.filter((e) => e.id !== 'my-seen');
      const qaN = visibleAll.reduce((s, e) => s + (e.items ? e.items.length : 0), 0);
      let starts = (m.start || []).map((id) => byId.get(id)).filter(Boolean);
      if (modId === 'code') {
        starts = ['handwrite-45', 'database-71', 'handwrite-47'].map((id) => byId.get(id)).filter(Boolean);
      }

      let highlightStrip = '';
      if (modId === 'design') {
        const items = DESIGN_TOP10.filter(([id]) => byId.has(id));
        highlightStrip = '<div class="mod-top-box"><div class="part-h" style="margin-top:0">高频必考 10 大场景（考前优先过这一行）</div><div class="mod-top-grid">' +
          items.map(([id, name, desc], idx) =>
            '<a class="mod-top-card" href="#/e/' + encodeURIComponent(id) + '"><span class="mod-top-n">' + String(idx + 1).padStart(2, '0') + '</span><div><strong>' + h(name) + '</strong><small>' + h(desc) + '</small></div></a>'
          ).join('') + '</div></div>';
      } else if (modId === 'plan') {
        const items = PLAN_MUST.filter(([id]) => byId.has(id));
        highlightStrip = '<div class="mod-top-box"><div class="part-h" style="margin-top:0">考前必看 4 件事（先搞定表达与简历，再按需看智力题）</div><div class="mod-top-grid mod-top-grid-4">' +
          items.map(([id, tag, desc]) =>
            '<a class="mod-top-card" href="#/e/' + encodeURIComponent(id) + '"><span class="mod-top-tag">' + h(tag) + '</span><div><strong>' + h(byId.get(id).title) + '</strong><small>' + h(desc) + '</small></div></a>'
          ).join('') + '</div></div>';
      } else if (modId === 'knowledge') {
        highlightStrip = '<div class="mod-top-box"><div class="part-h" style="margin-top:0">考前快速过一轮入口（零点击当页速扫全部高频重点）</div><div class="mod-top-grid">' +
          [
            ['interview-map', '后端高频', '传统后端高频榜（重点全展）'],
            ['kb-agent-board', 'Agent高频', 'AI Agent 高频榜（重点全展）'],
            ['kb-project-stack', '项目八股', '三段简历经历技术栈 39 专题'],
            ['kb-interview-routes', '开口路线', 'MySQL / Redis / Kafka 开口串联']
          ].filter(([id]) => byId.has(id)).map(([id, tag, desc]) =>
            '<a class="mod-top-card" href="#/e/' + encodeURIComponent(id) + '"><span class="mod-top-tag">' + h(tag) + '</span><div><strong>' + h(byId.get(id).title) + '</strong><small>' + h(desc) + '</small></div></a>'
          ).join('') + '</div></div>';
      }

      const renderCatCard = (c) => {
        const items = c.items.filter((x) => x.id !== 'my-seen');
        if (!items.length) return '';
        const catQ = items.reduce((s, e) => s + (e.items ? e.items.length : 0), 0);
        const countTxt = catQ ? (catQ + ' 问') : (items.length + ' 篇');
        return '<a class="cat-card" href="' + href(items[0]) + '" style="' + modColor(modId) + '">' +
          '<span class="h">' + h(c.name) + '<small>' + countTxt + '</small></span>' +
          '<span class="sub">' + h(items.slice(0, 4).map((x) => x.title).join(' · ')) + '</span></a>';
      };

      let partsHtml = '';
      if (modId === 'plan') {
        const normalParts = [];
        const brainCards = [];
        tree.parts.forEach((p) => {
          const keepCats = [];
          p.cats.forEach((c) => {
            if (/智力|概率|完整来源变体/.test(c.name)) {
              const card = renderCatCard(c);
              if (card) brainCards.push(card);
            } else {
              const card = renderCatCard(c);
              if (card) keepCats.push(card);
            }
          });
          if (keepCats.length) normalParts.push('<div class="part-h">' + h(p.name) + '</div><div class="cat-grid">' + keepCats.join('') + '</div>');
        });
        partsHtml = normalParts.join('');
        if (brainCards.length) {
          partsHtml += '<details class="plan-brain-fold"><summary><span>笔试 / 面试拓展：智力题与概率推理</span><small>按需展开</small></summary><div class="cat-grid" style="margin-top:10px">' + brainCards.join('') + '</div></details>';
        }
      } else {
        partsHtml = tree.parts.map((p) => {
          const cards = p.cats.map(renderCatCard).filter(Boolean).join('');
          return cards ? ('<div class="part-h">' + h(p.name) + '</div><div class="cat-grid">' + cards + '</div>') : '';
        }).join('');
      }

      const rub = (typeof RUBRIC !== 'undefined' && RUBRIC[modId])
        ? fold('面试评分维度（自测用）', '<div>' + RUBRIC[modId].map(([a, b]) =>
            '<div class="pm-row"><div class="pm-range">' + h(a) + '</div><div class="pm-note">' + h(b) + '</div></div>'
          ).join('') + '</div>')
        : '';

      return '<nav class="crumbs" style="' + modColor(modId) + '"><span class="mdot"></span><a href="#/">冲刺台</a><span class="sep">/</span><span>' + h(m.full) + '</span></nav>' +
        '<section class="hero" style="' + modColor(modId) + '"><h1>' + h(m.full) + '</h1><p>' + h(m.desc) + '</p>' +
          '<div class="meta"><span class="chip">' + visibleAll.length + ' 篇内容</span>' + (qaN ? '<span class="chip">' + qaN + ' 道问答</span>' : '') + '</div>' +
          '<div class="head-actions" style="border:0;padding:0">' +
            starts.map((s, i) => '<a class="btn' + (i === 0 ? ' primary' : '') + '" href="' + href(s) + '">' + (i === 0 ? '推荐入口：' : '') + h(s.title) + '</a>').join('') +
            (HL_MODS.includes(modId) ? '<a class="btn' + (starts.length ? '' : ' primary') + '" href="#/hl/' + modId + '">' + ICON_MAP + '重点地图 · ' + qaN + ' 问</a>' : '') +
          '</div></section>' +
        highlightStrip +
        partsHtml +
        (rub ? '<div class="sec">' + rub + '</div>' : '');
    };
  }

  // 7. Clean Sidebar: remove progress bar, mastery ratios, status dots, my-seen & expand code Top 10.
  if (typeof renderSidebar === 'function') {
    const _renderSidebar = renderSidebar;
    renderSidebar = function () {
      state.sfilter = '';
      _renderSidebar();
      const sideHead = document.getElementById('side-head');
      const sideList = document.getElementById('side-list');
      const sf = document.getElementById('status-filter');
      if (sf) sf.hidden = true;
      if (sideHead) {
        sideHead.querySelectorAll('.side-prog').forEach((el) => el.remove());
        if (state.mod !== 'home' && TREE[state.mod]) {
          const p = sideHead.querySelector('.side-mod p');
          if (p) {
            const list = TREE[state.mod].all.filter((e) => e.id !== 'my-seen');
            const qaN = list.reduce((s, e) => s + (e.items ? e.items.length : 0), 0);
            p.textContent = qaN ? (list.length + ' 篇 · ' + qaN + ' 问') : (list.length + ' 篇内容');
          }
        }
      }
      if (sideList) {
        // Hide my-seen everywhere in sidebar
        sideList.querySelectorAll('a[href="#/e/my-seen"]').forEach((a) => {
          const det = a.closest('details.side-cat');
          a.remove();
          if (det && !det.querySelector('.side-item')) det.remove();
        });

        // Upgrade code module sidebar "高频顺序" from 3 items to curated Top 10
        if (state.mod === 'code') {
          const abList = sideList.querySelector('.ab-side-list');
          const curId = state.route.view === 'entry' ? state.route.id : '';
          const q = (state.filter || '').trim().toLowerCase();
          if (abList) {
            const topLinks = CODE_TOP10.map((id, idx) => {
              const entry = byId.get(id);
              if (!entry) return '';
              if (q && !(entry.title + ' ' + (entry.number || '')).toLowerCase().includes(q)) return '';
              return '<a class="side-item ab-side' + (curId === id ? ' active' : '') + '" href="' + href(entry) + '">' +
                '<span class="ab-side-n">' + (idx + 1) + '</span>' +
                '<span class="t">' + h(entry.title) + '</span>' +
                '<span class="n">' + (entry.kind === 'database' ? 'SQL' : '代码') + '</span></a>';
            }).join('');
            const prevTitle = abList.previousElementSibling;
            if (prevTitle && prevTitle.classList.contains('side-part')) prevTitle.textContent = '高频手撕 Top 10';
            if (topLinks) abList.innerHTML = topLinks;
          }
        }

        if (state.mod === 'home') {
          sideList.querySelectorAll('.side-item').forEach((a) => {
            const hrefVal = a.getAttribute('href') || '';
            const m = /^#\/m\/([a-z]+)$/.exec(hrefVal);
            if (m && TREE[m[1]]) {
              const n = a.querySelector('.n');
              if (n) n.textContent = TREE[m[1]].all.filter((e) => e.id !== 'my-seen').length + ' 篇';
            } else {
              const dot = a.querySelector('.dot');
              if (dot) dot.remove();
            }
          });
        } else {
          sideList.querySelectorAll('.side-cat').forEach((det) => {
            const cnt = det.querySelector('summary .cnt');
            if (cnt) cnt.textContent = String(det.querySelectorAll('.side-item').length);
          });
          sideList.querySelectorAll('.side-item').forEach((a) => {
            const dot = a.querySelector('.dot');
            if (dot) dot.remove();
            if (a.classList.contains('kind-qa')) {
              const e = byId.get(a.dataset.id);
              const n = a.querySelector('.n');
              if (e && e.items && n) n.textContent = e.items.length + ' 问';
            }
          });
        }
      }
    };
  }

  // 8. Integrate the 3 project/handbook-* interview handbooks into Ctrl+K global search.
  if (typeof runSearch === 'function') {
    const _runSearch = runSearch;
    runSearch = async function () {
      await _runSearch();
      const input = document.getElementById('palette-q');
      const list = document.getElementById('palette-list');
      const cntEl = document.getElementById('palette-count');
      if (!input || !list) return;
      const raw = input.value.trim();
      if (!raw) {
        const hints = list.querySelector('.hints');
        if (hints) {
          hints.innerHTML = ['MVCC', 'LRU', 'NoteWeave', 'Outbox', 'TencentDB', '秒杀', '分布式锁', 'RAG 召回', '线程池'].map((x) =>
            '<button type="button" data-hint="' + h(x) + '">' + h(x) + '</button>'
          ).join('');
        }
        return;
      }
      if (pal && pal.scope) return; // only merge handbook matches when searching "全部"
      const terms = raw.toLowerCase().replace(/([\u3400-\u9fff\uf900-\ufaff])([a-z0-9])/g, '$1 $2').replace(/([a-z0-9])([\u3400-\u9fff\uf900-\ufaff])/g, '$1 $2').split(/\s+/).filter(Boolean);
      const hbHits = HANDBOOK_INDEX.filter((item) => {
        const hay = (item.title + ' ' + item.sub + ' ' + item.kw).toLowerCase();
        return terms.every((t) => hay.includes(t));
      }).slice(0, 6);
      if (!hbHits.length) return;
      const emptyEl = list.querySelector('.pl-empty');
      if (emptyEl) emptyEl.remove();
      const hbHtml = '<div class="pl-group">项目面试精炼手册</div>' + hbHits.map((item) =>
        '<a class="pl-item pl-hb" data-ext-href="1" href="' + h(item.href) + '">' +
          '<span class="pl-ic pl-ic-hb">册</span>' +
          '<span><span class="pl-title">' + hl(item.title, terms) + '<small>' + h(item.sub) + '</small></span></span>' +
        '</a>'
      ).join('');
      list.insertAdjacentHTML('afterbegin', hbHtml);
      const allItems = Array.from(list.querySelectorAll('.pl-item'));
      allItems.forEach((el, idx) => el.setAttribute('data-i', String(idx)));
      if (pal) pal.sel = 0;
      if (typeof markSel === 'function') markSel();
      if (cntEl) cntEl.textContent = allItems.length + ' 条结果（含 ' + hbHits.length + ' 条面试手册）';
    };
  }

  // Handle Enter key on Ctrl+K when a project/handbook-* result is selected.
  const palInput = document.getElementById('palette-q');
  if (palInput) {
    palInput.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      const items = document.querySelectorAll('#palette-list .pl-item');
      const a = items[pal ? pal.sel : 0];
      if (a && a.hasAttribute('data-ext-href')) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        if (typeof closePalette === 'function') closePalette();
        location.href = a.getAttribute('href');
      }
    }, true);
  }

  // 9. Clean Right Rail: remove "1 模糊 / 2 掌握" shortcut tips.
  if (typeof buildRail === 'function') {
    const _buildRail = buildRail;
    buildRail = function () {
      _buildRail();
      const card = document.querySelector('#rail .rail-card');
      if (!card) return;
      const isQA = document.querySelectorAll('#page .qa').length > 0;
      const p = card.querySelector('p');
      if (p) {
        p.textContent = isQA
          ? '问答页：J / K 切换题目，Space 展开或收起答案，/ 搜索，F 专注模式。'
          : '← / → 切换条目，/ 或 Ctrl K 全文搜索，F 专注模式。';
      }
      const keys = card.querySelector('.rail-keys');
      if (keys) {
        keys.innerHTML = (isQA
          ? '<div><kbd>J</kbd><kbd>K</kbd> 上 / 下一题</div><div><kbd>Space</kbd> 展开答案</div>'
          : '<div><kbd>←</kbd><kbd>→</kbd> 上 / 下一条</div>') +
          '<div><kbd>/</kbd> 搜索 · <kbd>F</kbd> 专注</div>';
      }
    };
  }

  // 10. Clean Highlight Map: remove mastery stats, mastery filter, status dots & bars.
  if (typeof renderMap === 'function') {
    const _renderMap = renderMap;
    renderMap = function (modId) {
      let html = _renderMap(modId);
      html = html
        .replace('；圆点直接标掌握状态', '')
        .replace(/<span class="ok">[\s\S]*?<\/span><span class="fz">[\s\S]*?<\/span><span class="todo">[\s\S]*?<\/span>/g, '')
        .replace(/<div class="seg" id="hm-f"[\s\S]*?<\/div>/g, '')
        .replace(/<button type="button" class="hm-dot"[\s\S]*?<\/button>/g, '')
        .replace(/<span class="bar" aria-hidden="true">[\s\S]*?<\/span>/g, '');
      return html;
    };
  }
  if (typeof wireMap === 'function') {
    const _wireMap = wireMap;
    wireMap = function (page) {
      try { store.set('iv16-hm-f-' + (page.querySelector('#hm-main')?.dataset.mod || ''), ''); } catch (_) {}
      _wireMap(page);
      page.querySelectorAll('[data-hm-n]').forEach((el) => {
        el.textContent = el.textContent.replace(/^\d+\//, '');
      });
    };
  }

  // 11. Suppress legacy 1/2/0 mastery hotkeys on QA pages so number presses never pop toasts.
  document.addEventListener('keydown', (ev) => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag || '') || (document.activeElement && document.activeElement.isContentEditable)) return;
    if ((ev.key === '1' || ev.key === '2' || ev.key === '0') && document.querySelectorAll('#page .qa').length > 0) {
      ev.stopImmediatePropagation();
    }
  }, true);

  // 12. Mount floating back-to-top button for long lectures, scenarios, and detail pages.
  function mountBackTop() {
    if (document.getElementById('backtop')) return;
    const btn = document.createElement('button');
    btn.id = 'backtop';
    btn.type = 'button';
    btn.setAttribute('aria-label', '回到顶部');
    btn.title = '回到顶部';
    btn.textContent = '↑';
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    document.body.appendChild(btn);
    const onScroll = () => btn.classList.toggle('on', window.scrollY > 380);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
  if (document.readyState !== 'loading') mountBackTop();
  else document.addEventListener('DOMContentLoaded', mountBackTop);
})();
`;

export function projectCleanUiRuntime(file, text, { baselineTest = false } = {}) {
  if (baselineTest || file !== 'src/app/search.js') return text;
  return text + '\n' + CLEAN_UI_SCRIPT;
}

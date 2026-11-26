// Late, additive UI refinement layer: removes mastery/progress tracking chrome
// across the main SPA (home, module overview, sidebar, rail, highlight map,
// entry headers, QA cards), adds quick links to the 3 interview handbooks on
// the home dashboard, and mounts a floating back-to-top button.
// Runs on src/app/search.js (after all renderers/navigation/dashboard globals
// are defined and before events.js starts rendering), keeping every earlier
// source-hash guard and test slice byte-identical.

const CLEAN_UI_SCRIPT = String.raw`
/* Clean reading UI: remove mastery chrome, polish dashboard & add back-to-top */
(() => {
  if (window.__NOTES_CLEAN_UI__) return;
  window.__NOTES_CLEAN_UI__ = true;

  // Hide legacy mastery filter immediately so events.js listener stays safe.
  const sfEl = document.getElementById('status-filter');
  if (sfEl) sfEl.hidden = true;
  if (typeof state === 'object' && state) state.sfilter = '';

  // 1. Strip mastery controls from page headers across all entry views.
  if (typeof pageHead === 'function') {
    const _pageHead = pageHead;
    pageHead = function (e, o) {
      const opts = Object.assign({}, o || {}, { noMastery: true });
      if (typeof opts.left === 'string' && /掌握|模糊/.test(opts.left)) {
        opts.left = '';
      }
      return _pageHead(e, opts);
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

  // 3. Clean Home Dashboard: remove mastery progress bars/chips/checkboxes,
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
      const recent = store.get('iv8-recent', []).map((id) => byId.get(id)).filter(Boolean);
      const last = recent[0];
      const activeMods = MODS.filter((m) => TREE[m.id]);
      const mods = activeMods.map((m) => {
        const list = TREE[m.id].all;
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
          '<a class="chip accent link" href="project/">3 份面试精炼手册 →</a>' +
          '<a class="chip link" href="#/e/interview-map">传统后端高频榜 →</a>' +
          '<a class="chip link" href="#/e/kb-agent-board">AI Agent 高频榜 →</a>' +
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

  // 4. Clean Module Overview: remove mastery chips, 0/N counts and progress bars.
  if (typeof renderModHome === 'function') {
    renderModHome = function (modId) {
      const m = MOD[modId], tree = TREE[modId];
      const qaN = tree.all.reduce((s, e) => s + (e.items ? e.items.length : 0), 0);
      const starts = (m.start || []).map((id) => byId.get(id)).filter(Boolean);
      const parts = tree.parts.map((p) =>
        '<div class="part-h">' + h(p.name) + '</div><div class="cat-grid">' + p.cats.map((c) => {
          const catQ = c.items.reduce((s, e) => s + (e.items ? e.items.length : 0), 0);
          const countTxt = catQ ? (catQ + ' 问') : (c.items.length + ' 篇');
          return '<a class="cat-card" href="' + href(c.items[0]) + '" style="' + modColor(modId) + '">' +
            '<span class="h">' + h(c.name) + '<small>' + countTxt + '</small></span>' +
            '<span class="sub">' + h(c.items.slice(0, 4).map((x) => x.title).join(' · ')) + '</span></a>';
        }).join('') + '</div>'
      ).join('');
      const rub = (typeof RUBRIC !== 'undefined' && RUBRIC[modId])
        ? fold('面试评分维度（自测用）', '<div>' + RUBRIC[modId].map(([a, b]) =>
            '<div class="pm-row"><div class="pm-range">' + h(a) + '</div><div class="pm-note">' + h(b) + '</div></div>'
          ).join('') + '</div>')
        : '';
      return '<nav class="crumbs" style="' + modColor(modId) + '"><span class="mdot"></span><a href="#/">冲刺台</a><span class="sep">/</span><span>' + h(m.full) + '</span></nav>' +
        '<section class="hero" style="' + modColor(modId) + '"><h1>' + h(m.full) + '</h1><p>' + h(m.desc) + '</p>' +
          '<div class="meta"><span class="chip">' + tree.all.length + ' 篇内容</span>' + (qaN ? '<span class="chip">' + qaN + ' 道问答</span>' : '') + '</div>' +
          '<div class="head-actions" style="border:0;padding:0">' +
            starts.map((s, i) => '<a class="btn' + (i === 0 ? ' primary' : '') + '" href="' + href(s) + '">' + (i === 0 ? '推荐入口：' : '') + h(s.title) + '</a>').join('') +
            (HL_MODS.includes(modId) ? '<a class="btn' + (starts.length ? '' : ' primary') + '" href="#/hl/' + modId + '">' + ICON_MAP + '重点地图 · ' + qaN + ' 问</a>' : '') +
          '</div></section>' +
        parts +
        (rub ? '<div class="sec">' + rub + '</div>' : '');
    };
  }

  // 5. Clean Sidebar: remove progress bar, mastery ratios, status dots & filter bar.
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
            const list = TREE[state.mod].all;
            const qaN = list.reduce((s, e) => s + (e.items ? e.items.length : 0), 0);
            p.textContent = qaN ? (list.length + ' 篇 · ' + qaN + ' 问') : (list.length + ' 篇内容');
          }
        }
      }
      if (sideList) {
        if (state.mod === 'home') {
          sideList.querySelectorAll('.side-item').forEach((a) => {
            const hrefVal = a.getAttribute('href') || '';
            const m = /^#\/m\/([a-z]+)$/.exec(hrefVal);
            if (m && TREE[m[1]]) {
              const n = a.querySelector('.n');
              if (n) n.textContent = TREE[m[1]].all.length + ' 篇';
            } else {
              const dot = a.querySelector('.dot');
              if (dot) dot.remove();
            }
          });
        } else {
          sideList.querySelectorAll('.side-cat').forEach((det) => {
            const cnt = det.querySelector('summary .cnt');
            if (cnt) {
              const items = det.querySelectorAll('.side-item').length;
              cnt.textContent = String(items);
            }
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

  // 6. Clean Right Rail: remove "1 模糊 / 2 掌握" shortcut tips.
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

  // 7. Clean Highlight Map: remove mastery stats, mastery filter, status dots & bars.
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
      // Strip "0/" mastery prefix from counts after wireMap mounts.
      _wireMap(page);
      page.querySelectorAll('[data-hm-n]').forEach((el) => {
        el.textContent = el.textContent.replace(/^\d+\//, '');
      });
    };
  }

  // 8. Suppress legacy 1/2/0 mastery hotkeys on QA pages so number presses never pop toasts.
  document.addEventListener('keydown', (ev) => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag || '') || (document.activeElement && document.activeElement.isContentEditable)) return;
    if ((ev.key === '1' || ev.key === '2' || ev.key === '0') && document.querySelectorAll('#page .qa').length > 0) {
      ev.stopImmediatePropagation();
    }
  }, true);

  // 9. Mount floating back-to-top button for long lectures, scenarios, and detail pages.
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

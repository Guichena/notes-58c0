/* ==========================================================================
   侧栏 / 顶栏 / 右栏
   ========================================================================== */
function renderModnav() {
  $('#modnav').innerHTML = MODS.filter((m) => m.id === 'home' || TREE[m.id]).map((m) => `<a href="${m.id === 'home' ? '#/' : '#/m/' + m.id}" class="${state.mod === m.id ? 'on' : ''}" style="${modColor(m.id)}"><span class="mdot"></span>${h(m.name)}</a>`).join('');
}
function sideMobileMods() {
  return `<div class="side-mobile-mods">${MODS.filter((m) => m.id === 'home' || TREE[m.id]).map((m) => `<a href="${m.id === 'home' ? '#/' : '#/m/' + m.id}" class="${state.mod === m.id ? 'on' : ''}" style="${modColor(m.id)}"><span class="mdot"></span>${h(m.name)}</a>`).join('')}</div>`;
}
function renderSidebar() {
  const head = $('#side-head'), list = $('#side-list');
  const filterBox = $('.side-filter');
  if (state.mod === 'home') {
    filterBox.hidden = true;
    head.innerHTML = `${sideMobileMods()}<div class="side-mod" style="${modColor('home')}"><span class="mi">◆</span><div><h2>冲刺台</h2><p>全部模块与最近浏览</p></div></div>`;
    const recent = store.get('iv8-recent', []).map((id) => byId.get(id)).filter(Boolean);
    list.innerHTML = `<div class="side-part">模块</div>${MODS.filter((m) => TREE[m.id]).map((m) => { const u = unitsOf(TREE[m.id].all); return `<a class="side-item" href="#/m/${m.id}" style="${modColor(m.id)}"><span class="dot" style="border-color:var(--mc);background:var(--mc)"></span><span class="t">${h(m.full)}</span><span class="n">${u.ok}/${u.total}</span></a>`; }).join('')}
      ${recent.length ? `<div class="side-part">最近浏览</div>${recent.map((e) => `<a class="side-item" href="${href(e)}"><span class="dot s${entryStatus(e)}"></span><span class="t">${h(e.title)}</span><span class="n">${h(MOD[e.mod].name)}</span></a>`).join('')}` : ''}`;
    return;
  }
  filterBox.hidden = false;
  const m = MOD[state.mod], tree = TREE[state.mod];
  const u = unitsOf(tree.all);
  head.innerHTML = `${sideMobileMods()}<div class="side-mod" style="${modColor(state.mod)}"><span class="mi">${m.icon}</span><div><h2><a href="#/m/${m.id}">${h(m.full)}</a></h2><p>${tree.all.length} 条目 · ${u.total} 个复习单元</p></div></div>
    <div class="side-prog"><div class="bar"><i class="s1" style="width:${((u.ok + u.fuzzy) / u.total * 100).toFixed(1)}%"></i><i style="width:${(u.ok / u.total * 100).toFixed(1)}%"></i></div><div class="bar-legend"><span>掌握 ${u.ok}</span><span>模糊 ${u.fuzzy}</span><span>${Math.round(u.ok / u.total * 100)}%</span></div></div>`;
  const cur = state.route.view === 'entry' ? byId.get(state.route.id) : null;
  const q = state.filter.trim().toLowerCase();
  const sf = state.sfilter;
  const small = tree.all.length <= 40;
  let html = '';
  if (HL_MODS.includes(m.id) && state.mod !== 'home') {
    const qn = tree.all.reduce((s, e) => s + (e.items ? e.items.length : 0), 0);
    html += `<a class="side-item side-hl${state.route.view === 'hl' ? ' active' : ''}" href="#/hl/${m.id}" style="margin-top:6px">${ICON_MAP}<span class="t">重点地图</span><span class="n">${qn}</span></a>`;
  }
  for (const p of tree.parts) {
    let partHtml = '';
    for (const c of p.cats) {
      const items = c.items.filter((e) => {
        if (q && !(`${e.title} ${e.number} ${e.cat}`.toLowerCase().includes(q))) return false;
        if (sf !== '' && String(entryStatus(e)) !== sf) return false;
        return true;
      });
      if (!items.length) continue;
      const key = state.mod + '|' + c.name;
      const open = q || sf !== '' || small || state.open.has(key) || (cur && cur.cat === c.name && cur.mod === state.mod);
      const cu = unitsOf(c.items);
      partHtml += `<details class="side-cat" data-key="${h(key)}"${open ? ' open' : ''}><summary>${h(c.name)}<span class="cnt">${cu.ok}/${cu.total}</span></summary>
        ${items.map((e) => `<a class="side-item kind-${e.kind}${cur === e ? ' active' : ''}" href="${href(e)}" data-id="${h(e.id)}"><span class="dot s${entryStatus(e)}"></span><span class="t">${h(e.title)}</span><span class="n">${h(e.kind === 'qa' ? (() => { const x = unitsOf([e]); return x.ok + '/' + x.total; })() : entryNum(e))}</span></a>`).join('')}</details>`;
    }
    if (partHtml) html += (tree.parts.length > 1 || p.name !== p.cats[0].name ? `<div class="side-part">${h(p.name)}</div>` : '') + partHtml;
  }
  list.innerHTML = html || '<div class="side-empty">没有匹配的条目</div>';
  const act = list.querySelector('.side-item.active');
  if (act) act.scrollIntoView({ block: 'nearest' });
}

function buildRail() {
  const rail = $('#rail');
  const page = $('#page');
  let heads = $$('.sec-h, .md > .md-h2, .md.sec > .md-h2, .md.sec > .md-h3, .qa', page).filter((x) => !x.closest('details'));
  const isQA = heads.some((x) => x.classList.contains('qa'));
  if (isQA) heads = $$('.sec-h, .qa', page);
  heads.forEach((x, i) => { if (!x.id) x.id = 'h-' + i; });
  const items = heads.slice(0, 80).map((x) => {
    if (x.classList.contains('qa')) {
      const t = x.querySelector('.qa-q').textContent.trim();
      return `<a href="#${x.id}" data-to="${x.id}" class="lv3" title="${h(t)}">${h(x.querySelector('.qa-no').textContent)}. ${h(t)}</a>`;
    }
    const t = (x.classList.contains('sec-h')
      ? Array.from(x.childNodes).filter((nd) => !(nd.classList && (nd.classList.contains('n') || nd.classList.contains('aside')))).map((nd) => nd.textContent).join('')
      : x.textContent).trim();
    return `<a href="#${x.id}" data-to="${x.id}" class="${x.classList.contains('md-h3') ? 'lv3' : ''}" title="${h(t)}">${h(t)}</a>`;
  }).join('');
  rail.innerHTML = `${items ? `<div class="rail-block"><div class="rail-title">本页目录</div><nav class="toc">${items}</nav></div>` : ''}
    <div class="rail-block"><div class="rail-card"><p>${isQA ? '问答页：J / K 切换题目，Space 显示或展开答案，1 标模糊、2 标掌握。' : '← / → 切换条目，/ 或 Ctrl K 全文搜索，F 专注模式。'}</p>
      <div class="rail-keys">${isQA ? '<div><kbd>J</kbd><kbd>K</kbd> 上 / 下一题</div><div><kbd>Space</kbd> 显示 / 展开</div><div><kbd>1</kbd><kbd>2</kbd> 模糊 / 掌握</div>' : '<div><kbd>←</kbd><kbd>→</kbd> 上 / 下一条</div>'}<div><kbd>/</kbd> 搜索 · <kbd>F</kbd> 专注</div></div></div></div>`;
  setupSpy(heads);
}
let spyObs = null;
function setupSpy(heads) {
  if (spyObs) spyObs.disconnect();
  if (!('IntersectionObserver' in window) || !heads.length) return;
  const links = new Map($$('#rail .toc a').map((a) => [a.dataset.to, a]));
  spyObs = new IntersectionObserver((ents) => {
    ents.forEach((en) => {
      if (!en.isIntersecting) return;
      links.forEach((a) => a.classList.remove('on'));
      const a = links.get(en.target.id);
      if (a) { a.classList.add('on'); a.scrollIntoView({ block: 'nearest' }); }
    });
  }, { rootMargin: '-70px 0px -70% 0px' });
  heads.forEach((x) => spyObs.observe(x));
}


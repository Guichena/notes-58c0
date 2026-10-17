/* ==========================================================================
   路由与渲染
   ========================================================================== */
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  if (!raw) return { view: 'home' };
  const parts = raw.split('/').map((x) => { try { return decodeURIComponent(x); } catch { return x; } });
  if (parts[0] === 'm' && TREE[parts[1]]) return { view: 'mod', mod: parts[1] };
  if ((parts[0] === 'must' || parts[0] === 'hl') && HL_MODS.includes(parts[1])) { if (parts[0] === 'must') history.replaceState(null, '', '#/hl/' + parts[1]); return { view: 'hl', mod: parts[1] }; }
  if (parts[0] === 'e' && ALGO_ALIAS[decodeURIComponent(parts[1] || '')]) parts[1] = ALGO_ALIAS[decodeURIComponent(parts[1])];
  if (parts[0] === 'e' && DATA.FACE_PARENTS && DATA.FACE_PARENTS[parts[1]] != null) {
    const nmax = DATA.FACE_PARENTS[parts[1]];
    let n = parts[2] != null && parts[2] !== '' ? parseInt(parts[2], 10) : 1;
    if (!Number.isFinite(n) || n < 1) n = 1; if (n > nmax) n = nmax;
    parts[1] = parts[1] + '-' + (n - 1); parts.length = 2;
  }
  if (parts[0] === 'e' && byId.has(parts[1])) return { view: 'entry', id: parts[1], q: parts[2] != null && parts[2] !== '' ? parts[2] : null };
  // 兼容 v7 书签：#<id>
  const legacy = parts.join('/');
  if (byId.has(legacy)) return { view: 'entry', id: legacy };
  if (legacy.startsWith('h-') || legacy.startsWith('s-') || legacy.startsWith('q-')) return null; // 页内锚点
  return { view: 'nf', id: raw };
}
let renderSequence = 0;
async function render() {
  const r = parseHash();
  if (!r) return;
  const sequence = ++renderSequence;
  const pendingEntry = r.view === 'entry' ? byId.get(r.id) : null;
  const repository = window.__NOTES_RUNTIME__.repository;
  const needsEntry = pendingEntry && !repository.loaded.has(pendingEntry._chunk);
  const needsMap = r.view === 'hl' && ENTRIES.some(e => e.mod === r.mod && e.kind === 'qa' && !repository.loaded.has(e._chunk));
  if (needsEntry || needsMap) {
    DG.stopAll();
    unwireMap($('#page'));
    document.body.dataset.rendered = '';
    $('#page').innerHTML = '<section class="hero load-state" role="status" aria-live="polite"><p>正在加载内容…</p></section>';
  }
  try {
    if (pendingEntry) await Promise.all([repository.loadEntry(pendingEntry.id), window.__NOTES_RUNTIME__.loadVisuals()]);
    else if (r.view === 'hl') await repository.loadMap(r.mod);
  } catch (error) {
    if (sequence !== renderSequence) return;
    console.error('Content load failed', error);
    document.body.dataset.rendered = '';
    $('#page').innerHTML = '<section class="hero load-error" role="alert"><h1>内容加载失败</h1><p>请检查网络后重试。已保存的学习进度不会丢失。</p><button type="button" class="btn primary" id="content-retry">重试</button> <a class="btn" href="#/">返回冲刺台</a></section>';
    $('#content-retry').addEventListener('click', () => render());
    return;
  }
  // A slow previous request must never overwrite a newer route.
  if (sequence !== renderSequence) return;
  const prevRoute = state.route;
  state.route = r;
  const e = r.view === 'entry' ? byId.get(r.id) : null;
  const mod = (r.view === 'home' || r.view === 'nf') ? 'home' : e ? e.mod : r.mod;
  if (mod !== state.mod) { state.filter = ''; $('#side-search').value = ''; }
  const samePage = prevRoute && prevRoute.view === r.view && prevRoute.id === r.id && prevRoute.mod === r.mod && document.body.dataset.rendered;
  state.mod = mod;
  document.body.dataset.rendered = '1';
  renderModnav();
  renderSidebar();
  if (!samePage) {
    secNo = 0;
    state.curQ = -1;
    if (!e || e.kind !== 'qa') state.mustOnly = false;
    let html = '';
    if (r.view === 'nf') html = renderNotFound(r.id);
    else if (r.view === 'home') html = renderHome();
    else if (r.view === 'mod') html = renderModHome(mod);
    else if (r.view === 'hl') html = renderMap(mod);
    else html = ({ algo: renderAlgo, ptopic: renderPTopic, pattern: renderPattern, topic: renderTopic, scenario: renderScenario, handwrite: renderHandwrite, database: renderHandwrite, syntax: renderSyntax, qa: renderQA, doc: renderDoc }[e.kind] || renderDoc)(e);
    const page = $('#page');
    DG.stopAll();
    page.innerHTML = html;
    page.querySelectorAll('.sec-h > .n').forEach((x, i) => { x.textContent = pad2(i + 1); });
    page.style.cssText = modColor(mod === 'home' ? 'algo' : mod);
    hydrateCode(page);
    wireVizIn(page);
    DG.mountAll(page);
    page.classList.toggle('hm-wide', r.view === 'hl');
    if (r.view === 'hl') wireMap(page); else unwireMap(page);
    buildRail();
    updateQaStat();
    if (e) { pushRecent(e.id); store.set('iv8-last', e.id); }
    document.title = (e ? e.title : r.view === 'mod' ? MOD[mod].full : r.view === 'hl' ? MOD[mod].full + ' · 重点地图' : (r.view === 'nf' ? '未找到' : '冲刺台')) + ' · 面试手册 v17';
    window.scrollTo(0, 0);
  }
  if (r.q != null) focusQuestion(r.q, true);
  closeNav();
}
function wireVizIn(root) {
  $$('.viz', root).forEach((fig) => { const svg = fig.querySelector('svg'); if (svg) staggerViz(svg); });
}
function refreshStatusUI() {
  renderSidebar();
  updateQaStat();
}
function updateQaStat() {
  const el = $('#qa-stat');
  if (!el) return;
  const cards = $$('.qa', $('#page'));
  const ok = cards.filter((c) => c.classList.contains('s2')).length;
  const fz = cards.filter((c) => c.classList.contains('s1')).length;
  el.textContent = `掌握 ${ok} · 模糊 ${fz} · 共 ${cards.length}`;
}


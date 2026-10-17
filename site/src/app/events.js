/* ==========================================================================
   事件
   ========================================================================== */
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 1500);
}
function copyText(text, okMsg) {
  const done = () => toast(okMsg || '已复制');
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  function fallback() {
    const a = document.createElement('textarea'); a.value = text; a.style.position = 'fixed'; a.style.opacity = '0';
    document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch { /* 忽略 */ } a.remove(); done();
  }
}
function codeOf(card) {
  if (card._code) return card._code;
  return $$('.code-text', card).map((x) => x.textContent).join('\n');
}
function closeNav() { document.body.classList.remove('nav-open'); $('#nav-toggle').setAttribute('aria-expanded', 'false'); }
function toggleFocus() { document.body.classList.toggle('focus'); toast(document.body.classList.contains('focus') ? '专注模式：按 F 退出' : '已退出专注模式'); }
function effectiveTheme() {
  const t = document.documentElement.dataset.theme;
  if (t) return t;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

document.addEventListener('click', (ev) => {
  const t = ev.target;
  const actEl = t.closest('[data-act]');
  const act = actEl && actEl.dataset.act;
  // 掌握度（页面头部）
  const segBtn = t.closest('[data-master] button');
  if (segBtn) {
    const key = segBtn.parentElement.dataset.master;
    setStatus(key, +segBtn.dataset.s);
    $$('button', segBtn.parentElement).forEach((b) => b.classList.toggle('on', b === segBtn));
    refreshStatusUI();
    if (+segBtn.dataset.s === 2) toast('已标记为掌握');
    return;
  }
  if (t.closest('#qa-mode button')) {
    const b = t.closest('button');
    state.qaMode = b.dataset.m; store.set('iv8-qamode', state.qaMode);
    $$('#qa-mode button').forEach((x) => x.classList.toggle('on', x === b));
    $$('.qa-list').forEach((l) => { l.dataset.mode = state.qaMode; });
    $$('.qa.open').forEach((c) => c.classList.remove('open'));
    return;
  }
  if (act === 'qa-toggle') {
    if (t.closest('a')) return;
    const card = actEl.closest('.qa');
    card.classList.toggle('open');
    focusQuestion(card.id.slice(2), false);
    return;
  }
  if (act === 'qa-open') { const c = actEl.closest('.qa'); c.classList.add('open'); focusQuestion(c.id.slice(2), false); return; }
  if (act === 'qa-close') { const c = actEl.closest('.qa'); c.classList.remove('open'); c.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
  if (act === 'qa-mark') { markCard(actEl.closest('.qa'), +actEl.dataset.s); return; }
  if (act === 'qa-random') {
    const cards = qaCards(); if (!cards.length) return;
    const pool = cards.filter((c) => !c.classList.contains('s2'));
    const pick = (pool.length ? pool : cards)[Math.floor(Math.random() * (pool.length || cards.length))];
    cards.forEach((c) => c.classList.remove('open', 'cur'));
    if (state.qaMode !== 'q') { $('#qa-mode [data-m="q"]').click(); }
    pick.classList.add('cur'); state.curQ = cards.indexOf(pick);
    pick.scrollIntoView({ block: 'center', behavior: 'smooth' });
    toast('先自己答一遍，再按 Space 看答案');
    return;
  }
  if (act === 'blind') { const c = actEl.closest('.code-card'); c.classList.toggle('blind'); actEl.classList.toggle('on', c.classList.contains('blind')); return; }
  if (act === 'unblind') { const c = actEl.closest('.code-card'); c.classList.remove('blind'); const b = c.querySelector('[data-act="blind"]'); if (b) b.classList.remove('on'); return; }
  if (act === 'copy-code') { copyText(codeOf(actEl.closest('.code-card')), '代码已复制'); return; }
  if (act === 'copy-link') { copyText(location.href, '链接已复制'); return; }
  if (act === 'focus') { toggleFocus(); return; }
  if (t.closest('.viz-replay')) {
    const fig = t.closest('.viz'); const cur = fig.querySelector('svg');
    if (cur) { const fresh = cur.cloneNode(true); cur.replaceWith(fresh); staggerViz(fresh); }
    return;
  }
  const scopeBtn = t.closest('[data-scope]');
  if (scopeBtn) { pal.scope = scopeBtn.dataset.scope; renderScope(); runSearch(); $('#palette-q').focus(); return; }
  const hint = t.closest('[data-hint]');
  if (hint) { $('#palette-q').value = hint.dataset.hint; runSearch(); $('#palette-q').focus(); return; }
  if (t.closest('.pl-item')) { closePalette(); return; }
  if (t.id === 'palette') { closePalette(); return; }
  const tocA = t.closest('#rail .toc a');
  if (tocA) {
    ev.preventDefault();
    const el = document.getElementById(tocA.dataset.to);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); if (el.classList.contains('qa')) focusQuestion(el.id.slice(2), false); }
    return;
  }
  // 正文里的页内锚点（v7 语法页小节导航等）
  const inner = t.closest('#page a[href^="#"]');
  if (inner && !/^#\//.test(inner.getAttribute('href'))) {
    ev.preventDefault();
    const el = document.getElementById(inner.getAttribute('href').slice(1));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  // v7 内嵌的 related-button / data-jump-id
  const jump = t.closest('[data-jump-id], [data-related-index]');
  if (jump) {
    const id = jump.dataset.jumpId;
    if (id && byId.has(id)) location.hash = href(byId.get(id));
    return;
  }
  const popBtn = t.closest('#font-pop [data-font]');
  if (popBtn) {
    const f = popBtn.dataset.font;
    if (f) document.documentElement.dataset.font = f; else delete document.documentElement.dataset.font;
    store.set('iv8-font', f); try { localStorage.setItem('iv8-font', f); } catch { /* 忽略 */ }
    markFont(); return;
  }
  if (!t.closest('#font-pop') && !t.closest('#font-btn')) $('#font-pop').hidden = true;
});
function rerender() { document.body.dataset.rendered = ''; const r = state.route; state.route = { view: '_' }; render(); if (r.q != null) focusQuestion(r.q, true); }

document.addEventListener('change', (ev) => {
  const wk = ev.target.closest('[data-week]');
  if (wk) {
    const w = store.get('iv8-weeks', {});
    if (wk.checked) w[wk.dataset.week] = 1; else delete w[wk.dataset.week];
    store.set('iv8-weeks', w);
    wk.closest('label').classList.toggle('done', wk.checked);
  }
});
$('#side-list').addEventListener('click', (ev) => {
  const sum = ev.target.closest('.side-cat > summary');
  if (!sum) return;
  const d = sum.parentElement;
  setTimeout(() => {
    if (d.open) state.open.add(d.dataset.key); else state.open.delete(d.dataset.key);
    store.set('iv8-open', [...state.open]);
  }, 0);
});

$('#side-search').addEventListener('input', (ev) => { state.filter = ev.target.value; renderSidebar(); });
$('#status-filter').addEventListener('click', (ev) => {
  const b = ev.target.closest('button'); if (!b) return;
  state.sfilter = b.dataset.f;
  $$('#status-filter button').forEach((x) => x.classList.toggle('on', x === b));
  renderSidebar();
});
$('#search-trigger').addEventListener('click', () => openPalette());
$('#palette-q').addEventListener('input', () => { clearTimeout(runSearch._t); runSearch._t = setTimeout(runSearch, 60); });
$('#palette-q').addEventListener('keydown', (ev) => {
  const n = $$('#palette-list .pl-item').length;
  if (ev.key === 'ArrowDown') { ev.preventDefault(); pal.sel = Math.min(n - 1, pal.sel + 1); markSel(); }
  else if (ev.key === 'ArrowUp') { ev.preventDefault(); pal.sel = Math.max(0, pal.sel - 1); markSel(); }
  else if (ev.key === 'Enter') { const a = $$('#palette-list .pl-item')[pal.sel]; if (a) { location.hash = a.getAttribute('href'); closePalette(); } }
  else if (ev.key === 'Escape') { closePalette(); }
});
$('#nav-toggle').addEventListener('click', () => {
  const open = !document.body.classList.contains('nav-open');
  document.body.classList.toggle('nav-open', open);
  $('#nav-toggle').setAttribute('aria-expanded', String(open));
});
$('#scrim').addEventListener('click', closeNav);
$('#theme-btn').addEventListener('click', () => {
  const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('iv8-theme', next); } catch { /* 忽略 */ }
});
function markFont() {
  const f = document.documentElement.dataset.font || '';
  $$('#font-pop [data-font]').forEach((b) => b.classList.toggle('on', b.dataset.font === f));
}
$('#font-btn').addEventListener('click', () => {
  const pop = $('#font-pop');
  const r = $('#font-btn').getBoundingClientRect();
  pop.style.top = (r.bottom + 8) + 'px';
  pop.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
  pop.hidden = !pop.hidden;
  markFont();
});

document.addEventListener('keydown', (ev) => {
  const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); $('#palette').hidden ? openPalette() : closePalette(); return; }
  if (!$('#palette').hidden) return;
  if (ev.key === 'Escape') { if (inField) document.activeElement.blur(); closeNav(); $('#font-pop').hidden = true; return; }
  if (inField || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  const key = ev.key;
  if (key === '/') { ev.preventDefault(); openPalette(); return; }
  if (key === 'f' || key === 'F') { toggleFocus(); return; }
  const cur = state.route.view === 'entry' ? byId.get(state.route.id) : null;
  const hasQA = qaCards().length > 0;
  const stepEntry = (d) => {
    if (!cur) return;
    const list = TREE[cur.mod].all; const i = list.indexOf(cur) + d;
    if (list[i]) location.hash = href(list[i]);
  };
  if (key === 'ArrowRight') { stepEntry(1); return; }
  if (key === 'ArrowLeft') { stepEntry(-1); return; }
  if (key === 'j' || key === 'J') { if (hasQA) moveQuestion(1); else stepEntry(1); ev.preventDefault(); return; }
  if (key === 'k' || key === 'K') { if (hasQA) moveQuestion(-1); else stepEntry(-1); ev.preventDefault(); return; }
  if (hasQA && state.curQ >= 0) {
    const card = qaCards()[state.curQ];
    if (!card) return;
    if (key === ' ') {
      ev.preventDefault();
      const list = card.closest('.qa-list');
      const mode = list ? list.dataset.mode : 'full';
      if (!card.classList.contains('open') && mode !== 'full') card.classList.add('open'); else moveQuestion(1);
      return;
    }
    if (key === '1') { markCard(card, 1); return; }
    if (key === '2') { markCard(card, 2); return; }
    if (key === '0') { setStatus(card.dataset.key, 0); card.classList.remove('s1', 's2'); $$('.qa-foot [data-s]', card).forEach((b) => b.classList.remove('on')); refreshStatusUI(); }
  }
});

window.addEventListener('hashchange', render);
window.addEventListener('storage', (ev) => { if (ev.key === 'iv8-progress') { PROG = store.get('iv8-progress', {}); refreshStatusUI(); } });
render();
// The compact global search index is fetched on first non-empty search.

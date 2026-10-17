
/* ---------------- v16 重点：易混对比卡 / 本节重点 / 重点地图 ---------------- */
const HLD = DATA.HL || { cards: {}, core: {} };
const HLC = HLD.cards || {}, HL_CORE = HLD.core || {};
const HL_MODS = MODS.filter((m) => TREE[m.id] && TREE[m.id].all.some((e) => e.kind === 'qa')).map((m) => m.id);
const ICON_MAP = '<svg class="ic-map" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/></svg>';
const ESS_RE = /<p class="md-p sx-ess"><span class="sx-tag">本质<\/span>([\s\S]*?)<\/p>/;
const essOf = (it) => { const m = ESS_RE.exec(it.lead || ''); return m ? stripTags(m[1]).trim() : ''; };
/* 仅展示层：去掉「X 的本质是」这类重复开头，原文不变 */
const ESS_HEAD = /^[^，。；：,;:]{1,22}?(的)?本质(上)?(是|在于|就是|：|:)\s*/;
const essShow = (s) => { const t = s.replace(ESS_HEAD, ''); return t.length >= 8 && t !== s ? t : s; };
const ST_TXT = ['未学', '模糊', '已掌握'];
function cmpCard(key) {
  const c = HLC[key];
  if (!c) return '';
  const tag = c.pick ? `<span class="pick">【${h(c.pickLabel || '推荐')}】</span>` : '';
  return `<div class="cmp${c.dup ? ' dup' : ''}"><div class="cmp-h"><span class="sx-tag cmpx">易混对比</span><b>${h(c.title)}</b>${c.dup ? '<small>正文里有完整对比表</small>' : ''}</div><div class="tbl-wrap"><table class="tbl cmp-t"><thead><tr><th></th>${c.cols.map((x) => `<th${x === c.pick ? ' class="pk"' : ''}>${h(x)}${x === c.pick ? tag : ''}</th>`).join('')}</tr></thead>
    <tbody>${c.rows.map((r) => `<tr><th>${h(r.dim)}</th>${r.cells.map((x, i) => `<td${c.cols[i] === c.pick ? ' class="pk"' : ''}>${h(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
}
function keyCard(e) {
  const core = HL_CORE[e.id];
  if (!e.items || e.items.length < 3) return core ? `<p class="kc-solo"><span class="sx-tag">核心</span>${h(core)}</p>` : '';
  const nc = e.items.filter((_, i) => HLC[qKey(e.id, i)]).length;
  return `<details class="kc" open><summary class="kc-h"><b>本节重点</b><small>${e.items.length} 问${nc ? ` · ${nc} 张易混对比` : ''} · 点题目跳转</small><span class="kc-car" aria-hidden="true"></span></summary>
    ${core ? `<p class="kc-core"><span class="sx-tag">核心</span>${h(core)}</p>` : ''}
    <ol class="kc-list">${e.items.map((it, i) => `<li class="s${statusOf(qKey(e.id, i))}" data-k="${h(qKey(e.id, i))}"><a href="${href(e, i)}" title="${h(essOf(it))}">${h(stripTags(it.q))}</a>${HLC[qKey(e.id, i)] ? '<span class="cmp-tag">对比</span>' : ''}</li>`).join('')}</ol></details>`;
}
function syncKeyCard(key, s) { $$(`.kc-list li[data-k="${CSS.escape(key)}"]`).forEach((li) => { li.className = 's' + s; }); }
const pct = (a, b) => (b ? (a / b * 100).toFixed(1) : 0);
const barHtml = (u) => `<span class="bar" aria-hidden="true"><i class="s1" style="width:${pct(u.ok + u.fuzzy, u.total)}%"></i><i style="width:${pct(u.ok, u.total)}%"></i></span>`;
function mapParts(modId) {
  return TREE[modId].parts.map((p) => ({ name: p.name, cats: p.cats.map((c) => ({ name: c.name, es: c.items.filter((e) => e.kind === 'qa'), docs: c.items.filter((e) => e.kind !== 'qa') })).filter((c) => c.es.length) })).filter((p) => p.cats.length);
}
const dotLabel = (s) => `状态：${ST_TXT[s]}，点击切换`;
function renderMap(modId) {
  const m = MOD[modId], parts = mapParts(modId);
  const all = parts.flatMap((p) => p.cats.flatMap((c) => c.es));
  const ndoc = parts.reduce((s, p) => s + p.cats.reduce((t, c) => t + c.docs.length, 0), 0);
  const u = unitsOf(all);
  const closed = new Set(store.get('iv15-hm-closed-' + modId, []));
  let ci = 0;
  const toc = parts.map((p) => `<div class="hm-toc-p">${h(p.name)}</div>${p.cats.map((c) => { const cu = unitsOf(c.es); return `<a class="hm-toc-c" href="#hm-c-${ci}" data-hm-jump="${ci++}"><span class="t">${h(c.name)}</span><span class="n" data-hm-n>${cu.ok}/${cu.total}</span>${barHtml(cu)}</a>`; }).join('')}`).join('');
  ci = 0;
  const body = parts.map((p) => `<h2 class="hm-part">${h(p.name)}<small>${p.cats.length} 个分类</small></h2>${p.cats.map((c) => {
    const cu = unitsOf(c.es), i = ci++;
    const solo = c.es.length === 1 ? c.es[0] : null;
    const entries = c.es.map((e) => `<div class="hm-entry" data-e="${h(e.id)}">${solo ? '' : `<div class="hm-entry-h"><a href="${href(e)}">${h(e.title)}</a><span class="n" data-hm-n>${unitsOf([e]).ok}/${e.items.length} 问</span></div>`}
      ${HL_CORE[e.id] && !solo ? `<p class="hm-core"><span class="sx-tag">核心</span>${h(HL_CORE[e.id])}</p>` : ''}
      <ol class="hm-qs">${e.items.map((it, qi) => { const k = qKey(e.id, qi), q = stripTags(it.q), es = essOf(it), s = statusOf(k);
        return `<li class="hm-q s${s}" data-k="${h(k)}" data-t="${h((q + ' ' + es).toLowerCase())}"><button type="button" class="hm-dot" data-hm-mark aria-label="${dotLabel(s)}" title="点击切换：未学 → 模糊 → 掌握"></button><a href="${href(e, qi)}"><span class="q">${h(q)}</span>${es ? `<span class="es">${h(essShow(es))}</span>` : ''}</a>${HLC[k] ? '<span class="cmp-tag">对比</span>' : ''}</li>`; }).join('')}</ol></div>`).join('');
    const docs = c.docs.length ? `<p class="hm-docs"><span>相关精讲（不计入问数）：</span>${c.docs.map((d) => `<a href="${href(d)}">${h(d.title)}</a>`).join('')}</p>` : '';
    const open = !closed.has(c.name);
    return `<section class="hm-cat${open ? ' open' : ''}" id="hm-c-${i}" data-cat="${h(c.name)}" data-i="${i}">
      <header class="hm-cat-h" data-hm-toggle role="button" tabindex="0" aria-expanded="${open}" aria-controls="hm-b-${i}"><span class="car" aria-hidden="true"></span><span class="t"><b>${h(c.name)}</b>${solo && HL_CORE[solo.id] ? `<small class="hm-core-s">${h(HL_CORE[solo.id])}</small>` : `<small>${c.es.length} 个小节</small>`}</span><span class="n" data-hm-n>${cu.ok}/${cu.total} 问</span>${barHtml(cu)}${solo ? `<a class="hm-open" href="${href(solo)}" title="打开本节" aria-label="打开本节">↗</a>` : ''}</header>
      <div class="hm-cat-b" id="hm-b-${i}">${entries}${docs}</div></section>`;
  }).join('')}`).join('');
  const fake = { id: 'hl-' + modId, mod: modId, part: '重点地图', cat: '重点地图' };
  return `${crumbs(fake)}<section class="hm-hero"><h1 class="page-title">${h(m.full)} · 重点地图</h1>
    <p class="page-sub">模块 → 分类 → 小节 → 题目，每题一句「本质」；圆点直接标掌握状态。顺序与侧栏一致，内容全部来自已有答案。</p>
    <div class="hm-stats"><span><b>${ci}</b> 个分类</span><span><b>${u.total}</b> 问</span><span class="ok">掌握 <b data-hm-ok>${u.ok}</b></span><span class="fz">模糊 <b data-hm-fz>${u.fuzzy}</b></span><span class="todo">未学 <b data-hm-td>${u.total - u.ok - u.fuzzy}</b></span>${barHtml(u)}</div>
    ${ndoc ? `<p class="hm-note">地图只统计问答题；侧栏的计数另含 ${ndoc} 篇精讲文档，所以会多一些。</p>` : ''}</section>
    <div class="hm-bar"><label class="hm-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg><input id="hm-q" type="search" placeholder="在地图里筛选题目 / 本质…" aria-label="在地图里筛选"></label>
      <div class="seg" id="hm-f" role="group" aria-label="按掌握状态筛选"><button type="button" data-f="" class="on" aria-pressed="true">全部</button><button type="button" data-f="todo" aria-pressed="false">未掌握</button><button type="button" data-f="1" aria-pressed="false">模糊</button><button type="button" data-f="2" aria-pressed="false">已掌握</button></div>
      <button type="button" class="btn ghost" data-hm-dense aria-pressed="false">精简</button><button type="button" class="btn ghost" data-hm-all>全部收起</button>
      <span class="hm-count" id="hm-count" aria-live="polite"></span></div>
    <div class="hm-layout"><nav class="hm-toc" aria-label="分类目录">${toc}</nav><div class="hm-main" id="hm-main" data-mod="${modId}">${body}<div class="empty-state hm-empty" hidden>没有匹配的题目</div></div></div>`;
}
function unwireMap(page) {
  if (page._hmh) { page.removeEventListener('click', page._hmh); page.removeEventListener('keydown', page._hmk); page._hmh = null; }
  if (window._hmScroll) { removeEventListener('scroll', window._hmScroll); window._hmScroll = null; if (window._hmTimer) window._hmTimer(); }
  if (window._hmIO) { window._hmIO.disconnect(); window._hmIO = null; }
}
function wireMap(page) {
  unwireMap(page);
  const main = $('#hm-main', page); if (!main) return;
  const modId = main.dataset.mod;
  const SK = 'iv16-hm-' + modId;
  let sess = {}; try { sess = JSON.parse(sessionStorage.getItem(SK) || '{}'); } catch (_) { sess = {}; }
  const st = { q: sess.q || '', f: store.get('iv16-hm-f-' + modId, '') };
  const saveSess = () => { if (!main.isConnected) return; try { sessionStorage.setItem(SK, JSON.stringify({ q: st.q, y: Math.round(scrollY) })); } catch (_) {} };
  const qs = $$('.hm-q', main);
  const cats = $$('.hm-cat', main);
  const syncAll = () => { const b = $('[data-hm-all]', page); if (b) b.textContent = cats.every((c) => c.classList.contains('open')) ? '全部收起' : '全部展开'; cats.forEach((c) => $('.hm-cat-h', c).setAttribute('aria-expanded', String(isOpen(c)))); };
  const isOpen = (c) => c.classList.contains('force') ? !c.classList.contains('force-off') : c.classList.contains('open');
  const saveClosed = () => store.set('iv15-hm-closed-' + modId, cats.filter((c) => !c.classList.contains('open')).map((c) => c.dataset.cat));
  const recount = () => {
    const cnt = (els) => { let ok = 0, fz = 0; els.forEach((x) => { if (x.classList.contains('s2')) ok++; else if (x.classList.contains('s1')) fz++; }); return { ok, fuzzy: fz, total: els.length }; };
    const setBar = (root, u, suf) => { const n = $('[data-hm-n]', root); if (n) n.textContent = `${u.ok}/${u.total}${suf || ''}`; const b = $('.bar', root); if (b) { b.children[0].style.width = pct(u.ok + u.fuzzy, u.total) + '%'; b.children[1].style.width = pct(u.ok, u.total) + '%'; } };
    cats.forEach((c, i) => { const u = cnt($$('.hm-q', c)); setBar($('.hm-cat-h', c), u, ' 问'); const t = $(`[data-hm-jump="${i}"]`, page); if (t) setBar(t, u); $$('.hm-entry', c).forEach((en) => { const hh = $('.hm-entry-h', en); if (hh) setBar(hh, cnt($$('.hm-q', en)), ' 问'); }); });
    const u = cnt(qs); $('[data-hm-ok]', page).textContent = u.ok; $('[data-hm-fz]', page).textContent = u.fuzzy; $('[data-hm-td]', page).textContent = u.total - u.ok - u.fuzzy; setBar($('.hm-stats', page), u);
  };
  const apply = (keepForceOff) => {
    const terms = st.q.toLowerCase().replace(/([\u3400-\u9fff])([a-z0-9])/g, '$1 $2').replace(/([a-z0-9])([\u3400-\u9fff])/g, '$1 $2').split(/\s+/).filter(Boolean);
    let shown = 0;
    qs.forEach((li) => { const s = li.classList.contains('s2') ? '2' : li.classList.contains('s1') ? '1' : '0';
      const okF = !st.f || (st.f === 'todo' ? s !== '2' : s === st.f); const okQ = terms.every((t) => li.dataset.t.includes(t));
      li.hidden = !(okF && okQ); if (!li.hidden) shown++; });
    const active = !!(st.f || terms.length);
    $$('.hm-entry', main).forEach((en) => { en.hidden = !$$('.hm-q', en).some((x) => !x.hidden); });
    cats.forEach((c, i) => { const any = $$('.hm-q', c).some((x) => !x.hidden); c.hidden = !any; c.classList.toggle('force', active && any); if (!keepForceOff) c.classList.remove('force-off'); const t = $(`[data-hm-jump="${i}"]`, page); if (t) t.classList.toggle('dim', !any); });
    $$('.hm-part', main).forEach((p) => { let n = p.nextElementSibling, any = false; while (n && !n.classList.contains('hm-part')) { if (n.classList.contains('hm-cat') && !n.hidden) any = true; n = n.nextElementSibling; } p.hidden = !any; });
    $('.hm-empty', main).hidden = shown > 0;
    $('#hm-count', page).textContent = active ? `显示 ${shown} / ${qs.length} 问` : `${qs.length} 问`;
    syncAll();
  };
  const setF = (f) => { st.f = f; store.set('iv16-hm-f-' + modId, f); $$('#hm-f button', page).forEach((b) => { const on = b.dataset.f === f; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }); };
  const toggleCat = (c) => {
    if (c.classList.contains('force')) c.classList.toggle('force-off');
    else { c.classList.toggle('open'); saveClosed(); }
    syncAll();
  };
  const inp = $('#hm-q', page);
  inp.value = st.q;
  inp.addEventListener('input', () => { st.q = inp.value.trim(); saveSess(); clearTimeout(apply._t); apply._t = setTimeout(() => apply(false), 60); });
  page._hmh = (ev) => {
    const f = ev.target.closest('#hm-f [data-f]');
    if (f) { setF(f.dataset.f); apply(false); return; }
    const tg = ev.target.closest('[data-hm-toggle]');
    if (tg && !ev.target.closest('a')) { toggleCat(tg.parentElement); return; }
    const all = ev.target.closest('[data-hm-all]');
    if (all) { const open = !cats.every((c) => c.classList.contains('open')); cats.forEach((c) => { c.classList.toggle('open', open); c.classList.toggle('force-off', !open && c.classList.contains('force')); }); syncAll(); saveClosed(); return; }
    const dn = ev.target.closest('[data-hm-dense]');
    if (dn) { const on = main.classList.toggle('dense'); dn.setAttribute('aria-pressed', String(on)); dn.classList.toggle('on', on); store.set('iv15-hm-dense', on); return; }
    const mk = ev.target.closest('[data-hm-mark]');
    if (mk) { const li = mk.closest('.hm-q'); const nx = (statusOf(li.dataset.k) + 1) % 3; setStatus(li.dataset.k, nx);
      li.classList.remove('s0', 's1', 's2'); li.classList.add('s' + nx); mk.setAttribute('aria-label', dotLabel(nx)); renderSidebar(); recount(); return; }
    const j = ev.target.closest('[data-hm-jump]');
    if (j) { ev.preventDefault(); const c = $('#hm-c-' + j.dataset.hmJump, main); if (!c.classList.contains('force')) { c.classList.add('open'); saveClosed(); } else c.classList.remove('force-off'); syncAll(); c.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
    const a = ev.target.closest('.hm-q a, .hm-entry-h a, .hm-open, .hm-docs a');
    if (a) saveSess();
  };
  page._hmk = (ev) => { const tg = ev.target.closest('[data-hm-toggle]'); if (tg && (ev.key === 'Enter' || ev.key === ' ') && ev.target === tg) { ev.preventDefault(); toggleCat(tg.parentElement); } };
  page.addEventListener('click', page._hmh);
  page.addEventListener('keydown', page._hmk);
  let tS; window._hmTimer = () => clearTimeout(tS); window._hmScroll = () => { clearTimeout(tS); tS = setTimeout(saveSess, 120); }; addEventListener('scroll', window._hmScroll, { passive: true });
  /* 当前分类高亮（scrollspy） */
  const tocLinks = $$('[data-hm-jump]', page);
  const vis = new Map();
  window._hmIO = new IntersectionObserver((ents) => {
    ents.forEach((en) => vis.set(+en.target.dataset.i, en.isIntersecting ? en.boundingClientRect.top : null));
    let best = null; vis.forEach((top, i) => { if (top != null && (best == null || i < best)) best = i; });
    if (best == null) return;
    tocLinks.forEach((t) => { const on = +t.dataset.hmJump === best; if (on !== t.classList.contains('cur')) { t.classList.toggle('cur', on); if (on) { t.setAttribute('aria-current', 'true'); const toc = t.parentElement; if (toc.scrollWidth > toc.clientWidth) toc.scrollTo({ left: t.offsetLeft - 12, behavior: 'smooth' }); else if (toc.scrollHeight > toc.clientHeight) { const r = t.offsetTop - toc.scrollTop; if (r < 0 || r > toc.clientHeight - 30) toc.scrollTo({ top: t.offsetTop - 40 }); } } else t.removeAttribute('aria-current'); } });
  }, { rootMargin: '-140px 0px -55% 0px' });
  cats.forEach((c) => window._hmIO.observe(c));
  if (store.get('iv15-hm-dense', false)) { main.classList.add('dense'); const dn = $('[data-hm-dense]', page); dn.classList.add('on'); dn.setAttribute('aria-pressed', 'true'); }
  setF(st.f); apply(false);
  if (sess.y) setTimeout(() => { window.scrollTo(0, sess.y); }, 0);
}

/* ---------------- 冲刺台 ---------------- */

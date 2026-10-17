/* ==========================================================================
   全文搜索（Ctrl K）
   ========================================================================== */
let INDEX = null;
async function buildIndex() {
  if (!INDEX) INDEX = await window.__NOTES_RUNTIME__.repository.loadSearch();
  return INDEX;
}
const pal = { scope: '', sel: 0, results: [] };
function openPalette(q) {
  $('#palette').hidden = false;
  const input = $('#palette-q');
  if (q != null) input.value = q;
  renderScope();
  runSearch();
  requestAnimationFrame(() => { input.focus(); input.select(); });
}
function closePalette() { $('#palette').hidden = true; }
function renderScope() {
  $('#palette-scope').innerHTML = [['', '全部'], ...MODS.filter((m) => TREE[m.id]).map((m) => [m.id, m.name])].map(([id, n]) => `<button type="button" data-scope="${id}" class="${pal.scope === id ? 'on' : ''}">${h(n)}</button>`).join('');
}
function snippet(text, terms) {
  const low = text.toLowerCase();
  let at = -1;
  for (const t of terms) { at = low.indexOf(t); if (at >= 0) break; }
  const start = Math.max(0, at - 28);
  let s = (start > 0 ? '…' : '') + text.slice(start, start + 110);
  return hl(s, terms);
}
function hl(s, terms) {
  let x = h(s);
  terms.filter(Boolean).sort((a, b) => b.length - a.length).forEach((t) => {
    const re = new RegExp(h(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    x = x.replace(re, (m) => `<mark>${m}</mark>`);
  });
  return x;
}
let searchSequence = 0;
async function runSearch() {
  const sequence = ++searchSequence;
  const raw = $('#palette-q').value.trim();
  const list = $('#palette-list');
  if (!raw) {
    const recent = store.get('iv8-recent', []).map((id) => byId.get(id)).filter(Boolean).slice(0, 8);
    pal.results = recent.map((e) => ({ e }));
    list.innerHTML = (recent.length ? `<div class="pl-group">最近浏览</div>${recent.map((e, i) => plItem({ e }, i, [])).join('')}` : '')
      + `<div class="pl-empty">输入关键词搜索全部 ${ENTRIES.length} 个条目与 ${ENTRIES.reduce((s, e) => s + (e.items ? e.items.length : 0), 0)} 道问答<div class="hints">${['MVCC', 'LRU', '秒杀', '分布式锁', '146', '消息不丢', 'RAG 召回', '线程池', '分库分表'].map((x) => `<button type="button" data-hint="${h(x)}">${h(x)}</button>`).join('')}</div></div>`;
    pal.sel = 0; markSel(); $('#palette-count').textContent = '';
    return;
  }
  const terms = raw.toLowerCase().replace(/([\u3400-\u9fff\uf900-\ufaff])([a-z0-9])/g, '$1 $2').replace(/([a-z0-9])([\u3400-\u9fff\uf900-\ufaff])/g, '$1 $2').split(/\s+/).filter(Boolean);
  let idx;
  try {
    if (!INDEX) list.innerHTML = '<div class="pl-empty" role="status">正在加载搜索索引…</div>';
    idx = await buildIndex();
  } catch (error) {
    if (sequence !== searchSequence) return;
    console.error('Search load failed', error);
    list.innerHTML = '<div class="pl-empty" role="alert">搜索索引加载失败 <button type="button" class="btn" id="search-retry">重试</button></div>';
    $('#search-retry').addEventListener('click', () => runSearch());
    $('#palette-count').textContent = '';
    pal.results = [];
    return;
  }
  if (sequence !== searchSequence || $('#palette').hidden) return;
  const out = [];
  for (const r of idx) {
    if (pal.scope && r.e.mod !== pal.scope) continue;
    let score = 0, ok = true;
    for (const t of terms) {
      const inT = r.tl.includes(t);
      if (inT) score += r.tl.startsWith(t) ? 14 : 10;
      else if (r.tx.includes(t)) score += 1;
      else { ok = false; break; }
    }
    if (!ok) continue;
    if (r.e.kind === 'algo' && String(r.e.number) === raw) score += 40;
    if (r.qi == null && r.e.kind !== 'qa') score += 1.5;
    out.push({ r, score });
  }
  out.sort((a, b) => b.score - a.score);
  pal.results = out.slice(0, 80).map((x) => x.r);
  list.innerHTML = pal.results.length ? pal.results.map((r, i) => plItem(r, i, terms)).join('') : '<div class="pl-empty">没有找到匹配内容，换个关键词或减少关键词试试</div>';
  $('#palette-count').textContent = out.length ? `${out.length} 条结果${out.length > 80 ? '（显示前 80）' : ''}` : '';
  pal.sel = 0; markSel();
}
function plItem(r, i, terms) {
  const e = r.e, m = MOD[e.mod];
  const isQ = r.qi != null;
  const title = isQ ? r.title : (e.kind === 'algo' ? e.number + '. ' : '') + e.title;
  const sub = isQ ? `${e.cat} · ${e.title}` : `${KIND_LABEL[e.kind] || ''} · ${e.cat}`;
  const snip = terms.length && r.text ? snippet(r.text, terms) : '';
  return `<a class="pl-item" data-i="${i}" href="${isQ ? href(e, r.qi) : href(e)}" style="${modColor(e.mod)}"><span class="pl-ic">${m.icon}</span><span><span class="pl-title">${hl(title, terms)}<small>${h(sub)}</small></span>${snip ? `<span class="pl-snip">${snip}</span>` : ''}</span></a>`;
}
function markSel() {
  const items = $$('#palette-list .pl-item');
  items.forEach((x, i) => x.classList.toggle('on', i === pal.sel));
  if (items[pal.sel]) items[pal.sel].scrollIntoView({ block: 'nearest' });
}


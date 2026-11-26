// Late, additive UI projection for the imported knowledge module. Keeping it
// after the reviewed display projection leaves its source hash guards intact.
import {resolveRetiredKnowledgeRoute} from './knowledge-library.mjs';

export function projectKnowledgeRuntime(file, text, {baselineTest = false} = {}) {
  if (baselineTest) return text;
  if (file === 'src/app/catalog.js') {
    const before = "  { id: 'bagu', name: '八股', full: '系统设计八股', icon: 'B', must: true,";
    const addition = "  { id: 'knowledge', name: '考点', full: '后端 + Agent 考点', icon: 'K', start: ['interview-map', 'kb-agent-board'],\n    desc: '拆分为传统后端高频榜与 AI Agent 高频榜，按重要度排好顺序、不标次数；全量考点完整收录在独立详解页，底部附 25 册系统讲义。' },\n";
    if (!text.includes(before)) throw new Error('Knowledge runtime: catalog module boundary not found');
    return text.replace(before, addition + before);
  }
  if (file === 'src/app/renderers.js') {
    const before = 'function renderDoc(e) {';
    const start = text.indexOf(before);
    const end = text.indexOf('\n}\n\n/* ---------------- 问答卡', start);
    if (start < 0 || end < 0) throw new Error('Knowledge runtime: renderDoc boundary not found');
    const original = text.slice(start, end);
    const replacement = original
      .replace('<span class="chip accent">专题精讲</span>', '<span class="chip accent">${e.mod === \'knowledge\' ? \'考点知识\' : \'专题精讲\'}</span>')
      .replace('<div class="md sec">${e.html}</div>', '<div class="md sec${e.mod === \'knowledge\' ? \' kb-page\' : \'\'}">${e.html}</div>');
    if (replacement === original) throw new Error('Knowledge runtime: renderDoc projection did not apply');
    return text.slice(0, start) + replacement + text.slice(end);
  }
  if (file === 'src/app/search.js') {
    const scoreAnchor = "    if (r.qi == null && r.e.kind !== 'qa') score += 1.5;";
    const scoreAfter = "    if (r.qi == null && !r.anchor && r.e.kind !== 'qa') score += 1.5;\n    if (r.anchor) score += 1.2;";
    const plBefore = `function plItem(r, i, terms) {
  const e = r.e, m = MOD[e.mod];
  const isQ = r.qi != null;
  const title = isQ ? r.title : (e.kind === 'algo' ? e.number + '. ' : '') + e.title;
  const sub = isQ ? \`\${learnerLabel('cat', e.cat)} · \${e.title}\` : \`\${KIND_LABEL[e.kind] || ''} · \${learnerLabel('cat', e.cat)}\`;
  const snip = terms.length && r.text ? snippet(learnerSearchText(r), terms) : '';
  return \`<a class="pl-item" data-i="\${i}" href="\${isQ ? href(e, r.qi) : href(e)}" style="\${modColor(e.mod)}"><span class="pl-ic">\${m.icon}</span><span><span class="pl-title">\${hl(title, terms)}<small>\${h(sub)}</small></span>\${snip ? \`<span class="pl-snip">\${snip}</span>\` : ''}</span></a>\`;
}`;
    const plAfter = `function plItem(r, i, terms) {
  const e = r.e, m = MOD[e.mod];
  const isQ = r.qi != null, isKbCard = Boolean(r.anchor);
  const title = (isQ || isKbCard) ? r.title : (e.kind === 'algo' ? e.number + '. ' : '') + e.title;
  const sub = (isQ || isKbCard) ? \`\${learnerLabel('cat', e.cat)} · \${e.title}\` : \`\${KIND_LABEL[e.kind] || ''} · \${learnerLabel('cat', e.cat)}\`;
  const snip = terms.length && r.text ? snippet(learnerSearchText(r), terms) : '';
  const targetHref = isKbCard ? \`#/e/\${encodeURIComponent(e.id)}/\${encodeURIComponent(r.anchor)}\` : isQ ? href(e, r.qi) : href(e);
  return \`<a class="pl-item" data-i="\${i}" href="\${targetHref}" style="\${modColor(e.mod)}"><span class="pl-ic">\${m.icon}</span><span><span class="pl-title">\${hl(title, terms)}<small>\${h(sub)}</small></span>\${snip ? \`<span class="pl-snip">\${snip}</span>\` : ''}</span></a>\`;
}`;
    if (!text.includes(scoreAnchor) || !text.includes(plBefore)) throw new Error('Knowledge runtime: search projection anchor not found');
    return text.replace(scoreAnchor, scoreAfter).replace(plBefore, plAfter);
  }
  if (file === 'src/app/routing.js') {
    const parseAnchor = "  if (parts[0] === 'e' && byId.has(parts[1])) return { view: 'entry', id: parts[1], q: parts[2] != null && parts[2] !== '' ? parts[2] : null };";
    const parseAfter = `${parseAnchor}
  if (parts[0] === 'e' && !DATA.archivedRoutes?.[parts[1]]) {
    const mappedKb = resolveRetiredKnowledgeRoute(parts[1]);
    if (mappedKb && byId.has(mappedKb)) return { view: 'entry', id: mappedKb, q: null };
  }`;
    const archivedBefore = "const owner = byId.get(DATA.archivedRoutes[r.id].ownerId);";
    const archivedAfter = "const owner = byId.get(DATA.archivedRoutes[r.id].ownerId) || byId.get('interview-map') || ENTRIES[0];";
    const hydrateBefore = "    hydrateCode(page);";
    const hydrateAfter = "    hydrateCode(page);\n    hydrateKnowledgePage(page);";
    const before = "if (r.q != null) {\n    if (e?.id === 'own-practice-es-write-visibility' && /^s-es-[a-z]+$/.test(r.q)) document.getElementById(r.q)?.scrollIntoView({block: 'start'});\n    else focusQuestion(r.q, true);\n  }";
    const after = `if (r.q != null) {
    if (e?.kind === 'doc') {
      const anchor = document.getElementById(r.q);
      if (anchor) requestAnimationFrame(() => {
        const page = anchor.closest('.kb-filter-page');
        if (page) {
          page.querySelectorAll('.kb-filter-bar button').forEach((b) => b.classList.toggle('on', b.getAttribute('data-kb-type') === 'all'));
          page.querySelectorAll('[data-kb-pfilter]').forEach((b) => b.classList.toggle('on', b.getAttribute('data-kb-pfilter') === 'all'));
          applyKbFilters(page);
          page.querySelectorAll('.kb-route-tip').forEach((it) => { it.hidden = true; });
        }
        if (anchor.tagName === 'DETAILS') anchor.open = true;
        if (anchor.classList.contains('kb-detail-card')) anchor.classList.add('kb-dcard-expanded');
        $$('.kb-anchor-hit').forEach((x) => x.classList.remove('kb-anchor-hit'));
        anchor.classList.add('kb-anchor-hit');
        anchor.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    }
    else if (e?.id === 'own-practice-es-write-visibility' && /^s-es-[a-z]+$/.test(r.q)) document.getElementById(r.q)?.scrollIntoView({block: 'start'});
    else focusQuestion(r.q, true);
  }`;
    if (!text.includes(parseAnchor) || !text.includes(archivedBefore) || !text.includes(hydrateBefore)) {
      throw new Error('Knowledge runtime: routing lifecycle anchor not found');
    }
    if (text.split(before).length !== 2) throw new Error('Knowledge runtime: routing focus boundary not found');
    return text
      .replace(parseAnchor, parseAfter)
      .replace(archivedBefore, archivedAfter)
      .replace(hydrateBefore, hydrateAfter)
      .replace(before, after) + `
${resolveRetiredKnowledgeRoute.toString()}
function syncBoardRowState(row, page) {
  if (!row || !page) return;
  const mode = page.getAttribute('data-kb-bmode-state') || 'oral';
  const btn = row.querySelector('[data-kb-board-toggle]');
  const chev = row.querySelector('.kb-board-chev');
  const isOpen = (mode === 'scan' || mode === 'recite')
    ? row.classList.contains('is-open')
    : !row.classList.contains('is-collapsed');
  if (btn) btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  if (chev) chev.textContent = isOpen ? '收起 ▴' : '展开 ▾';
}
function applyKbFilters(page) {
  if (!page) return;
  const activeTypeBtn = page.querySelector('.kb-filter-bar button.on');
  const type = activeTypeBtn ? activeTypeBtn.getAttribute('data-kb-type') : 'all';
  const activePBtn = page.querySelector('[data-kb-pfilter].on');
  const pfilter = activePBtn ? activePBtn.getAttribute('data-kb-pfilter') : 'all';
  const searchEl = page.querySelector('[data-kb-search]');
  const q = searchEl ? searchEl.value.trim().toLowerCase() : '';
  const terms = q ? q.split(/\s+/).filter(Boolean) : [];
  const isDetail = page.classList.contains('kb-detail-page');
  let shown = 0, total = 0;

  page.querySelectorAll('.kb-filter-item').forEach((item) => {
    const typeMatch = type === 'all' || item.getAttribute('data-kb-type') === type;
    if (!isDetail) {
      total += 1;
      let qMatch = true;
      if (terms.length) {
        const hay = item.getAttribute('data-kb-search-text') || item.textContent.toLowerCase();
        qMatch = terms.every((t) => hay.includes(t));
      }
      const vis = typeMatch && qMatch;
      item.hidden = !vis;
      if (vis) shown += 1;
      return;
    }
    const cards = item.querySelectorAll('.kb-detail-card[data-kb-key]');
    total += cards.length;
    if (!typeMatch) {
      item.hidden = true;
      return;
    }
    let visibleCards = 0;
    cards.forEach((card) => {
      const projs = (card.getAttribute('data-kb-projects') || '').split('|').filter(Boolean);
      const pMatch = pfilter === 'all' || !projs.length || projs.includes(pfilter);
      let qMatch = true;
      if (terms.length) {
        if (!card._kbHay) card._kbHay = card.textContent.toLowerCase();
        qMatch = terms.every((t) => card._kbHay.includes(t));
      }
      const show = pMatch && qMatch;
      card.hidden = !show;
      if (show) { visibleCards += 1; shown += 1; }
    });
    item.hidden = visibleCards === 0;
  });

  const countEl = page.querySelector('[data-kb-count]');
  if (countEl) {
    const unit = page.classList.contains('kb-proj-page') ? '专题' : '题';
    countEl.textContent = (shown === total) ? ('共 ' + total + ' ' + unit) : ('显示 ' + shown + ' / ' + total + ' ' + unit);
  }
  const emptyEl = page.querySelector('.kb-empty');
  if (emptyEl) emptyEl.hidden = shown > 0;
}
function hydrateKnowledgePage(root) {
  if (!root) return;
  root.querySelectorAll('a[href^="#/e/"]').forEach((a) => {
    const rawHref = a.getAttribute('href') || '';
    const m = /^#\\/e\\/([^/#?]+)(?:\\/([^#?]+))?/.exec(rawHref);
    if (!m) return;
    let id = m[1];
    try { id = decodeURIComponent(m[1]); } catch {}
    if (byId.has(id) || DATA.archivedRoutes?.[id]) return;
    const mapped = resolveRetiredKnowledgeRoute(id);
    if (mapped && byId.has(mapped)) a.setAttribute('href', '#/e/' + encodeURIComponent(mapped));
  });
  const supBtn = root.querySelector('[data-kb-sup-all]');
  if (supBtn) {
    const sups = root.querySelectorAll('details.kb-supplement');
    if (!sups.length) supBtn.hidden = true;
    else supBtn.textContent = '展开全部考点补强（' + sups.length + '）';
  }
  const filterPage = root.querySelector('.kb-filter-page');
  if (!filterPage) return;
  const searchEl = filterPage.querySelector('[data-kb-search]');
  if (searchEl && !searchEl._kbBound) {
    searchEl._kbBound = true;
    searchEl.addEventListener('input', () => {
      clearTimeout(searchEl._t);
      searchEl._t = setTimeout(() => applyKbFilters(filterPage), 70);
    });
  }
  const detailPage = root.querySelector('.kb-detail-page');
  if (detailPage) {
    const reciteOn = Boolean(store.get('iv8-kb-recite', false));
    detailPage.classList.toggle('kb-recite-on', reciteOn);
    const reciteBtn = detailPage.querySelector('[data-kb-recite]');
    if (reciteBtn) {
      reciteBtn.classList.toggle('on', reciteOn);
      reciteBtn.setAttribute('aria-pressed', reciteOn ? 'true' : 'false');
      reciteBtn.textContent = reciteOn ? '背诵自测：已遮挡答案' : '背诵自测：遮挡答案';
    }
  }
  applyKbFilters(filterPage);
}
document.addEventListener('click', (ev) => {
  const supAllBtn = ev.target.closest('[data-kb-sup-all]');
  if (supAllBtn) {
    const page = document.getElementById('page');
    const sups = Array.from(page ? page.querySelectorAll('details.kb-supplement') : []);
    if (!sups.length) return;
    const allOpen = sups.every((d) => d.open);
    sups.forEach((d) => { d.open = !allOpen; });
    supAllBtn.textContent = (!allOpen ? '收起全部考点补强（' : '展开全部考点补强（') + sups.length + '）';
    return;
  }
  const boardMore = ev.target.closest('[data-kb-board-more]');
  if (boardMore) {
    const row = boardMore.closest('.kb-board-row');
    if (!row) return;
    const open = row.classList.toggle('show-extra');
    boardMore.setAttribute('aria-expanded', open ? 'true' : 'false');
    boardMore.textContent = open ? '收起底层原理与追问 ▴' : '展开底层原理与追问 ▾';
    return;
  }
  const boardReveal = ev.target.closest('[data-kb-board-reveal]');
  if (boardReveal) {
    const row = boardReveal.closest('.kb-board-row');
    const page = boardReveal.closest('.kb-board-page');
    if (!row || !page) return;
    row.classList.add('is-open', 'show-extra');
    syncBoardRowState(row, page);
    return;
  }
  const boardToggle = ev.target.closest('[data-kb-board-toggle]');
  if (boardToggle) {
    const row = boardToggle.closest('.kb-board-row');
    const page = boardToggle.closest('.kb-board-page');
    if (!row || !page) return;
    const mode = page.getAttribute('data-kb-bmode-state') || 'oral';
    if (mode === 'scan' || mode === 'recite') {
      row.classList.toggle('is-open');
    } else {
      row.classList.toggle('is-collapsed');
    }
    syncBoardRowState(row, page);
    return;
  }
  const bmodeBtn = ev.target.closest('[data-kb-bmode]');
  if (bmodeBtn) {
    const page = bmodeBtn.closest('.kb-board-page');
    if (!page) return;
    const mode = bmodeBtn.getAttribute('data-kb-bmode');
    page.setAttribute('data-kb-bmode-state', mode);
    page.querySelectorAll('[data-kb-bmode]').forEach((b) => b.classList.toggle('on', b === bmodeBtn));
    page.querySelectorAll('.kb-board-row').forEach((r) => {
      r.classList.remove('is-open', 'is-collapsed', 'show-extra');
      const more = r.querySelector('[data-kb-board-more]');
      if (more) { more.setAttribute('aria-expanded', 'false'); more.textContent = '展开底层原理与追问 ▾'; }
      syncBoardRowState(r, page);
    });
    if (mode === 'oral' && typeof toast === 'function') toast('面试速过：直接下滑过完专业凝练的作答主线与必踩采分点，按需点单卡展开底层细节');
    else if (mode === 'full' && typeof toast === 'function') toast('全量摊开：作答主线 + 完整底层原理 + 连环追问 + 易错点全部展开');
    else if (mode === 'recite' && typeof toast === 'function') toast('背诵自测：答案已遮挡，先构思作答再点单卡核对');
    return;
  }
  const dmodeBtn = ev.target.closest('[data-kb-dmode]');
  if (dmodeBtn) {
    const page = dmodeBtn.closest('.kb-detail-page');
    if (!page) return;
    const mode = dmodeBtn.getAttribute('data-kb-dmode');
    page.setAttribute('data-kb-dmode-state', mode);
    page.querySelectorAll('[data-kb-dmode]').forEach((b) => b.classList.toggle('on', b === dmodeBtn));
    page.querySelectorAll('.kb-detail-card').forEach((c) => {
      c.classList.remove('kb-dcard-expanded');
      const mbtn = c.querySelector('[data-kb-dcard-more]');
      if (mbtn) { mbtn.setAttribute('aria-expanded', 'false'); mbtn.textContent = '展开完整原理与追问 ▾'; }
    });
    if (mode === 'skim' && typeof toast === 'function') toast('考前速扫：每题精简展示口述/核心本质，按需点单卡展开底层细节');
    else if (mode === 'full' && typeof toast === 'function') toast('完整详解：已展开全部原理、参数边界与追问');
    return;
  }
  const dcardMore = ev.target.closest('[data-kb-dcard-more]');
  if (dcardMore) {
    const card = dcardMore.closest('.kb-detail-card');
    if (!card) return;
    const open = card.classList.toggle('kb-dcard-expanded');
    dcardMore.setAttribute('aria-expanded', open ? 'true' : 'false');
    dcardMore.textContent = open ? '收起完整原理与追问 ▴' : '展开完整原理与追问 ▾';
    return;
  }
  const randBtn = ev.target.closest('[data-kb-board-random]');
  if (randBtn) {
    const page = randBtn.closest('.kb-board-page');
    if (!page) return;
    const rows = Array.from(page.querySelectorAll('.kb-board-row')).filter((r) => !r.hidden);
    if (!rows.length) return;
    const pick = rows[Math.floor(Math.random() * rows.length)];
    page.setAttribute('data-kb-bmode-state', 'recite');
    page.querySelectorAll('[data-kb-bmode]').forEach((b) => b.classList.toggle('on', b.getAttribute('data-kb-bmode') === 'recite'));
    page.querySelectorAll('.kb-board-row').forEach((r) => {
      r.classList.remove('is-open', 'is-collapsed', 'show-extra');
      syncBoardRowState(r, page);
    });
    pick.classList.add('kb-anchor-hit');
    setTimeout(() => pick.classList.remove('kb-anchor-hit'), 1800);
    pick.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (typeof toast === 'function') toast('抽中一题：先口述结论与必答要点，再点卡片核对');
    return;
  }
  const revealBtn = ev.target.closest('[data-kb-reveal]');
  if (revealBtn) {
    const card = revealBtn.closest('.kb-detail-card');
    if (card) card.classList.add('kb-revealed');
    return;
  }
  const reciteBtn = ev.target.closest('[data-kb-recite]');
  if (reciteBtn) {
    const page = reciteBtn.closest('.kb-detail-page');
    if (!page) return;
    const next = !page.classList.contains('kb-recite-on');
    page.classList.toggle('kb-recite-on', next);
    if (next) page.querySelectorAll('.kb-detail-card.kb-revealed').forEach((c) => c.classList.remove('kb-revealed'));
    store.set('iv8-kb-recite', next);
    reciteBtn.classList.toggle('on', next);
    reciteBtn.setAttribute('aria-pressed', next ? 'true' : 'false');
    reciteBtn.textContent = next ? '背诵自测：已遮挡答案' : '背诵自测：遮挡答案';
    if (typeof toast === 'function') toast(next ? '已开启背诵遮挡：先口述再点卡片展开核对' : '已显示全部答案');
    return;
  }
  const pfilterBtn = ev.target.closest('[data-kb-pfilter]');
  if (pfilterBtn) {
    const page = pfilterBtn.closest('.kb-detail-page');
    if (!page) return;
    page.querySelectorAll('[data-kb-pfilter]').forEach((b) => b.classList.toggle('on', b === pfilterBtn));
    applyKbFilters(page);
    return;
  }
  const btn = ev.target.closest('[data-kb-type]');
  if (!btn) return;
  const page = btn.closest('.kb-filter-page');
  if (!page) return;
  const type = btn.getAttribute('data-kb-type');
  page.querySelectorAll('.kb-filter-bar button').forEach((item) => item.classList.toggle('on', item === btn));
  applyKbFilters(page);
  page.querySelectorAll('.kb-route-tip').forEach((item) => { item.hidden = item.getAttribute('data-kb-route') !== type; });
});
`;
  }
  return text;
}

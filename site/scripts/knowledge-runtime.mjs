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
          page.querySelectorAll('[data-kb-mfilter]').forEach((b) => b.classList.toggle('on', b.getAttribute('data-kb-mfilter') === 'all'));
          applyKbFilters(page);
          page.querySelectorAll('.kb-route-tip').forEach((it) => { it.hidden = true; });
        }
        if (anchor.tagName === 'DETAILS') anchor.open = true;
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
function getKbProg() {
  const raw = store.get('iv8-kb-prog', {});
  return raw && typeof raw === 'object' ? raw : {};
}
function setKbProgStatus(key, s) {
  const prog = getKbProg();
  if (!s) delete prog[key];
  else prog[key] = s;
  store.set('iv8-kb-prog', prog);
  return prog;
}
function updateKbDetailStat(page, prog) {
  const stat = page.querySelector('[data-kb-stat]');
  if (!stat) return;
  const cards = page.querySelectorAll('.kb-detail-card[data-kb-key]');
  let ok = 0, fuzzy = 0;
  cards.forEach((card) => {
    const s = Number(prog[card.getAttribute('data-kb-key')] || 0);
    if (s === 2) ok += 1;
    else if (s === 1) fuzzy += 1;
  });
  const rest = Math.max(0, cards.length - ok - fuzzy);
  stat.textContent = \`已掌握 \${ok} · 模糊 \${fuzzy} · 未学 \${rest}\`;
}
function applyKbFilters(page) {
  if (!page) return;
  const activeTypeBtn = page.querySelector('.kb-filter-bar button.on');
  const type = activeTypeBtn ? activeTypeBtn.getAttribute('data-kb-type') : 'all';
  const activeMBtn = page.querySelector('[data-kb-mfilter].on');
  const mfilter = activeMBtn ? activeMBtn.getAttribute('data-kb-mfilter') : 'all';
  const isDetail = page.classList.contains('kb-detail-page');
  page.querySelectorAll('.kb-filter-item').forEach((item) => {
    const typeMatch = type === 'all' || item.getAttribute('data-kb-type') === type;
    if (!isDetail) {
      item.hidden = !typeMatch;
      return;
    }
    if (!typeMatch) {
      item.hidden = true;
      return;
    }
    let visibleCards = 0;
    item.querySelectorAll('.kb-detail-card[data-kb-key]').forEach((card) => {
      const s = card.getAttribute('data-kb-status') || '0';
      const show = mfilter === 'all' || s === mfilter;
      card.hidden = !show;
      if (show) visibleCards += 1;
    });
    item.hidden = visibleCards === 0;
  });
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
  const prog = getKbProg();
  root.querySelectorAll('[data-kb-badge]').forEach((badge) => {
    const s = Number(prog[badge.getAttribute('data-kb-badge')] || 0);
    if (s === 2) { badge.textContent = '已掌握'; badge.className = 'kb-board-badge s2'; badge.hidden = false; }
    else if (s === 1) { badge.textContent = '模糊'; badge.className = 'kb-board-badge s1'; badge.hidden = false; }
    else { badge.textContent = ''; badge.hidden = true; }
  });
  const detailPage = root.querySelector('.kb-detail-page');
  if (!detailPage) return;
  const reciteOn = Boolean(store.get('iv8-kb-recite', false));
  detailPage.classList.toggle('kb-recite-on', reciteOn);
  const reciteBtn = detailPage.querySelector('[data-kb-recite]');
  if (reciteBtn) {
    reciteBtn.classList.toggle('on', reciteOn);
    reciteBtn.setAttribute('aria-pressed', reciteOn ? 'true' : 'false');
    reciteBtn.textContent = reciteOn ? '背诵自测：已遮挡答案' : '背诵自测：遮挡答案';
  }
  detailPage.querySelectorAll('.kb-detail-card[data-kb-key]').forEach((card) => {
    const key = card.getAttribute('data-kb-key');
    const s = Number(prog[key] || 0);
    card.setAttribute('data-kb-status', String(s));
    card.querySelectorAll('[data-kb-mark]').forEach((b) => b.classList.toggle('on', Number(b.getAttribute('data-kb-mark')) === s));
  });
  updateKbDetailStat(detailPage, prog);
  applyKbFilters(detailPage);
}
document.addEventListener('click', (ev) => {
  const markBtn = ev.target.closest('[data-kb-mark]');
  if (markBtn) {
    const card = markBtn.closest('.kb-detail-card[data-kb-key]');
    const page = markBtn.closest('.kb-detail-page');
    if (!card || !page) return;
    const key = card.getAttribute('data-kb-key');
    const s = Number(markBtn.getAttribute('data-kb-mark') || 0);
    const prog = setKbProgStatus(key, s);
    card.setAttribute('data-kb-status', String(s));
    card.querySelectorAll('[data-kb-mark]').forEach((b) => b.classList.toggle('on', b === markBtn));
    updateKbDetailStat(page, prog);
    applyKbFilters(page);
    if (s === 2 && typeof toast === 'function') toast('已标记为掌握');
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
  const mfilterBtn = ev.target.closest('[data-kb-mfilter]');
  if (mfilterBtn) {
    const page = mfilterBtn.closest('.kb-detail-page');
    if (!page) return;
    page.querySelectorAll('[data-kb-mfilter]').forEach((b) => b.classList.toggle('on', b === mfilterBtn));
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

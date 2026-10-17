function renderSyntax(e) {
  return `${pageHead(e, { num: '语法', sub: h(e.subtitle || ''), chips: `<span class="chip accent">${h(learnerLabel('cat', e.cat))}</span>` })}
    <div class="md sec">${e.html || ''}</div>
    ${sec('同分类', relatedLinks(TREE[e.mod].all.filter((x) => x.cat === e.cat && x !== e)))}
    ${pager(e)}`;
}

function pager(e) {
  const list = TREE[e.mod].all;
  const i = list.indexOf(e);
  const prev = list[i - 1], next = list[i + 1];
  return `${e.kind!=='qa'&&e.readingNotesHtml ? '<section class="md sec">'+e.readingNotesHtml+'</section>' : ''}${e.kind!=='qa'&&e.supplementHtml ? `<div class="md sec">${e.supplementHtml}</div>` : ''}<nav class="pager">${prev ? `<a href="${href(prev)}"><span>← 上一条 · ${h(learnerLabel('cat', prev.cat))}</span><strong>${h(prev.title)}</strong></a>` : '<span class="ph"></span>'}
    ${next ? `<a class="next" href="${href(next)}"><span>${h(learnerLabel('cat', next.cat))} · 下一条 →</span><strong>${h(next.title)}</strong></a>` : '<span class="ph"></span>'}</nav>`;
}
const href = (e, q) => `#/e/${encodeURIComponent(e.id)}${q != null ? '/' + qAnchor(e.id, q) : ''}`;

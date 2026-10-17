// Apply only to the final learner graph, after all authoring/content corrections.
// Source entries, question objects and archives remain untouched.
export function projectNoteDisplay(entries, {baselineTest = false} = {}) {
  if (baselineTest) return entries;
  return entries.map(e => {
    if (e.kind !== 'qa' || !Array.isArray(e.items) || typeof e.number !== 'string') return e;
    const count = /^(\s*)\d+(\s*问\s*)$/.exec(e.number);
    if (!count) return e;
    const number = count[1] + e.items.length + count[2];
    return number === e.number ? e : {...e, number};
  });
}

// These two functions are serialized into the classic app bundle. `h` and `fold`
// are the existing escaping/rendering helpers. Ordinals are local DOM references,
// not persisted IDs, URLs, progress keys or assumptions about future authoring.
function renderNoteTopicFolds(e) {
  if (!['p-list', 'p-tree'].includes(e.id)) return e.folds.map(f => fold(f.title, f.html, false, '')).join('');
  const first = new Map();
  const title = f => f.title.replace(/（保留原稿版本 \d+）$/, '');
  return '<div data-note-topic-folds>' + e.folds.map((f, i) => {
    if (!f.html) return fold(title(f), f.html, false, '');
    if (first.has(f.html)) {
      const canonical = first.get(f.html);
      const body = '<p>完整讲解与代码：<button type="button" class="btn" data-note-fold-ref="' + canonical + '">查看「' + h(title(e.folds[canonical])) + '」</button></p>';
      return fold(title(f), body, false, '');
    }
    first.set(f.html, i);
    return fold(title(f), f.html, false, '').replace('<details ', '<details data-note-fold="' + i + '" ');
  }).join('') + '</div>';
}
function activateNoteTopicFold(event) {
  // Synthetic events can target Document, text nodes, or null.
  const target = event?.target;
  if (!target || typeof target.closest !== 'function') return;
  const button = target.closest('[data-note-fold-ref]');
  if (!button) return;
  const root = button.closest('[data-note-topic-folds]');
  const index = button.dataset.noteFoldRef;
  if (!root || !/^\d+$/.test(index)) return;
  const canonical = root.querySelector('[data-note-fold="' + index + '"]');
  if (!canonical) return;
  canonical.open = true;
  canonical.querySelector('summary').focus({preventScroll: true});
  canonical.scrollIntoView({block: 'nearest'});
}
export function projectNoteDisplayRuntime(file, text, {baselineTest = false} = {}) {
  if (baselineTest || file !== 'src/app/renderers.js') return text;
  const before = "e.folds.map(f=>fold(f.title,f.html,false,'')).join('')";
  if (text.split(before).length !== 2) throw new Error('Note display cleanup: expected exactly one topic-fold render site');
  return text.replace(before, 'renderNoteTopicFolds(e)') + '\n' + renderNoteTopicFolds.toString() + '\n' + activateNoteTopicFold.toString() + '\ndocument.addEventListener("click", activateNoteTopicFold);\n';
}

// Late, additive UI projection for the imported knowledge module. Keeping it
// after the reviewed display projection leaves its source hash guards intact.
export function projectKnowledgeRuntime(file, text, {baselineTest = false} = {}) {
  if (baselineTest) return text;
  if (file === 'src/app/catalog.js') {
    const before = "  { id: 'bagu', name: '八股', full: '系统设计八股', icon: 'B', must: true,";
    const addition = "  { id: 'knowledge', name: '考点', full: '后端 + Agent 考点', icon: 'K', start: ['interview-map'],\n    desc: '按真实面试出现次数查看后端与 Agent 考点；点击考点直达对应知识库小节，再按章内目录系统补齐。' },\n";
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
  if (file === 'src/app/routing.js') {
    const before = "if (r.q != null) {\n    if (e?.id === 'own-practice-es-write-visibility' && /^s-es-[a-z]+$/.test(r.q)) document.getElementById(r.q)?.scrollIntoView({block: 'start'});\n    else focusQuestion(r.q, true);\n  }";
    const after = `if (r.q != null) {
    if (e?.kind === 'doc') {
      const anchor = document.getElementById(r.q);
      if (anchor) requestAnimationFrame(() => {
        if (anchor.tagName === 'DETAILS') anchor.open = true;
        $$('.kb-anchor-hit').forEach((x) => x.classList.remove('kb-anchor-hit'));
        anchor.classList.add('kb-anchor-hit');
        anchor.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    }
    else if (e?.id === 'own-practice-es-write-visibility' && /^s-es-[a-z]+$/.test(r.q)) document.getElementById(r.q)?.scrollIntoView({block: 'start'});
    else focusQuestion(r.q, true);
  }`;
    if (text.split(before).length !== 2) throw new Error('Knowledge runtime: routing focus boundary not found');
    return text.replace(before, after);
  }
  return text;
}

// Scenario pages double as the 题目 pages: the merged lecture becomes the
// page's knowledge section, and pages without the old eleven dimensions must
// not render empty boxes.
const RENDERERS = 'src/app/renderers.js';

const NEW_SCENARIO = `function renderScenario(e) {
  const cf = (SCENARIO_COUNTERFACTUALS[e.id] || []);
  const dims = DIMS.filter(([k]) => e[k] && e[k].length).map(([k, name, ic, ord], i, arr) => \`<div class="dim\${(arr.length % 2 === 1 && i === arr.length - 1) ? ' span2' : ''}" id="dim-\${k}" style="\${modColor(e.mod)}"><h3><i>\${ic}</i>\${h(name)}</h3>\${bullets(e[k], ord)}</div>\`).join('');
  const tocItems = (e.knowledgeToc || []).filter((t) => t.level === 2);
  const toc = tocItems.length
    ? \`<div class="sd-toc"><span class="sd-toc-lb">讲义目录</span>\${tocItems.map((t) => \`<button type="button" class="jump-btn" data-act="sd-jump" data-target="\${h(t.id)}">\${h(t.text)}</button>\`).join('')}</div>\`
    : '';
  const know = e.knowledgeHtml ? toc + \`<div class="md">\${e.knowledgeHtml}</div>\` : '';
  const kv = (e.description || e.metrics || e.components)
    ? \`<div class="kv"><div class="wide"><span>场景与目标</span><strong>\${h(e.description || '—')}</strong></div><div class="wide"><span>关键指标</span><strong>\${h(e.metrics || '—')}</strong></div><div class="wide"><span>核心组件</span><strong>\${h(e.components || '—')}</strong></div></div>\`
    : '';
  return \`\${pageHead(e, { num: entryNum(e), chips: \`<span class="chip accent">\${h(e.cat)}</span>\${e.source ? \`<span class="chip">\${h(e.source)}</span>\` : ''}\` })}
    \${callout('设计主线', e.idea)}
    \${kv}
    \${sec('60 秒面试话术', pitchBlock(sentencePitch(e.interviewAnswer), '按「结论 → 论据 → 关键设计 → 取舍」讲'))}
    \${sec('架构图解与请求流', vizFigure(e), { aside: '▶ 播放 · 点击步骤跳转' })}
    \${dims ? sec('架构详解', \`<div class="dims">\${dims}</div>\`, { aside: '11 个维度' }) : ''}
    \${sec('反事实：如果不这么做', cf.length ? \`<div class="cf">\${cf.map(([q, a]) => \`<div class="cf-item"><strong>\${h(q)}</strong><span>\${h(a)}</span></div>\`).join('')}</div>\` : '')}
    \${sec('深入补强', deepenBlock(e))}
    \${sec('架构伪代码', e.code ? codeCard(e.code, 'architecture.pseudo') : '')}
    \${sec('知识点精讲', know, { aside: e.knowledgeSource ? e.knowledgeSource : '' })}
    \${sec('同类场景', relatedLinks(TREE[e.mod].all.filter((x) => x.cat === e.cat && x !== e)))}
    \${pager(e)}\`;
}
`;

const JUMP_HANDLER = `
document.addEventListener('click', function (ev) {
  var btn = ev.target.closest('[data-act="sd-jump"]');
  if (!btn) return;
  var target = document.getElementById(btn.getAttribute('data-target'));
  if (target) target.scrollIntoView({ block: 'start', behavior: 'smooth' });
});
`;

// Mermaid is 3.5 MB, so it is fetched only when a rendered page actually
// contains a diagram, and cached by the browser afterwards.
const MERMAID_LOADER = `
(function () {
  var loading = null;
  function themeName() {
    var t = document.documentElement.dataset.theme;
    if (!t) t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    return t === 'dark' ? 'dark' : 'default';
  }
  function source() {
    var tag = document.querySelector('script[src*="assets/app.js"]');
    if (tag && tag.src) return new URL('vendor/mermaid.min.js', tag.src).href;
    return 'assets/vendor/mermaid.min.js';
  }
  function load() {
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = source();
      s.async = true;
      s.onload = function () {
        try {
          window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: themeName() });
          resolve(window.mermaid);
        } catch (err) { reject(err); }
      };
      s.onerror = function () { loading = null; reject(new Error('mermaid unavailable')); };
      document.head.appendChild(s);
    });
    return loading;
  }
  function paint() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll('.mermaid:not([data-drawn])'));
    if (!nodes.length) return;
    nodes.forEach(function (n) { n.setAttribute('data-drawn', '1'); });
    load().then(function (mermaid) {
      return mermaid.run({ nodes: nodes });
    }).catch(function (err) {
      nodes.forEach(function (n) { n.removeAttribute('data-drawn'); n.classList.add('mmd-failed'); });
      console.error('mermaid render failed', err);
    });
  }
  var timer = null;
  function schedule() { clearTimeout(timer); timer = setTimeout(paint, 120); }
  if (document.readyState !== 'loading') schedule();
  else document.addEventListener('DOMContentLoaded', schedule);
  window.addEventListener('load', schedule);
  document.addEventListener('click', schedule, true);
  var page = document.getElementById('page');
  if (page && window.MutationObserver) new MutationObserver(schedule).observe(page, { childList: true, subtree: true });
})();
`;

export function projectDesignRuntime(file, text, {baselineTest = false} = {}) {
  if (baselineTest || file !== RENDERERS) return text;
  const start = text.indexOf('function renderScenario(e) {');
  if (start < 0) throw new Error('Design runtime: renderScenario not found');
  const end = text.indexOf('function renderHandwrite(e) {', start);
  if (end < 0) throw new Error('Design runtime: renderHandwrite boundary not found');
  const result = text.slice(0, start) + NEW_SCENARIO + '\n' + text.slice(end);
  return result + JUMP_HANDLER + MERMAID_LOADER;
}

// Algorithm module focus: one topic page (patterns + knowledge + navigation)
// followed by plain problem pages. The collapsible "original topic notes /
// lecture" dump and the duplicated per-problem lecture folds are removed.
//
// This runs last in the source-text chain, so every earlier reviewed projection
// keeps its pinned hashes; only the final text is rewritten here.
const RENDERERS = 'src/app/renderers.js';

const PROBLEMS_SRC =
  "  ${sec('代表题',e.groups.map(g=>`<div class=\"rs-group\"><h4>${h(g.name)}</h4><p class=\"prose\">${h(g.note)}</p><div class=\"rs-jumps\">${g.items.map(([hr,t])=>`<a class=\"jump-btn\" href=\"${hr}\">${h(t)}</a>`).join('')}</div></div>`).join(''))}\n";
const PROBLEMS_NEW = "  ${sec('代表题',e.groups.map(ptGroup).join(''))}\n";

const FOLD_SECTION_FROM = PROBLEMS_SRC + "  ${e.folds.length?sec('原专题笔记与精讲（折叠）',renderNoteTopicFolds(e)):''}\n";
const FOLD_SECTION_TO = "  ${e.topicKnowledge?sec('知识点精讲',ptKnowledge(e.topicKnowledge)):''}\n" + PROBLEMS_NEW;

// The Java template block is gone: pattern code lives on every problem page, and
// four full listings per topic made the page unreadable.
const TEMPLATE_FROM =
  "  ${sec('通用模板（Java）',e.templates.map(x=>`<h4 class=\"md-h md-h4\">${h(x.name)}</h4><p class=\"prose\">${h(x.when)}</p>${codeCard(x.java,'Template.java')}<p class=\"prose rs-demo\">已用 <b>${h(x.demo)}</b> 的样例实测：<code class=\"tok-inline\">${h(x.demoMain)}</code> → <code class=\"tok-inline\">${h(x.expected)}</code></p>`).join(''))}\n";
const TEMPLATE_TO = '';

const IDENTIFY_FROM =
  "  ${sec('题型识别',`<div class=\"panel tone-accent\">${ul(e.recognize)}</div>${e.notApplicable.length?`<div class=\"panel tone-bad\"><h4><span class=\"ic\">✗</span>什么时候不适用</h4>${ul(e.notApplicable)}</div>`:''}`)}\n";
const IDENTIFY_TO =
  "  ${sec('题型识别',ptClues(e.recognize)+(e.notApplicable.length?`<div class=\"pt-na\"><h4 class=\"pt-na-h\"><span class=\"pt-na-ic\">✗</span>什么时候不适用</h4>${ptNaList(e.notApplicable)}</div>`:''))}\n";

const VARIANTS_FROM = "  ${sec('常见变体',ul(e.variants))}\n";
const VARIANTS_TO = "  ${sec('常见变体',ptVariants(e.variants))}\n";

const PITFALLS_FROM = "  ${sec('通用坑',`<div class=\"panel tone-warn\">${ul(e.pitfalls)}</div>`)}\n";
const PITFALLS_TO = "  ${sec('通用坑',ptPitfalls(e.pitfalls))}\n";

const FUSION_FROM =
  "  const t = (e.topic && TOPICS[e.topic]) || (e.topicExplains ? { patterns: [], explains: [] } : null);\n" +
  "  let fusion = '';\n" +
  "  if (t) {\n" +
  "    if (e.patternIdx >= 0 && t.patterns[e.patternIdx]) fusion += fold(`专题套路 · ${t.patterns[e.patternIdx].title.replace(/^\\d+\\.\\s*/, '')}`, t.patterns[e.patternIdx].html, false, `《${t.title}》题型全景`);\n" +
  "    if (e.topicExplains) e.topicExplains.forEach((x) => { fusion += fold(`专题精讲 · ${x.title}`, x.html, false, `来自《${x.from}》专题笔记`); });\n" +
  "    else if (e.explainIdx >= 0 && t.explains[e.explainIdx]) fusion += fold(`专题精讲 · ${t.explains[e.explainIdx].title}`, t.explains[e.explainIdx].html, false, '来自 lc算法 专题笔记');\n" +
  "  }\n";
const FUSION_TO = '';

const FACE_FROM =
  "    ${e.face ? sec('面经版答案', fold('面经版答案（八股面经整理 · LeetCode 算法题）', e.face, false, '另一种讲法 / 代码写法')) : ''}\n";
const FACE_TO = '';

const TOPIC_LINK_FROM =
  "    ${sec('放回专题理解', fusion + (links.length ? `<p class=\"prose\">同一套路的完整知识：</p>${relatedLinks(links)}` : ''))}\n";
const TOPIC_LINK_TO =
  "    ${links.length ? sec('所属题型', `<p class=\"prose\">同一套路的完整知识：</p>${relatedLinks(links)}`) : ''}\n";

// Helpers injected into the classic bundle, next to the other render helpers.
const HELPERS = `
function ptTable(head, rows){
  return '<div class="tbl-wrap pt-table"><table class="tbl"><thead><tr>' +
    head.map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>' +
    rows.map(cells => '<tr>' + cells.map((c, i) => '<td' + (i === 0 ? ' class="pt-c1"' : '') + '>' + mdLite(c) + '</td>').join('') + '</tr>').join('') +
    '</tbody></table></div>';
}
function ptClues(list){
  return ptTable(['看到什么', '第一反应'], list.map(x => typeof x === 'string' ? [x, '—'] : [x.see, x.act]));
}
function ptVariants(list){
  return ptTable(['原题', '变体', '只改这一处'], list.map(x => typeof x === 'string' ? ['—', x, ''] : [x.from, x.to, x.change]));
}
function ptNaList(list){
  return '<ul class="pt-na-list">' + list.map(t =>
    '<li><span class="pt-na-x">✗</span><span>' + mdLite(String(t)) + '</span></li>').join('') + '</ul>';
}
function ptPitfalls(list){
  return '<div class="pt-pits">' + list.map(t => {
    let symptom = '', consequence = String(t);
    if (t && typeof t === 'object') { symptom = t.symptom || ''; consequence = t.consequence || ''; }
    else { const m = /^(.+?[。；])\\s*([\\s\\S]+)$/.exec(String(t)); if (m) { symptom = m[1]; consequence = m[2]; } }
    return '<div class="pt-pit"><span class="pt-pit-ic">!</span><div class="pt-pit-txt">' +
      (symptom ? '<p class="pt-pit-sym">' + mdLite(symptom) + '</p>' : '') +
      (consequence ? '<p class="pt-pit-con">' + mdLite(consequence) + '</p>' : '') +
      '</div></div>';
  }).join('') + '</div>';
}
function ptGroup(g){
  return '<div class="rs-group pt-group"><h4>' + h(g.name) + '</h4>' +
    (g.note ? '<p class="pt-group-note">' + mdLite(g.note) + '</p>' : '') +
    '<div class="rs-jumps">' + g.items.map(([hr, t]) => '<a class="jump-btn" href="' + hr + '">' + h(t) + '</a>').join('') + '</div></div>';
}
function ptKnowledge(k){
  const list = (a) => '<ul class="pt-k-list">' + a.map(t => '<li>' + mdLite(String(t)) + '</li>').join('') + '</ul>';
  let out = '';
  if (k && k.essence) out += '<p class="pt-k-ess">' + mdLite(k.essence) + '</p>';
  if (k && Array.isArray(k.points) && k.points.length) out += '<h4 class="pt-k-h">要点</h4>' + list(k.points);
  if (k && Array.isArray(k.boundaries) && k.boundaries.length) out += '<h4 class="pt-k-h pt-k-h-warn">边界</h4>' + list(k.boundaries);
  return out;
}
`;

export function projectAlgoFocusRuntime(file, text, {baselineTest = false} = {}) {
  if (baselineTest || file !== RENDERERS) return text;
  let result = text;

  const swap = (label, from, to) => {
    const occurrences = result.split(from).length - 1;
    if (occurrences !== 1) throw new Error('Algo focus: expected exactly one ' + label + ', found ' + occurrences);
    result = result.split(from).join(to);
  };

  swap('fold section', FOLD_SECTION_FROM, FOLD_SECTION_TO);
  swap('template section', TEMPLATE_FROM, TEMPLATE_TO);
  swap('topic fusion block', FUSION_FROM, FUSION_TO);
  swap('face-answer fold', FACE_FROM, FACE_TO);
  swap('topic link', TOPIC_LINK_FROM, TOPIC_LINK_TO);
  swap('identify section', IDENTIFY_FROM, IDENTIFY_TO);
  swap('variants section', VARIANTS_FROM, VARIANTS_TO);
  swap('pitfalls section', PITFALLS_FROM, PITFALLS_TO);

  // The fold helpers injected by note-display-cleanup only served the removed folds.
  const helperStart = result.indexOf('function renderNoteTopicFolds(e) {');
  if (helperStart < 0) throw new Error('Algo focus: fold helper block missing');
  const helperEnd = result.indexOf('document.addEventListener("click", activateNoteTopicFold);\n', helperStart);
  if (helperEnd < 0) throw new Error('Algo focus: fold helper block end missing');
  const cut = helperEnd + 'document.addEventListener("click", activateNoteTopicFold);\n'.length;
  result = result.slice(0, helperStart) + result.slice(cut);

  return result + '\n' + HELPERS;
}

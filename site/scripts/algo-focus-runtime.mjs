// Algorithm module focus: one topic page (patterns + shared solution + knowledge
// + problem navigation) followed by plain problem pages. The collapsible
// "original topic notes / lecture" dump and the duplicated per-problem lecture
// folds are removed from the rendered app.
//
// This runs last in the source-text chain, so every earlier reviewed projection
// keeps its pinned hashes; only the final text is rewritten here.
const RENDERERS = 'src/app/renderers.js';

// Move the knowledge block above the problem navigation so the topic page reads
// identify -> template -> variants -> pitfalls -> knowledge -> navigation.
const PROBLEMS_LINE =
  "  ${sec('代表题',e.groups.map(g=>`<div class=\"rs-group\"><h4>${h(g.name)}</h4><p class=\"prose\">${h(g.note)}</p><div class=\"rs-jumps\">${g.items.map(([hr,t])=>`<a class=\"jump-btn\" href=\"${hr}\">${h(t)}</a>`).join('')}</div></div>`).join(''))}\n";
const FOLD_SECTION_FROM = PROBLEMS_LINE + "  ${e.folds.length?sec('原专题笔记与精讲（折叠）',renderNoteTopicFolds(e)):''}\n";
const FOLD_SECTION_TO = "  ${e.knowledgeHtml?sec('知识点精讲',e.knowledgeHtml):''}\n" + PROBLEMS_LINE;

// A topic page has to be scannable: one idea per card, keywords marked up, and
// never a wall of comma-separated prose.
const IDENTIFY_FROM =
  "  ${sec('题型识别',`<div class=\"panel tone-accent\">${ul(e.recognize)}</div>${e.notApplicable.length?`<div class=\"panel tone-bad\"><h4><span class=\"ic\">✗</span>什么时候不适用</h4>${ul(e.notApplicable)}</div>`:''}`)}\n";
const IDENTIFY_TO =
  "  ${sec('题型识别',ptClues(e.recognize)+(e.notApplicable.length?`<div class=\"panel tone-bad pt-na\"><h4><span class=\"ic\">✗</span>什么时候不适用</h4>${ptList(e.notApplicable)}</div>`:''))}\n";

const TEMPLATE_FROM =
  "  ${sec('通用模板（Java）',e.templates.map(x=>`<h4 class=\"md-h md-h4\">${h(x.name)}</h4><p class=\"prose\">${h(x.when)}</p>${codeCard(x.java,'Template.java')}<p class=\"prose rs-demo\">已用 <b>${h(x.demo)}</b> 的样例实测：<code class=\"tok-inline\">${h(x.demoMain)}</code> → <code class=\"tok-inline\">${h(x.expected)}</code></p>`).join(''))}\n";
const TEMPLATE_TO =
  "  ${sec('通用模板（Java）',e.templates.map((x,i)=>`<div class=\"pt-tpl\"><h4 class=\"md-h md-h4\"><span class=\"pt-tpl-n\">${i+1}</span>${h(x.name)}</h4><p class=\"prose\">${mdLite(x.when)}</p>${codeCard(x.java,'Template.java')}${ptDemo(x)}</div>`).join(''))}\n";

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
function ptList(list){
  return '<ul class="md-list pt-list">' + list.map(t => '<li>' + mdLite(t) + '</li>').join('') + '</ul>';
}
function ptClues(list){
  return '<div class="pt-clues">' + list.map((t, i) =>
    '<div class="pt-clue"><span class="pt-clue-n">' + (i + 1) + '</span><p>' + mdLite(t) + '</p></div>'
  ).join('') + '</div>';
}
function ptVariants(list){
  return '<div class="pt-vars">' + list.map(t => {
    const m = /^(.+?)\\s*[→➜]\\s*(.+?)\\s*[：:]\\s*([\\s\\S]+)$/.exec(t);
    if (!m) return '<div class="pt-var"><p>' + mdLite(t) + '</p></div>';
    return '<div class="pt-var"><div class="pt-var-head"><span class="pt-pill">' + mdLite(m[1]) + '</span>' +
      '<span class="pt-arrow">→</span><span class="pt-pill accent">' + mdLite(m[2]) + '</span></div>' +
      '<p>' + mdLite(m[3]) + '</p></div>';
  }).join('') + '</div>';
}
function ptPitfalls(list){
  return '<div class="pt-pits">' + list.map(t => {
    const m = /^(.+?[。；])\\s*([\\s\\S]+)$/.exec(t);
    const head = m ? m[1] : '';
    const rest = m ? m[2] : t;
    return '<div class="pt-pit"><span class="pt-pit-ic">!</span><div>' +
      (head ? '<p class="pt-pit-head">' + mdLite(head) + '</p>' : '') +
      '<p class="pt-pit-body">' + mdLite(rest) + '</p></div></div>';
  }).join('') + '</div>';
}
function ptDemo(x){
  const out = String(x.expected == null ? '' : x.expected).trim().split('\\n').map(s => s.trim()).filter(Boolean).join(' · ');
  return '<p class="pt-demo"><span class="pt-demo-k">实测通过</span><b>' + h(x.demo) + '</b>' +
    (out ? ' <span class="pt-demo-arrow">→</span> <code class="tok-inline">' + h(out) + '</code>' : '') + '</p>';
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
  swap('topic fusion block', FUSION_FROM, FUSION_TO);
  swap('face-answer fold', FACE_FROM, FACE_TO);
  swap('topic link', TOPIC_LINK_FROM, TOPIC_LINK_TO);
  swap('identify section', IDENTIFY_FROM, IDENTIFY_TO);
  swap('template section', TEMPLATE_FROM, TEMPLATE_TO);
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

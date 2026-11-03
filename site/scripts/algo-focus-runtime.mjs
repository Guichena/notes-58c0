// Algorithm module focus: one topic page (patterns + shared solution + knowledge
// + problem navigation) followed by plain problem pages. The collapsible
// "original topic notes / lecture" dump and the duplicated per-problem lecture
// folds are removed from the rendered app.
//
// This runs last in the source-text chain, so every earlier reviewed projection
// keeps its pinned hashes; only the final text is rewritten here.
const RENDERERS = 'src/app/renderers.js';

const FOLD_SECTION_FROM = "  ${e.folds.length?sec('原专题笔记与精讲（折叠）',renderNoteTopicFolds(e)):''}\n";
const FOLD_SECTION_TO = "  ${e.knowledgeHtml?sec('知识点精讲',e.knowledgeHtml):''}\n";

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

// The helpers injected by note-display-cleanup only served the removed folds.
const HELPERS_FROM = 'function renderNoteTopicFolds(e) {';
const HELPERS_END = 'document.addEventListener("click", activateNoteTopicFold);\n';

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

  const helperStart = result.indexOf(HELPERS_FROM);
  if (helperStart < 0) throw new Error('Algo focus: fold helper block missing');
  const helperEnd = result.indexOf(HELPERS_END, helperStart);
  if (helperEnd < 0) throw new Error('Algo focus: fold helper block end missing');
  result = result.slice(0, helperStart) + result.slice(helperEnd + HELPERS_END.length);

  return result;
}

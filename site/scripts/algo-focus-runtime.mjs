// Algorithm module focus: one topic page (pattern families + pitfalls + navigation)
// followed by plain problem pages.
//
// This runs last in the source-text chain, so every earlier reviewed projection
// keeps its pinned hashes; only the final text is rewritten here.
const RENDERERS = 'src/app/renderers.js';

const PROBLEMS_SRC =
  "  ${sec('代表题',e.groups.map(g=>`<div class=\"rs-group\"><h4>${h(g.name)}</h4><p class=\"prose\">${h(g.note)}</p><div class=\"rs-jumps\">${g.items.map(([hr,t])=>`<a class=\"jump-btn\" href=\"${hr}\">${h(t)}</a>`).join('')}</div></div>`).join(''))}\n";
const PROBLEMS_NEW = "  ${sec('代表题',e.groups.map(ptGroup).join(''))}\n";

const FOLD_SECTION_FROM = PROBLEMS_SRC + "  ${e.folds.length?sec('原专题笔记与精讲（折叠）',renderNoteTopicFolds(e)):''}\n";
const FOLD_SECTION_TO =
  "  ${e.topicFamilies?sec('题型与套路',ptFamilies(e.topicFamilies)):''}\n" +
  "  ${((e.topicFamilies&&e.topicFamilies.boundaries&&e.topicFamilies.boundaries.length)||(e.pitfalls&&e.pitfalls.length))?sec('边界与常见坑',ptEdge(e)):''}\n" +
  PROBLEMS_NEW;

const TEMPLATE_FROM =
  "  ${sec('通用模板（Java）',e.templates.map(x=>`<h4 class=\"md-h md-h4\">${h(x.name)}</h4><p class=\"prose\">${h(x.when)}</p>${codeCard(x.java,'Template.java')}<p class=\"prose rs-demo\">已用 <b>${h(x.demo)}</b> 的样例实测：<code class=\"tok-inline\">${h(x.demoMain)}</code> → <code class=\"tok-inline\">${h(x.expected)}</code></p>`).join(''))}\n";
const TEMPLATE_TO = '';

const IDENTIFY_FROM =
  "  ${sec('题型识别',`<div class=\"panel tone-accent\">${ul(e.recognize)}</div>${e.notApplicable.length?`<div class=\"panel tone-bad\"><h4><span class=\"ic\">✗</span>什么时候不适用</h4>${ul(e.notApplicable)}</div>`:''}`)}\n";
const IDENTIFY_TO = '';

const VARIANTS_FROM = "  ${sec('常见变体',ul(e.variants))}\n";
const VARIANTS_TO = '';

const PITFALLS_FROM = "  ${sec('通用坑',`<div class=\"panel tone-warn\">${ul(e.pitfalls)}</div>`)}\n";
const PITFALLS_TO = '';

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

const HELPERS = `
function ptGroup(g){
  return '<div class="rs-group pt-group"><h4>' + h(g.name) + '</h4>' +
    (g.note ? '<p class="pt-group-note">' + mdLite(g.note) + '</p>' : '') +
    '<div class="rs-jumps">' + g.items.map(([hr, t]) => '<a class="jump-btn" href="' + hr + '">' + h(t) + '</a>').join('') + '</div></div>';
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
function ptTable(head, rows){
  return '<div class="tbl-wrap pt-table"><table class="tbl"><thead><tr>' +
    head.map(function (c) { return '<th>' + h(c) + '</th>'; }).join('') +
    '</tr></thead><tbody>' +
    rows.map(function (cells) {
      return '<tr>' + cells.map(function (c, i) {
        return '<td' + (i === 0 ? ' class="pt-c1"' : '') + '>' + mdLite(String(c || '')) + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody></table></div>';
}
function ptFamChip(label){
  var s = String(label);
  var hit = null;
  if (typeof ENTRIES !== 'undefined') {
    var m = s.match(/^\\s*(\\d{1,4})\\b/);
    if (m) {
      hit = ENTRIES.find(function (x) { return x.kind === 'algo' && String(x.number) === m[1]; });
    }
    if (!hit) {
      var core = s.replace(/^\\s*\\d{1,4}\\s*[.．、]?\\s*/, '').replace(/\\s/g, '');
      if (core.length >= 4) {
        var key = core.slice(0, Math.min(8, core.length));
        hit = ENTRIES.find(function (x) {
          return x.kind === 'algo' && String(x.title || '').replace(/\\s/g, '').indexOf(key) >= 0;
        });
      }
    }
  }
  if (hit) return '<a class="jump-btn" href="#/e/' + encodeURIComponent(hit.id) + '">' + h(s) + '</a>';
  return '<span class="pt-fam-tag">' + h(s) + '</span>';
}
function ptDemo(demo){
  if (!demo || !Array.isArray(demo.frames) || !demo.frames.length) return '';
  var frames = demo.frames.map(function (fr, i) {
    var cells = Array.isArray(fr.cells) ? fr.cells : [];
    var links = Array.isArray(fr.links) ? fr.links : [];
    var marks = fr.marks || {};
    var row = cells.map(function (c, idx) {
      var mark = marks[idx] != null ? marks[idx] : marks[String(idx)];
      var band = fr.band;
      var inBand = Array.isArray(band) && idx >= band[0] && idx <= band[1];
      var cell = '<div class="pt-cell' + (mark ? ' pt-cell-on' : '') + (inBand ? ' pt-cell-band' : '') + '"><b>' + h(String(c)) + '</b><i>' +
        (mark ? h(String(mark)) : '') + '</i></div>';
      if (idx < cells.length - 1) {
        var link = links[idx];
        if (link == null) link = '→';
        cell += (link === '·' || link === '')
          ? '<span class="pt-gap"></span>'
          : '<span class="pt-arrow">' + h(String(link)) + '</span>';
      }
      return cell;
    }).join('');
    return '<div class="pt-demo-frame' + (i === 0 ? ' on' : '') + '"><div class="pt-cells">' + row + '</div>' +
      (fr.note ? '<p class="pt-demo-note">' + mdLite(fr.note) + '</p>' : '') + '</div>';
  }).join('');
  return '<div class="pt-demo" data-i="0">' +
    '<p class="pt-demo-title">' + h(demo.title || '这一类题共用的动作') + '</p>' +
    '<div class="pt-demo-frames">' + frames + '</div>' +
    '<div class="pt-demo-bar">' +
      '<button type="button" data-act="pt-step" data-dir="-1">上一步</button>' +
      '<span class="pt-demo-idx">1 / ' + demo.frames.length + '</span>' +
      '<button type="button" data-act="pt-step" data-dir="1">下一步</button>' +
      '<button type="button" data-act="pt-play">播放</button>' +
    '</div></div>';
}
function ptShowFrame(box, index){
  var frames = box.querySelectorAll('.pt-demo-frame');
  if (!frames.length) return;
  var i = Math.max(0, Math.min(frames.length - 1, index));
  frames.forEach(function (frame, k) { frame.classList.toggle('on', k === i); });
  var label = box.querySelector('.pt-demo-idx');
  if (label) label.textContent = (i + 1) + ' / ' + frames.length;
  box.dataset.i = String(i);
}
document.addEventListener('click', function (ev) {
  var btn = ev.target.closest('[data-act="pt-step"],[data-act="pt-play"]');
  if (!btn) return;
  var box = btn.closest('.pt-demo');
  if (!box) return;
  var frames = box.querySelectorAll('.pt-demo-frame');
  var i = Number(box.dataset.i || 0);
  if (btn.getAttribute('data-act') === 'pt-step') {
    if (box._timer) { clearInterval(box._timer); box._timer = null; }
    var play = box.querySelector('[data-act="pt-play"]');
    if (play) play.textContent = '播放';
    ptShowFrame(box, i + Number(btn.getAttribute('data-dir') || 1));
    return;
  }
  if (box._timer) { clearInterval(box._timer); box._timer = null; btn.textContent = '播放'; return; }
  btn.textContent = '暂停';
  box._timer = setInterval(function () {
    var cur = Number(box.dataset.i || 0);
    if (cur >= frames.length - 1) { clearInterval(box._timer); box._timer = null; btn.textContent = '播放'; return; }
    ptShowFrame(box, cur + 1);
  }, 900);
});
function ptFamilies(k){
  var fams = (k && k.families) || [];
  var out = '';
  if (k && k.essence) out += '<p class="pt-k-ess">' + mdLite(k.essence) + '</p>';
  if (fams.length) {
    out += '<p class="pt-fam-lead">先对上题型。骨架是这一类题都要写的那几行；演示只放这一类共用的动作，不是某一道题的完整过程。</p>';
    out += ptTable(['题型', '看到什么就用它'], fams.map(function (f) { return [f.name || '', f.signal || '']; }));
  }
  out += '<div class="pt-fams">' + fams.map(function (f, i) {
    var steps = Array.isArray(f.steps) ? f.steps : [];
    var traps = Array.isArray(f.traps) ? f.traps : [];
    var vars = Array.isArray(f.variants) ? f.variants : [];
    var probs = Array.isArray(f.problems) ? f.problems : [];
    return '<div class="pt-fam">' +
      '<h4 class="pt-fam-h"><span class="pt-fam-n">' + (i + 1) + '</span>' + h(f.name || '') + '</h4>' +
      (f.signal ? '<p class="pt-fam-sig"><b>什么时候用</b>' + mdLite(f.signal) + '</p>' : '') +
      ptDemo(f.demo) +
      (f.code ? '<p class="pt-demo-title">这一类题共用的骨架</p>' + codeCard(f.code, '骨架.java') : '') +
      (steps.length ? '<ol class="pt-fam-steps">' + steps.map(function (s) { return '<li>' + mdLite(s) + '</li>'; }).join('') + '</ol>' : '') +
      (f.key ? '<p class="pt-fam-key"><b>为什么成立</b>' + mdLite(f.key) + '</p>' : '') +
      (traps.length ? '<div class="pt-fam-trap"><b>这个题型的坑</b><ul>' + traps.map(function (t) { return '<li>' + mdLite(String(t)) + '</li>'; }).join('') + '</ul></div>' : '') +
      (vars.length ? '<div class="pt-fam-var"><b>只改变体</b><ul>' + vars.map(function (v) {
        return '<li><span class="pt-var-to">' + h((v && v.to) || '') + '</span>' + mdLite((v && v.change) || '') + '</li>';
      }).join('') + '</ul></div>' : '') +
      (probs.length ? '<div class="rs-jumps pt-fam-prob">' + probs.map(ptFamChip).join('') + '</div>' : '') +
      '</div>';
  }).join('') + '</div>';
  return out;
}
function ptEdge(e){
  var k = (e && e.topicFamilies) || {};
  var out = '';
  var bounds = Array.isArray(k.boundaries) ? k.boundaries : [];
  if (bounds.length) {
    out += '<ul class="pt-k-list">' + bounds.map(function (t) { return '<li>' + mdLite(String(t)) + '</li>'; }).join('') + '</ul>';
  }
  if (e && Array.isArray(e.pitfalls) && e.pitfalls.length) {
    out += '<h4 class="pt-k-h">这些坑不限某一种题型</h4>' + ptPitfalls(e.pitfalls);
  }
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

  const helperStart = result.indexOf('function renderNoteTopicFolds(e) {');
  if (helperStart < 0) throw new Error('Algo focus: fold helper block missing');
  const helperEnd = result.indexOf('document.addEventListener("click", activateNoteTopicFold);\n', helperStart);
  if (helperEnd < 0) throw new Error('Algo focus: fold helper block end missing');
  const cut = helperEnd + 'document.addEventListener("click", activateNoteTopicFold);\n'.length;
  result = result.slice(0, helperStart) + result.slice(cut);

  return result + '\n' + HELPERS;
}

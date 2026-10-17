
function mdLite(t){return h(t).replace(/`([^`]+)`/g,'<code class="tok-inline">$1</code>').replace(/\*\*(.+?)\*\*/g,'<b>$1</b>')}
function v10Analysis(e){const v=e.v10,ul=(a)=>`<ul class="md-list">${a.map(x=>`<li>${mdLite(x)}</li>`).join('')}</ul>`;
  return [e.walkthrough?`<p>${h(e.walkthrough)}</p>`:'',
  `<div class="panel tone-accent"><h4><span class="ic">?</span>识别信号 · 为什么想到这个解法</h4>${ul(v.signals)}</div>`,
  `<div class="grid2"><div class="panel"><h4><span class="ic">1</span>暴力解</h4><p class="prose">${mdLite(v.brute)}</p></div><div class="panel tone-bad"><h4><span class="ic">2</span>瓶颈</h4><p class="prose">${mdLite(v.bottleneck)}</p></div><div class="panel span2 tone-accent"><h4><span class="ic">3</span>关键一步</h4><p class="prose">${mdLite(v.insight)}</p></div></div>`,
  `<div class="grid2"><div class="panel tone-ok"><h4><span class="ic">✓</span>为什么正确 · 不变量</h4><p class="prose">${mdLite(v.invariant)}</p></div><div class="panel tone-accent"><h4><span class="ic">O</span>复杂度</h4><p class="prose">${mdLite(v.complexity_why)}</p></div>
   <div class="panel tone-warn"><h4><span class="ic">!</span>边界自检</h4>${ul(v.boundary)}</div><div class="panel tone-bad"><h4><span class="ic">✗</span>常见 bug</h4>${ul(v.bugs)}</div></div>`,
  callout('高频坑',e.pitfall,'bad'),
  fold('逐级提示（自测用，先别看代码）',v.hints.map((x,i)=>`<p class="md-p"><b>提示 ${i+1}</b>　${mdLite(x)}</p>`).join(''),false,`${v.hints.length} 条`)].join('');}
function v10Follow(e){const v=e.v10;
  return `<div class="panel"><h4><span class="ic">?</span>追问 · 带答案</h4>${v.followups.map(f=>`<div class="av-fu"><p class="md-p"><b>Q：${mdLite(f.q)}</b></p><p class="md-p">${mdLite(f.a)}</p></div>`).join('')}</div>`
   +`<div class="panel"><h4><span class="ic">⇄</span>变体 / 进阶</h4><ul class="md-list">${v.variants.map(x=>`<li>${mdLite(x)}</li>`).join('')}</ul></div>`;}

const ALGO_ALIAS = DATA.ALGO_ALIAS || {};
function renderSimpleAlgo(e){const v=e.simple, url=e.url||(e.slug?`https://leetcode.cn/problems/${e.slug}/`:'');
  const actions=url?`<a class="btn" href="${h(url)}" target="_blank" rel="noopener noreferrer">${ICON.ext}${h(e.linkLabel||'原题')}</a>`:'';
  const viz=diagramFor(e);
  const numStr=e.number!=null&&String(e.number)!==''?String(e.number)+'.':'';
  const secA=sec('题目及要求',`<p class="lead-text">${h(v.statement)}</p>${v.req.length?`<ul class="md-list rs-req">${v.req.map(x=>`<li>${h(x)}</li>`).join('')}</ul>`:''}`);
  const secB=sec('解法解析',`<p class="prose">${h(v.analysis)}</p>${v.cx?`<p class="prose rs-cx">${h(v.cx)}</p>`:''}${viz?`<div class="rs-viz">${viz}</div>`:''}`,viz?{aside:'含逐步演示'}:{});
  const codeSec=e.code?sec('Java 代码（带注释）',codeCard(e.code,'Solution.java')):'';
  return `${pageHead(e,{num:numStr,chips:'',actions})}
  ${secA}
  ${secB}
  ${codeSec}
  <p class="rs-back">所属专题：<a href="#/e/${v.topic}">${h(v.topicName)} →</a></p>
  ${pager(e)}`;}
function renderPTopic(e){const ul=(a)=>`<ul class="md-list">${a.map(x=>`<li>${h(x)}</li>`).join('')}</ul>`;
  const n=e.groups.reduce((s,g)=>s+g.items.length,0);
  return `${pageHead(e,{num:'专题',title:e.cat,sub:h(e.summary),chips:`<span class="chip accent">专题知识库</span><span class="chip">代表题 <b>${n}</b></span>`})}
  ${sec('题型识别',`<div class="panel tone-accent">${ul(e.recognize)}</div>${e.notApplicable.length?`<div class="panel tone-bad"><h4><span class="ic">✗</span>什么时候不适用</h4>${ul(e.notApplicable)}</div>`:''}`)}
  ${sec('通用模板（Java）',e.templates.map(x=>`<h4 class="md-h md-h4">${h(x.name)}</h4><p class="prose">${h(x.when)}</p>${codeCard(x.java,'Template.java')}<p class="prose rs-demo">已用 <b>${h(x.demo)}</b> 的样例实测：<code class="tok-inline">${h(x.demoMain)}</code> → <code class="tok-inline">${h(x.expected)}</code></p>`).join(''))}
  ${sec('常见变体',ul(e.variants))}
  ${sec('通用坑',`<div class="panel tone-warn">${ul(e.pitfalls)}</div>`)}
  ${sec('代表题',e.groups.map(g=>`<div class="rs-group"><h4>${h(g.name)}</h4><p class="prose">${h(g.note)}</p><div class="rs-jumps">${g.items.map(([hr,t])=>`<a class="jump-btn" href="${hr}">${h(t)}</a>`).join('')}</div></div>`).join(''))}
  ${e.folds.length?sec('原专题笔记与精讲（折叠）',e.folds.map(f=>fold(f.title,f.html,false,'')).join('')):''}
  ${pager(e)}`;}
function renderAlgo(e) {
  if (e.simple) return renderSimpleAlgo(e);
  const url = e.url || (e.slug ? `https://leetcode.cn/problems/${e.slug}/` : '');
  const pat = ENTRIES.find((x) => x.kind === 'pattern' && x.mod === 'algo' && x.cat === e.cat);
  const topic = e.topic ? ENTRIES.find((x) => x.kind === 'topic' && x.topicKey === e.topic) : null;
  const chips = [
    `<span class="chip accent">${h(e.cat)}</span>`,
    e.source ? `<span class="chip">${h(e.source)}</span>` : '',
    e.time ? `<span class="chip">时间 <b>${h(e.time)}</b></span>` : '',
    e.space ? `<span class="chip">空间 <b>${h(String(e.space).replace(/（.*?）/, ''))}</b></span>` : '',
  ].join('');
  const actions = [
    url ? `<a class="btn" href="${h(url)}" target="_blank" rel="noopener noreferrer">${ICON.ext}${h(e.linkLabel || '原题')}</a>` : '',
    pat ? `<a class="btn" href="${href(pat)}">题型模板</a>` : '',
  ].join('');
  const t = (e.topic && TOPICS[e.topic]) || (e.topicExplains ? { patterns: [], explains: [] } : null);
  let fusion = '';
  if (t) {
    if (e.patternIdx >= 0 && t.patterns[e.patternIdx]) fusion += fold(`专题套路 · ${t.patterns[e.patternIdx].title.replace(/^\d+\.\s*/, '')}`, t.patterns[e.patternIdx].html, false, `《${t.title}》题型全景`);
    if (e.topicExplains) e.topicExplains.forEach((x) => { fusion += fold(`专题精讲 · ${x.title}`, x.html, false, `来自《${x.from}》专题笔记`); });
    else if (e.explainIdx >= 0 && t.explains[e.explainIdx]) fusion += fold(`专题精讲 · ${t.explains[e.explainIdx].title}`, t.explains[e.explainIdx].html, false, '来自 lc算法 专题笔记');
  }
  const analysis = e.v10 ? v10Analysis(e) : [
    e.walkthrough ? `<p>${h(e.walkthrough)}</p>` : '',
    `<div class="grid2">
      ${e.correctness ? `<div class="panel tone-ok"><h4><span class="ic">✓</span>为什么正确</h4><p class="prose">${h(e.correctness)}</p></div>` : ''}
      <div class="panel tone-accent"><h4><span class="ic">O</span>复杂度</h4><p class="prose">时间 <b>${h(e.time || '—')}</b>，空间 <b>${h(e.space || '—')}</b>。${e.complexityNote ? h(e.complexityNote) : ''}</p></div>
      ${e.boundaryCases && e.boundaryCases.length ? `<div class="panel span2 tone-warn"><h4><span class="ic">!</span>边界自检</h4>${bullets(e.boundaryCases)}</div>` : ''}
    </div>`,
    callout('高频坑', e.pitfall, 'bad'),
  ].join('');
  const follow = e.v10 ? v10Follow(e) : [
    e.methodCompare && e.methodCompare.length ? `<div class="panel"><h4><span class="ic">⇄</span>方法对比 · 为什么选这个</h4>${bullets(e.methodCompare)}</div>` : '',
    e.followupQuestions && e.followupQuestions.length ? `<ol class="followups">${e.followupQuestions.map((q) => `<li>${h(q)}</li>`).join('')}</ol>` : '',
  ].join('');
  const links = [topic, pat].filter(Boolean);
  return `${pageHead(e, { num: e.number + '.', chips, actions })}
    ${callout('一句话思路', e.idea)}
    ${sec('题目', `<p class="lead-text">${h(e.description)}</p>`)}
    ${sec('图解', vizFigure(e), { aside: TRACES[String(e.number)] ? '真实输入逐步执行' : '' })}
    ${sec('Java 代码', codeCard(e.code, 'Solution.java'), { aside: '先默写，再对照' })}
    ${e.face ? sec('面经版答案', fold('面经版答案（八股面经整理 · LeetCode 算法题）', e.face, false, '另一种讲法 / 代码写法')) : ''}
    ${sec('解法拆解', analysis)}
    ${sec('对比与追问', follow)}
    ${sec('放回专题理解', fusion + (links.length ? `<p class="prose">同一套路的完整知识：</p>${relatedLinks(links)}` : ''))}
    ${sec('同类题', relatedLinks(TREE[e.mod].all.filter((x) => x.cat === e.cat && x !== e && x.kind === 'algo')))}
    ${pager(e)}`;
}

const PATTERN_TOPIC_KEY = {
  '哈希': '哈希', '双指针': '双指针', '滑动窗口': '字符串 / 子串', '前缀和': '数组 / 矩阵 / 区间', '子串': '字符串 / 子串', '字符串': '字符串 / 子串',
  '普通数组': '数组 / 矩阵 / 区间', '区间': '数组 / 矩阵 / 区间', '矩阵': '数组 / 矩阵 / 区间', '二叉树': '树', '图论': '图论', '回溯': '回溯', '二分查找': '二分',
  '排序': '排序与选择', '分治': '排序与选择', '链表': '链表', '数学与数论': '数学与位运算', '技巧': '数学与位运算', '概率与随机': '数学与位运算',
  '栈': '数据结构（栈 / 堆 / 设计）', '堆': '数据结构（栈 / 堆 / 设计）', '贪心': '贪心', '动态规划': '动态规划', '多维动态规划': '动态规划', '并发': '多线程与并发',
};
function renderPattern(e) {
  const related = (e.relatedIds || []).map((id) => byId.get(String(id))).filter(Boolean);
  const tkey = PATTERN_TOPIC_KEY[e.category];
  const topic = tkey ? ENTRIES.find((x) => x.kind === 'topic' && x.topicKey === tkey) : null;
  const t = tkey && TOPICS[tkey];
  const toolkit = (e.toolkit || []).length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>工具</th><th>用途</th><th>对应题目</th></tr></thead><tbody>${e.toolkit.map((x) => `<tr><td>${h(x.name)}</td><td>${h(x.use)}</td><td class="mono">${h(x.when)}</td></tr>`).join('')}</tbody></table></div>` : '';
  const fq = (e.commonFollowups || []).map((f, i) => ({ q: h(f.q), a: `<p class="md-p">${h(f.a)}</p>` }));
  const extra = [];
  if (e.problemDecomposition) extra.push(sec(e.problemDecomposition.title, e.problemDecomposition.steps.map((s) => `<div class="stage"><h4>${h(s.stage)}</h4>${bullets(s.questions)}${s.example ? `<p class="prose"><b>例：</b>${h(s.example)}</p>` : ''}</div>`).join('')));
  if (e.capacityEstimation) extra.push(sec(e.capacityEstimation.title, `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>公式</th><th>表达式</th><th>示例</th></tr></thead><tbody>${e.capacityEstimation.formulas.map((f) => `<tr><td>${h(f.name)}</td><td><code class="tok-inline">${h(f.formula)}</code></td><td>${h(f.example)}</td></tr>`).join('')}</tbody></table></div>`
    + (e.capacityEstimation.benchmarks ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>资源</th><th>写</th><th>读</th><th>备注</th></tr></thead><tbody>${e.capacityEstimation.benchmarks.map((b) => `<tr><td>${h(b.resource)}</td><td>${h(b.write)}</td><td>${h(b.read)}</td><td>${h(b.note)}</td></tr>`).join('')}</tbody></table></div>` : '')));
  if (e.architectureEvolution) extra.push(sec(e.architectureEvolution.title, e.architectureEvolution.stages.map((s, i) => `<div class="stage"><h4>阶段 ${i + 1} · ${h(s.stage)}</h4><p class="prose"><code class="tok-inline">${h(s.architecture)}</code></p><div class="grid2"><div class="panel tone-ok"><h4><span class="ic">+</span>优点</h4>${bullets(s.pros)}</div><div class="panel tone-bad"><h4><span class="ic">−</span>缺点</h4>${bullets(s.cons)}</div></div><p class="prose"><b>适用：</b>${h(s.when)}${s.tradeoff ? `　<b>取舍：</b>${h(s.tradeoff)}` : ''}</p></div>`).join('')));
  if (e.tradeoffMatrix) extra.push(sec(e.tradeoffMatrix.title, e.tradeoffMatrix.decisions.map((d) => fold(d.question, `<p class="md-p"><b>选 A：</b>${h(d.chooseCache)}</p><p class="md-p"><b>选 B：</b>${h(d.chooseDB)}</p><p class="md-p"><b>代价：</b>${h(d.cost)}</p>`)).join('')));
  if (e.codeSkeletons) extra.push(sec(e.codeSkeletons.title, e.codeSkeletons.snippets.map((s) => `<h4 class="md-h md-h4">${h(s.name)}</h4>${codeCard(s.code, 'Skeleton.java')}<p class="prose">${h(s.explanation)}</p>`).join('')));
  if (e.failureModes && e.failureModes.scenarios) extra.push(sec(e.failureModes.title, `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>故障</th><th>症状</th><th>缓解</th><th>检测</th></tr></thead><tbody>${e.failureModes.scenarios.map((s) => `<tr><td>${h(s.failure)}</td><td>${h(s.symptom)}</td><td>${h(s.mitigation)}</td><td>${h(s.detection)}</td></tr>`).join('')}</tbody></table></div>`));
  if (e.observability && e.observability.red) extra.push(sec(e.observability.title, `<div class="grid2"><div class="panel"><h4><span class="ic">R</span>RED</h4>${bullets(e.observability.red)}</div><div class="panel"><h4><span class="ic">U</span>USE</h4>${bullets(e.observability.use)}</div><div class="panel span2"><h4><span class="ic">B</span>业务指标</h4>${bullets(e.observability.business)}</div></div>`));
  const map = (e.problemMap || []).length ? `<div>${e.problemMap.map((m) => `<div class="pm-row"><div class="pm-range">${h(m.range)}</div><div class="pm-note">${h(m.note)}</div></div>`).join('')}</div>` : '';
  const patternsFromTopic = t ? t.patterns.map((p) => fold(p.title.replace(/^\d+\.\s*/, ''), p.html, false, `出自《${t.title}》`)).join('') : '';
  return `${pageHead(e, { num: '模板', title: e.title, sub: h(e.subtitle || ''), chips: `<span class="chip accent">${h(e.kindLabel || '题型模板')}</span><span class="chip">覆盖 <b>${related.length}</b> 题</span>` })}
    ${callout('60 秒说清这类题', e.interviewPitch)}
    ${sec('识别信号与高频坑', `<div class="grid2"><div class="panel tone-accent"><h4><span class="ic">?</span>看到这些关键词就想到它</h4>${bullets(e.signals)}</div><div class="panel tone-bad"><h4><span class="ic">!</span>高频坑</h4>${bullets(e.pitfalls)}</div></div>`)}
    ${sec('核心工具箱', toolkit)}
    ${sec('正确性 · 复杂度 · 边界', `${e.correctnessTemplate ? `<p>${h(e.correctnessTemplate)}</p>` : ''}<div class="grid2"><div class="panel"><h4><span class="ic">O</span>复杂度备忘</h4>${bullets(e.complexityNotes)}</div><div class="panel tone-warn"><h4><span class="ic">!</span>必测边界</h4>${bullets(e.boundaryChecklist)}</div></div>`)}
    ${sec('通用追问', fq.length ? qaListHtml(fq.map((x, i) => ({ ...x, key: qKey(e.id, 'f' + i), no: i + 1 })), { mode: 'lead', simple: true }) : '')}
    ${extra.join('')}
    ${sec('解题模式', patternsFromTopic + (topic ? `<p class="prose">完整知识点、题型全景与精讲在：</p>${relatedLinks([topic])}` : ''))}
    ${sec('题目地图', map)}
    ${sec('本类全部题目', relatedLinks(related))}
    ${pager(e)}`;
}

function renderTopic(e) {
  const t = TOPICS[e.topicKey];
  const problemsIn = ENTRIES.filter((x) => x.kind === 'algo' && x.topic === e.topicKey);
  const explains = (t.explains || []).map((x) => {
    const m = x.title.match(/LC\s*(\d+)/);
    const hit = m && ENTRIES.find((p) => p.kind === 'algo' && String(p.number) === m[1]);
    return fold(x.title, x.html + (hit && !x.linked ? `<p class="md-p"><a href="${href(hit)}">打开题目页 →</a></p>` : ''), false, x.linked ? (x.summaryOf ? '摘要 · 见题目页' : '摘要 · 见另一专题') : hit ? '题单内' : '');
  }).join('');
  return `${pageHead(e, { num: '专题', title: t.title + ' 专题', chips: `<span class="chip accent">lc算法 专题笔记</span><span class="chip">题型 <b>${t.patterns.length}</b></span><span class="chip">精讲 <b>${t.explains.length}</b></span><span class="chip">题单内 <b>${problemsIn.length}</b> 题</span>` })}
    ${callout('本专题讲什么', stripTags(t.subtitle || t.intro))}
    ${sec('必会知识点与模板', `<div class="md">${t.knowledge || ''}</div>`)}
    ${sec('题型全景与套路', `<div class="md">${t.patterns.map((p) => `<h3 class="md-h md-h3">${h(p.title)}</h3>${p.html}`).join('')}</div>`)}
    ${sec('高频题清单', `<div class="md">${t.list || ''}</div>${problemsIn.length ? `<p class="prose">本手册题单中属于该专题的题：</p>${relatedLinks(problemsIn)}` : ''}`)}
    ${sec('具体题目精讲', explains, { aside: `${t.explains.length} 篇，按需展开` })}
    ${sec('复习路线与自检', `<div class="md">${t.route || ''}${t.checklist ? `<h3 class="md-h md-h3">面试自检清单</h3>${t.checklist}` : ''}</div>`)}
    ${t.ref ? sec('参考题单', `<div class="md">${t.ref}</div>`) : ''}
    ${pager(e)}`;
}

const DIMS = [
  ['requirements', '需求拆解', 'R'], ['capacityPlan', '容量估算与 SLO', 'C'], ['architecture', '整体架构', 'A', true], ['dataFlow', '核心数据流', 'D', true],
  ['consistency', '一致性 / 幂等 / 事实源', 'I'], ['failureModes', '故障、降级与恢复', 'F'], ['keyPoints', '关键设计与取舍', 'K'],
  ['observability', '可观测性与容量验证', 'O'], ['tradeoffs', '架构取舍 Trade-offs', 'T'], ['security', '安全与滥用防护', 'S'], ['followups', '面试官可能继续追问', 'Q'],
];
function renderScenario(e) {
  const cf = (SCENARIO_COUNTERFACTUALS[e.id] || []);
  const dims = DIMS.filter(([k]) => e[k] && e[k].length).map(([k, name, ic, ord], i, arr) => `<div class="dim${(arr.length % 2 === 1 && i === arr.length - 1) ? ' span2' : ''}" id="dim-${k}" style="${modColor(e.mod)}"><h3><i>${ic}</i>${h(name)}</h3>${bullets(e[k], ord)}</div>`).join('');
  return `${pageHead(e, { num: entryNum(e), chips: `<span class="chip accent">${h(e.cat)}</span>${e.source ? `<span class="chip">${h(e.source)}</span>` : ''}` })}
    ${callout('设计主线', e.idea)}
    <div class="kv"><div class="wide"><span>场景与目标</span><strong>${h(e.description)}</strong></div><div class="wide"><span>关键指标</span><strong>${h(e.metrics || '—')}</strong></div><div class="wide"><span>核心组件</span><strong>${h(e.components || '—')}</strong></div></div>
    ${sec('60 秒面试话术', pitchBlock(sentencePitch(e.interviewAnswer), '按「结论 → 论据 → 关键设计 → 取舍」讲'))}
    ${sec('架构图解与请求流', vizFigure(e), { aside: '▶ 播放 · 点击步骤跳转' })}
    ${sec('架构详解', `<div class="dims">${dims}</div>`, { aside: '11 个维度' })}
    ${sec('反事实：如果不这么做', cf.length ? `<div class="cf">${cf.map(([q, a]) => `<div class="cf-item"><strong>${h(q)}</strong><span>${h(a)}</span></div>`).join('')}</div>` : '')}
    ${sec('深入补强', deepenBlock(e))}
    ${sec('架构伪代码', e.code ? codeCard(e.code, 'architecture.pseudo') : '')}
    ${sec('同类场景', relatedLinks(TREE[e.mod].all.filter((x) => x.cat === e.cat && x !== e)))}
    ${pager(e)}`;
}

function renderHandwrite(e) {
  const isDb = e.kind === 'database';
  if (e.number === 0) {
    return `${pageHead(e, { num: '总览', noMastery: false })}<div class="md sec">${e.questionHtml || ''}</div>${pager(e)}`;
  }
  const know = e.knowledge && e.knowledge.length ? `<ul class="bullets">${e.knowledge.map((k) => `<li>${k}</li>`).join('')}</ul>` : '';
  return `${pageHead(e, { num: isDb ? 'SQL' : '手撕', chips: `<span class="chip accent">${h(e.cat)}</span>${e.source ? `<span class="chip">${h(e.source)}</span>` : ''}` })}
    ${sec('题目', `<div class="md">${e.questionHtml || '<p>见下方分析。</p>'}</div>`)}
    ${sec('图解', diagramFor(e), { aside: '▶ 播放 · 可单步' })}
    ${sec('问题分析与必备知识点', `<div class="grid2"><div class="panel span2"><h4><span class="ic">?</span>问题分析</h4><div class="md">${e.analysisHtml || '—'}</div></div>${know ? `<div class="panel span2 tone-accent"><h4><span class="ic">K</span>必备知识点</h4><div class="md">${know}</div></div>` : ''}</div>`)}
    ${sec(isDb ? '参考答案（SQL / 设计）' : '参考答案', `<div class="md">${e.answerHtml || '—'}</div>`, { aside: '点「默写」遮住代码自测' })}
    ${sec('变体与追问', e.relatedHtml ? `<div class="md">${e.relatedHtml}</div>` : '')}
    ${sec('深入补强', deepenBlock(e))}
    ${sec('同章节', relatedLinks(TREE[e.mod].all.filter((x) => x.cat === e.cat && x !== e)))}
    ${pager(e)}`;
}

function renderSyntax(e) {
  return `${pageHead(e, { num: '语法', sub: h(e.subtitle || ''), chips: `<span class="chip accent">${h(e.cat)}</span>` })}
    <div class="md sec">${e.html || ''}</div>
    ${sec('同分类', relatedLinks(TREE[e.mod].all.filter((x) => x.cat === e.cat && x !== e)))}
    ${pager(e)}`;
}

function renderDoc(e) {
  const imgs = (e.images || []).map((im) => `<a class="btn" href="${h(im.href)}" target="_blank" rel="noopener" title="${h(im.name)}">${ICON.img}原图${e.images.length > 1 ? ' · ' + h(im.name.replace(/\.\w+$/, '')) : ''}</a>`).join('');
  return `${pageHead(e, { num: '', chips: `<span class="chip accent">专题精讲</span><span class="chip">${h(e.cat)}</span>`, noMastery: false, actions: imgs })}
    ${e.lead ? callout('这篇讲什么', e.lead, 'plain') : ''}
    <div class="md sec">${e.html}</div>
    <p class="src-note">来源：${h(e.source || '')}</p>
    ${pager(e)}`;
}

/* ---------------- 问答卡 ---------------- */
function splitLead(html) {
  const s = String(html || '').trim();
  if (s.startsWith('<p class="md-p">')) {
    const end = s.indexOf('</p>') + 4;
    return [s.slice(0, end), s.slice(end).trim()];
  }
  return ['', s];
}
function qaCardHtml(it) {
  const s = statusOf(it.key);
  const [lead, rest] = it.lead ? [it.lead, it.a] : splitLead(it.a);
  return `<div class="qa s${s}" id="q-${h(it.anchor ?? it.no)}" data-key="${h(it.key)}">
    <div class="qa-head" data-act="qa-toggle"><span class="qa-no">${h(it.no)}</span><div class="qa-q">${it.q}</div>
      <div class="qa-tags">${HLC[it.key] ? '<span class="cmp-tag">对比</span>' : ''}${it.from ? `<a class="lc-link" href="${it.from.href}">${h(it.from.label)}</a>` : ''}</div></div>
    <button type="button" class="qa-reveal" data-act="qa-open">显示答案 · Space</button>
    <div class="qa-body"><div class="md">${lead ? `<div class="qa-lead">${lead}${cmpCard(it.key)}</div>` : cmpCard(it.key)}${rest ? `<div class="qa-rest">${rest}</div>` : ''}</div>
      <div class="qa-foot">${lead && rest ? '<button type="button" class="mini more expand" data-act="qa-open">展开全文 ↓</button><button type="button" class="mini more collapse" data-act="qa-close">收起 ↑</button>' : ''}
        <span class="grow"></span><button type="button" class="mini${s === 1 ? ' on' : ''}" data-s="1" data-act="qa-mark">模糊</button><button type="button" class="mini${s === 2 ? ' on' : ''}" data-s="2" data-act="qa-mark">掌握</button></div></div></div>`;
}
function qaListHtml(items, opts = {}) {
  let lastSub = null, html = '';
  for (const it of items) {
    if (it.sub && it.sub !== lastSub) { html += `<div class="qa-sub">${h(it.sub)}</div>`; }
    lastSub = it.sub;
    html += qaCardHtml(it);
  }
  return `<div class="qa-list" data-mode="${opts.mode || state.qaMode}">${html}</div>`;
}
function qaToolbar(count, mustCount) {
  const m = state.qaMode;
  return `<div class="qa-toolbar"><span class="lb">答案显示</span><div class="seg" id="qa-mode">
      <button type="button" data-m="q" class="${m === 'q' ? 'on' : ''}" title="只看题目，自测后再翻答案">只看题目</button>
      <button type="button" data-m="lead" class="${m === 'lead' ? 'on' : ''}" title="先看答题提纲：本质一句 + 要点骨架">先答一句</button>
      <button type="button" data-m="full" class="${m === 'full' ? 'on' : ''}">全部展开</button></div>
      <button type="button" class="btn ghost" data-act="qa-random">${ICON.shuffle}抽一题</button>
      <span class="grow"></span><span class="stat" id="qa-stat"></span></div>`;
}
function renderQA(e) {
  const items = e.items.map((it, i) => ({ ...it, key: qKey(e.id, i), no: i + 1, anchor: qAnchor(e.id, i) }));
  const shown = items;
  const u = unitsOf([e]);
  const catEntries = TREE[e.mod].all.filter((x) => x.cat === e.cat && x !== e);
  return `${pageHead(e, { num: '', noMastery: true, left: `<span class="chip">掌握 <b>${u.ok}/${u.total}</b></span>${u.fuzzy ? `<span class="chip">模糊 <b>${u.fuzzy}</b></span>` : ''}`,
      chips: `<span class="chip accent">${h(e.cat)}</span><span class="chip">${items.length} 问</span>${e.source ? `<span class="chip">${h(e.source)}</span>` : ''}` })}
    ${keyCard(e)}
    ${qaToolbar(items.length)}
    ${qaListHtml(shown)}
    ${sec('同专题其它小节', relatedLinks(catEntries))}
    ${pager(e)}`;
}

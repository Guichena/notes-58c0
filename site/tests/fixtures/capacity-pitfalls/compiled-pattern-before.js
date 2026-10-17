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
  if (e.codeSkeletons) extra.push(sec(e.codeSkeletons.title, e.codeSkeletons.snippets.map((s) => `<h4 class="md-h md-h4">${h(s.name)}</h4>${s.code ? codeCard(s.code, 'Skeleton.java') : ''}<p class="prose">${h(s.explanation)}</p>`).join('')));
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


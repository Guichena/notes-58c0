const WEEKS = [
  { n: 'W1', t: '制作面试方案', goal: '简历初版 + 核心项目 + 八股主干', doc: 'doc-03', items: ['写初版简历，确定一个核心项目、一个补充项目', '写核心卖点和两三个支撑点', '为项目准备 10 个模拟问题', '八股主干：MySQL / Redis / Kafka / 分布式基础题', '算法：每天 3 题，先刷题型模板'] },
  { n: 'W2', t: '再改简历 · 过八股', goal: '逐句过简历，补高可用 / 高性能 / 可靠性案例', doc: 'doc-04', items: ['逐句过简历，准备每个数据来源', '写自我介绍、项目介绍', 'MVCC、redo log、长事务、Sentinel / Cluster', '投低优先级公司练手', '场景题：答题框架 + 3 道高频'] },
  { n: 'W3', t: '高级内容 · 正式投递', goal: '微服务治理、分库分表、不停机迁移', doc: 'doc-05', items: ['正式投递，每场面试复盘', '记录高频追问，修正简历危险表述', '限流 / 降级 / 熔断 / 隔离讲成案例', '分库分表：分多少、按什么分、跨库问题', '手撕：LRU、限流、阻塞队列、线程池'] },
  { n: 'W4', t: 'AI 项目 · 表达打磨', goal: '把「调用大模型」升级成 Agent 工程项目', doc: 'doc-06', items: ['练总分结构和开头第一句话', '意图识别、上下文工程、Plan/Replan', 'RAG 测试集与 recall@k 指标', '练项目落地表达：每个知识点配一句项目', '补八股短板（看冲刺台「模糊」项）'] },
];
const METHOD = [
  ['01', '总分结构', '先给结论，再展开细节，不要一上来陷入细节。', '「我会从生产、存储、消费三个阶段保证消息不丢……」'],
  ['02', '开篇第一句抓关键', '第一句话要让面试官知道你理解了问题，答到最关键的点。', '「Redis 快的核心是内存访问、单线程无锁、IO 多路复用和高效数据结构。」'],
  ['03', '层次遍历展开', '先答主干，再根据面试官反馈一层层深入，每层都能收住。', '缓存一致性：先更新 DB 再删缓存 → 删除失败怎么办 → 并发读写 → 能否强一致'],
  ['04', '万事不离项目', '每个知识点都准备一句项目落地，证明不是背题。', '「Kafka 我在通知异步投递里用过，积压时……」'],
];
function renderNotFound(id) {
  return `<section class="hero nf"><h1>未找到</h1><p>没有找到页面 <code class="tok-inline">${h(id)}</code>，可能是旧链接或拼写有误。</p>
    <div class="meta"><a class="btn primary" href="#/">返回冲刺台</a><button type="button" class="btn" onclick="openPalette&&openPalette()">搜索</button></div></section>`;
}
function renderHome() {
  const all = unitsOf(ENTRIES);
  const qaCount = ENTRIES.reduce((s, e) => s + (e.items ? e.items.length : 0), 0);
  const recent = store.get('iv8-recent', []).map((id) => byId.get(id)).filter(Boolean);
  const last = recent[0];
  const weeksDone = store.get('iv8-weeks', {});
  const mods = MODS.filter((m) => TREE[m.id]).map((m) => {
    const u = unitsOf(TREE[m.id].all);
    return `<a class="mod-card" href="#/m/${m.id}" style="${modColor(m.id)}"><div class="top"><span class="mi">${m.icon}</span><h3>${h(m.full)}</h3></div>
      <p>${h(m.desc)}</p><div class="bar"><i class="s1" style="width:${((u.ok + u.fuzzy) / u.total * 100).toFixed(1)}%"></i><i style="width:${(u.ok / u.total * 100).toFixed(1)}%"></i></div>
      <span class="nums">${TREE[m.id].all.length} 条目 · ${u.total} 单元 · 掌握 ${u.ok}</span></a>`;
  }).join('');
  return `<section class="hero"><h1>冲刺台</h1>
      <p>简历负责吸引追问，项目负责承载追问，八股负责支撑追问，面试技巧负责把答案讲清楚。这里把算法手撕、场景设计、八股问答和面试策略串成一套可以每天推进的复习体系。</p>
      <div class="meta"><span class="chip">${ENTRIES.length} 条目</span><span class="chip">${all.total} 复习单元</span><span class="chip accent">已掌握 <b>${all.ok}</b> / ${all.total} 单元</span>${all.fuzzy ? `<span class="chip">模糊 <b>${all.fuzzy}</b></span>` : ''}</div></section>
    ${last ? `<h2 class="dash-h">继续上次</h2><div class="today"><a href="${href(last)}" style="${modColor(last.mod)}"><span class="dot s${entryStatus(last)}"></span><span class="t">${h(last.title)}<span class="why">${h(MOD[last.mod].full)} · ${h(last.cat)}</span></span><span class="w">继续 →</span></a></div>` : ''}
    <h2 class="dash-h">模块</h2><div class="mod-grid">${mods}</div>
    <h2 class="dash-h">四周冲刺 <small>勾选会保存在本机浏览器</small></h2>
    <div class="weeks">${WEEKS.map((w) => `<div class="week"><header><b>${w.n}</b><strong>${h(w.t)}</strong></header><p class="goal">${h(w.goal)}</p>
      ${w.items.map((it, i) => { const k = w.n + '-' + i; const d = !!weeksDone[k]; return `<label class="${d ? 'done' : ''}"><input type="checkbox" data-week="${k}" ${d ? 'checked' : ''}><span>${h(it)}</span></label>`; }).join('')}
      ${byId.get(w.doc) ? `<a class="more" href="${href(byId.get(w.doc))}">本周精讲 →</a>` : ''}</div>`).join('')}</div>
    <h2 class="dash-h">答题心法 <small>来自《春招准备总规划》第 6 节</small></h2>
    <div class="method">${METHOD.map(([n, t, p, eg]) => `<div><h4><i>${n}</i>${h(t)}</h4><p>${h(p)}</p><p class="eg">${h(eg)}</p></div>`).join('')}</div>
    <h2 class="dash-h">重点地图 <small>按 模块 → 小节 → 题目 铺开全部问答，每题一句「本质」，配合掌握状态查漏补缺</small></h2>
    <div class="hm-home">${HL_MODS.map((id) => { const es = TREE[id].all.filter((e) => e.kind === 'qa'); const u = unitsOf(es); const nc = new Set(es.map((e) => e.cat)).size;
      return `<a class="hm-home-card" href="#/hl/${id}" style="${modColor(id)}"><span class="mi">${MOD[id].icon}</span><span class="t"><b>${h(MOD[id].full)}</b><small>${nc} 个小节 · ${u.total} 问 · 掌握 ${u.ok}</small></span>
        <span class="bar"><i class="s1" style="width:${((u.ok + u.fuzzy) / u.total * 100).toFixed(1)}%"></i><i style="width:${(u.ok / u.total * 100).toFixed(1)}%"></i></span><span class="go">打开 →</span></a>`; }).join('')}</div>`;
}

/* ---------------- 模块总览 ---------------- */
const RUBRIC = {
  algo: [['通过线', '能给出正确解法和复杂度，写出能编译的主流程代码'], ['良好', '能解释为什么正确（不变量），给出边界用例，讨论取舍'], ['优秀', '给出 2 种以上解法对比，讨论下界 / 最优性，主动接追问'], ['红线', '只会暴力且不能优化、不会分析复杂度、代码无法编译']],
  code: [['通过线', '写出主干代码（核心类 + 核心方法），知道至少 1 个并发 / 性能问题；SQL 写对并知道索引怎么用'], ['良好', '代码线程安全、能解释设计决策；能读 EXPLAIN、知道锁类型与索引失效'], ['优秀', '完整可运行、能谈性能优化与测试；能优化慢查询、设计分库分表'], ['红线', '代码不能编译、不懂基本并发原语；不知道 B+ 树和 ACID']],
  design: [['通过线', '给出 QPS / 存储 / 带宽至少两项估算，说出 ≥3 个核心组件'], ['良好', '明确哪里强一致、哪里最终一致；列出 ≥2 个故障模式和降级方案'], ['优秀', '讨论演进路径（单机 → 主从 → 分库分表 → 多活），主动提监控指标与告警阈值，先澄清需求'], ['红线', '只会单机方案、说不出失败模式、容量拍脑袋、不懂消息幂等']],
};
function renderModHome(modId) {
  const m = MOD[modId], tree = TREE[modId];
  const u = unitsOf(tree.all);
  const qaN = tree.all.reduce((s, e) => s + (e.items ? e.items.length : 0), 0);
  const mustN = tree.all.reduce((s, e) => s + (e.items ? e.items.filter((x) => x.mk).length : 0), 0);
  const starts = (m.start || []).map((id) => byId.get(id)).filter(Boolean);
  const parts = tree.parts.map((p) => `<div class="part-h">${h(p.name)}</div><div class="cat-grid">${p.cats.map((c) => {
    const cu = unitsOf(c.items);
    return `<a class="cat-card" href="${href(c.items[0])}" style="${modColor(modId)}"><span class="h">${h(c.name)}<small>${cu.ok}/${cu.total}</small></span>
      <span class="sub">${h(c.items.slice(0, 4).map((x) => x.title).join(' · '))}</span>
      <div class="bar"><i class="s1" style="width:${((cu.ok + cu.fuzzy) / cu.total * 100).toFixed(1)}%"></i><i style="width:${(cu.ok / cu.total * 100).toFixed(1)}%"></i></div></a>`;
  }).join('')}</div>`).join('');
  const rub = RUBRIC[modId] ? fold('面试评分维度（自测用）', `<div>${RUBRIC[modId].map(([a, b]) => `<div class="pm-row"><div class="pm-range">${h(a)}</div><div class="pm-note">${h(b)}</div></div>`).join('')}</div>`) : '';
  return `<nav class="crumbs" style="${modColor(modId)}"><span class="mdot"></span><a href="#/">冲刺台</a><span class="sep">/</span><span>${h(m.full)}</span></nav>
    <section class="hero" style="${modColor(modId)}"><h1>${h(m.full)}</h1><p>${h(m.desc)}</p>
      <div class="meta"><span class="chip">${tree.all.length} 个条目</span>${qaN ? `<span class="chip">${qaN} 道问答</span>` : ''}<span class="chip accent">已掌握 <b>${u.ok}</b> / ${u.total}</span></div>
      <div class="head-actions" style="border:0;padding:0">${starts.map((s, i) => `<a class="btn${i === 0 ? ' primary' : ''}" href="${href(s)}">${i === 0 ? '从这里开始：' : ''}${h(s.title)}</a>`).join('')}${HL_MODS.includes(modId) ? `<a class="btn${starts.length ? '' : ' primary'}" href="#/hl/${modId}">${ICON_MAP}重点地图 · ${qaN} 问</a>` : ''}</div></section>
    ${parts}
    ${rub ? `<div class="sec">${rub}</div>` : ''}`;
}


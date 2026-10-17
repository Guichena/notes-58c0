/* Generated deterministically. Edit src/, never dist/. */
void 0;

/* Source: src/app/catalog.js */
/* ==========================================================================
   面试手册 v8 · 前端
   路由：#/  冲刺台 · #/m/<模块>  模块总览 · #/e/<条目>[/<题号>]  条目 · #/hl/<模块>  重点地图（旧 #/must 链接自动跳转）
   ========================================================================== */
// Preserve the original non-strict classic-script scope (the original directive was mid-script).
void 0;

const DATA = window.__NOTES_DATA__;
const ENTRIES = DATA.entries;
const TOPICS = DATA.TOPICS;
const byId = new Map();
ENTRIES.forEach((e, i) => { e._i = i; byId.set(e.id, e); });
const detailEl = document.getElementById('page');   // v7 图解 wireViz 依赖此名
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const escapeHtml = (v) => String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const h = escapeHtml;
// Reviewed display labels only. Keep grouping, route, and persistence keys raw.
const LEARNER_DISPLAY_ALIASES = Object.freeze({part:Object.freeze({"Agent Runtime 工程合同":"Agent Runtime 工程机制","学习参考":"学习指南"}),cat:Object.freeze({"证据、图关系与评价合同":"证据、图关系与评价约束","数据库工具的查询合同":"数据库工具的查询规则","跨册场景补充":"场景分析与追问","实现参考与验证边界":"学习路线与实践条件","查询计划、融合与重排合同":"查询计划、融合与重排约束","向量服务与版本化数据合同":"向量服务与版本化数据契约","教学参考与验证边界":"学习路线与实践条件","补充算法合同":"算法题与解题条件","MySQL 教学参考":"MySQL 学习指南","教学程序与阅读参考":"配套练习与学习指南","身份、隔离与业务状态合同":"身份、隔离与业务状态契约","教学参考与完整代码":"练习环境与完整示例","流处理与数据合同":"流处理与数据约束","完整来源变体":"来源变体与完整解法"})});
function learnerLabel(field, value) {
  if (typeof field !== 'string' || typeof value !== 'string') return value;
  const aliases = Object.hasOwn(LEARNER_DISPLAY_ALIASES, field) ? LEARNER_DISPLAY_ALIASES[field] : null;
  return aliases && Object.hasOwn(aliases, value) ? aliases[value] : value;
}
function learnerSearchText(record) {
  if (record.qi != null || typeof record.text !== 'string') return record.text;
  const e = record.e;
  const original = stripTags([e.title, e.number, e.cat, e.part].filter(Boolean).join(' '));
  const display = stripTags([e.title, e.number, learnerLabel('cat', e.cat), learnerLabel('part', e.part)].filter(Boolean).join(' '));
  if (!original || original === display) return record.text;
  if (record.text === original || record.text.startsWith(original + ' ')) return display + record.text.slice(original.length);
  return record.text;
}
const pad2 = (n) => String(n).padStart(2, '0');
const stripTags = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const MODS = [
  { id: 'home', name: '冲刺台', icon: '◆' },
  { id: 'algo', name: '算法', full: '算法与数据结构', icon: 'A', start: ['p-hash', '1'],
    desc: '先读专题（题型识别 + 通用模板），再逐题看解法、默写代码。' },
  { id: 'code', name: '手撕', full: '代码与 SQL 手撕', icon: 'C', start: ['handwrite-45', 'database-71'],
    desc: 'LRU、限流、阻塞队列、线程池、设计模式等工程手撕，以及 SQL 统计、索引、事务锁与表设计。' },
  { id: 'design', name: '场景', full: '场景设计', icon: 'S', start: ['scenario-design-framework', 'doc-sd-scenarios'],
    desc: '架构场景题 + 高可用项目精讲 + 面经场景问答。按「需求 → 容量 → 架构 → 一致性 → 故障 → 可观测」展开。' },
  { id: 'bagu', name: '八股', full: '系统设计八股', icon: 'B', must: true,
    desc: 'MySQL、Redis、ES、Kafka / RabbitMQ / RocketMQ、分布式与线上排障。先用重点地图把每节主线过一遍，再补项目案例，最后抠高阶追问。' },
  { id: 'ai', name: 'AI', full: 'AI 应用与 Agent', icon: 'AI', must: true, start: ['doc-06'],
    desc: 'Agent、RAG、上下文工程、模型评测八股，以及意图识别、Plan/Replan、AI Debug 工具等项目表达。' },
  { id: 'syntax', name: '语法', full: 'Java 语法速查', icon: 'J',
    desc: '容器与常用 API、ACM 输入输出、Stream 语法。手撕前 5 分钟快速过一遍，避免卡在 API 上。' },
  { id: 'plan', name: '策略', full: '面试策略', icon: 'P', start: ['doc-02'],
    desc: '四周冲刺规划、简历与项目包装、团队研发流程、日常问题与智力题。' },
];
const MOD = Object.fromEntries(MODS.map((m) => [m.id, m]));
const modColor = (id) => `--mc: var(--m-${id})`;
const KIND_LABEL = { algo: '算法题', pattern: '题型模板', topic: '专题知识', scenario: '场景题', handwrite: '代码手撕', database: 'SQL 手撕', syntax: '语法速查', qa: '问答', doc: '专题精讲' };


;

/* Source: src/app/storage.js */
/* ---------------- 存储：掌握度 / 最近浏览 / 偏好 ---------------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 隐私模式等情况下忽略 */ } },
};
let PROG = store.get('iv8-progress', null);
if (!PROG || typeof PROG !== 'object') {
  PROG = {};
  // 兼容 v7 的「已复习」记录：视为已掌握
  const old = store.get('lc-v7-progress', []);
  if (Array.isArray(old)) old.forEach((id) => { if (byId.has(String(id))) PROG[String(id)] = { s: 2, t: Date.now() }; });
  store.set('iv8-progress', PROG);
}
// Original questions retain numeric identities; new questions carry stable IDs.
const qAnchor = (eid, qi) => byId.get(eid)?.items?.[qi]?.id || qi;
const qKey = (eid, qi) => `${eid}#${qAnchor(eid, qi)}`;
const statusOf = (key) => (PROG[key] && PROG[key].s) || 0;
function setStatus(key, s) {
  if (!s) delete PROG[key]; else PROG[key] = { s, t: Date.now() };
  store.set('iv8-progress', PROG);
}
function entryStatus(e) {
  if (e.kind !== 'qa') return statusOf(e.progressKey || e.id);
  let m = 0, any = false;
  e.items.forEach((_, i) => { const s = statusOf(qKey(e.id, i)); if (s === 2) m++; if (s) any = true; });
  return m === e.items.length ? 2 : any ? 1 : 0;
}
function unitsOf(list) {
  let total = 0, ok = 0, fuzzy = 0;
  for (const e of list) {
    if (e.kind === 'qa') {
      e.items.forEach((_, i) => { total++; const s = statusOf(qKey(e.id, i)); if (s === 2) ok++; else if (s === 1) fuzzy++; });
    } else { total++; const s = statusOf(e.progressKey || e.id); if (s === 2) ok++; else if (s === 1) fuzzy++; }
  }
  return { total, ok, fuzzy };
}
function pushRecent(id) {
  const r = store.get('iv8-recent', []).filter((x) => x !== id);
  r.unshift(id);
  store.set('iv8-recent', r.slice(0, 12));
}


;

/* Source: src/app/structure.js */
/* Reviewed display-only traversal; original source retained. */
function buildLearningOrder(entries, registry, warn = message => console.warn(message)) {
  const fail = message => { throw new Error('Learning order: ' + message); };
  const valid = value => typeof value === 'string' && value.length > 0;
  if (registry?.schemaVersion !== 1 || !Array.isArray(registry.modules) || !Array.isArray(registry.moduleOrder)) fail('invalid registry');
  const mods = new Set(), parts = new Set(), groups = new Set(), ranks = new Map();
  for (const [mi, m] of registry.modules.entries()) {
    if (!valid(m.mod) || mods.has(m.mod) || registry.moduleOrder[mi] !== m.mod || !Array.isArray(m.parts)) fail('invalid module rank');
    mods.add(m.mod);
    for (const [pi, p] of m.parts.entries()) {
      if (!valid(p.partId) || parts.has(p.partId) || !Array.isArray(p.categories) || !p.categories.length) fail('invalid part rank');
      parts.add(p.partId);
      for (const [ci, c] of p.categories.entries()) {
        if (!valid(c.groupId) || groups.has(c.groupId) || !Array.isArray(c.entryIds) || !c.entryIds.length) fail('invalid category rank');
        groups.add(c.groupId);
        for (const [ei, id] of c.entryIds.entries()) {
          if (!valid(id) || ranks.has(id)) fail('duplicate or malformed entry rank: ' + id);
          ranks.set(id, {mod:m.mod, part:p.partId, group:c.groupId, pi, ci, ei});
        }
      }
    }
  }
  if (registry.moduleOrder.length !== mods.size) fail('invalid module ranks');
  const tree = Object.create(null), seen = new Set(), knownParts = new Map(), knownGroups = new Map();
  const partRank = new Map(), catRank = new Map();
  const unknown = [], newParts = [], newGroups = [];
  for (const e of entries) {
    if (!valid(e.id) || seen.has(e.id)) fail('duplicate or invalid entry ID: ' + e.id);
    seen.add(e.id);
    if (!mods.has(e.mod)) fail('unreviewed module: ' + e.mod);
    const m = tree[e.mod] ||= {parts:[], all:[]};
    let p = m.parts.find(p => p.name === e.part);
    if (!p) { p = {name:e.part,cats:[]}; m.parts.push(p); }
    let c = p.cats.find(c => c.name === e.cat);
    if (!c) { c = {name:e.cat,items:[]}; p.cats.push(c); }
    c.items.push(e);
    const r = ranks.get(e.id);
    if (!r) { unknown.push(e.id); continue; }
    if (r.mod !== e.mod) fail('reviewed entry moved module: ' + e.id);
    if ((knownParts.has(r.part) && knownParts.get(r.part) !== p) || (partRank.has(p) && partRank.get(p).part !== r.part)) fail('reviewed part split or merged: ' + e.id);
    if ((knownGroups.has(r.group) && knownGroups.get(r.group) !== c) || (catRank.has(c) && catRank.get(c).group !== r.group)) fail('reviewed category split or merged: ' + e.id);
    knownParts.set(r.part,p); knownGroups.set(r.group,c); partRank.set(p,r); catRank.set(c,r);
  }
  // Stable sorting leaves new entries/groups in canonical encounter order.
  const rankSort = (map, key) => (a,b) => (map.get(a)?.[key] ?? Infinity) - (map.get(b)?.[key] ?? Infinity) || 0;
  for (const [mod,m] of Object.entries(tree)) {
    m.parts.sort(rankSort(partRank,'pi'));
    for (const p of m.parts) {
      if (!partRank.has(p)) newParts.push([mod,p.name]);
      p.cats.sort(rankSort(catRank,'ci'));
      for (const c of p.cats) {
        if (!catRank.has(c)) newGroups.push([mod,p.name,c.name]);
        c.items.sort((a,b) => (ranks.get(a.id)?.ei ?? Infinity) - (ranks.get(b.id)?.ei ?? Infinity) || 0);
      }
    }
    m.all = m.parts.flatMap(p => p.cats.flatMap(c => c.items));
  }
  const missing = [...ranks.keys()].filter(id => !seen.has(id));
  if (unknown.length || newParts.length || newGroups.length || missing.length) warn('Learning order editor review: ' + JSON.stringify({unlistedEntries:unknown,newParts,newGroups,missingReviewedEntries:missing}));
  return {tree, order:registry.moduleOrder.flatMap(mod => tree[mod]?.all || [])};
}
const LEARNING_ORDER_REGISTRY = {"schemaVersion":1,"moduleOrder":["algo","code","design","bagu","ai","syntax","plan"],"modules":[{"mod":"algo","parts":[{"partId":"part-fac7b79d2fa7bb92","currentPart":"线性结构","categories":[{"groupId":"group-6439e83dd77217a3","currentCategory":"哈希与计数","entryIds":["p-hash","1","49","128","nonlc-1-15","nonlc-1-16","own-algo-792-matching-subsequences"]},{"groupId":"group-3a9980e155c30d51","currentCategory":"双指针","entryIds":["p-twoptr","11","42","125","977","15","lc-face-extra-21","interview-3sum-multiplicity","611","283","75","nonlc-1-6","nonlc-5-0","88","nonlc-1-4","287"]},{"groupId":"group-76323aec57045c96","currentCategory":"滑动窗口","entryIds":["p-window","3","904","lc-face-extra-8","438","lc-face-extra-7","30","76","lc-face-extra-20","nonlc-1-11","nonlc-1-10","395"]},{"groupId":"group-5683cf4d664c5211","currentCategory":"前缀和与差分","entryIds":["p-prefix","560","862","nonlc-2-1","238"]},{"groupId":"group-b363beaf629aae14","currentCategory":"数组 / 矩阵 / 字符串模拟","entryIds":["p-array","415","43","8","nonlc-5-1","nonlc-5-5","151","165","nonlc-5-4","lc-face-extra-26","189","31","41","442","array-left-smaller-right-greater","73","54","48","240","498"]},{"groupId":"group-3c7b08823418ed5d","currentCategory":"链表","entryIds":["p-list","206","92","24","25","143","141","142","19","234","160","21","23","148","2","83","82","138","nonlc-1-17","nonlc-1-18"]}]},{"partId":"part-c102a7c48b113d4a","currentPart":"栈 · 堆 · 二分","categories":[{"groupId":"group-f3361ac4b0329c22","currentCategory":"栈 / 单调栈 / 单调队列","entryIds":["p-stack","239","739","84","20","priority-brackets","lc-face-extra-0","lc-face-extra-1","lc-face-extra-2","lc-face-extra-3","lc-face-extra-4","lc-face-extra-5","394","string-compression-stack","227","lc-face-extra-14","lc-face-extra-15"]},{"groupId":"group-8d0eaf90c1e679c5","currentCategory":"堆 · 排序 · Top K","entryIds":["p-heap","sort-basic","sort-quick","sort-merge","sort-heap","nonlc-1-5","215","nonlc-1-14","nonlc-1-3","347","295","merge-n-sorted-arrays"]},{"groupId":"group-9dd2b2c62c134c75","currentCategory":"二分查找","entryIds":["p-bsearch","704","35","34","33","153","81","69","lc-face-extra-12","lc-face-extra-18","nonlc-1-7","74","378","4","162","540"]}]},{"partId":"part-3407d1e0d37e6cde","currentPart":"树 · 回溯 · 图","categories":[{"groupId":"group-ec621bb472d7a3db","currentCategory":"二叉树","entryIds":["p-tree","94","tree-three-traversals-iterative","lc-face-extra-17","nonlc-1-12","102","103","199","lc-face-extra-16","104","110","543","124","687","112","lc-face-extra-9","437","98","230","108","105","interview-pre-in-post","nonlc-2-0","114","226","814","101","236"]},{"groupId":"group-a1e2aa32cf39e9cb","currentCategory":"回溯","entryIds":["p-backtrack","78","39","40","17","46","47","131","lc-face-extra-24","51","79","22","lc-face-extra-6","byte-largest-less-than-n"]},{"groupId":"group-7ffdc98e60db4212","currentCategory":"图与搜索（BFS/DFS/拓扑/并查集）","entryIds":["p-graph","200","994","934","grid-shortest-path-8-dir","207","2359","lc-face-extra-19"]}]},{"partId":"part-ec473e7ba9e717d8","currentPart":"贪心与动态规划","categories":[{"groupId":"group-4e23b9e370d80263","currentCategory":"贪心与区间","entryIds":["p-greedy","56","interview-uncovered-closed-intervals","253","228","1221","763","55","45","121","lc-face-extra-22","nonlc-1-0"]},{"groupId":"group-ea07ce68befc6458","currentCategory":"动态规划","entryIds":["p-dp","70","198","53","152","32","300","maximum-sum-increasing-subsequence","118","lc-face-extra-13","322","279","139","416","knapsack-01-template","pdd-reading-max-knowledge","62","63","64","221","5","1143","72","longest-common-substring"]}]},{"partId":"part-c52df6ff9b462da9","currentPart":"设计 · 数学 · 专项","categories":[{"groupId":"group-b9a63db721ee99cd","currentCategory":"设计题（LRU/LFU/Trie/栈队列）","entryIds":["p-design","146","460","nonlc-4-0","nonlc-4-2","155","225","lc-face-extra-23","nonlc-5-3","208","nonlc-1-9","nonlc-4-1"]},{"groupId":"group-2ac4fd4dce4a0f8c","currentCategory":"数学 · 位运算 · 随机 · 几何","entryIds":["p-math","50","lc-face-extra-25","byte-smallest-n","136","169","191","offer61","440","lc-face-extra-11","lc-face-extra-10","nonlc-1-1","nonlc-1-2","josephus","nonlc-5-2","game-100-pingpong","470","384","interview-biased-bit-uniform","interview-weighted-random","interview-count-squares","interview-point-in-polygon","nonlc-3-0","nonlc-1-8"]},{"groupId":"group-dbac040905f3b1d6","currentCategory":"专项手撕（并发 / ML）","entryIds":["p-special","ml-mha","ml-cross-entropy","ml-kl-divergence","ml-auc","concurrency-ten-threads-order","concurrency-matrix-rows","1226","nonlc-1-13","singleton-dcl"]}]},{"partId":"part-f47108ad1c84fcf2","currentPart":"算法练习","categories":[{"groupId":"group-294225f7f20775bd","currentCategory":"补充算法合同","entryIds":["own-algo-gap-132-pattern","own-algo-gap-augmented-avl","own-algo-gap-balanced-trees","own-algo-gap-bst-greater-tree","own-algo-gap-chess-reachability","own-algo-gap-closest-points","own-algo-gap-collinear-points","own-algo-gap-decimal-parser","own-algo-gap-digit-decoding","own-algo-gap-dijkstra","own-algo-gap-distinct-subsequences","own-algo-gap-equal-runs","own-algo-gap-euler-itinerary","own-algo-gap-exam-state-variants","own-algo-gap-exclusive-time","own-algo-gap-expression-parser","own-algo-gap-flat-record-tree","own-algo-gap-frog-energy","own-algo-gap-incremental-parsers","own-algo-gap-int256","own-algo-gap-intellectual-clarification","own-algo-gap-kth-list-node","own-algo-gap-list-partition","own-algo-gap-mcts","own-algo-gap-multi-pattern-replacement","own-algo-gap-path-normalization","own-algo-gap-polygon-perimeter","own-algo-gap-random-set","own-algo-gap-remove-duplicate-letters","own-algo-gap-reservoir","own-algo-gap-skip-list","own-algo-gap-sudoku-validation","own-algo-gap-tree-subtree","own-algo-gap-unsorted-segment","own-algo-gap-validate-stack","own-algo-gap-zero-flip-window"]},{"groupId":"group-5e8f66472456c0c0","currentCategory":"阅读与自测","entryIds":["own-algo-manual-guide"]},{"groupId":"group-8995901bccf083fe","currentCategory":"跨册场景补充","entryIds":["own-practice-spatial-grid-aggregation"]}]}]},{"mod":"code","parts":[{"partId":"part-a123214e4a37323b","currentPart":"代码手撕","categories":[{"groupId":"group-ad06dfad5f444515","currentCategory":"总览","entryIds":["handwrite-45"]},{"groupId":"group-0c6e68c846391fd7","currentCategory":"基础手写与数据结构","entryIds":["handwrite-46","handwrite-47","handwrite-48"]},{"groupId":"group-e97f7ecc5226101f","currentCategory":"并发与任务调度","entryIds":["handwrite-56","handwrite-57","handwrite-58","handwrite-59"]},{"groupId":"group-deac8f69e0eb9d02","currentCategory":"设计模式","entryIds":["handwrite-49","handwrite-50","handwrite-51","handwrite-52","handwrite-53","handwrite-54","handwrite-55"]},{"groupId":"group-7a982883a0181aa3","currentCategory":"Redis 与分布式","entryIds":["handwrite-60","handwrite-61","handwrite-62","handwrite-63"]},{"groupId":"group-65238f7b2badb6c2","currentCategory":"MQ 可靠性与削峰","entryIds":["handwrite-64","handwrite-65"]},{"groupId":"group-baea01de37a6c1cc","currentCategory":"项目定制系统设计","entryIds":["handwrite-66","handwrite-67","handwrite-68","handwrite-69","handwrite-70"]},{"groupId":"group-9e1ac3b6a73d4bec","currentCategory":"语言与解析实现","entryIds":["own-algo-gap-frame-instruction","own-algo-gap-ordered-index-services"]}]},{"partId":"part-f12fba64a6299cba","currentPart":"SQL 与数据库","categories":[{"groupId":"group-afb21056a2447d7e","currentCategory":"SQL 总览","entryIds":["database-71"]},{"groupId":"group-42a3d09d9acf98a4","currentCategory":"SQL 基础与统计","entryIds":["pattern-sql-query","database-72","database-73","database-74","database-75","database-76","database-77","database-78","database-79"]},{"groupId":"group-d66844ed75aadaf7","currentCategory":"索引与查询优化","entryIds":["pattern-index-optimization","database-80","database-81","database-82","database-83","database-84","database-85","database-86"]},{"groupId":"group-484582e96fafa99e","currentCategory":"事务、锁与日志","entryIds":["pattern-transaction-ha","database-87","database-88","database-89","database-90"]},{"groupId":"group-bc8393ffb4b27e6c","currentCategory":"高可用与分库分表","entryIds":["database-91","database-92","database-93","database-94"]},{"groupId":"group-1687557d1fba8aaf","currentCategory":"项目表设计","entryIds":["database-95","database-96","database-97","database-98"]}]},{"partId":"part-5e2428a91ccaf0b8","currentPart":"面经问答","categories":[{"groupId":"group-c5d459e21cba5ddb","currentCategory":"面经 · 场景手撕","entryIds":["hwqa-1","hwqa-2","hwqa-3"]},{"groupId":"group-387612af9eb054a5","currentCategory":"面经 · SQL 手撕","entryIds":["dbqa-1","dbqa-2","dbqa-3","dbqa-4"]}]}]},{"mod":"design","parts":[{"partId":"part-d8f92a7fee29ec99","currentPart":"架构场景 35 题","categories":[{"groupId":"group-976d9aae8988214e","currentCategory":"答题框架","entryIds":["scenario-design-framework"]},{"groupId":"group-01407bef7537019f","currentCategory":"场景题型模板","entryIds":["pattern-scenario-highconcurrency","pattern-cache-consistency","pattern-async-schedule","pattern-bigdata-file","pattern-distributed-foundation","pattern-ai-rag"]},{"groupId":"group-cc79b029e1ceaf01","currentCategory":"缓存、存储与 ID","entryIds":["scenario-redis-mysql-consistency","scenario-redis-outage","scenario-local-cache","scenario-distributed-lock","scenario-unique-id","scenario-short-url"]},{"groupId":"group-9167cd6dc1ff610d","currentCategory":"高并发与交易","entryIds":["scenario-seckill-system","scenario-red-packet","scenario-single-machine-counter","scenario-distributed-rate-limit","scenario-order-timeout-close","scenario-delay-queue","scenario-qps-capacity-planning"]},{"groupId":"group-1c72cfee0ea34479","currentCategory":"平台与基础设施","entryIds":["scenario-distributed-scheduler","scenario-rpc-framework","scenario-message-queue","scenario-log-system","scenario-gray-release","scenario-service-prewarm","scenario-external-dependency-isolation","scenario-lan-distribute-500gb"]},{"groupId":"group-0bff25d886bb676c","currentCategory":"登录与安全","entryIds":["scenario-cross-site-sso","scenario-oauth-login","scenario-scan-login"]},{"groupId":"group-a223da2234873833","currentCategory":"海量数据","entryIds":["scenario-massive-topk","scenario-external-sort"]},{"groupId":"group-ba22cef99b3b6d09","currentCategory":"实时、内容与推送","entryIds":["scenario-realtime-music-ranking","scenario-hot-search","scenario-live-comment-system","scenario-feed-system","scenario-notification","scenario-nearby","scenario-search-recommendation","scenario-cdn"]}]},{"partId":"part-9db27acb26f555fa","currentPart":"专题精讲","categories":[{"groupId":"group-a0adb12f41b1320d","currentCategory":"系统设计方法论","entryIds":["doc-sd-scenarios","doc-sd-guide"]},{"groupId":"group-a41b5e2dbff825d8","currentCategory":"高可用项目精讲","entryIds":["doc-12","doc-28","doc-22","doc-23","doc-25","doc-13","doc-14","doc-15"]}]},{"partId":"part-9b69a01b5b8494f2","currentPart":"面经场景问答","categories":[{"groupId":"group-9b69a01b5b8494f2","currentCategory":"面经场景问答","entryIds":["sceneqa-1","sceneqa-2","sceneqa-3","sceneqa-4","sceneqa-5","sceneqa-6","sceneqa-7"]}]},{"partId":"part-2a7b0f66dec9568d","currentPart":"消息队列与异步系统","categories":[{"groupId":"group-d0a20425c7fd9b72","currentCategory":"身份、隔离与业务状态合同","entryIds":["own-mq-contracts"]},{"groupId":"group-1c8a46b12f933f47","currentCategory":"持久责任、事务与未知结果","entryIds":["own-mq-reliability"]},{"groupId":"group-fdb1b256d58a96c0","currentCategory":"持久任务与分阶段执行","entryIds":["own-mq-tasks"]},{"groupId":"group-81158284dc8bf0b0","currentCategory":"容量、索引与流式数据场景","entryIds":["own-mq-operations"]},{"groupId":"group-0f42eca6730f35ad","currentCategory":"教学参考与完整代码","entryIds":["own-mq-noteweave","own-mq-cross-topic-reference","own-mq-source-guide"]}]},{"partId":"part-f994c20d33d77212","currentPart":"分布式系统工程","categories":[{"groupId":"group-a43e6c3542d8a0a4","currentCategory":"一致性与共识","entryIds":["own-distributed-ch01"]},{"groupId":"group-1ab8b195df52f33f","currentCategory":"服务发现与通信治理","entryIds":["own-distributed-ch02"]},{"groupId":"group-f8fe52755380ba7f","currentCategory":"分片与鉴权语义","entryIds":["own-distributed-ch03"]},{"groupId":"group-8fe7cf63c8f072df","currentCategory":"事务与资源协调","entryIds":["own-distributed-ch04"]},{"groupId":"group-54c204bcaec33a18","currentCategory":"消息产品与边界","entryIds":["own-distributed-ch05"]},{"groupId":"group-92f4a3491aaec63e","currentCategory":"准入、预算与期限","entryIds":["own-distributed-ch06"]},{"groupId":"group-287f844e4f7965f8","currentCategory":"升级与演进","entryIds":["own-distributed-ch07"]},{"groupId":"group-45f06daf553ef0d9","currentCategory":"业务资格与交易状态","entryIds":["own-distributed-ch08"]},{"groupId":"group-ea7187c3367db0fd","currentCategory":"流处理与数据合同","entryIds":["own-distributed-ch09"]},{"groupId":"group-9b82d6dda575845a","currentCategory":"集群、文件与多地域","entryIds":["own-distributed-ch10"]},{"groupId":"group-6a941821544a4cfb","currentCategory":"手册路线与故障验证","entryIds":["own-distributed-guide"]}]},{"partId":"part-89002aad888cf865","currentPart":"后端场景","categories":[{"groupId":"group-89002aad888cf865","currentCategory":"跨册场景补充","entryIds":["own-practice-approval-rule-selection","own-practice-authoritative-deadlines","own-practice-av-sync-latency","own-practice-client-server-timing","own-practice-cross-client-reconciliation","own-practice-driver-assistant-deadline","own-practice-event-time-billing","own-practice-exporter-last-contract","own-practice-git-agent-isolation","own-practice-latency-attribution","own-practice-lottery-user-prize-quota","own-practice-parking-occupancy","own-practice-permission-critical-path","own-practice-python-data-processing","own-practice-request-signing-replay","own-practice-source-guide"]}]},{"partId":"part-df0d753d02680e5b","currentPart":"代码手撕","categories":[{"groupId":"group-df0d753d02680e5b","currentCategory":"跨册场景补充","entryIds":["own-practice-gift-receipt-contract"]}]}]},{"mod":"bagu","parts":[{"partId":"part-185a289212ce13ce","currentPart":"Java 基础与工程实践","categories":[{"groupId":"group-73ea29b57537adf7","currentCategory":"语言、对象与类型契约","entryIds":["own-java-language"]},{"groupId":"group-6b94153447307bc9","currentCategory":"字符串与泛型","entryIds":["own-java-strings-generics"]},{"groupId":"group-096036c69185a662","currentCategory":"集合机制与并发使用契约","entryIds":["own-java-collections"]},{"groupId":"group-d103358373d0c6e8","currentCategory":"异常传播与资源收尾","entryIds":["own-java-exceptions"]},{"groupId":"group-330abae4f0a134a6","currentCategory":"I/O、协议与序列化","entryIds":["own-java-io"]},{"groupId":"group-bf4eff21dabc0c4a","currentCategory":"反射、Lombok 与扩展机制","entryIds":["own-java-runtime"]},{"groupId":"group-62a0e7e1a7141e4b","currentCategory":"现代 Java、跨语言与项目边界","entryIds":["own-java-modern"]}]},{"partId":"part-efe5df93e5a29c4e","currentPart":"Java 并发与 JUC","categories":[{"groupId":"group-11fc54b20e3e70bf","currentCategory":"并发正确性、生命周期与安全发布","entryIds":["own-juc-correctness"]},{"groupId":"group-3d2cf2235aac2e52","currentCategory":"锁、同步器与原子操作","entryIds":["own-juc-synchronizers"]},{"groupId":"group-c3b67d9d4e5bdded","currentCategory":"线程上下文与并发容器","entryIds":["own-juc-contexts"]},{"groupId":"group-93741b3e3eb0e0ca","currentCategory":"任务结果、取消与执行预算","entryIds":["own-juc-execution"]},{"groupId":"group-0203d4cfaf82a7cc","currentCategory":"顺序协作、队列与线程池手写","entryIds":["own-juc-coordination"]},{"groupId":"group-789c8868786be20b","currentCategory":"死锁、活性与验证","entryIds":["own-juc-diagnostics"]},{"groupId":"group-8f5d7bb1db6092c5","currentCategory":"并发系统设计与项目边界","entryIds":["own-juc-systems"]}]},{"partId":"part-720e6bbda04d5a76","currentPart":"Java 与 JVM","categories":[{"groupId":"group-a900a524a84d117b","currentCategory":"JVM 运行机制与诊断","entryIds":["q-own-jvm-runtime","q-own-jvm-memory","q-own-jvm-reachability","q-own-jvm-collectors","q-own-jvm-diagnosis","q-own-jvm-practice","q-own-jvm-versions"]},{"groupId":"group-a5daa9e80dbf3da1","currentCategory":"JVM 阅读与实验资料","entryIds":["own-jvm-study-guide"]}]},{"partId":"part-2e90a09abd7c7929","currentPart":"数据库与缓存","categories":[{"groupId":"group-1ac811494137bf40","currentCategory":"MySQL","entryIds":["bg-mysql-3","bg-mysql-5","bg-mysql-1","bg-mysql-2","bg-mysql-4","bg-mysql-6","doc-08","doc-20"]},{"groupId":"group-711f3e00bfa3a164","currentCategory":"Redis","entryIds":["bg-redis-1","bg-redis-4","bg-redis-5","bg-redis-3","bg-redis-7","bg-redis-6","bg-redis-2","bg-redis-8","doc-09","doc-21","own-redis-reading-guide"]},{"groupId":"group-e4f3e886ccdfa805","currentCategory":"Elasticsearch","entryIds":["bg-elasticsearch-1","bg-elasticsearch-2","bg-elasticsearch-3","bg-elasticsearch-4","bg-elasticsearch-5","own-es-reading-guide"]},{"groupId":"group-22137a5e31e6c131","currentCategory":"MySQL 手册 · Server、存储引擎与完整读写链路","entryIds":["own-mysql-ch01"]},{"groupId":"group-005a632ac3066a08","currentCategory":"MySQL 手册 · LSM、PostgreSQL 与分析、文档存储比较","entryIds":["own-mysql-ch04"]},{"groupId":"group-a856a6018ca72a4d","currentCategory":"MySQL 手册 · 范式 关系 约束与业务身份","entryIds":["own-mysql-ch05"]},{"groupId":"group-d695b1c588058744","currentCategory":"MySQL 手册 · JOIN 聚合 窗口与集合差异","entryIds":["own-mysql-ch06"]},{"groupId":"group-d979db63466df834","currentCategory":"MySQL 手册 · 金额 时间 字符串 JSON 与大文本","entryIds":["own-mysql-ch07"]},{"groupId":"group-4dbd130c6e956998","currentCategory":"MySQL 手册 · 历史版本 报表与物化读模型","entryIds":["own-mysql-ch08"]},{"groupId":"group-bc13afd8d54687df","currentCategory":"MySQL 手册 · 会话 工单 任务和资产的持久化模型","entryIds":["own-mysql-ch09"]},{"groupId":"group-cd2f2f33ad537a42","currentCategory":"MySQL 手册 · 索引结构、聚簇与覆盖","entryIds":["own-mysql-ch10"]},{"groupId":"group-0969978bec7f7603","currentCategory":"MySQL 手册 · 从真实查询分布推导索引","entryIds":["own-mysql-ch13"]},{"groupId":"group-4b04669cadc39262","currentCategory":"MySQL 手册 · EXPLAIN、执行器与优化器选择","entryIds":["own-mysql-ch14"]},{"groupId":"group-40c44e4cfb14afba","currentCategory":"MySQL 手册 · 大表索引变更、批量写入与容量","entryIds":["own-mysql-ch17"]},{"groupId":"group-653b490b6c4eacc2","currentCategory":"MySQL 手册 · 事务契约：ACID、原子提交与业务一致性","entryIds":["own-mysql-ch18"]},{"groupId":"group-fe8dda94eaed29d5","currentCategory":"MySQL 手册 · 事务锁 意向锁 MDL 与内部闩","entryIds":["own-mysql-ch21"]},{"groupId":"group-141493e4e2da6adc","currentCategory":"MySQL 手册 · 实际访问路径决定锁范围","entryIds":["own-mysql-ch22"]},{"groupId":"group-a5dd4a7c14660041","currentCategory":"MySQL 手册 · 死锁检测 等待与完整事务重试","entryIds":["own-mysql-ch23"]},{"groupId":"group-0ebebb7989217d26","currentCategory":"MySQL 手册 · 版本 CAS 热点行与并发状态机","entryIds":["own-mysql-ch24"]},{"groupId":"group-58979725104a58e5","currentCategory":"MySQL 手册 · 三类日志、提交协议与持久化","entryIds":["own-mysql-ch25"]},{"groupId":"group-fda192ee346767c2","currentCategory":"MySQL 手册 · 崩溃恢复、备份与重放幂等","entryIds":["own-mysql-ch26"]},{"groupId":"group-f60c9098fc10c9ec","currentCategory":"MySQL 手册 · 教学 WAL 格式与大记录分片","entryIds":["own-mysql-ch27"]},{"groupId":"group-02fc3ea0f8e809ef","currentCategory":"MySQL 手册 · CDC 快照增量合并与派生索引对账","entryIds":["own-mysql-ch30"]},{"groupId":"group-1d9e86819b862601","currentCategory":"MySQL 手册 · 扩容 重分片与不停服迁移","entryIds":["own-mysql-ch32"]},{"groupId":"group-1b84137535c3cea3","currentCategory":"MySQL 手册 · JDBC、连接池与参数化 SQL","entryIds":["own-mysql-ch34"]},{"groupId":"group-8122bc89aa18331c","currentCategory":"MySQL 手册 · Spring 事务、ORM 与代理边界","entryIds":["own-mysql-ch35"]},{"groupId":"group-232de8b325466262","currentCategory":"MySQL 手册 · 数据库、缓存、消息与外部动作","entryIds":["own-mysql-ch36"]},{"groupId":"group-f54661d3cca6fa83","currentCategory":"MySQL 手册 · DSL 序列化与数组合并","entryIds":["own-mysql-ch37"]},{"groupId":"group-9900ff074fcb20a2","currentCategory":"MySQL 教学参考","entryIds":["own-mysql-guide"]}]},{"partId":"part-17c28e64f7b56412","currentPart":"Spring 与 Java 服务端","categories":[{"groupId":"group-2394de0c28122a9f","currentCategory":"容器、依赖注入与生命周期","entryIds":["own-spring-container"]},{"groupId":"group-b4bcc4d03590fcf8","currentCategory":"Boot 启动、配置与运行边界","entryIds":["own-spring-boot"]},{"groupId":"group-162ecdce5262cc8a","currentCategory":"Servlet、MVC 与安全入口","entryIds":["own-spring-mvc"]},{"groupId":"group-fb2b666fd28d1ca5","currentCategory":"权限注解与工具执行边界","entryIds":["own-spring-advice"]},{"groupId":"group-751899a9ea43886e","currentCategory":"JDBC 与 MyBatis 的执行契约","entryIds":["own-spring-persistence"]},{"groupId":"group-53dc3b88d38ff07d","currentCategory":"Spring 事务与失败边界","entryIds":["own-spring-transactions"]},{"groupId":"group-45b344c614362d8f","currentCategory":"响应式、异步与上下文","entryIds":["own-spring-async"]}]},{"partId":"part-2a6b72acc1bff153","currentPart":"消息队列","categories":[{"groupId":"group-49d16da8997db654","currentCategory":"Kafka","entryIds":["bg-kafka-1","bg-kafka-2","bg-kafka-3","bg-kafka-4","bg-kafka-5","doc-10"]},{"groupId":"group-87a757ab93b1855a","currentCategory":"RabbitMQ","entryIds":["bg-rabbitmq-1","bg-rabbitmq-2","bg-rabbitmq-3","bg-rabbitmq-4","bg-rabbitmq-5"]},{"groupId":"group-3e1164f97cff9c21","currentCategory":"RocketMQ","entryIds":["bg-rocketmq-1","bg-rocketmq-2","bg-rocketmq-3","bg-rocketmq-4"]}]},{"partId":"part-f4d1fd98c6273aa3","currentPart":"消息队列与异步系统","categories":[{"groupId":"group-f4d1fd98c6273aa3","currentCategory":"Kafka 消费位置与所有权","entryIds":["own-mq-kafka"]}]},{"partId":"part-060273b73e763545","currentPart":"计算机网络","categories":[{"groupId":"group-863450e550033de8","currentCategory":"TCP、IP 与端到端传输","entryIds":["own-network-transport"]},{"groupId":"group-dab6d443d9c92ac3","currentCategory":"HTTP、TLS 与请求全链路","entryIds":["own-network-http"]},{"groupId":"group-b1620e148fd7075d","currentCategory":"Web 安全、SSE 与实时媒体","entryIds":["own-network-web"]},{"groupId":"group-8811e0332cf24179","currentCategory":"教学程序与阅读参考","entryIds":["own-network-source-guide"]}]},{"partId":"part-8eb4af87b9f0bd4d","currentPart":"操作系统与 Linux","categories":[{"groupId":"group-769fe2115bb1f65e","currentCategory":"系统全景与约束","entryIds":["own-os-foundations"]},{"groupId":"group-86aa2285d041a7b1","currentCategory":"保护边界与内核入口","entryIds":["own-os-protection"]},{"groupId":"group-74026277e62af930","currentCategory":"硬件缓存与执行模型","entryIds":["own-os-hardware"]},{"groupId":"group-6390d6d3d0e97331","currentCategory":"执行单元与进程生命周期","entryIds":["own-os-process"]},{"groupId":"group-5a8975c9a89e7beb","currentCategory":"CPU调度与容量","entryIds":["own-os-scheduling"]},{"groupId":"group-ec2e83c0e7c8558e","currentCategory":"虚拟内存与分配","entryIds":["own-os-memory"]},{"groupId":"group-1020bc2bc67ed11f","currentCategory":"文件描述符与持久存储","entryIds":["own-os-files"]},{"groupId":"group-28cdf150921d59fb","currentCategory":"就绪与等待机制","entryIds":["own-os-io"]},{"groupId":"group-6f75429795e07ad6","currentCategory":"同步与跨进程协议","entryIds":["own-os-ipc"]},{"groupId":"group-6c1a294ea4074f3c","currentCategory":"Linux诊断证据","entryIds":["own-os-diagnostics"]},{"groupId":"group-21271c35faf0f28c","currentCategory":"容器与部署边界","entryIds":["own-os-containers"]},{"groupId":"group-d63871f51ea6444b","currentCategory":"Java进程编排与实验","entryIds":["own-os-java-process"]},{"groupId":"group-9a917612a3735835","currentCategory":"Agent受控执行","entryIds":["own-os-sandbox"]},{"groupId":"group-8cc92c714bf590ba","currentCategory":"系统设计与生命周期","entryIds":["own-os-design"]}]},{"partId":"part-5257027f559576df","currentPart":"分布式与排障","categories":[{"groupId":"group-778b109f454ff003","currentCategory":"分布式","entryIds":["bg-分布式-1","bg-分布式-2","bg-分布式-3","bg-分布式-4","bg-分布式-5","bg-分布式-6","bg-分布式-7"]},{"groupId":"group-9fec4f453426585b","currentCategory":"线上排障","entryIds":["bg-线上排障-1","bg-线上排障-2"]}]}]},{"mod":"ai","parts":[{"partId":"part-3683811dd4e5b484","currentPart":"AI 八股","categories":[{"groupId":"group-5b583ae6628e3b2a","currentCategory":"AI · Agent","entryIds":["ai-agent-1","ai-agent-2","ai-agent-3","ai-agent-4","ai-agent-7","ai-agent-8","ai-agent-5","ai-agent-9","ai-agent-6"]},{"groupId":"group-41d2d389a2bd7337","currentCategory":"AI · RAG","entryIds":["ai-rag-1","ai-rag-2","ai-rag-3","ai-rag-4","ai-rag-8","ai-rag-7","ai-rag-5","ai-rag-10","ai-rag-6","ai-rag-11","ai-rag-9"]},{"groupId":"group-2403231efbaedb6c","currentCategory":"AI · 上下文工程","entryIds":["ai-上下文工程-1","ai-上下文工程-2","ai-上下文工程-3","ai-上下文工程-4","ai-上下文工程-5","ai-上下文工程-6","ai-上下文工程-7"]},{"groupId":"group-8fed5f6c80acfbc4","currentCategory":"AI · 模型与评测","entryIds":["ai-模型与评测-1","ai-模型与评测-2","ai-模型与评测-3","ai-模型与评测-4","ai-模型与评测-5","ai-模型与评测-6","ai-模型与评测-7","ai-模型与评测-8"]}]},{"partId":"part-2c0c165d655b1e76","currentPart":"RAG 检索与工作流","categories":[{"groupId":"group-d515115f159d390b","currentCategory":"资料接入、结构切分与增量发布","entryIds":["own-rag-ingestion"]},{"groupId":"group-20704297cbb528b5","currentCategory":"词法、表示与近邻索引","entryIds":["own-rag-retrieval"]},{"groupId":"group-ef0c6fffbbc3d667","currentCategory":"向量服务与版本化数据合同","entryIds":["own-rag-stores"]},{"groupId":"group-2137e398168278ff","currentCategory":"查询计划、融合与重排合同","entryIds":["own-rag-fusion"]},{"groupId":"group-316a73ed164036d6","currentCategory":"证据、图关系与评价合同","entryIds":["own-rag-evidence"]},{"groupId":"group-3df0055e2bee9b04","currentCategory":"任务检索与项目口径","entryIds":["own-rag-workflow"]},{"groupId":"group-e618e4a52c00df08","currentCategory":"服务预算、容量与行业场景","entryIds":["own-rag-service"]},{"groupId":"group-bdcbad0b9b467eb1","currentCategory":"教学参考与验证边界","entryIds":["own-rag-source-guide"]}]},{"partId":"part-fe033963d8dee073","currentPart":"工具与 MCP 工程","categories":[{"groupId":"group-79b8cf18fb530421","currentCategory":"MCP 协议、传输与接入","entryIds":["own-tools-protocol"]},{"groupId":"group-a94d5fbe41ea89b5","currentCategory":"MCP 发现、授权与版本治理","entryIds":["own-tools-governance"]},{"groupId":"group-4ebc6d10d8031737","currentCategory":"工具执行、错误与恢复","entryIds":["own-tools-execution"]},{"groupId":"group-21025754f5fc93e9","currentCategory":"并行执行与结果治理","entryIds":["own-tools-parallel"]},{"groupId":"group-0bc0247b6d0119eb","currentCategory":"数据库工具的查询合同","entryIds":["own-tools-database"]},{"groupId":"group-f918d1e58bd08262","currentCategory":"Skill 发布与运行边界","entryIds":["own-tools-skill"]},{"groupId":"group-648ffb28342c1428","currentCategory":"实现参考与验证边界","entryIds":["own-tools-guide","own-tools-projects"]}]},{"partId":"part-3e8fa4cfe0a649e6","currentPart":"Memory 与上下文工程","categories":[{"groupId":"group-38af810a8b6d4066","currentCategory":"上下文推荐与多模态证据","entryIds":["own-memory-context"]},{"groupId":"group-b7ac17794a3b24ef","currentCategory":"记忆治理的边界与验证","entryIds":["own-memory-governance"]},{"groupId":"group-fe0ef450a16952a8","currentCategory":"NoteWeave 记忆与上下文实现","entryIds":["own-memory-project"]},{"groupId":"group-dbea40fe5da27c65","currentCategory":"实现参考与验证边界","entryIds":["own-memory-guide"]}]},{"partId":"part-3cf3fe3d5d787bc2","currentPart":"Agent Runtime 工程合同","categories":[{"groupId":"group-a10c8b754718c5f6","currentCategory":"状态、编排与可验证交付","entryIds":["own-runtime-noteweave","own-runtime-usage","own-runtime-json-diff","own-runtime-dsl","own-runtime-code-validator","own-runtime-api-log-cli","own-runtime-alarm-log","own-runtime-incident-workflow","own-runtime-saas-workflow","own-runtime-weekly-report","own-runtime-resume-feedback","own-runtime-moderation","own-runtime-video-provider","own-runtime-a2a"]},{"groupId":"group-f080fe09a08de9c1","currentCategory":"教学参考与验证边界","entryIds":["own-runtime-domain-designs","own-runtime-guide"]}]},{"partId":"part-69e3ae3c9bd2cdb0","currentPart":"AI 项目精讲","categories":[{"groupId":"group-69e3ae3c9bd2cdb0","currentCategory":"Agent 项目表达","entryIds":["doc-19","doc-16","doc-17","doc-18","doc-29","doc-07"]}]},{"partId":"part-72302fcd62367701","currentPart":"分布式系统工程","categories":[{"groupId":"group-0bd5be64b5304b2a","currentCategory":"持久执行与端云协作","entryIds":["own-distributed-ch11"]},{"groupId":"group-6c41e53850a42cdf","currentCategory":"协作策略切换","entryIds":["own-distributed-ch12"]},{"groupId":"group-1f0ff33eb02c41ef","currentCategory":"入口安全与工具场景","entryIds":["own-distributed-ch13"]},{"groupId":"group-0cee9085d5c8e36a","currentCategory":"训练推理基础设施","entryIds":["own-distributed-ch14"]}]},{"partId":"part-f952335a14aef10e","currentPart":"AI 工程","categories":[{"groupId":"group-f952335a14aef10e","currentCategory":"跨册场景补充","entryIds":["own-practice-analysis-artifact-gates","own-practice-credit-decision-contract","own-practice-ocr-permission-normalization","own-practice-purchase-preflight","own-practice-risk-model-evidence","own-practice-scheduler-evidence","own-practice-serving-feature-drift","own-practice-state-machine-evolution"]}]},{"partId":"part-d03945f914322b8e","currentPart":"代码手撕","categories":[{"groupId":"group-d03945f914322b8e","currentCategory":"跨册场景补充","entryIds":["own-practice-purchase-preflight-parser"]}]},{"partId":"part-ffd5ef7963589cbf","currentPart":"AI 模型与训练原理","categories":[{"groupId":"group-e848550ecd555af2","currentCategory":"模型表示与数值基础","entryIds":["own-theory-fundamentals"]},{"groupId":"group-e78553608f698967","currentCategory":"机器学习与手写数学","entryIds":["own-theory-math"]},{"groupId":"group-58ac3963cd1e8435","currentCategory":"模型结构与版本边界","entryIds":["own-theory-architectures"]},{"groupId":"group-e69bac28e8617c98","currentCategory":"训练数据与目标设计","entryIds":["own-theory-data"]},{"groupId":"group-ecd588f2b4d1fc1c","currentCategory":"强化学习数学与估计","entryIds":["own-theory-rl-foundations"]},{"groupId":"group-db3c7773f8167665","currentCategory":"对齐变体与 Agent 学习","entryIds":["own-theory-rl-advanced"]},{"groupId":"group-2262321ccac9ba82","currentCategory":"推理服务与解码","entryIds":["own-theory-serving"]},{"groupId":"group-67f05e67c1a03b38","currentCategory":"GPU 执行与算子","entryIds":["own-theory-kernels"]},{"groupId":"group-0f10708ac7386b1c","currentCategory":"分布式训练与资源估算","entryIds":["own-theory-distributed"]},{"groupId":"group-5ebbffb1b1bd6821","currentCategory":"视觉编码与跨模态对齐","entryIds":["own-theory-vision"]},{"groupId":"group-51b8a7b7ae3cb527","currentCategory":"音频理解与生成","entryIds":["own-theory-audio"]},{"groupId":"group-7c5ca2a9397c93d9","currentCategory":"图像、视频与三维生成","entryIds":["own-theory-generation"]},{"groupId":"group-d3fe9c3093e32a94","currentCategory":"多模态任务与资产工程","entryIds":["own-theory-media"]},{"groupId":"group-1356803f2ac81d27","currentCategory":"具身智能与时序交互","entryIds":["own-theory-embodied"]},{"groupId":"group-0a51aec6767b0afc","currentCategory":"实现参考与验证边界","entryIds":["own-theory-alignment-guide","own-theory-inference-guide","own-theory-model-principles-guide","own-theory-multimodal-guide","own-theory-training-guide"]}]}]},{"mod":"syntax","parts":[{"partId":"part-e19be21b593e5c35","currentPart":"Java 语法","categories":[{"groupId":"group-11b0fa526b82c500","currentCategory":"容器与常用 API","entryIds":["syntax-1","syntax-2","syntax-3","syntax-4","syntax-5","syntax-6","syntax-7","syntax-8","syntax-9","syntax-10","syntax-11","syntax-12","syntax-13","syntax-14","syntax-15"]},{"groupId":"group-c6995b0b334b24f7","currentCategory":"LC 语法 · ACM 输入输出","entryIds":["syntax-16","syntax-17","syntax-18","syntax-19","syntax-20","syntax-21","syntax-22","syntax-23","syntax-24","syntax-25","syntax-26","syntax-27","syntax-28","syntax-29","syntax-30","syntax-31","syntax-32","syntax-33","syntax-34","syntax-35","syntax-36"]},{"groupId":"group-ca0a036f9da081eb","currentCategory":"Stream 语法","entryIds":["syntax-37","syntax-38","syntax-39","syntax-40","syntax-41","syntax-42","syntax-43","syntax-44"]}]}]},{"mod":"plan","parts":[{"partId":"part-12f7c82105e80d57","currentPart":"准备方法","categories":[{"groupId":"group-49d2aaf4b19bbb5f","currentCategory":"四周冲刺规划","entryIds":["doc-02","doc-03","doc-04","doc-05","doc-06"]},{"groupId":"group-0fe6a9aead296925","currentCategory":"简历与项目包装","entryIds":["doc-01","doc-11","doc-27"]}]},{"partId":"part-564cc118eff840f6","currentPart":"面试问答","categories":[{"groupId":"group-d504b3afe0faee74","currentCategory":"日常与 AI 使用","entryIds":["plan-日常与ai使用-1","plan-日常与ai使用-2","plan-日常与ai使用-3","plan-日常与ai使用-4","plan-日常与ai使用-5"]},{"groupId":"group-f207e64f7bc94f47","currentCategory":"智力题","entryIds":["plan-智力题-1"]},{"groupId":"group-208e4c73b7e3658b","currentCategory":"智力与概率推理","entryIds":["own-practice-abstract-pieces","own-practice-alternating-coin","own-practice-banana-transfer","own-practice-binary-coding","own-practice-bulb-divisors","own-practice-candy-counting","own-practice-coverage-model","own-practice-employee-sampling","own-practice-fermi-aircraft","own-practice-gold-payments","own-practice-horse-top-four","own-practice-horse-top-three","own-practice-pirate-voting","own-practice-ring-walk","own-practice-shot-counting","own-practice-simultaneous-shooters","own-practice-slots-parity","own-practice-truth-lie","own-practice-two-eggs","own-practice-two-heap-nim","own-practice-water-bfs","own-practice-wolf-preferences"]}]},{"partId":"part-a410230f8afb9554","currentPart":"学习参考","categories":[{"groupId":"group-a410230f8afb9554","currentCategory":"完整来源变体","entryIds":["own-practice-probability-guide"]}]}]}]};
const learningView = buildLearningOrder(ENTRIES, LEARNING_ORDER_REGISTRY);
const TREE = learningView.tree;
const ORDER = learningView.order;
ORDER.forEach((e, i) => { e._o = i; });

const state = { mod: 'home', route: { view: 'home' }, filter: '', sfilter: '', open: new Set(store.get('iv8-open', [])), qaMode: store.get('iv8-qamode', 'lead'), mustOnly: false, curQ: -1 };


function priorityQuestionView(entry, registry) {
  const rule = registry?.records?.find(r=>r.entryId===entry.id);
  const ranks = new Map((rule?.order || []).map((key,index)=>[key,index]));
  const emphasis = new Set(rule?.emphasis || []);
  let block = -1, previousSub;
  const rows = (entry.items || []).map((item,canonicalIndex)=>{
    if(canonicalIndex===0 || item.sub!==previousSub) block++;
    previousSub=item.sub;
    const anchor=item.id || canonicalIndex, key=entry.id+'#'+anchor;
    return {item,canonicalIndex,anchor,key,originalNo:canonicalIndex+1,block,emphasis:emphasis.has(key)};
  });
  return rows.sort((a,b)=>a.block-b.block || (ranks.get(a.key)??Infinity)-(ranks.get(b.key)??Infinity) || a.canonicalIndex-b.canonicalIndex);
}
const PRIORITY_VIEW_REGISTRY = {"schemaVersion":1,"policy":"Editorial priority within existing chapters; source topic mentions are not exact question frequencies. Canonical identities and content unchanged.","records":[{"entryId":"bg-mysql-3","order":["bg-mysql-3#0","bg-mysql-3#1","bg-mysql-3#2","bg-mysql-3#3","bg-mysql-3#4","bg-mysql-3#5","bg-mysql-3#6"],"emphasis":["bg-mysql-3#3","bg-mysql-3#5"],"basis":["prerequisites","backend-agent-preparation"]},{"entryId":"bg-mysql-5","order":["bg-mysql-5#0","bg-mysql-5#1","bg-mysql-5#2","bg-mysql-5#4","bg-mysql-5#5","bg-mysql-5#3"],"emphasis":["bg-mysql-5#0","bg-mysql-5#1"],"basis":["prerequisites","backend-agent-preparation"]},{"entryId":"bg-mysql-1","order":["bg-mysql-1#0","bg-mysql-1#1","bg-mysql-1#2","bg-mysql-1#4","bg-mysql-1#3"],"emphasis":["bg-mysql-1#2","bg-mysql-1#4"],"basis":["prerequisites","backend-agent-preparation"]},{"entryId":"bg-mysql-2","order":["bg-mysql-2#0","bg-mysql-2#1","bg-mysql-2#3","bg-mysql-2#2"],"emphasis":["bg-mysql-2#0","bg-mysql-2#3"],"basis":["prerequisites","backend-agent-preparation"]},{"entryId":"bg-redis-1","order":["bg-redis-1#0","bg-redis-1#4","bg-redis-1#3","bg-redis-1#1","bg-redis-1#2"],"emphasis":["bg-redis-1#0","bg-redis-1#3"],"basis":["prerequisites","backend-agent-preparation"]},{"entryId":"bg-redis-4","order":["bg-redis-4#0","bg-redis-4#1","bg-redis-4#4","bg-redis-4#2","bg-redis-4#3"],"emphasis":["bg-redis-4#1"],"basis":["prerequisites","backend-agent-preparation"]},{"entryId":"bg-redis-5","order":["bg-redis-5#0","bg-redis-5#3","bg-redis-5#4","bg-redis-5#1","bg-redis-5#2","bg-redis-5#5"],"emphasis":["bg-redis-5#0","bg-redis-5#3"],"basis":["prerequisites","backend-agent-preparation"]},{"entryId":"bg-redis-3","order":["bg-redis-3#0","bg-redis-3#2","bg-redis-3#4","bg-redis-3#6","bg-redis-3#5","bg-redis-3#1","bg-redis-3#3"],"emphasis":["bg-redis-3#0","bg-redis-3#4"],"basis":["prerequisites","backend-agent-preparation"]},{"entryId":"bg-kafka-3","order":["bg-kafka-3#5","bg-kafka-3#2","bg-kafka-3#3","bg-kafka-3#0","bg-kafka-3#1","bg-kafka-3#4"],"emphasis":["bg-kafka-3#2","bg-kafka-3#3"],"basis":["prerequisites","backend-agent-preparation"]},{"entryId":"own-java-collections","order":["own-java-collections#q-own-java-collection-contracts","own-java-collections#q-own-java-hashmap-mechanism","own-java-collections#q-own-java-hashmap-resize","own-java-collections#q-own-java-concurrent-collections","own-java-collections#q-own-java-iteration-contracts"],"emphasis":["own-java-collections#q-own-java-hashmap-mechanism","own-java-collections#q-own-java-concurrent-collections"],"basis":["prerequisites","backend-agent-preparation"]},{"entryId":"own-juc-correctness","order":["own-juc-correctness#q-own-juc-thread-safety","own-juc-correctness#q-own-juc-concurrency-parallelism","own-juc-correctness#q-own-juc-lost-update","own-juc-correctness#q-own-juc-happens-before","own-juc-correctness#q-own-juc-volatile-final","own-juc-correctness#q-own-juc-thread-lifecycle","own-juc-correctness#q-own-juc-cooperative-interruption"],"emphasis":["own-juc-correctness#q-own-juc-happens-before","own-juc-correctness#q-own-juc-volatile-final"],"basis":["prerequisites","backend-agent-preparation"]},{"entryId":"own-juc-execution","order":["own-juc-execution#q-own-juc-task-failure-observation","own-juc-execution#q-own-juc-future-contracts","own-juc-execution#q-own-juc-stage-composition","own-juc-execution#q-own-juc-executor-termination","own-juc-execution#q-own-juc-shared-timeouts","own-juc-execution#q-own-juc-dependent-workflow"],"emphasis":["own-juc-execution#q-own-juc-task-failure-observation","own-juc-execution#q-own-juc-shared-timeouts"],"basis":["prerequisites","backend-agent-preparation"]},{"entryId":"own-spring-transactions","order":["own-spring-transactions#q-own-spring-transaction-resources","own-spring-transactions#q-own-spring-transaction-attributes","own-spring-transactions#q-own-spring-rollback-diagnostics","own-spring-transactions#q-own-spring-propagation","own-spring-transactions#q-own-spring-commit-outcomes"],"emphasis":["own-spring-transactions#q-own-spring-rollback-diagnostics"],"basis":["prerequisites","backend-agent-preparation"]},{"entryId":"ai-agent-1","order":["ai-agent-1#0","ai-agent-1#1","ai-agent-1#2","ai-agent-1#4","ai-agent-1#3"],"emphasis":["ai-agent-1#2"],"basis":["prerequisites","backend-agent-preparation"]},{"entryId":"ai-agent-2","order":["ai-agent-2#0","ai-agent-2#1","ai-agent-2#2","ai-agent-2#3","ai-agent-2#4","ai-agent-2#12","ai-agent-2#5","ai-agent-2#6","ai-agent-2#7","ai-agent-2#8","ai-agent-2#9","ai-agent-2#10","ai-agent-2#11"],"emphasis":["ai-agent-2#4","ai-agent-2#5"],"basis":["prerequisites","backend-agent-preparation"]},{"entryId":"ai-agent-3","order":["ai-agent-3#0","ai-agent-3#1","ai-agent-3#4","ai-agent-3#6","ai-agent-3#2","ai-agent-3#3","ai-agent-3#5"],"emphasis":["ai-agent-3#4","ai-agent-3#6"],"basis":["prerequisites","backend-agent-preparation"]},{"entryId":"ai-agent-4","order":["ai-agent-4#0","ai-agent-4#1","ai-agent-4#2","ai-agent-4#5","ai-agent-4#6","ai-agent-4#3","ai-agent-4#4"],"emphasis":["ai-agent-4#2","ai-agent-4#5"],"basis":["prerequisites","backend-agent-preparation"]},{"entryId":"ai-agent-5","order":["ai-agent-5#0","ai-agent-5#2","ai-agent-5#1","ai-agent-5#3","ai-agent-5#11","ai-agent-5#12","ai-agent-5#10","ai-agent-5#7","ai-agent-5#4","ai-agent-5#6","ai-agent-5#14","ai-agent-5#13","ai-agent-5#5","ai-agent-5#8","ai-agent-5#9"],"emphasis":["ai-agent-5#2","ai-agent-5#12","ai-agent-5#10"],"basis":["prerequisites","backend-agent-preparation"]},{"entryId":"ai-agent-8","order":["ai-agent-8#0","ai-agent-8#1","ai-agent-8#3","ai-agent-8#4","ai-agent-8#5","ai-agent-8#6","ai-agent-8#2"],"emphasis":["ai-agent-8#3","ai-agent-8#4"],"basis":["prerequisites","backend-agent-preparation"]},{"entryId":"ai-agent-9","order":["ai-agent-9#0","ai-agent-9#q-ai-agent-eval-run","ai-agent-9#q-ai-agent-eval-metrics","ai-agent-9#q-ai-agent-trajectory-contract","ai-agent-9#2"],"emphasis":["ai-agent-9#q-ai-agent-eval-run","ai-agent-9#q-ai-agent-eval-metrics"],"basis":["prerequisites","backend-agent-preparation"]},{"entryId":"ai-rag-1","order":["ai-rag-1#0","ai-rag-1#1","ai-rag-1#2","ai-rag-1#3","ai-rag-1#4"],"emphasis":["ai-rag-1#0","ai-rag-1#2"],"basis":["prerequisites","backend-agent-preparation"]},{"entryId":"ai-rag-2","order":["ai-rag-2#0","ai-rag-2#1","ai-rag-2#3","ai-rag-2#2"],"emphasis":["ai-rag-2#1"],"basis":["prerequisites","backend-agent-preparation"]},{"entryId":"ai-rag-8","order":["ai-rag-8#0","ai-rag-8#1","ai-rag-8#4","ai-rag-8#2","ai-rag-8#3","ai-rag-8#5"],"emphasis":["ai-rag-8#1","ai-rag-8#4"],"basis":["prerequisites","backend-agent-preparation"]},{"entryId":"own-tools-execution","order":["own-tools-execution#q-own-tools-error-contract","own-tools-execution#q-own-tools-unknown-recovery","own-tools-execution#q-own-tools-shared-budget","own-tools-execution#q-own-tools-model-timeout","own-tools-execution#q-own-tools-debounce-intent"],"emphasis":["own-tools-execution#q-own-tools-unknown-recovery"],"basis":["prerequisites","backend-agent-preparation"]},{"entryId":"ai-模型与评测-6","order":["ai-模型与评测-6#0","ai-模型与评测-6#2","ai-模型与评测-6#4","ai-模型与评测-6#5","ai-模型与评测-6#1","ai-模型与评测-6#3"],"emphasis":["ai-模型与评测-6#2","ai-模型与评测-6#4"],"basis":["prerequisites","backend-agent-preparation"]},{"entryId":"own-juc-synchronizers","order":[],"emphasis":["own-juc-synchronizers#q-own-juc-monitor-semantics"],"basis":["prerequisites","source-topic-mentions"]},{"entryId":"own-juc-coordination","order":["own-juc-coordination#q-own-juc-producer-consumer","own-juc-coordination#q-own-juc-closeable-ring","own-juc-coordination#q-own-juc-bounded-pool"],"emphasis":["own-juc-coordination#q-own-juc-bounded-pool"],"basis":["prerequisites","source-topic-mentions"]},{"entryId":"own-network-transport","order":[],"emphasis":["own-network-transport#q-own-network-handshake","own-network-transport#q-own-network-reliability"],"basis":["prerequisites","source-topic-mentions"]},{"entryId":"ai-rag-4","order":[],"emphasis":["ai-rag-4#2"],"basis":["prerequisites","source-topic-mentions"]}]};
const orderedQuestionView = e => priorityQuestionView(e, PRIORITY_VIEW_REGISTRY);
const priorityChip = key => PRIORITY_VIEW_REGISTRY.records.some(r=>r.emphasis.includes(key)) ? '<span class="cmp-tag priority-tag">重点</span>' : '';

;

/* Source: src/app/fragments.js */
/* ---------------- 通用片段 ---------------- */
const ICON = {
  ext: '<svg viewBox="0 0 24 24"><path d="M14 5h5v5M10 14 19 5M19 14v5H5V5h5"/></svg>',
  link: '<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  focus: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24"><path d="M16 4h4v4M4 20 20 4M20 16v4h-4M15 15l5 5M4 4l5 5"/></svg>',
  img: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m3 16 5-5 5 5 3-3 5 5"/><circle cx="15.5" cy="9" r="1.5"/></svg>',
};
const href = (e, q) => `#/e/${encodeURIComponent(e.id)}${q != null ? '/' + qAnchor(e.id, q) : ''}`;
const bullets = (items, ordered) => (items && items.length) ? `<${ordered ? 'ol' : 'ul'} class="bullets">${items.map((x) => `<li>${h(x)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>` : '';
const entryNum = (e) => {
  if (e.kind === 'algo') return String(e.number);
  if (e.kind === 'qa') return e.number;
  if (e.number === 0) return '总览';
  if (e.kind === 'scenario') return String(e.number).replace('场景 ', '#').replace('场景总纲', '总纲');
  if (e.kind === 'pattern') return '模板';
  if (e.kind === 'ptopic') return '专题';
  return typeof e.number === 'number' ? '' : String(e.number || '');
};

let secNo = 0;
function sec(title, body, opts = {}) {
  if (!body) return '';
  secNo += 1;
  const id = opts.id || `s-${secNo}`;
  return `<section class="sec" ${opts.attr || ''}><h2 class="sec-h" id="${id}"><span class="n">${pad2(secNo)}</span>${h(title)}${opts.aside ? `<span class="aside">${opts.aside}</span>` : ''}</h2>${body}</section>`;
}
const callout = (k, text, tone = '', raw = false) => text ? `<div class="callout ${tone}"><span class="k">${h(k)}</span><p>${raw ? text : h(text)}</p></div>` : '';
const fold = (title, body, open, note) => body ? `<details class="fold"${open ? ' open' : ''}><summary>${h(title)}${note ? `<span class="note">${h(note)}</span>` : ''}</summary><div class="fold-body md">${body}</div></details>` : '';

function crumbs(e) {
  const m = MOD[e.mod];
  return `<nav class="crumbs" style="${modColor(e.mod)}"><span class="mdot"></span><a href="#/m/${e.mod}">${h(m.full || m.name)}</a><span class="sep">/</span><span>${h(learnerLabel('part', e.part))}</span>${e.cat !== e.part ? `<span class="sep">/</span><span>${h(learnerLabel('cat', e.cat))}</span>` : ''}</nav>`;
}
function masteryCtl(key) {
  const s = statusOf(key);
  return `<div class="mastery"><span>掌握度</span><div class="seg" data-master="${h(key)}">
    <button type="button" data-s="0" class="${s === 0 ? 'on' : ''}">未学</button>
    <button type="button" data-s="1" class="${s === 1 ? 'on' : ''}">模糊</button>
    <button type="button" data-s="2" class="${s === 2 ? 'on' : ''}">掌握</button></div></div>`;
}
function pageHead(e, o = {}) {
  const num = o.num != null ? o.num : '';
  return `${crumbs(e)}
    <h1 class="page-title">${num ? `<span class="num">${h(num)}</span>` : ''}${h(o.title || e.title)}</h1>
    ${o.sub ? `<p class="page-sub">${o.sub}</p>` : ''}
    ${o.chips ? `<div class="meta">${o.chips}</div>` : ''}
    <div class="head-actions">${o.noMastery ? (o.left || '') : masteryCtl(e.progressKey || e.id)}<span class="grow"></span>${o.actions || ''}
      <button type="button" class="btn ghost" data-act="copy-link" title="复制本页链接">${ICON.link}链接</button>
      <button type="button" class="btn ghost" data-act="focus" title="专注模式（F）">${ICON.focus}专注</button></div>`;
}
function pager(e) {
  const list = TREE[e.mod].all;
  const i = list.indexOf(e);
  const prev = list[i - 1], next = list[i + 1];
  return `${e.kind!=='qa'&&e.readingNotesHtml ? '<section class="md sec">'+e.readingNotesHtml+'</section>' : ''}${e.kind!=='qa'&&e.supplementHtml ? `<div class="md sec">${e.supplementHtml}</div>` : ''}<nav class="pager">${prev ? `<a href="${href(prev)}"><span>← 上一条 · ${h(learnerLabel('cat', prev.cat))}</span><strong>${h(prev.title)}</strong></a>` : '<span class="ph"></span>'}
    ${next ? `<a class="next" href="${href(next)}"><span>${h(learnerLabel('cat', next.cat))} · 下一条 →</span><strong>${h(next.title)}</strong></a>` : '<span class="ph"></span>'}</nav>`;
}
function relatedLinks(list) {
  if (!list.length) return '';
  return `<div class="related">${list.map((x) => `<a href="${href(x)}"><span class="dot s${entryStatus(x)}"></span>${h((x.kind === 'algo' ? x.number + '. ' : '') + x.title)}</a>`).join('')}</div>`;
}
/* ---------------- 代码高亮：单遍分词，不会出现替换结果被二次替换 ---------------- */
const HL_KW = new Set('public private protected class static final abstract synchronized volatile transient return for while do if else new int long double float boolean char byte short void null true false this super throw throws try catch finally break continue extends implements interface enum instanceof package import switch case default assert native var record sealed permits yield local function then end elseif nil not and or'.split(' '));
const HL_TYPE = new Set('String StringBuilder StringBuffer Object List Map Set Deque Queue PriorityQueue ArrayList LinkedList HashMap LinkedHashMap TreeMap HashSet LinkedHashSet TreeSet ArrayDeque Arrays Math Integer Long Character Double Boolean Byte Short Float Collections Comparator Comparable Optional Stream Collectors IntStream TreeNode ListNode Node Thread Runnable Callable Future CompletableFuture ExecutorService Executors ThreadPoolExecutor TimeUnit CountDownLatch CyclicBarrier Semaphore ReentrantLock ReentrantReadWriteLock Condition Lock AtomicInteger AtomicLong AtomicReference AtomicBoolean LongAdder ConcurrentHashMap CopyOnWriteArrayList BlockingQueue ArrayBlockingQueue LinkedBlockingQueue DelayQueue ThreadLocal Iterator Iterable StringJoiner Objects System Exception RuntimeException InterruptedException IllegalArgumentException IllegalStateException Scanner BufferedReader InputStreamReader PrintWriter Random Entry'.split(' '));
const HL_SQL = new Set('SELECT FROM WHERE JOIN LEFT RIGHT INNER OUTER CROSS ON GROUP BY HAVING ORDER LIMIT OFFSET INSERT UPDATE DELETE CREATE TABLE INDEX PRIMARY KEY UNIQUE FOREIGN REFERENCES AND OR NOT AS WITH OVER PARTITION RANK DENSE_RANK ROW_NUMBER LAG LEAD DISTINCT INTO VALUES SET EXPLAIN ANALYZE COMMIT ROLLBACK TRANSACTION BEGIN START COUNT SUM AVG MAX MIN CASE WHEN THEN ELSE END UNION ALL EXISTS BETWEEN LIKE IN IS ASC DESC ALTER DROP TRUNCATE FORCE USING NULL DEFAULT AUTO_INCREMENT ENGINE CHARSET COLLATE VARCHAR CHAR INT BIGINT TINYINT TEXT DATETIME DATE TIMESTAMP DECIMAL JSON BLOB IF IFNULL COALESCE DATEDIFF DATE_SUB INTERVAL DAY FOR SHARE LOCK MODE SHOW STATUS'.split(' '));
function highlightCode(line, lang) {
  const isSql = lang === 'sql' || (!lang && /^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|WITH|EXPLAIN|BEGIN|COMMIT)\b/i.test(line));
  const commentRe = isSql ? /--|#(?=\s)/ : (lang === 'lua' ? /--/ : null);
  let out = '', i = 0;
  const n = line.length;
  const push = (cls, s) => { out += cls ? `<span class="${cls}">${escapeHtml(s)}</span>` : escapeHtml(s); };
  while (i < n) {
    const c = line[i];
    const rest = line.slice(i);
    if ((c === '/' && (line[i + 1] === '/' || line[i + 1] === '*')) || (commentRe && commentRe.test(rest) && rest.search(commentRe) === 0) || (c === '*' && /^\s*\*/.test(line) && line.slice(0, i).trim() === '')) {
      push('tok-comment', rest); break;
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < n && line[j] !== c) j += line[j] === '\\' ? 2 : 1;
      push('tok-string', line.slice(i, j + 1)); i = j + 1; continue;
    }
    if (c === '@' && /[A-Za-z]/.test(line[i + 1] || '')) {
      const m = rest.match(/^@\w+/); push('tok-anno', m[0]); i += m[0].length; continue;
    }
    if (/[0-9]/.test(c) && !/[\w$]/.test(line[i - 1] || '')) {
      const m = rest.match(/^(0x[0-9a-fA-F_]+|\d[\d_]*(\.\d+)?([eE][+-]?\d+)?[lLfFdD]?)/); push('tok-number', m[0]); i += m[0].length; continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      const m = rest.match(/^[\w$]+/); const w = m[0];
      let cls = '';
      if (isSql) cls = HL_SQL.has(w.toUpperCase()) ? 'tok-sql' : '';
      else if (HL_KW.has(w)) cls = 'tok-keyword';
      else if (HL_TYPE.has(w)) cls = 'tok-type';
      else if (/^[A-Z][A-Z0-9_]{2,}$/.test(w) && HL_SQL.has(w)) cls = 'tok-sql';
      push(cls, w); i += w.length; continue;
    }
    push('', c); i += 1;
  }
  return out || '&nbsp;';
}

/* ---------------- 代码块 ---------------- */
function codeLines(code, lang) {
  return String(code || '').replace(/\s+$/, '').split('\n').map((line, i) => `<div class="code-line"><span class="line-number">${i + 1}</span><span class="code-text">${highlightCode(line, lang)}</span></div>`).join('');
}
function codeCard(code, label, opts = {}) {
  return `<section class="code-card${opts.blind ? ' blind' : ''}" data-code="1"><div class="code-toolbar"><div class="toolbar-left"><span class="file-label">${h(label)}</span></div>
    <button type="button" data-act="blind" class="${opts.blind ? 'on' : ''}" title="遮住代码，先自己默写一遍">默写</button><button type="button" data-act="copy-code">复制</button></div>
    <div class="code-scroll"><code>${codeLines(code, opts.lang || (/.sql$/.test(label) ? 'sql' : ''))}</code></div>
    <div class="blind-cover"><strong>默写模式</strong><span>先在纸上 / IDE 里写一遍，再点击对照</span><button type="button" class="btn primary" data-act="unblind">显示代码</button></div></section>`;
}
// 把笔记里的 <pre class="md-pre"> 转成带行号高亮，并补上「默写 / 复制」
function hydrateCode(root) {
  // Plain imported <pre><code> blocks use the same bounded, copyable card as authored examples.
  $$('pre', root).forEach((pre) => {
    if (pre.closest('.code-card, .md-code-card')) return;
    const source = pre.textContent;
    const match = (pre.querySelector('code')?.className || '').match(/(?:language-|lang-)([a-z0-9_-]+)/i);
    const lang = match ? match[1].toLowerCase() : 'text';
    const extension = ({java:'java',sql:'sql',python:'py',javascript:'js',cpp:'cpp',go:'go'})[lang] || 'txt';
    const template = document.createElement('template');
    template.innerHTML = codeCard(source, 'example.' + extension, {lang});
    const card = template.content.firstElementChild;
    card._code = source;
    pre.replaceWith(card);
  });
  $$('.md-code-card', root).forEach((card) => {
    if (card.dataset.code) return;
    const pre = card.querySelector('.md-pre');
    if (!pre) return;
    card.dataset.code = '1';
    const code = pre.textContent;
    card._code = code;
    const lang = pre.dataset.lang || '';
    const scroll = pre.parentElement;
    pre.outerHTML = `<code>${codeLines(code, lang)}</code>`;
    const tb = card.querySelector('.code-toolbar');
    const oldBtn = tb && tb.querySelector('.md-copy');
    if (oldBtn) oldBtn.remove();
    if (tb) tb.insertAdjacentHTML('beforeend', `${lang === 'text' || lang === 'txt' ? '' : '<button type="button" data-act="blind" title="遮住代码，先自己默写一遍">默写</button>'}<button type="button" data-act="copy-code">复制</button>`);
    if (scroll) scroll.insertAdjacentHTML('afterend', '<div class="blind-cover"><strong>默写模式</strong><span>先自己写一遍，再点击对照</span><button type="button" class="btn primary" data-act="unblind">显示代码</button></div>');
  });
}

/* ---------------- 图解 ---------------- */
function vizBuild(key, p) {
  const tpl = VIZ_TPL[key] || VIZ_TPL.fallback;
  let built;
  try { built = tpl(p || {}); } catch (err) { built = VIZ_TPL.fallback(p || {}); }
  const motion = VIZ_MOTION[key];
  const inner = built.inner + (motion ? moverSvg(key, motion) : '');
  return `<figure class="viz" data-viz="${h(key)}"><div class="viz-head">图解 <span>${h(built.name || '思路示意')}</span>${motion ? '<span class="viz-anim">动态</span>' : ''}<button class="viz-replay" type="button">重播</button></div>
    ${SV(built.w, built.h, inner)}${built.cap ? `<figcaption>${h(built.cap)}</figcaption>` : ''}</figure>`;
}
// 手撕 / 数据库题复用算法演示或场景架构图
const DIAGRAM_ALIAS = {
  /* v13: face/nonlc reuse existing demos */
  'nonlc-1-5': ['trace', '排序 2'],
  'nonlc-5-5': ['trace', '43'],
  'nonlc-1-14': ['trace', '215'],
  'nonlc-5-2': ['trace', 'LCR / Offer'],
  'nonlc-1-12': ['trace', '145'],
  'handwrite-46': ['arch', 'scenario-massive-topk'],
  'handwrite-47': ['trace', '146'],
  'handwrite-60': ['arch', 'scenario-distributed-rate-limit'],
  'handwrite-61': ['arch', 'scenario-redis-mysql-consistency'],
  'handwrite-62': ['arch', 'scenario-distributed-lock'],
  'handwrite-63': ['arch', 'scenario-unique-id'],
  'database-90': ['arch', 'database-93'],
  'database-94': ['arch', 'scenario-order-timeout-close'],
};
function diagramFor(e) {
  const tkey = e.kind === 'algo' ? String(e.number) : e.id;
  if (TRACES[tkey] || TRACES[e.id]) return DG.renderAlgo(TRACES[tkey] ? tkey : e.id, TRACES[tkey] || TRACES[e.id]);
  if (ARCH[e.id]) return DG.renderArch(e.id, ARCH[e.id]);
  const al = DIAGRAM_ALIAS[e.id];
  if (al && al[0] === 'trace' && TRACES[al[1]]) return DG.renderAlgo(al[1], TRACES[al[1]]);
  if (al && al[0] === 'arch' && ARCH[al[1]]) return DG.renderArch(al[1], ARCH[al[1]]);
  return '';
}
function vizFigure(e) {
  return diagramFor(e) || vizBuild(pickVizKey(e), e).replace('<figure class="viz"', '<figure class="viz viz-generic"');
}

function deepenBlock(e) {
  const d = DEEPEN[e.id];
  if (!d) return '';
  const out = [];
  if (d.extraViz && !diagramFor(e)) out.push(vizBuild(d.extraViz, {}));
  const panels = [];
  if (d.points && d.points.length) panels.push(`<div class="panel span2 tone-accent"><h4><span class="ic">+</span>${h(d.title || '深入补强')}</h4>${bullets(d.points)}</div>`);
  if (d.dbDesign && d.dbDesign.length) panels.push(`<div class="panel span2"><h4><span class="ic">DB</span>数据库与表设计</h4>${bullets(d.dbDesign)}</div>`);
  if (d.formulas && d.formulas.length) panels.push(`<div class="panel span2"><h4><span class="ic">∑</span>${h(d.formulaTitle || '容量估算公式')}</h4>${bullets(d.formulas)}</div>`);
  if (d.steps && d.steps.length) panels.push(`<div class="panel span2"><h4><span class="ic">→</span>${h(d.stepTitle || '落地步骤')}</h4>${bullets(d.steps, true)}</div>`);
  if (panels.length) out.push(`<div class="grid2">${panels.join('')}</div>`);
  if (d.table && d.table.headers) {
    out.push(`<div class="tbl-wrap"><table class="tbl"><thead><tr>${d.table.headers.map((x) => `<th>${h(x)}</th>`).join('')}</tr></thead><tbody>${d.table.rows.map((r) => `<tr>${r.map((c) => `<td>${h(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
  }
  if (d.sql && d.sql.length) d.sql.forEach((s) => out.push(codeCard(s.code, s.label || 'query.sql')));
  if (d.links && d.links.length) out.push(relatedLinks(d.links.map((l) => byId.get(l.id)).filter(Boolean)));
  return out.join('');
}

/* 结构化口述：按句切分并标注 */
const KW = ['关键', '核心', '本质', '瓶颈', 'trade-off', '取舍', '权衡', '不变量', '幂等', '最终一致', '降级', '兜底', '事实源'];
function markKw(s) {
  let x = h(s);
  KW.forEach((k) => { x = x.split(k).join(`<mark>${k}</mark>`); });
  return x.replace(/(\d+(?:\.\d+)?\s*(?:QPS|TPS|TB|GB|MB|KB|ms|万|亿|%|倍|毫秒|秒|分钟|小时|天|次|条|个|并发|连接|节点|副本|分片))/gi, '<mark>$1</mark>');
}
function pitchBlock(rows, headNote) {
  if (!rows || !rows.length) return '';
  return `<div class="pitch">${headNote ? `<div class="pitch-head"><span>${h(headNote)}</span><span>总分结构 · 先给结论</span></div>` : ''}${rows.map(([lb, tx]) => `<div class="pitch-row"><div class="lb">${h(lb)}</div><div class="tx">${markKw(tx)}</div></div>`).join('')}</div>`;
}
function sentencePitch(text) {
  const segs = String(text || '').split('。').map((s) => s.trim()).filter(Boolean).slice(0, 5);
  const labels = ['结论', '论据', '关键设计', '取舍', '记忆点'];
  return segs.map((s, i) => [labels[i] || `要点 ${i + 1}`, s + '。']);
}

/* ==========================================================================
   各类页面
   ========================================================================== */

;

/* Source: src/app/renderers.js */

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
  return `${pageHead(e,{num:'专题',title:learnerLabel('cat', e.cat),sub:h(e.summary),chips:`<span class="chip accent">专题知识库</span><span class="chip">代表题 <b>${n}</b></span>`})}
  ${sec('题型识别',`<div class="panel tone-accent">${ul(e.recognize)}</div>${e.notApplicable.length?`<div class="panel tone-bad"><h4><span class="ic">✗</span>什么时候不适用</h4>${ul(e.notApplicable)}</div>`:''}`)}
  ${sec('通用模板（Java）',e.templates.map(x=>`<h4 class="md-h md-h4">${h(x.name)}</h4><p class="prose">${h(x.when)}</p>${codeCard(x.java,'Template.java')}<p class="prose rs-demo">已用 <b>${h(x.demo)}</b> 的样例实测：<code class="tok-inline">${h(x.demoMain)}</code> → <code class="tok-inline">${h(x.expected)}</code></p>`).join(''))}
  ${sec('常见变体',ul(e.variants))}
  ${sec('通用坑',`<div class="panel tone-warn">${ul(e.pitfalls)}</div>`)}
  ${sec('代表题',e.groups.map(g=>`<div class="rs-group"><h4>${h(g.name)}</h4><p class="prose">${h(g.note)}</p><div class="rs-jumps">${g.items.map(([hr,t])=>`<a class="jump-btn" href="${hr}">${h(t)}</a>`).join('')}</div></div>`).join(''))}
  ${e.folds.length?sec('原专题笔记与精讲（折叠）',renderNoteTopicFolds(e)):''}
  ${pager(e)}`;}
function renderAlgo(e) {
  if (e.simple) return renderSimpleAlgo(e);
  const url = e.url || (e.slug ? `https://leetcode.cn/problems/${e.slug}/` : '');
  const pat = ENTRIES.find((x) => x.kind === 'pattern' && x.mod === 'algo' && x.cat === e.cat);
  const topic = e.topic ? ENTRIES.find((x) => x.kind === 'topic' && x.topicKey === e.topic) : null;
  const chips = [
    `<span class="chip accent">${h(learnerLabel('cat', e.cat))}</span>`,
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
    + (e.capacityEstimation.benchmarks ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>资源</th><th>写</th><th>读</th><th>备注</th></tr></thead><tbody>${e.capacityEstimation.benchmarks.map((b) => `<tr><td>${h(b.resource)}</td><td>${h(b.write)}</td><td>${h(b.read)}</td><td>${h(b.note)}</td></tr>`).join('')}</tbody></table></div>` : '') + renderCapacityEstimationPitfalls(e.capacityEstimation.pitfalls)));
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
  return `${pageHead(e, { num: entryNum(e), chips: `<span class="chip accent">${h(learnerLabel('cat', e.cat))}</span>` })}
    ${callout('设计主线', e.idea)}
    <div class="kv"><div class="wide"><span>场景与目标</span><strong>${h(e.description)}</strong></div>${e.metrics ? `<div class="wide"><span>关键指标</span><strong>${h(e.metrics)}</strong></div>` : ''}${e.components ? `<div class="wide"><span>核心组件</span><strong>${h(e.components)}</strong></div>` : ''}</div>
    ${sec('60 秒面试话术', pitchBlock(sentencePitch(e.interviewAnswer), '按「结论 → 论据 → 关键设计 → 取舍」讲'))}
    ${sec('架构图解与请求流', vizFigure(e), { aside: '▶ 播放 · 点击步骤跳转' })}
    ${sec('架构详解', `<div class="dims">${dims}</div>`, { aside: `${DIMS.filter(([k]) => e[k] && e[k].length).length} 个维度` })}
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
  return `${pageHead(e, { num: isDb ? 'SQL' : '手撕', chips: `<span class="chip accent">${h(learnerLabel('cat', e.cat))}</span>` })}
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
  return `${pageHead(e, { num: '语法', sub: h(e.subtitle || ''), chips: `<span class="chip accent">${h(learnerLabel('cat', e.cat))}</span>` })}
    <div class="md sec">${e.html || ''}</div>
    ${sec('同分类', relatedLinks(TREE[e.mod].all.filter((x) => x.cat === e.cat && x !== e)))}
    ${pager(e)}`;
}

function renderDoc(e) {
  const imgs = (e.images || []).map((im) => `<a class="btn" href="${h(im.href)}" target="_blank" rel="noopener" title="${h(im.name)}">${ICON.img}原图${e.images.length > 1 ? ' · ' + h(im.name.replace(/\.\w+$/, '')) : ''}</a>`).join('');
  return `${pageHead(e, { num: '', chips: `<span class="chip accent">专题精讲</span><span class="chip">${h(learnerLabel('cat', e.cat))}</span>`, noMastery: false, actions: imgs })}
    ${e.lead ? callout('这篇讲什么', e.lead, 'plain') : ''}
    <div class="md sec">${e.html}</div>
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
  // Authored answers retain their full lead in data/search; display that exact prefix once.
  // Do not infer duplicates in legacy answers or strip arbitrary HTML.
  const answerRest = it.leadType === 'authored' && it.lead && typeof it.a === 'string' && it.a.startsWith(it.lead)
    ? removeExactIntroRepeat(it.lead, it.a.slice(it.lead.length)) : it.a;
  const [lead, rest] = it.lead ? [it.lead, answerRest] : splitLead(it.a);
  return `<div class="qa s${s}" id="q-${h(it.anchor ?? it.no)}" data-key="${h(it.key)}">
    <div class="qa-head" data-act="qa-toggle"><span class="qa-no">${h(it.no)}</span><div class="qa-q">${it.q}</div>
      <div class="qa-tags">${priorityChip(it.key)}${HLC[it.key] ? '<span class="cmp-tag">对比</span>' : ''}${it.from ? `<a class="lc-link" href="${it.from.href}">${h(it.from.label)}</a>` : ''}</div></div>
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
  const items = orderedQuestionView(e).map(({item, canonicalIndex}) => ({ ...item, key: qKey(e.id, canonicalIndex), no: canonicalIndex + 1, anchor: qAnchor(e.id, canonicalIndex) }));
  const shown = items;
  const u = unitsOf([e]);
  const catEntries = TREE[e.mod].all.filter((x) => x.cat === e.cat && x !== e);
  return `${pageHead(e, { num: '', noMastery: true, left: `<span class="chip">掌握 <b>${u.ok}/${u.total}</b></span>${u.fuzzy ? `<span class="chip">模糊 <b>${u.fuzzy}</b></span>` : ''}`,
      chips: `<span class="chip accent">${h(learnerLabel('cat', e.cat))}</span><span class="chip">${items.length} 问</span>` })}
    ${keyCard(e)}
    ${qaToolbar(items.length)}
    ${qaListHtml(shown)}
    ${e.readingNotesHtml ? sec('补充知识与适用边界', '<div class="md">'+e.readingNotesHtml+'</div>') : ''}
    ${sec('同专题其它小节', relatedLinks(catEntries))}
    ${pager(e)}`;
}

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
document.addEventListener("click", activateNoteTopicFold);

function removeExactIntroRepeat(lead, rest) {
  if (typeof lead !== 'string' || typeof rest !== 'string') return rest;
  const essence = /^<p class="md-p sx-ess"><span class="sx-tag">本质<\/span>([^<>]+)<\/p>$/.exec(lead);
  if (!essence) return rest;
  const intro = /^(\s*(?:<h([23])\b[^>]*>[^<>]*<\/h\2>\s*)?)(<p class="md-p">([^<>]+)<\/p>)/.exec(rest);
  if (!intro || intro[4] !== essence[1]) return rest;
  return intro[1] + rest.slice(intro[0].length);
}

function renderCapacityEstimationPitfalls(value) {
 if (!Array.isArray(value) || !value.length || !value.every(x => typeof x === 'string')) return '';
 return '<div class="panel tone-warn" data-capacity-pitfalls><h4>容量估算常见误区</h4>' + bullets(value) + '</div>';
}

;

/* Source: src/app/highlight-map.js */

/* ---------------- v16 重点：易混对比卡 / 本节重点 / 重点地图 ---------------- */
const HLD = DATA.HL || { cards: {}, core: {} };
const HLC = HLD.cards || {}, HL_CORE = HLD.core || {};
const HL_MODS = MODS.filter((m) => TREE[m.id] && TREE[m.id].all.some((e) => e.kind === 'qa')).map((m) => m.id);
const ICON_MAP = '<svg class="ic-map" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/></svg>';
const ESS_RE = /<p class="md-p sx-ess"><span class="sx-tag">本质<\/span>([\s\S]*?)<\/p>/;
const essOf = (it) => { const m = ESS_RE.exec(it.lead || ''); return m ? stripTags(m[1]).trim() : ''; };
/* 仅展示层：去掉「X 的本质是」这类重复开头，原文不变 */
const ESS_HEAD = /^[^，。；：,;:]{1,22}?(的)?本质(上)?(是|在于|就是|：|:)\s*/;
const essShow = (s) => { const t = s.replace(ESS_HEAD, ''); return t.length >= 8 && t !== s ? t : s; };
const ST_TXT = ['未学', '模糊', '已掌握'];
function cmpCard(key) {
  const c = HLC[key];
  if (!c) return '';
  const tag = c.pick ? `<span class="pick">【${h(c.pickLabel || '推荐')}】</span>` : '';
  return `<div class="cmp${c.dup ? ' dup' : ''}"><div class="cmp-h"><span class="sx-tag cmpx">易混对比</span><b>${h(c.title)}</b>${c.dup ? '<small>正文里有完整对比表</small>' : ''}</div><div class="tbl-wrap"><table class="tbl cmp-t"><thead><tr><th></th>${c.cols.map((x) => `<th${x === c.pick ? ' class="pk"' : ''}>${h(x)}${x === c.pick ? tag : ''}</th>`).join('')}</tr></thead>
    <tbody>${c.rows.map((r) => `<tr><th>${h(r.dim)}</th>${r.cells.map((x, i) => `<td${c.cols[i] === c.pick ? ' class="pk"' : ''}>${h(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
}
function keyCard(e) {
  const core = HL_CORE[e.id];
  if (!e.items || e.items.length < 3) return core ? `<p class="kc-solo"><span class="sx-tag">核心</span>${h(core)}</p>` : '';
  const nc = e.items.filter((_, i) => HLC[qKey(e.id, i)]).length;
  return `<details class="kc" open><summary class="kc-h"><b>本节重点</b><small>${e.items.length} 问${nc ? ` · ${nc} 张易混对比` : ''} · 点题目跳转</small><span class="kc-car" aria-hidden="true"></span></summary>
    ${core ? `<p class="kc-core"><span class="sx-tag">核心</span>${h(core)}</p>` : ''}
    <ol class="kc-list">${orderedQuestionView(e).map(({item:it, canonicalIndex:i}) => `<li class="s${statusOf(qKey(e.id, i))}" data-k="${h(qKey(e.id, i))}"><a href="${href(e, i)}" title="${h(essOf(it))}">${h(stripTags(it.q))}</a>${priorityChip(qKey(e.id, i))}${HLC[qKey(e.id, i)] ? '<span class="cmp-tag">对比</span>' : ''}</li>`).join('')}</ol></details>`;
}
function syncKeyCard(key, s) { $$(`.kc-list li[data-k="${CSS.escape(key)}"]`).forEach((li) => { li.className = 's' + s; }); }
const pct = (a, b) => (b ? (a / b * 100).toFixed(1) : 0);
const barHtml = (u) => `<span class="bar" aria-hidden="true"><i class="s1" style="width:${pct(u.ok + u.fuzzy, u.total)}%"></i><i style="width:${pct(u.ok, u.total)}%"></i></span>`;
function mapParts(modId) {
  return TREE[modId].parts.map((p) => ({ name: p.name, cats: p.cats.map((c) => ({ name: c.name, es: c.items.filter((e) => e.kind === 'qa'), docs: c.items.filter((e) => e.kind !== 'qa') })).filter((c) => c.es.length) })).filter((p) => p.cats.length);
}
const dotLabel = (s) => `状态：${ST_TXT[s]}，点击切换`;
function renderMap(modId) {
  const m = MOD[modId], parts = mapParts(modId);
  const all = parts.flatMap((p) => p.cats.flatMap((c) => c.es));
  const ndoc = parts.reduce((s, p) => s + p.cats.reduce((t, c) => t + c.docs.length, 0), 0);
  const u = unitsOf(all);
  const closed = new Set(store.get('iv15-hm-closed-' + modId, []));
  let ci = 0;
  const toc = parts.map((p) => `<div class="hm-toc-p">${h(learnerLabel('part', p.name))}</div>${p.cats.map((c) => { const cu = unitsOf(c.es); return `<a class="hm-toc-c" href="#hm-c-${ci}" data-hm-jump="${ci++}"><span class="t">${h(learnerLabel('cat', c.name))}</span><span class="n" data-hm-n>${cu.ok}/${cu.total}</span>${barHtml(cu)}</a>`; }).join('')}`).join('');
  ci = 0;
  const body = parts.map((p) => `<h2 class="hm-part">${h(learnerLabel('part', p.name))}<small>${p.cats.length} 个分类</small></h2>${p.cats.map((c) => {
    const cu = unitsOf(c.es), i = ci++;
    const solo = c.es.length === 1 ? c.es[0] : null;
    const entries = c.es.map((e) => `<div class="hm-entry" data-e="${h(e.id)}">${solo ? '' : `<div class="hm-entry-h"><a href="${href(e)}">${h(e.title)}</a><span class="n" data-hm-n>${unitsOf([e]).ok}/${e.items.length} 问</span></div>`}
      ${HL_CORE[e.id] && !solo ? `<p class="hm-core"><span class="sx-tag">核心</span>${h(HL_CORE[e.id])}</p>` : ''}
      <ol class="hm-qs">${orderedQuestionView(e).map(({item:it, canonicalIndex:qi}) => { const k = qKey(e.id, qi), q = stripTags(it.q), es = essOf(it), s = statusOf(k);
        return `<li class="hm-q s${s}" data-k="${h(k)}" data-t="${h((q + ' ' + es).toLowerCase())}"><button type="button" class="hm-dot" data-hm-mark aria-label="${dotLabel(s)}" title="点击切换：未学 → 模糊 → 掌握"></button><a href="${href(e, qi)}"><span class="q">${h(q)}</span>${es ? `<span class="es">${h(essShow(es))}</span>` : ''}</a>${priorityChip(k)}${HLC[k] ? '<span class="cmp-tag">对比</span>' : ''}</li>`; }).join('')}</ol></div>`).join('');
    const docs = c.docs.length ? `<p class="hm-docs"><span>相关精讲（不计入问数）：</span>${c.docs.map((d) => `<a href="${href(d)}">${h(d.title)}</a>`).join('')}</p>` : '';
    const open = !closed.has(c.name);
    return `<section class="hm-cat${open ? ' open' : ''}" id="hm-c-${i}" data-cat="${h(c.name)}" data-i="${i}">
      <header class="hm-cat-h" data-hm-toggle role="button" tabindex="0" aria-expanded="${open}" aria-controls="hm-b-${i}"><span class="car" aria-hidden="true"></span><span class="t"><b>${h(learnerLabel('cat', c.name))}</b>${solo && HL_CORE[solo.id] ? `<small class="hm-core-s">${h(HL_CORE[solo.id])}</small>` : `<small>${c.es.length} 个小节</small>`}</span><span class="n" data-hm-n>${cu.ok}/${cu.total} 问</span>${barHtml(cu)}${solo ? `<a class="hm-open" href="${href(solo)}" title="打开本节" aria-label="打开本节">↗</a>` : ''}</header>
      <div class="hm-cat-b" id="hm-b-${i}">${entries}${docs}</div></section>`;
  }).join('')}`).join('');
  const fake = { id: 'hl-' + modId, mod: modId, part: '重点地图', cat: '重点地图' };
  return `${crumbs(fake)}<section class="hm-hero"><h1 class="page-title">${h(m.full)} · 重点地图</h1>
    <p class="page-sub">模块 → 分类 → 小节 → 题目，每题一句「本质」；圆点直接标掌握状态。顺序与侧栏一致，内容全部来自已有答案。</p>
    <div class="hm-stats"><span><b>${ci}</b> 个分类</span><span><b>${u.total}</b> 问</span><span class="ok">掌握 <b data-hm-ok>${u.ok}</b></span><span class="fz">模糊 <b data-hm-fz>${u.fuzzy}</b></span><span class="todo">未学 <b data-hm-td>${u.total - u.ok - u.fuzzy}</b></span>${barHtml(u)}</div>
    ${ndoc ? `<p class="hm-note">地图只统计问答题；侧栏的计数另含 ${ndoc} 篇精讲文档，所以会多一些。</p>` : ''}</section>
    <div class="hm-bar"><label class="hm-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg><input id="hm-q" type="search" placeholder="在地图里筛选题目 / 本质…" aria-label="在地图里筛选"></label>
      <div class="seg" id="hm-f" role="group" aria-label="按掌握状态筛选"><button type="button" data-f="" class="on" aria-pressed="true">全部</button><button type="button" data-f="todo" aria-pressed="false">未掌握</button><button type="button" data-f="1" aria-pressed="false">模糊</button><button type="button" data-f="2" aria-pressed="false">已掌握</button></div>
      <button type="button" class="btn ghost" data-hm-dense aria-pressed="false">精简</button><button type="button" class="btn ghost" data-hm-all>全部收起</button>
      <span class="hm-count" id="hm-count" aria-live="polite"></span></div>
    <div class="hm-layout"><nav class="hm-toc" aria-label="分类目录">${toc}</nav><div class="hm-main" id="hm-main" data-mod="${modId}">${body}<div class="empty-state hm-empty" hidden>没有匹配的题目</div></div></div>`;
}
function unwireMap(page) {
  if (page._hmh) { page.removeEventListener('click', page._hmh); page.removeEventListener('keydown', page._hmk); page._hmh = null; }
  if (window._hmScroll) { removeEventListener('scroll', window._hmScroll); window._hmScroll = null; if (window._hmTimer) window._hmTimer(); }
  if (window._hmIO) { window._hmIO.disconnect(); window._hmIO = null; }
}
function wireMap(page) {
  unwireMap(page);
  const main = $('#hm-main', page); if (!main) return;
  const modId = main.dataset.mod;
  const SK = 'iv16-hm-' + modId;
  let sess = {}; try { sess = JSON.parse(sessionStorage.getItem(SK) || '{}'); } catch (_) { sess = {}; }
  const st = { q: sess.q || '', f: store.get('iv16-hm-f-' + modId, '') };
  const saveSess = () => { if (!main.isConnected) return; try { sessionStorage.setItem(SK, JSON.stringify({ q: st.q, y: Math.round(scrollY) })); } catch (_) {} };
  const qs = $$('.hm-q', main);
  const cats = $$('.hm-cat', main);
  const syncAll = () => { const b = $('[data-hm-all]', page); if (b) b.textContent = cats.every((c) => c.classList.contains('open')) ? '全部收起' : '全部展开'; cats.forEach((c) => $('.hm-cat-h', c).setAttribute('aria-expanded', String(isOpen(c)))); };
  const isOpen = (c) => c.classList.contains('force') ? !c.classList.contains('force-off') : c.classList.contains('open');
  const saveClosed = () => store.set('iv15-hm-closed-' + modId, cats.filter((c) => !c.classList.contains('open')).map((c) => c.dataset.cat));
  const recount = () => {
    const cnt = (els) => { let ok = 0, fz = 0; els.forEach((x) => { if (x.classList.contains('s2')) ok++; else if (x.classList.contains('s1')) fz++; }); return { ok, fuzzy: fz, total: els.length }; };
    const setBar = (root, u, suf) => { const n = $('[data-hm-n]', root); if (n) n.textContent = `${u.ok}/${u.total}${suf || ''}`; const b = $('.bar', root); if (b) { b.children[0].style.width = pct(u.ok + u.fuzzy, u.total) + '%'; b.children[1].style.width = pct(u.ok, u.total) + '%'; } };
    cats.forEach((c, i) => { const u = cnt($$('.hm-q', c)); setBar($('.hm-cat-h', c), u, ' 问'); const t = $(`[data-hm-jump="${i}"]`, page); if (t) setBar(t, u); $$('.hm-entry', c).forEach((en) => { const hh = $('.hm-entry-h', en); if (hh) setBar(hh, cnt($$('.hm-q', en)), ' 问'); }); });
    const u = cnt(qs); $('[data-hm-ok]', page).textContent = u.ok; $('[data-hm-fz]', page).textContent = u.fuzzy; $('[data-hm-td]', page).textContent = u.total - u.ok - u.fuzzy; setBar($('.hm-stats', page), u);
  };
  const apply = (keepForceOff) => {
    const terms = st.q.toLowerCase().replace(/([\u3400-\u9fff])([a-z0-9])/g, '$1 $2').replace(/([a-z0-9])([\u3400-\u9fff])/g, '$1 $2').split(/\s+/).filter(Boolean);
    let shown = 0;
    qs.forEach((li) => { const s = li.classList.contains('s2') ? '2' : li.classList.contains('s1') ? '1' : '0';
      const okF = !st.f || (st.f === 'todo' ? s !== '2' : s === st.f); const okQ = terms.every((t) => li.dataset.t.includes(t));
      li.hidden = !(okF && okQ); if (!li.hidden) shown++; });
    const active = !!(st.f || terms.length);
    $$('.hm-entry', main).forEach((en) => { en.hidden = !$$('.hm-q', en).some((x) => !x.hidden); });
    cats.forEach((c, i) => { const any = $$('.hm-q', c).some((x) => !x.hidden); c.hidden = !any; c.classList.toggle('force', active && any); if (!keepForceOff) c.classList.remove('force-off'); const t = $(`[data-hm-jump="${i}"]`, page); if (t) t.classList.toggle('dim', !any); });
    $$('.hm-part', main).forEach((p) => { let n = p.nextElementSibling, any = false; while (n && !n.classList.contains('hm-part')) { if (n.classList.contains('hm-cat') && !n.hidden) any = true; n = n.nextElementSibling; } p.hidden = !any; });
    $('.hm-empty', main).hidden = shown > 0;
    $('#hm-count', page).textContent = active ? `显示 ${shown} / ${qs.length} 问` : `${qs.length} 问`;
    syncAll();
  };
  const setF = (f) => { st.f = f; store.set('iv16-hm-f-' + modId, f); $$('#hm-f button', page).forEach((b) => { const on = b.dataset.f === f; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }); };
  const toggleCat = (c) => {
    if (c.classList.contains('force')) c.classList.toggle('force-off');
    else { c.classList.toggle('open'); saveClosed(); }
    syncAll();
  };
  const inp = $('#hm-q', page);
  inp.value = st.q;
  inp.addEventListener('input', () => { st.q = inp.value.trim(); saveSess(); clearTimeout(apply._t); apply._t = setTimeout(() => apply(false), 60); });
  page._hmh = (ev) => {
    const f = ev.target.closest('#hm-f [data-f]');
    if (f) { setF(f.dataset.f); apply(false); return; }
    const tg = ev.target.closest('[data-hm-toggle]');
    if (tg && !ev.target.closest('a')) { toggleCat(tg.parentElement); return; }
    const all = ev.target.closest('[data-hm-all]');
    if (all) { const open = !cats.every((c) => c.classList.contains('open')); cats.forEach((c) => { c.classList.toggle('open', open); c.classList.toggle('force-off', !open && c.classList.contains('force')); }); syncAll(); saveClosed(); return; }
    const dn = ev.target.closest('[data-hm-dense]');
    if (dn) { const on = main.classList.toggle('dense'); dn.setAttribute('aria-pressed', String(on)); dn.classList.toggle('on', on); store.set('iv15-hm-dense', on); return; }
    const mk = ev.target.closest('[data-hm-mark]');
    if (mk) { const li = mk.closest('.hm-q'); const nx = (statusOf(li.dataset.k) + 1) % 3; setStatus(li.dataset.k, nx);
      li.classList.remove('s0', 's1', 's2'); li.classList.add('s' + nx); mk.setAttribute('aria-label', dotLabel(nx)); renderSidebar(); recount(); return; }
    const j = ev.target.closest('[data-hm-jump]');
    if (j) { ev.preventDefault(); const c = $('#hm-c-' + j.dataset.hmJump, main); if (!c.classList.contains('force')) { c.classList.add('open'); saveClosed(); } else c.classList.remove('force-off'); syncAll(); c.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
    const a = ev.target.closest('.hm-q a, .hm-entry-h a, .hm-open, .hm-docs a');
    if (a) saveSess();
  };
  page._hmk = (ev) => { const tg = ev.target.closest('[data-hm-toggle]'); if (tg && (ev.key === 'Enter' || ev.key === ' ') && ev.target === tg) { ev.preventDefault(); toggleCat(tg.parentElement); } };
  page.addEventListener('click', page._hmh);
  page.addEventListener('keydown', page._hmk);
  let tS; window._hmTimer = () => clearTimeout(tS); window._hmScroll = () => { clearTimeout(tS); tS = setTimeout(saveSess, 120); }; addEventListener('scroll', window._hmScroll, { passive: true });
  /* 当前分类高亮（scrollspy） */
  const tocLinks = $$('[data-hm-jump]', page);
  const vis = new Map();
  window._hmIO = new IntersectionObserver((ents) => {
    ents.forEach((en) => vis.set(+en.target.dataset.i, en.isIntersecting ? en.boundingClientRect.top : null));
    let best = null; vis.forEach((top, i) => { if (top != null && (best == null || i < best)) best = i; });
    if (best == null) return;
    tocLinks.forEach((t) => { const on = +t.dataset.hmJump === best; if (on !== t.classList.contains('cur')) { t.classList.toggle('cur', on); if (on) { t.setAttribute('aria-current', 'true'); const toc = t.parentElement; if (toc.scrollWidth > toc.clientWidth) toc.scrollTo({ left: t.offsetLeft - 12, behavior: 'smooth' }); else if (toc.scrollHeight > toc.clientHeight) { const r = t.offsetTop - toc.scrollTop; if (r < 0 || r > toc.clientHeight - 30) toc.scrollTo({ top: t.offsetTop - 40 }); } } else t.removeAttribute('aria-current'); } });
  }, { rootMargin: '-140px 0px -55% 0px' });
  cats.forEach((c) => window._hmIO.observe(c));
  if (store.get('iv15-hm-dense', false)) { main.classList.add('dense'); const dn = $('[data-hm-dense]', page); dn.classList.add('on'); dn.setAttribute('aria-pressed', 'true'); }
  setF(st.f); apply(false);
  if (sess.y) setTimeout(() => { window.scrollTo(0, sess.y); }, 0);
}

/* ---------------- 冲刺台 ---------------- */

;

/* Source: src/app/dashboard.js */
const WEEKS = [
  { n: 'W1', t: '制作面试方案', goal: '简历初版 + 核心项目 + 八股主干', doc: 'doc-03', items: ['写初版简历，确定一个核心项目、一个补充项目', '写核心卖点和两三个支撑点', '为项目准备 10 个模拟问题', '八股主干：MySQL / Redis / Kafka / 分布式基础题', '算法：每天 3 题，先刷题型模板'] },
  { n: 'W2', t: '再改简历 · 过八股', goal: '逐句过简历，补高可用 / 高性能 / 可靠性案例', doc: 'doc-04', items: ['逐句过简历，准备每个数据来源', '写自我介绍、项目介绍', 'MVCC、redo log、长事务、Sentinel / Cluster', '投低优先级公司练手', '场景题：答题框架 + 3 道高频'] },
  { n: 'W3', t: '高级内容 · 正式投递', goal: '微服务治理、分库分表、不停机迁移', doc: 'doc-05', items: ['正式投递，每场面试复盘', '记录高频追问，修正简历危险表述', '限流 / 降级 / 熔断 / 隔离讲成案例', '分库分表：分多少、按什么分、跨库问题', '手撕：LRU、限流、阻塞队列、线程池'] },
  { n: 'W4', t: 'AI 项目 · 表达打磨', goal: '把「调用大模型」升级成 Agent 工程项目', doc: 'doc-06', items: ['练总分结构和开头第一句话', '意图识别、上下文工程、Plan/Replan', 'RAG 测试集与 recall@k 指标', '练项目落地表达：每个知识点配一句项目', '补八股短板（看冲刺台「模糊」项）'] },
];
const METHOD = [
  ['01', '总分结构', '先给结论，再展开细节，不要一上来陷入细节。', '「我会从生产、存储、消费三个阶段保证消息不丢……」'],
  ['02', '开篇第一句抓关键', '第一句话要让面试官知道你理解了问题，答到最关键的点。', '「Redis 快的核心是内存访问、多数命令串行执行以减少锁竞争、IO 多路复用和高效数据结构。」'],
  ['03', '层次遍历展开', '先答主干，再根据面试官反馈一层层深入，每层都能收住。', '缓存一致性：先更新 DB 再删缓存 → 删除失败怎么办 → 并发读写 → 能否强一致'],
  ['04', '万事不离项目', '有真实经历就联系项目；没有则说明设计思路，不虚构落地。', '「Kafka 我在通知异步投递里用过，积压时……」'],
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
      <p>简历负责吸引追问，项目负责承载追问，八股负责支撑追问，面试技巧负责把答案讲清楚。这里把算法与数据结构、场景设计、八股问答和面试策略串成一套可以每天推进的复习体系。</p>
      <div class="meta"><span class="chip">${ENTRIES.length} 条目</span><span class="chip">${all.total} 复习单元</span><span class="chip accent">已掌握 <b>${all.ok}</b> / ${all.total} 单元</span>${all.fuzzy ? `<span class="chip">模糊 <b>${all.fuzzy}</b></span>` : ''}</div></section>
    ${last ? `<h2 class="dash-h">继续上次</h2><div class="today"><a href="${href(last)}" style="${modColor(last.mod)}"><span class="dot s${entryStatus(last)}"></span><span class="t">${h(last.title)}<span class="why">${h(MOD[last.mod].full)} · ${h(learnerLabel('cat', last.cat))}</span></span><span class="w">继续 →</span></a></div>` : ''}
    <h2 class="dash-h">模块</h2><div class="mod-grid">${mods}</div>
    <h2 class="dash-h">四周冲刺 <small>勾选会保存在本机浏览器</small></h2>
    <div class="weeks">${WEEKS.map((w) => `<div class="week"><header><b>${w.n}</b><strong>${h(w.t)}</strong></header><p class="goal">${h(w.goal)}</p>
      ${w.items.map((it, i) => { const k = w.n + '-' + i; const d = !!weeksDone[k]; return `<label class="${d ? 'done' : ''}"><input type="checkbox" data-week="${k}" ${d ? 'checked' : ''}><span>${h(it)}</span></label>`; }).join('')}
      ${byId.get(w.doc) ? `<a class="more" href="${href(byId.get(w.doc))}">本周精讲 →</a>` : ''}</div>`).join('')}</div>
    <h2 class="dash-h">答题心法</h2>
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
  const parts = tree.parts.map((p) => `<div class="part-h">${h(learnerLabel('part', p.name))}</div><div class="cat-grid">${p.cats.map((c) => {
    const cu = unitsOf(c.items);
    return `<a class="cat-card" href="${href(c.items[0])}" style="${modColor(modId)}"><span class="h">${h(learnerLabel('cat', c.name))}<small>${cu.ok}/${cu.total}</small></span>
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


;

/* Source: src/app/navigation.js */
/* ==========================================================================
   侧栏 / 顶栏 / 右栏
   ========================================================================== */
function renderModnav() {
  $('#modnav').innerHTML = MODS.filter((m) => m.id === 'home' || TREE[m.id]).map((m) => `<a href="${m.id === 'home' ? '#/' : '#/m/' + m.id}" class="${state.mod === m.id ? 'on' : ''}" style="${modColor(m.id)}"><span class="mdot"></span>${h(m.name)}</a>`).join('');
}
function sideMobileMods() {
  return `<div class="side-mobile-mods">${MODS.filter((m) => m.id === 'home' || TREE[m.id]).map((m) => `<a href="${m.id === 'home' ? '#/' : '#/m/' + m.id}" class="${state.mod === m.id ? 'on' : ''}" style="${modColor(m.id)}"><span class="mdot"></span>${h(m.name)}</a>`).join('')}</div>`;
}
function renderSidebar() {
  const head = $('#side-head'), list = $('#side-list');
  const filterBox = $('.side-filter');
  if (state.mod === 'home') {
    filterBox.hidden = true;
    head.innerHTML = `${sideMobileMods()}<div class="side-mod" style="${modColor('home')}"><span class="mi">◆</span><div><h2>冲刺台</h2><p>全部模块与最近浏览</p></div></div>`;
    const recent = store.get('iv8-recent', []).map((id) => byId.get(id)).filter(Boolean);
    list.innerHTML = `<div class="side-part">模块</div>${MODS.filter((m) => TREE[m.id]).map((m) => { const u = unitsOf(TREE[m.id].all); return `<a class="side-item" href="#/m/${m.id}" style="${modColor(m.id)}"><span class="dot" style="border-color:var(--mc);background:var(--mc)"></span><span class="t">${h(m.full)}</span><span class="n">${u.ok}/${u.total}</span></a>`; }).join('')}
      ${recent.length ? `<div class="side-part">最近浏览</div>${recent.map((e) => `<a class="side-item" href="${href(e)}"><span class="dot s${entryStatus(e)}"></span><span class="t">${h(e.title)}</span><span class="n">${h(MOD[e.mod].name)}</span></a>`).join('')}` : ''}`;
    return;
  }
  filterBox.hidden = false;
  const m = MOD[state.mod], tree = TREE[state.mod];
  const u = unitsOf(tree.all);
  head.innerHTML = `${sideMobileMods()}<div class="side-mod" style="${modColor(state.mod)}"><span class="mi">${m.icon}</span><div><h2><a href="#/m/${m.id}">${h(m.full)}</a></h2><p>${tree.all.length} 条目 · ${u.total} 个复习单元</p></div></div>
    <div class="side-prog"><div class="bar"><i class="s1" style="width:${((u.ok + u.fuzzy) / u.total * 100).toFixed(1)}%"></i><i style="width:${(u.ok / u.total * 100).toFixed(1)}%"></i></div><div class="bar-legend"><span>掌握 ${u.ok}</span><span>模糊 ${u.fuzzy}</span><span>${Math.round(u.ok / u.total * 100)}%</span></div></div>`;
  const cur = state.route.view === 'entry' ? byId.get(state.route.id) : null;
  const q = state.filter.trim().toLowerCase();
  const sf = state.sfilter;
  const small = tree.all.length <= 40;
  let html = '';
  if (HL_MODS.includes(m.id) && state.mod !== 'home') {
    const qn = tree.all.reduce((s, e) => s + (e.items ? e.items.length : 0), 0);
    html += `<a class="side-item side-hl${state.route.view === 'hl' ? ' active' : ''}" href="#/hl/${m.id}" style="margin-top:6px">${ICON_MAP}<span class="t">重点地图</span><span class="n">${qn}</span></a>`;
  }
  for (const p of tree.parts) {
    let partHtml = '';
    for (const c of p.cats) {
      const items = c.items.filter((e) => {
        if (q && !(`${e.title} ${e.number} ${e.cat} ${learnerLabel('cat', e.cat)} ${learnerLabel('part', e.part)}`.toLowerCase().includes(q))) return false;
        if (sf !== '' && String(entryStatus(e)) !== sf) return false;
        return true;
      });
      if (!items.length) continue;
      const key = state.mod + '|' + c.name;
      const open = q || sf !== '' || small || state.open.has(key) || (cur && cur.cat === c.name && cur.mod === state.mod);
      const cu = unitsOf(c.items);
      partHtml += `<details class="side-cat" data-key="${h(key)}"${open ? ' open' : ''}><summary>${h(learnerLabel('cat', c.name))}<span class="cnt">${cu.ok}/${cu.total}</span></summary>
        ${items.map((e) => `<a class="side-item kind-${e.kind}${cur === e ? ' active' : ''}" href="${href(e)}" data-id="${h(e.id)}"><span class="dot s${entryStatus(e)}"></span><span class="t">${h(e.title)}</span><span class="n">${h(e.kind === 'qa' ? (() => { const x = unitsOf([e]); return x.ok + '/' + x.total; })() : entryNum(e))}</span></a>`).join('')}</details>`;
    }
    if (partHtml) html += (tree.parts.length > 1 || p.name !== p.cats[0].name ? `<div class="side-part">${h(learnerLabel('part', p.name))}</div>` : '') + partHtml;
  }
  list.innerHTML = html || '<div class="side-empty">没有匹配的条目</div>';
  const act = list.querySelector('.side-item.active');
  if (act) act.scrollIntoView({ block: 'nearest' });
}

function buildRail() {
  const rail = $('#rail');
  const page = $('#page');
  let heads = $$('.sec-h, .md > .md-h2, .md.sec > .md-h2, .md.sec > .md-h3, .qa', page).filter((x) => !x.closest('details'));
  const isQA = heads.some((x) => x.classList.contains('qa'));
  if (isQA) heads = $$('.sec-h, .qa', page);
  heads.forEach((x, i) => { if (!x.id) x.id = 'h-' + i; });
  const items = heads.slice(0, 80).map((x) => {
    if (x.classList.contains('qa')) {
      const t = x.querySelector('.qa-q').textContent.trim();
      return `<a href="#${x.id}" data-to="${x.id}" class="lv3" title="${h(t)}">${h(x.querySelector('.qa-no').textContent)}. ${h(t)}</a>`;
    }
    const t = (x.classList.contains('sec-h')
      ? Array.from(x.childNodes).filter((nd) => !(nd.classList && (nd.classList.contains('n') || nd.classList.contains('aside')))).map((nd) => nd.textContent).join('')
      : x.textContent).trim();
    return `<a href="#${x.id}" data-to="${x.id}" class="${x.classList.contains('md-h3') ? 'lv3' : ''}" title="${h(t)}">${h(t)}</a>`;
  }).join('');
  rail.innerHTML = `${items ? `<div class="rail-block"><div class="rail-title">本页目录</div><nav class="toc">${items}</nav></div>` : ''}
    <div class="rail-block"><div class="rail-card"><p>${isQA ? '问答页：J / K 切换题目，Space 显示或展开答案，1 标模糊、2 标掌握。' : '← / → 切换条目，/ 或 Ctrl K 全文搜索，F 专注模式。'}</p>
      <div class="rail-keys">${isQA ? '<div><kbd>J</kbd><kbd>K</kbd> 上 / 下一题</div><div><kbd>Space</kbd> 显示 / 展开</div><div><kbd>1</kbd><kbd>2</kbd> 模糊 / 掌握</div>' : '<div><kbd>←</kbd><kbd>→</kbd> 上 / 下一条</div>'}<div><kbd>/</kbd> 搜索 · <kbd>F</kbd> 专注</div></div></div></div>`;
  setupSpy(heads);
}
let spyObs = null;
function setupSpy(heads) {
  if (spyObs) spyObs.disconnect();
  if (!('IntersectionObserver' in window) || !heads.length) return;
  const links = new Map($$('#rail .toc a').map((a) => [a.dataset.to, a]));
  spyObs = new IntersectionObserver((ents) => {
    ents.forEach((en) => {
      if (!en.isIntersecting) return;
      links.forEach((a) => a.classList.remove('on'));
      const a = links.get(en.target.id);
      if (a) { a.classList.add('on'); a.scrollIntoView({ block: 'nearest' }); }
    });
  }, { rootMargin: '-70px 0px -70% 0px' });
  heads.forEach((x) => spyObs.observe(x));
}


;

/* Source: src/app/routing.js */
/* ==========================================================================
   路由与渲染
   ========================================================================== */
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  if (!raw) return { view: 'home' };
  const parts = raw.split('/').map((x) => { try { return decodeURIComponent(x); } catch { return x; } });
  if (parts[0] === 'm' && TREE[parts[1]]) return { view: 'mod', mod: parts[1] };
  if ((parts[0] === 'must' || parts[0] === 'hl') && HL_MODS.includes(parts[1])) { if (parts[0] === 'must') history.replaceState(null, '', '#/hl/' + parts[1]); return { view: 'hl', mod: parts[1] }; }
  if (parts[0] === 'e' && ALGO_ALIAS[decodeURIComponent(parts[1] || '')]) parts[1] = ALGO_ALIAS[decodeURIComponent(parts[1])];
  if (parts[0] === 'e' && DATA.FACE_PARENTS && DATA.FACE_PARENTS[parts[1]] != null) {
    const nmax = DATA.FACE_PARENTS[parts[1]];
    let n = parts[2] != null && parts[2] !== '' ? parseInt(parts[2], 10) : 1;
    if (!Number.isFinite(n) || n < 1) n = 1; if (n > nmax) n = nmax;
    parts[1] = parts[1] + '-' + (n - 1); parts.length = 2;
  }
  if (parts[0] === 'e' && byId.has(parts[1])) return { view: 'entry', id: parts[1], q: parts[2] != null && parts[2] !== '' ? parts[2] : null };
  const archivedId = parts[0] === 'e' ? parts[1] : parts.join('/');
  if (DATA.archivedRoutes?.[archivedId]) return { view: 'archived', id: archivedId };
  // 兼容 v7 书签：#<id>
  const legacy = parts.join('/');
  if (byId.has(legacy)) return { view: 'entry', id: legacy };
  if (legacy.startsWith('h-') || legacy.startsWith('s-') || legacy.startsWith('q-')) return null; // 页内锚点
  return { view: 'nf', id: raw };
}
let renderSequence = 0;
async function render() {
  const r = parseHash();
  if (!r) return;
  const sequence = ++renderSequence;
  const pendingEntry = r.view === 'entry' ? byId.get(r.id) : null;
  const repository = window.__NOTES_RUNTIME__.repository;
  const needsEntry = pendingEntry && !repository.loaded.has(pendingEntry._chunk);
  const needsMap = r.view === 'hl' && ENTRIES.some(e => e.mod === r.mod && e.kind === 'qa' && !repository.loaded.has(e._chunk));
  if (needsEntry || needsMap) {
    DG.stopAll();
    unwireMap($('#page'));
    document.body.dataset.rendered = '';
    $('#page').innerHTML = '<section class="hero load-state" role="status" aria-live="polite"><p>正在加载内容…</p></section>';
  }
  try {
    if (pendingEntry) await Promise.all([repository.loadEntry(pendingEntry.id), window.__NOTES_RUNTIME__.loadVisuals()]);
    else if (r.view === 'hl') await repository.loadMap(r.mod);
  } catch (error) {
    if (sequence !== renderSequence) return;
    console.error('Content load failed', error);
    document.body.dataset.rendered = '';
    $('#page').innerHTML = '<section class="hero load-error" role="alert"><h1>内容加载失败</h1><p>请检查网络后重试。已保存的学习进度不会丢失。</p><button type="button" class="btn primary" id="content-retry">重试</button> <a class="btn" href="#/">返回冲刺台</a></section>';
    $('#content-retry').addEventListener('click', () => render());
    return;
  }
  // A slow previous request must never overwrite a newer route.
  if (sequence !== renderSequence) return;
  const prevRoute = state.route;
  state.route = r;
  const e = r.view === 'entry' ? byId.get(r.id) : null;
  const mod = (r.view === 'home' || r.view === 'nf') ? 'home' : r.view === 'archived' ? DATA.archivedRoutes[r.id].mod : e ? e.mod : r.mod;
  if (mod !== state.mod) { state.filter = ''; $('#side-search').value = ''; }
  const samePage = prevRoute && prevRoute.view === r.view && prevRoute.id === r.id && prevRoute.mod === r.mod && document.body.dataset.rendered;
  state.mod = mod;
  document.body.dataset.rendered = '1';
  renderModnav();
  renderSidebar();
  if (!samePage) {
    secNo = 0;
    state.curQ = -1;
    if (!e || e.kind !== 'qa') state.mustOnly = false;
    let html = '';
    if (r.view === 'archived') { const owner = byId.get(DATA.archivedRoutes[r.id].ownerId); html = '<section class="hero"><h1>实现参考已归档</h1><p>本页原始源码与历史进度已保留。面试阅读请从问题、原理、适用条件与取舍继续。</p><p><a class="btn primary" href="' + href(owner) + '">继续学习：' + h(owner.title) + '</a></p></section>'; }
    else if (r.view === 'nf') html = renderNotFound(r.id);
    else if (r.view === 'home') html = renderHome();
    else if (r.view === 'mod') html = renderModHome(mod);
    else if (r.view === 'hl') html = renderMap(mod);
    else html = ({ algo: renderAlgo, ptopic: renderPTopic, pattern: renderPattern, topic: renderTopic, scenario: renderScenario, handwrite: renderHandwrite, database: renderHandwrite, syntax: renderSyntax, qa: renderQA, doc: renderDoc }[e.kind] || renderDoc)(e);
    const page = $('#page');
    DG.stopAll();
    page.innerHTML = html;
    page.querySelectorAll('.sec-h > .n').forEach((x, i) => { x.textContent = pad2(i + 1); });
    page.style.cssText = modColor(mod === 'home' ? 'algo' : mod);
    hydrateCode(page);
    wireVizIn(page);
    DG.mountAll(page);
    page.classList.toggle('hm-wide', r.view === 'hl');
    if (r.view === 'hl') wireMap(page); else unwireMap(page);
    buildRail();
    updateQaStat();
    if (e) { pushRecent(e.id); store.set('iv8-last', e.id); }
    document.title = (e ? e.title : r.view === 'mod' ? MOD[mod].full : r.view === 'hl' ? MOD[mod].full + ' · 重点地图' : (r.view === 'nf' ? '未找到' : '冲刺台')) + ' · 学习笔记';
    window.scrollTo(0, 0);
  }
  if (r.q != null) focusQuestion(r.q, true);
  closeNav();
}
function wireVizIn(root) {
  $$('.viz', root).forEach((fig) => { const svg = fig.querySelector('svg'); if (svg) staggerViz(svg); });
}
function refreshStatusUI() {
  renderSidebar();
  updateQaStat();
}
function updateQaStat() {
  const el = $('#qa-stat');
  if (!el) return;
  const cards = $$('.qa', $('#page'));
  const ok = cards.filter((c) => c.classList.contains('s2')).length;
  const fz = cards.filter((c) => c.classList.contains('s1')).length;
  el.textContent = `掌握 ${ok} · 模糊 ${fz} · 共 ${cards.length}`;
}


;

/* Source: src/app/questions.js */
/* ---------------- 问答交互 ---------------- */
function qaCards() { return $$('#page .qa'); }
function focusQuestion(anchor, scroll) {
  const card = document.getElementById('q-' + anchor) || qaCards()[+anchor];
  if (!card) return;
  qaCards().forEach((c) => c.classList.remove('cur'));
  card.classList.add('cur');
  state.curQ = qaCards().indexOf(card);
  if (scroll) {
    card.classList.add('open');
    requestAnimationFrame(() => card.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  }
}
function moveQuestion(d) {
  const cards = qaCards();
  if (!cards.length) return false;
  let i = state.curQ < 0 ? (d > 0 ? 0 : cards.length - 1) : Math.max(0, Math.min(cards.length - 1, state.curQ + d));
  cards.forEach((c) => c.classList.remove('cur'));
  cards[i].classList.add('cur');
  state.curQ = i;
  cards[i].scrollIntoView({ block: 'center', behavior: 'smooth' });
  return true;
}
function markCard(card, s) {
  const key = card.dataset.key;
  const next = statusOf(key) === s ? 0 : s;
  setStatus(key, next);
  syncKeyCard(key, next);
  card.classList.remove('s0', 's1', 's2');
  card.classList.add('s' + next);
  $$('.qa-foot [data-s]', card).forEach((b) => b.classList.toggle('on', +b.dataset.s === next));
  refreshStatusUI();
}


;

/* Source: src/app/search.js */
/* ==========================================================================
   全文搜索（Ctrl K）
   ========================================================================== */
let INDEX = null;
async function buildIndex() {
  if (!INDEX) INDEX = await window.__NOTES_RUNTIME__.repository.loadSearch();
  return INDEX;
}
const pal = { scope: '', sel: 0, results: [] };
function openPalette(q) {
  $('#palette').hidden = false;
  const input = $('#palette-q');
  if (q != null) input.value = q;
  renderScope();
  runSearch();
  requestAnimationFrame(() => { input.focus(); input.select(); });
}
function closePalette() { $('#palette').hidden = true; }
function renderScope() {
  $('#palette-scope').innerHTML = [['', '全部'], ...MODS.filter((m) => TREE[m.id]).map((m) => [m.id, m.name])].map(([id, n]) => `<button type="button" data-scope="${id}" class="${pal.scope === id ? 'on' : ''}">${h(n)}</button>`).join('');
}
function snippet(text, terms) {
  const low = text.toLowerCase();
  let at = -1;
  for (const t of terms) { at = low.indexOf(t); if (at >= 0) break; }
  const start = Math.max(0, at - 28);
  let s = (start > 0 ? '…' : '') + text.slice(start, start + 110);
  return hl(s, terms);
}
function hl(s, terms) {
  let x = h(s);
  terms.filter(Boolean).sort((a, b) => b.length - a.length).forEach((t) => {
    const re = new RegExp(h(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    x = x.replace(re, (m) => `<mark>${m}</mark>`);
  });
  return x;
}
let searchSequence = 0;
async function runSearch() {
  const sequence = ++searchSequence;
  const raw = $('#palette-q').value.trim();
  const list = $('#palette-list');
  if (!raw) {
    const recent = store.get('iv8-recent', []).map((id) => byId.get(id)).filter(Boolean).slice(0, 8);
    pal.results = recent.map((e) => ({ e }));
    list.innerHTML = (recent.length ? `<div class="pl-group">最近浏览</div>${recent.map((e, i) => plItem({ e }, i, [])).join('')}` : '')
      + `<div class="pl-empty">输入关键词搜索全部 ${ENTRIES.length} 个条目与 ${ENTRIES.reduce((s, e) => s + (e.items ? e.items.length : 0), 0)} 道问答<div class="hints">${['MVCC', 'LRU', '秒杀', '分布式锁', '146', '消息不丢', 'RAG 召回', '线程池', '分库分表'].map((x) => `<button type="button" data-hint="${h(x)}">${h(x)}</button>`).join('')}</div></div>`;
    pal.sel = 0; markSel(); $('#palette-count').textContent = '';
    return;
  }
  const terms = raw.toLowerCase().replace(/([\u3400-\u9fff\uf900-\ufaff])([a-z0-9])/g, '$1 $2').replace(/([a-z0-9])([\u3400-\u9fff\uf900-\ufaff])/g, '$1 $2').split(/\s+/).filter(Boolean);
  let idx;
  try {
    if (!INDEX) list.innerHTML = '<div class="pl-empty" role="status">正在加载搜索索引…</div>';
    idx = await buildIndex();
  } catch (error) {
    if (sequence !== searchSequence) return;
    console.error('Search load failed', error);
    list.innerHTML = '<div class="pl-empty" role="alert">搜索索引加载失败 <button type="button" class="btn" id="search-retry">重试</button></div>';
    $('#search-retry').addEventListener('click', () => runSearch());
    $('#palette-count').textContent = '';
    pal.results = [];
    return;
  }
  if (sequence !== searchSequence || $('#palette').hidden) return;
  const out = [];
  for (const r of idx) {
    if (pal.scope && r.e.mod !== pal.scope) continue;
    const labels = (learnerLabel('part', r.e.part) + ' ' + learnerLabel('cat', r.e.cat)).toLowerCase();
    let score = 0, ok = true;
    for (const t of terms) {
      const inT = r.tl.includes(t);
      if (inT) score += r.tl.startsWith(t) ? 14 : 10;
      else if (r.tx.includes(t) || labels.includes(t)) score += 1;
      else { ok = false; break; }
    }
    if (!ok) continue;
    if (r.e.kind === 'algo' && String(r.e.number) === raw) score += 40;
    if (r.qi == null && r.e.kind !== 'qa') score += 1.5;
    out.push({ r, score });
  }
  out.sort((a, b) => b.score - a.score);
  pal.results = out.slice(0, 80).map((x) => x.r);
  list.innerHTML = pal.results.length ? pal.results.map((r, i) => plItem(r, i, terms)).join('') : '<div class="pl-empty">没有找到匹配内容，换个关键词或减少关键词试试</div>';
  $('#palette-count').textContent = out.length ? `${out.length} 条结果${out.length > 80 ? '（显示前 80）' : ''}` : '';
  pal.sel = 0; markSel();
}
function plItem(r, i, terms) {
  const e = r.e, m = MOD[e.mod];
  const isQ = r.qi != null;
  const title = isQ ? r.title : (e.kind === 'algo' ? e.number + '. ' : '') + e.title;
  const sub = isQ ? `${learnerLabel('cat', e.cat)} · ${e.title}` : `${KIND_LABEL[e.kind] || ''} · ${learnerLabel('cat', e.cat)}`;
  const snip = terms.length && r.text ? snippet(learnerSearchText(r), terms) : '';
  return `<a class="pl-item" data-i="${i}" href="${isQ ? href(e, r.qi) : href(e)}" style="${modColor(e.mod)}"><span class="pl-ic">${m.icon}</span><span><span class="pl-title">${hl(title, terms)}<small>${h(sub)}</small></span>${snip ? `<span class="pl-snip">${snip}</span>` : ''}</span></a>`;
}
function markSel() {
  const items = $$('#palette-list .pl-item');
  items.forEach((x, i) => x.classList.toggle('on', i === pal.sel));
  if (items[pal.sel]) items[pal.sel].scrollIntoView({ block: 'nearest' });
}


;

/* Reading presentation lifecycle adapter */
(() => {
  const originalHydrateCode = hydrateCode;
  if (originalHydrateCode.__notesReadingPresentation) return;
  function hydrateReadingPage() {
    const page = arguments[0];
    if (page === document.getElementById('page')) {
      const entry = state.route?.view === 'entry' ? byId.get(state.route.id) : null;
      window.__NOTES_RUNTIME__.enhanceReadingPage?.(page, entry);
      page.querySelectorAll('.sec-h > .n').forEach((node, i) => { node.textContent = pad2(i + 1); });
    }
    return originalHydrateCode.apply(this, arguments);
  }
  Object.defineProperty(hydrateReadingPage, '__notesReadingPresentation', {value: true});
  hydrateCode = hydrateReadingPage;
})();

;

/* Source: src/app/events.js */
/* ==========================================================================
   事件
   ========================================================================== */
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 1500);
}
function copyText(text, okMsg) {
  const done = () => toast(okMsg || '已复制');
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  function fallback() {
    const a = document.createElement('textarea'); a.value = text; a.style.position = 'fixed'; a.style.opacity = '0';
    document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch { /* 忽略 */ } a.remove(); done();
  }
}
function codeOf(card) {
  if (card._code) return card._code;
  return $$('.code-text', card).map((x) => x.textContent).join('\n');
}
function closeNav() { document.body.classList.remove('nav-open'); $('#nav-toggle').setAttribute('aria-expanded', 'false'); }
function toggleFocus() { document.body.classList.toggle('focus'); toast(document.body.classList.contains('focus') ? '专注模式：按 F 退出' : '已退出专注模式'); }
function effectiveTheme() {
  const t = document.documentElement.dataset.theme;
  if (t) return t;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

document.addEventListener('click', (ev) => {
  const t = ev.target;
  const actEl = t.closest('[data-act]');
  const act = actEl && actEl.dataset.act;
  // 掌握度（页面头部）
  const segBtn = t.closest('[data-master] button');
  if (segBtn) {
    const key = segBtn.parentElement.dataset.master;
    setStatus(key, +segBtn.dataset.s);
    $$('button', segBtn.parentElement).forEach((b) => b.classList.toggle('on', b === segBtn));
    refreshStatusUI();
    if (+segBtn.dataset.s === 2) toast('已标记为掌握');
    return;
  }
  if (t.closest('#qa-mode button')) {
    const b = t.closest('button');
    state.qaMode = b.dataset.m; store.set('iv8-qamode', state.qaMode);
    $$('#qa-mode button').forEach((x) => x.classList.toggle('on', x === b));
    $$('.qa-list').forEach((l) => { l.dataset.mode = state.qaMode; });
    $$('.qa.open').forEach((c) => c.classList.remove('open'));
    return;
  }
  if (act === 'qa-toggle') {
    if (t.closest('a')) return;
    const card = actEl.closest('.qa');
    card.classList.toggle('open');
    focusQuestion(card.id.slice(2), false);
    return;
  }
  if (act === 'qa-open') { const c = actEl.closest('.qa'); c.classList.add('open'); focusQuestion(c.id.slice(2), false); return; }
  if (act === 'qa-close') { const c = actEl.closest('.qa'); c.classList.remove('open'); c.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
  if (act === 'qa-mark') { markCard(actEl.closest('.qa'), +actEl.dataset.s); return; }
  if (act === 'qa-random') {
    const cards = qaCards(); if (!cards.length) return;
    const pool = cards.filter((c) => !c.classList.contains('s2'));
    const pick = (pool.length ? pool : cards)[Math.floor(Math.random() * (pool.length || cards.length))];
    cards.forEach((c) => c.classList.remove('open', 'cur'));
    if (state.qaMode !== 'q') { $('#qa-mode [data-m="q"]').click(); }
    pick.classList.add('cur'); state.curQ = cards.indexOf(pick);
    pick.scrollIntoView({ block: 'center', behavior: 'smooth' });
    toast('先自己答一遍，再按 Space 看答案');
    return;
  }
  if (act === 'blind') { const c = actEl.closest('.code-card'); c.classList.toggle('blind'); actEl.classList.toggle('on', c.classList.contains('blind')); return; }
  if (act === 'unblind') { const c = actEl.closest('.code-card'); c.classList.remove('blind'); const b = c.querySelector('[data-act="blind"]'); if (b) b.classList.remove('on'); return; }
  if (act === 'copy-code') { copyText(codeOf(actEl.closest('.code-card')), '代码已复制'); return; }
  if (act === 'copy-link') { copyText(location.href, '链接已复制'); return; }
  if (act === 'focus') { toggleFocus(); return; }
  if (t.closest('.viz-replay')) {
    const fig = t.closest('.viz'); const cur = fig.querySelector('svg');
    if (cur) { const fresh = cur.cloneNode(true); cur.replaceWith(fresh); staggerViz(fresh); }
    return;
  }
  const scopeBtn = t.closest('[data-scope]');
  if (scopeBtn) { pal.scope = scopeBtn.dataset.scope; renderScope(); runSearch(); $('#palette-q').focus(); return; }
  const hint = t.closest('[data-hint]');
  if (hint) { $('#palette-q').value = hint.dataset.hint; runSearch(); $('#palette-q').focus(); return; }
  if (t.closest('.pl-item')) { closePalette(); return; }
  if (t.id === 'palette') { closePalette(); return; }
  const tocA = t.closest('#rail .toc a');
  if (tocA) {
    ev.preventDefault();
    const el = document.getElementById(tocA.dataset.to);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); if (el.classList.contains('qa')) focusQuestion(el.id.slice(2), false); }
    return;
  }
  // 正文里的页内锚点（v7 语法页小节导航等）
  const inner = t.closest('#page a[href^="#"]');
  if (inner && !/^#\//.test(inner.getAttribute('href'))) {
    ev.preventDefault();
    const el = document.getElementById(inner.getAttribute('href').slice(1));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  // v7 内嵌的 related-button / data-jump-id
  const jump = t.closest('[data-jump-id], [data-related-index]');
  if (jump) {
    const id = jump.dataset.jumpId;
    if (id && byId.has(id)) location.hash = href(byId.get(id));
    return;
  }
  const popBtn = t.closest('#font-pop [data-font]');
  if (popBtn) {
    const f = popBtn.dataset.font;
    if (f) document.documentElement.dataset.font = f; else delete document.documentElement.dataset.font;
    store.set('iv8-font', f); try { localStorage.setItem('iv8-font', f); } catch { /* 忽略 */ }
    markFont(); return;
  }
  if (!t.closest('#font-pop') && !t.closest('#font-btn')) $('#font-pop').hidden = true;
});
function rerender() { document.body.dataset.rendered = ''; const r = state.route; state.route = { view: '_' }; render(); if (r.q != null) focusQuestion(r.q, true); }

document.addEventListener('change', (ev) => {
  const wk = ev.target.closest('[data-week]');
  if (wk) {
    const w = store.get('iv8-weeks', {});
    if (wk.checked) w[wk.dataset.week] = 1; else delete w[wk.dataset.week];
    store.set('iv8-weeks', w);
    wk.closest('label').classList.toggle('done', wk.checked);
  }
});
$('#side-list').addEventListener('click', (ev) => {
  const sum = ev.target.closest('.side-cat > summary');
  if (!sum) return;
  const d = sum.parentElement;
  setTimeout(() => {
    if (d.open) state.open.add(d.dataset.key); else state.open.delete(d.dataset.key);
    store.set('iv8-open', [...state.open]);
  }, 0);
});

$('#side-search').addEventListener('input', (ev) => { state.filter = ev.target.value; renderSidebar(); });
$('#status-filter').addEventListener('click', (ev) => {
  const b = ev.target.closest('button'); if (!b) return;
  state.sfilter = b.dataset.f;
  $$('#status-filter button').forEach((x) => x.classList.toggle('on', x === b));
  renderSidebar();
});
$('#search-trigger').addEventListener('click', () => openPalette());
$('#palette-q').addEventListener('input', () => { clearTimeout(runSearch._t); runSearch._t = setTimeout(runSearch, 60); });
$('#palette-q').addEventListener('keydown', (ev) => {
  const n = $$('#palette-list .pl-item').length;
  if (ev.key === 'ArrowDown') { ev.preventDefault(); pal.sel = Math.min(n - 1, pal.sel + 1); markSel(); }
  else if (ev.key === 'ArrowUp') { ev.preventDefault(); pal.sel = Math.max(0, pal.sel - 1); markSel(); }
  else if (ev.key === 'Enter') { const a = $$('#palette-list .pl-item')[pal.sel]; if (a) { location.hash = a.getAttribute('href'); closePalette(); } }
  else if (ev.key === 'Escape') { closePalette(); }
});
$('#nav-toggle').addEventListener('click', () => {
  const open = !document.body.classList.contains('nav-open');
  document.body.classList.toggle('nav-open', open);
  $('#nav-toggle').setAttribute('aria-expanded', String(open));
});
$('#scrim').addEventListener('click', closeNav);
$('#theme-btn').addEventListener('click', () => {
  const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('iv8-theme', next); } catch { /* 忽略 */ }
});
function markFont() {
  const f = document.documentElement.dataset.font || '';
  $$('#font-pop [data-font]').forEach((b) => b.classList.toggle('on', b.dataset.font === f));
}
$('#font-btn').addEventListener('click', () => {
  const pop = $('#font-pop');
  const r = $('#font-btn').getBoundingClientRect();
  pop.style.top = (r.bottom + 8) + 'px';
  pop.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
  pop.hidden = !pop.hidden;
  markFont();
});

document.addEventListener('keydown', (ev) => {
  const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); $('#palette').hidden ? openPalette() : closePalette(); return; }
  if (!$('#palette').hidden) return;
  if (ev.key === 'Escape') { if (inField) document.activeElement.blur(); closeNav(); $('#font-pop').hidden = true; return; }
  if (inField || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  const key = ev.key;
  if (key === '/') { ev.preventDefault(); openPalette(); return; }
  if (key === 'f' || key === 'F') { toggleFocus(); return; }
  const cur = state.route.view === 'entry' ? byId.get(state.route.id) : null;
  const hasQA = qaCards().length > 0;
  const stepEntry = (d) => {
    if (!cur) return;
    const list = TREE[cur.mod].all; const i = list.indexOf(cur) + d;
    if (list[i]) location.hash = href(list[i]);
  };
  if (key === 'ArrowRight') { stepEntry(1); return; }
  if (key === 'ArrowLeft') { stepEntry(-1); return; }
  if (key === 'j' || key === 'J') { if (hasQA) moveQuestion(1); else stepEntry(1); ev.preventDefault(); return; }
  if (key === 'k' || key === 'K') { if (hasQA) moveQuestion(-1); else stepEntry(-1); ev.preventDefault(); return; }
  if (hasQA && state.curQ >= 0) {
    const card = qaCards()[state.curQ];
    if (!card) return;
    if (key === ' ') {
      ev.preventDefault();
      const list = card.closest('.qa-list');
      const mode = list ? list.dataset.mode : 'full';
      if (!card.classList.contains('open') && mode !== 'full') card.classList.add('open'); else moveQuestion(1);
      return;
    }
    if (key === '1') { markCard(card, 1); return; }
    if (key === '2') { markCard(card, 2); return; }
    if (key === '0') { setStatus(card.dataset.key, 0); card.classList.remove('s1', 's2'); $$('.qa-foot [data-s]', card).forEach((b) => b.classList.remove('on')); refreshStatusUI(); }
  }
});

window.addEventListener('hashchange', render);
window.addEventListener('storage', (ev) => { if (ev.key === 'iv8-progress') { PROG = store.get('iv8-progress', {}); refreshStatusUI(); } });
render();
// The compact global search index is fetched on first non-empty search.

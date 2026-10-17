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
const pad2 = (n) => String(n).padStart(2, '0');
const stripTags = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const MODS = [
  { id: 'home', name: '冲刺台', icon: '◆' },
  { id: 'algo', name: '算法', full: '算法手撕', icon: 'A', start: ['p-hash', '1'],
    desc: '先读专题（题型识别 + 通用模板），再逐题看解法、默写代码。' },
  { id: 'code', name: '手撕', full: '代码与 SQL 手撕', icon: 'C', start: ['handwrite-45', 'database-71'],
    desc: 'LRU、限流、阻塞队列、线程池、设计模式等工程手撕，以及 SQL 统计、索引、事务锁与表设计。' },
  { id: 'design', name: '场景', full: '场景设计', icon: 'S', start: ['scenario-design-framework', 'doc-sd-scenarios'],
    desc: '35 道架构场景题 + 高可用项目精讲 + 面经场景问答。按「需求 → 容量 → 架构 → 一致性 → 故障 → 可观测」展开。' },
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


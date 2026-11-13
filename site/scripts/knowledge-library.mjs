// Interview exam map + imported backend/Agent knowledge library.
// All source Markdown and images are checked in; this projection runs after the
// legacy content guards, just like the design lectures.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {mdToSiteHtml} from './md-lite.mjs';

const SOURCE = '后端 + Agent 面试知识库';
export const KNOWLEDGE_DOCS = [
  {id:'kb-javase', source:'11_后端八股/01_JAVASE.md', title:'Java SE：集合、字符串、异常与 IO', part:'后端知识库', cat:'Java 与并发'},
  {id:'kb-juc', source:'11_后端八股/02_JUC.md', title:'JUC：线程池、AQS、CAS、synchronized 与 JMM', part:'后端知识库', cat:'Java 与并发'},
  {id:'kb-jvm', source:'11_后端八股/03_JVM.md', title:'JVM：内存、类加载、GC 与线上排查', part:'后端知识库', cat:'Java 与并发'},
  {id:'kb-spring', source:'11_后端八股/09_Spring.md', title:'Spring：IoC、AOP、事务与 Boot 自动装配', part:'后端知识库', cat:'Java 与并发'},
  {id:'kb-mysql', source:'11_后端八股/05_MySQL.md', title:'MySQL：索引、事务、MVCC、锁与复制', part:'后端知识库', cat:'数据与中间件'},
  {id:'kb-redis', source:'11_后端八股/04_Redis.md', title:'Redis：数据结构、缓存、持久化与分布式锁', part:'后端知识库', cat:'数据与中间件'},
  {id:'kb-mq', source:'11_后端八股/10_中间件.md', title:'消息队列与中间件：Kafka、RabbitMQ、RocketMQ、Netty', part:'后端知识库', cat:'数据与中间件'},
  {id:'kb-os', source:'11_后端八股/06_操作系统.md', title:'操作系统与 Linux：进程、内存、IO 与排查命令', part:'后端知识库', cat:'计算机基础'},
  {id:'kb-network', source:'11_后端八股/07_计算机网络.md', title:'计算机网络：TCP、HTTP、TLS、DNS 与连接治理', part:'后端知识库', cat:'计算机基础'},
  {id:'kb-distributed', source:'11_后端八股/08_分布式与架构.md', title:'分布式与架构：微服务、RPC、容量与高可用', part:'后端知识库', cat:'架构与语言'},
  {id:'kb-patterns', source:'11_后端八股/11_设计模式.md', title:'设计模式：选型判据与工程落地', part:'后端知识库', cat:'架构与语言'},
  {id:'kb-algorithm', source:'11_后端八股/12_数据结构与算法.md', title:'数据结构与算法：复杂度、经典结构与手写题', part:'后端知识库', cat:'架构与语言'},
  {id:'kb-python', source:'11_后端八股/13_Python异步与服务化.md', title:'Python：GIL、异步 IO 与服务化', part:'后端知识库', cat:'架构与语言'},
  {id:'kb-llm', source:'01_LLM基础/01_LLM基础.md', title:'LLM 基础：Transformer、采样、训练、微调与推理', part:'Agent 知识库', cat:'模型与检索'},
  {id:'kb-prompt', source:'02_提示词与上下文工程/02_提示词与上下文工程.md', title:'提示词与上下文工程：结构、注入、压缩与治理', part:'Agent 知识库', cat:'模型与检索'},
  {id:'kb-rag', source:'05_RAG与知识检索/05_RAG与知识检索.md', title:'RAG 与知识检索：切分、Embedding、混合检索与重排', part:'Agent 知识库', cat:'模型与检索'},
  {id:'kb-agent', source:'03_Agent范式与设计/03_Agent范式与设计.md', title:'Agent 范式与设计：ReAct、Planning、状态机与框架', part:'Agent 知识库', cat:'Agent 核心'},
  {id:'kb-tools', source:'04_工具调用与协议/04_工具调用与协议.md', title:'工具调用与协议：Function Calling、MCP、A2A 与 Skills', part:'Agent 知识库', cat:'Agent 核心'},
  {id:'kb-memory', source:'06_记忆与会话状态/06_记忆与会话状态.md', title:'记忆与会话状态：分层记忆、Session 与生命周期', part:'Agent 知识库', cat:'Agent 核心'},
  {id:'kb-multiagent', source:'07_MultiAgent与编排/07_MultiAgent与编排.md', title:'Multi-Agent 与编排：协作拓扑、Graph 与持久执行', part:'Agent 知识库', cat:'Agent 核心'},
  {id:'kb-eval', source:'08_评测与可观测/08_评测与可观测.md', title:'Agent 评测与可观测：评测集、判分、Trace 与回放', part:'Agent 知识库', cat:'质量与工程'},
  {id:'kb-runtime', source:'09_Runtime与工程化/09_Runtime与工程化.md', title:'Agent Runtime 与工程化：调度、恢复、成本与 Harness', part:'Agent 知识库', cat:'质量与工程'},
  {id:'kb-security', source:'10_安全与治理/10_安全与治理.md', title:'Agent 安全与治理：注入、权限、审批与多租户', part:'Agent 知识库', cat:'质量与工程'},
  {id:'kb-framework', source:'12_开源框架解读/12_开源框架解读.md', title:'开源框架解读：PI、Hermes、Claude Code 与 Runtime', part:'Agent 知识库', cat:'质量与工程'},
  {id:'kb-aicoding', source:'16_AICoding与工具实践/16_AICoding与工具实践.md', title:'AI Coding 与工具实践：Claude Code、Codex 与工程规范', part:'Agent 知识库', cat:'质量与工程'}
];

const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const cleanTitle = (s) => String(s).replace(/^[一二三四五六七八九十]+、/,'').replace(/（★+）/g,'').trim();
const norm = (s) => String(s).toLowerCase()
  .replace(/[（(].*?[）)]/g,'').replace(/[\s`*_~\-—–_/\\|｜:：,，.。;；?？!！+·/]/g,'')
  .replace(/什么是|怎么|如何|原理|机制|详解|底层|实现|设计|问题|区别|核心/g,'');

function unescapeSource(markdown) {
  return String(markdown)
    .replace(/\\`/g, '`')
    .replace(/\\\*/g, '*')
    .replace(/\\\[/g, '[')
    .replace(/\\\]/g, ']')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/^\\-/gm, '-');
}

function cleanLibraryMarkdown(markdown) {
  const lines = unescapeSource(markdown).replace(/\r\n?/g,'\n').split('\n');
  const out = [];
  let skippingToc = false;
  let skipLevel = 0;
  let inFence = false;
  let beforeFirstSection = true;
  const auxHeading = /^(?:来源档案|参考资料|参考资料与延伸阅读|资料来源与延伸阅读|资料与延伸阅读|写作备注)/;
  for (const line of lines) {
    if (/^```/.test(line.trim())) inFence = !inFence;
    const heading = /^(#{2,6})\s+(.+)$/.exec(line);
    if (heading && !inFence) {
      const level = heading[1].length;
      const text = heading[2].trim().replace(/\*\*/g, '');
      if (skipLevel && level <= skipLevel) skipLevel = 0;
      beforeFirstSection = false;
      if (/^(?:目录|本篇包含)\s*$/.test(text)) { skippingToc = true; continue; }
      skippingToc = false;
      if (!skipLevel && auxHeading.test(text)) { skipLevel = level; continue; }
    }
    if (skippingToc || skipLevel) continue;
    if (beforeFirstSection && /^>\s*\*\*(?:模块|来源|构成|规模|状态|生成)/.test(line)) continue;
    out.push(line);
  }
  return out.join('\n');
}

export function parseExam(markdown) {
  const lines = markdown.replace(/\r\n?/g,'\n').split('\n');
  const tops = {backend:[], agent:[]};
  const sections = [];
  let track = null, section = null, group = null, point = null;
  const finishPoint = () => {
    if (!point) return;
    point.body = point.body.join('\n').replace(/^\s+|\s+$/g,'');
    point = null;
  };
  for (const line of lines) {
    const h2 = /^##\s+(.+)$/.exec(line);
    if (h2) {
      finishPoint();
      const text = h2[1];
      if (/传统后端.*高频考点总榜/.test(text)) track = 'backend-top';
      else if (/AI Agent.*高频考点总榜/.test(text)) track = 'agent-top';
      else if (/^[二三四五六七八九]、/.test(text)) track = 'backend';
      else if (/^十一、|^十二、|^十三、|^十四、|^十五、/.test(text)) track = 'agent';
      else track = null;
      if (track === 'backend' || track === 'agent') {
        section = {track, title:text, groups:[]};
        sections.push(section);
        group = null;
      } else { section = null; group = null; }
      continue;
    }
    if (track === 'backend-top' || track === 'agent-top') {
      const cells = line.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map((x) => x.trim());
      if (cells.length === 5 && /^\d+$/.test(cells[0]) && /^\d+$/.test(cells[4])) {
        tops[track === 'backend-top' ? 'backend' : 'agent'].push({rank:+cells[0], title:cells[1], direction:cells[2], conclusion:cells[3], frequency:+cells[4]});
      }
      continue;
    }
    if (!section) continue;
    const h3 = /^###\s+(.+)$/.exec(line);
    if (h3) {
      finishPoint();
      group = {title:h3[1], topic:h3[1].split('｜')[0].trim(), intro:[], points:[]};
      section.groups.push(group);
      continue;
    }
    const start = /^\*\*(\d+)\.\s*(.+?)\*\*(?:（(★+)）)?\s*$/.exec(line);
    if (start && !group) {
      group = {title:cleanTitle(section.title), topic:cleanTitle(section.title), intro:[], points:[]};
      section.groups.push(group);
    }
    if (!group) continue;
    if (start) {
      finishPoint();
      point = {track:section.track, section:section.title, topic:group.topic, group:group.title,
        no:+start[1], title:start[2].trim(), stars:start[3] || '', summary:'', body:[], anchor:'exam-' + section.track + '-p' + (sections.flatMap((s) => s.groups).flatMap((g) => g.points).length + 1)};
      group.points.push(point);
      continue;
    }
    if (point) {
      if (!point.summary && /^[　\s]*\*.+\*\s*$/.test(line) && !line.startsWith('-')) {
        point.summary = line.trim().replace(/^\*|\*$/g,'');
      } else point.body.push(line);
    } else group.intro.push(line);
  }
  finishPoint();
  const points = sections.flatMap((s) => s.groups.flatMap((g) => g.points));
  for (const top of [...tops.backend, ...tops.agent]) {
    const hit = points.find((p) => norm(p.title) === norm(top.title));
    if (hit) { top.point = hit; hit.frequency = top.frequency; hit.direction = top.direction; }
  }
  return {tops, sections, points};
}

function docForPoint(p) {
  const t = p.topic + ' ' + p.title;
  if (p.track === 'agent') {
    if (/多\s*Agent|Multi.?Agent|协作拓扑/i.test(t)) return 'kb-multiagent';
    if (/MCP|Function Call|工具调用|Tool|Skill/i.test(t)) return 'kb-tools';
    if (/记忆|会话|多轮对话/.test(t) && !/上下文注入/.test(t)) return 'kb-memory';
    if (/Prompt|提示词|上下文|四类消息/i.test(t)) return 'kb-prompt';
    if (/RAG|检索|向量|Embedding|召回|重排|文档切分/i.test(t)) return 'kb-rag';
    if (/评测|评估|可观测|Trace|回放/i.test(t)) return 'kb-eval';
    if (/安全|越权|权限|注入|审批|治理/i.test(t)) return 'kb-security';
    if (/AI 编程|Coding|Claude Code|Codex|生成代码/i.test(t)) return 'kb-aicoding';
    if (/Runtime|Harness|Orchestrator|工程化|长任务|成本|流式|SSE|沙箱|执行引擎/i.test(t)) return 'kb-runtime';
    if (/Transformer|LLM|微调|训练|推理部署|幻觉|多模态|模型|Token 成本/i.test(t)) return 'kb-llm';
    return 'kb-agent';
  }
  if (/MySQL|数据库（通用/.test(t)) return 'kb-mysql';
  if (/Redis|缓存/.test(t)) return 'kb-redis';
  if (/消息队列|Kafka|RabbitMQ|RocketMQ|Netty/i.test(t)) return 'kb-mq';
  if (/JVM/.test(t)) return 'kb-jvm';
  if (/Spring|MyBatis|ORM/i.test(t)) return 'kb-spring';
  if (/并发编程|多线程|JUC/.test(t)) return 'kb-juc';
  if (/Java/.test(t)) return 'kb-javase';
  if (/计算机网络|安全/.test(t)) return 'kb-network';
  if (/操作系统|Linux/.test(t)) return 'kb-os';
  if (/设计模式/.test(t)) return 'kb-patterns';
  if (/Python|C\+\+/.test(t)) return 'kb-python';
  if (/算法|数据结构|手撕代码题/.test(t)) return 'kb-algorithm';
  return 'kb-distributed';
}

const HINTS = [
  [/最左前缀|联合索引|覆盖索引|回表|索引下推/, /索引/],
  [/慢 SQL|EXPLAIN|执行计划/, /索引|优化|执行/],
  [/线程池/, /线程池/], [/HashMap/, /HashMap|集合/], [/synchronized/, /synchronized/],
  [/分布式锁/, /分布式锁/], [/大 Key|热 Key/, /大.*Key|热.*Key|缓存/],
  [/三次握手|四次挥手/, /三次握手|四次挥手|TCP/], [/Full GC|GC Roots/, /GC|垃圾/],
  [/自动装配/, /自动装配/], [/AOP/, /AOP/], [/ReAct/, /ReAct/],
  [/MCP/, /MCP/], [/Function Call/, /Function.?Call/i], [/Skill/, /Skill/i],
  [/混合检索|BM25/, /Hybrid|混合|BM25/i], [/RAG/, /RAG/],
  [/Transformer/, /Transformer/i], [/KV Cache/, /KV.?Cache/i],
  [/评测集|评测体系/, /评测|评估/], [/可观测|Trace/, /观测|Trace/i],
  [/长期记忆/, /长期记忆|记忆/], [/上下文.*压缩/, /压缩|上下文/]
];
function grams(s) {
  const n = norm(s), set = new Set();
  for (let i=0;i<n.length;i++) set.add(n.slice(i,i+2));
  for (const word of String(s).toLowerCase().match(/[a-z][a-z0-9]+/g) || []) set.add(word);
  return set;
}
function similarity(title, candidate) {
  const a = grams(title), b = grams(candidate);
  let hit = 0; for (const x of a) if (b.has(x)) hit += 1;
  let score = hit / Math.max(1, Math.min(a.size,b.size));
  const nt = norm(title), nc = norm(candidate);
  if (nt && nc && (nt.includes(nc) || nc.includes(nt))) score += 0.65;
  for (const [needle, target] of HINTS) if (needle.test(title) && target.test(candidate)) score += 0.3;
  return score;
}
const AUX_HEADING = /来源档案|参考资料|速记|图解补充|讲解视频|面试问题|面试真题|常见误区|目录|本篇包含|写作备注|官方文档|Cookbook|高频追问补充|对比补充|延伸阅读/;
// Top 80 are pinned. "*" means the lecture has no matching section, so the
// full exam answer is placed in that document's own gap section.
const TOP_EXACT = [
  ['联合索引与最左前缀','kb-mysql','联合索引的最左前缀'],
  ['线程池核心参数','kb-juc','线程池的工作流程'],
  ['HashMap 底层结构','kb-javase','HashMap的底层原理'],
  ['慢 SQL 排查','kb-mysql','SQL 优化的常见思路'],
  ['双指针同向','kb-algorithm','*'],
  ['链表指针重排','kb-algorithm','反转链表怎么理解'],
  ['索引结构与 B+ 树','kb-mysql','索引的数据结构选择'],
  ['分布式锁：SET NX PX','kb-redis','setnx'],
  ['滑动窗口（变长','kb-algorithm','滑动窗口最大值'],
  ['滑动窗口（无重复','kb-algorithm','滑动窗口最大值'],
  ['大 Key、热 Key','kb-redis','BigKey 和 HotKey 问题'],
  ['InnoDB 引擎与 ACID','kb-mysql','01 事务与MVCC'],
  ['事务隔离级别与 RC/RR','kb-mysql','事务隔离的实现机制'],
  ['字符串与数字模拟','kb-algorithm','*'],
  ['synchronized 与锁升级','kb-juc','synchronized的锁升级机制'],
  ['Spring Boot 自动装配','kb-spring','Spring自动装配'],
  ['数据结构与底层编码','kb-redis','01 数据类型'],
  ['多线程基础与线程创建','kb-juc','01 线程基础'],
  ['三次握手与四次挥手','kb-network','三次握手'],
  ['接口幂等与重复提交','kb-distributed','*'],
  ['排序算法与复杂度','kb-algorithm','03 排序算法'],
  ['接口超时与响应慢','kb-distributed','*'],
  ['进程/线程/协程的区别','kb-os','01 进程线程协程'],
  ['缓存击穿与雪崩','kb-redis','缓存击穿'],
  ['LRU/LFU 缓存设计（TTL','kb-algorithm','*'],
  ['GC Roots、可达性分析','kb-jvm','03 垃圾回收'],
  ['消息可靠性三段式','kb-mq','消息的可靠性'],
  ['AOP 原理与 JDK/CGLIB','kb-spring','什么是AOP'],
  ['连接治理：长短连接','kb-network','*'],
  ['CAS 原理与 ABA','kb-juc','ABA 问题'],
  ['树形 DP 与树的深度','kb-algorithm','*'],
  ['图与网格搜索','kb-algorithm','*'],
  ['字符串解析与大数运算','kb-algorithm','*'],
  ['手写 SQL（深分页','kb-algorithm','*'],
  ['二叉树遍历与递归','kb-algorithm','二叉树遍历怎么理解'],
  ['DP 一维与计数','kb-algorithm','*'],
  ['双指针·贪心·单调栈','kb-algorithm','单调栈怎么理解'],
  ['ZSet、跳表与排行榜','kb-redis','ZSet的底层实现'],
  ['限流算法与工程实现','kb-distributed','什么是限流和隔离'],
  ['RAG 基本原理与端到端链路','kb-rag','1. RAG基础'],
  ['上下文窗口预算管理','kb-memory','Compaction'],
  ['工具选择与是否调用工具','kb-tools','Tool selection'],
  ['ReAct 循环与推理范式','kb-agent','4 ReAct'],
  ['混合检索：向量','kb-rag','Hybrid检索与QueryRewrite'],
  ['Harness / Orchestrator / Runtime','kb-runtime','1. Agent-Runtime设计'],
  ['长期记忆分层','kb-memory','长期记忆到底要记什么'],
  ['Skill 渐进式加载','kb-tools','Skill 的动态加载与发现'],
  ['评测体系搭建与评测集','kb-eval','1. 评测框架'],
  ['工具设计与调用可靠性','kb-tools','工具 schema 怎么设计'],
  ['长任务防漂移','kb-runtime','2. 执行恢复'],
  ['系统 Prompt 的结构','kb-prompt','1. Prompt-Engineering'],
  ['MCP 定位与本质','kb-tools','3. MCP'],
  ['LangChain 与 LangGraph 的抽象差异','kb-agent','7. 开发框架选型'],
  ['Agent Loop 实现','kb-agent','6. Agent状态机与终止条件'],
  ['Workflow vs Agent','kb-agent','1. Workflow'],
  ['文档切分策略','kb-rag','6. RAG工程实现全流程'],
  ['长任务规划与执行编排','kb-runtime','3. 异步长任务与流式执行'],
  ['开放型 Agent 产品','kb-runtime','1. Agent-Runtime设计'],
  ['Agent 核心模块','kb-agent','1. Agent定义与边界'],
  ['召回率提升','kb-rag','召回优化策略'],
  ['MCP 与 Function Calling','kb-tools','MCP 和 Function Calling 的关系'],
  ['工具 / MCP 编排','kb-tools','2. ToolUse与Action执行'],
  ['系统/用户/检索/工具四类消息','kb-prompt','2. Context-Engineering'],
  ['向量检索原理','kb-rag','2. Chunking-Embedding-Rerank'],
  ['Agent 评估维度','kb-eval','1. 评测框架'],
  ['意图识别与路由','kb-agent','*'],
  ['Transformer 整体架构','kb-llm','2 Transformer'],
  ['Agent 与单次 LLM','kb-agent','1. Agent定义与边界'],
  ['Claude Code 类 Coding Agent','kb-aicoding','1. Claude-Code'],
  ['Token 成本核算','kb-runtime','4. 成本延迟与稳定性优化'],
  ['RAG 知识库全链路','kb-rag','6. RAG工程实现全流程'],
  ['多轮对话：会话表','kb-memory','2. 会话状态与上下文生命周期'],
  ['Function Calling 全链路','kb-tools','3. Function Calling'],
  ['幻觉成因与分层治理','kb-llm','4. 幻觉与对齐'],
  ['AI 生成代码的正确性判定','kb-aicoding','AI 生成代码的主要问题是什么'],
  ['执行引擎、沙箱','kb-runtime','Executors / Sandboxes'],
  ['通用 Agent 设计','kb-agent','1. Agent定义与边界'],
  ['开源框架盘点','kb-agent','7. 开发框架选型'],
  ['Skill 与 Tool 的区别','kb-tools','5. Skills与插件化']
];
const ALGO_LINKS = [
  [/双指针·贪心|单调栈/, 'p-stack', '栈 / 单调栈专题'],
  [/双指针/, 'p-twoptr', '双指针专题'],
  [/滑动窗口/, 'p-window', '滑动窗口专题'],
  [/链表/, 'p-list', '链表专题'],
  [/排序/, 'p-heap', '堆 · 排序专题'],
  [/二叉树|树形 DP|公共祖先/, 'p-tree', '树专题'],
  [/DP |动态规划|背包/, 'p-dp', '动态规划专题'],
  [/二分/, 'p-bsearch', '二分专题'],
  [/哈希|两数之和/, 'p-hash', '哈希专题'],
  [/图与网格|岛屿|BFS/, 'p-graph', '图专题'],
  [/回溯/, 'p-backtrack', '回溯专题'],
  [/LRU/, 'p-design', '设计题专题'],
  [/贪心/, 'p-greedy', '贪心专题'],
  [/前缀和/, 'p-prefix', '前缀和专题']
];
function algoLink(title) {
  const hit = ALGO_LINKS.find(([needle]) => needle.test(title));
  return hit ? `<p class="md-p"><a href="#/e/${hit[1]}">站内算法专题：${esc(hit[2])} →</a></p>` : '';
}
function resolveTarget(p, models) {
  if (p.track === 'backend' && /^(?:C\+\+|行为面)/.test(p.topic)) {
    return {entry:'exam-backend-detail', anchor:p.anchor, kind:'exam', score:0, heading:p.group};
  }
  const exact = TOP_EXACT.find(([needle]) => p.title.includes(needle));
  if (exact) {
    if (exact[2] === '*') return {entry:exact[1], anchor:'', kind:'extra', score:2, heading:'本篇未单列的考点'};
    const hit = models.get(exact[1]).toc.find((item) => item.text.includes(exact[2]) && !AUX_HEADING.test(item.text));
    if (!hit) throw new Error('Knowledge map: exact target missing ' + JSON.stringify(exact));
    return {entry:exact[1], anchor:hit.id, kind:'library', score:2, heading:hit.text};
  }
  const docId = docForPoint(p);
  const model = models.get(docId);
  const candidates = model.toc.filter((item) => !AUX_HEADING.test(item.text));
  let best = null, score = 0;
  for (const candidate of candidates) {
    const value = similarity(p.title, candidate.text);
    if (value > score) { score = value; best = candidate; }
  }
  if (best && score >= 0.55) return {entry:docId, anchor:best.id, kind:'library', score, heading:best.text};
  return {entry:docId, anchor:'', kind:'extra', score, heading:'本篇未单列的考点'};
}

function supplementHtml(p) {
  const labels = ['本质','必答','高频追问','易错点'].filter((label) => p.body.includes(label));
  const body = mdToSiteHtml(p.body,{idPrefix:'sup-' + p.anchor,dropFirstHeading:false,knowledge:true}).html;
  return `<details class="kb-supplement" id="sup-${p.anchor}"><summary><span>考点补强 · ${esc(p.title)}</span><b>${labels.join(' · ')}</b></summary><div class="kb-supplement-body"><p class="exam-point-summary">${esc(p.summary)}</p>${algoLink(p.title)}${body}</div></details>`;
}
function insertAfterHeading(html, anchor, blocks) {
  const marker = 'id="' + anchor + '"';
  const idAt = html.indexOf(marker);
  if (idAt < 0) throw new Error('Knowledge enrichment: insertion anchor missing ' + anchor);
  const openStart = html.lastIndexOf('<', idAt);
  const open = /^<(h[2-6])\b/.exec(html.slice(openStart));
  if (!open) throw new Error('Knowledge enrichment: heading open tag missing ' + anchor);
  const close = '</' + open[1] + '>';
  const closeAt = html.indexOf(close, idAt);
  if (closeAt < 0) throw new Error('Knowledge enrichment: heading close tag missing ' + anchor);
  const insertAt = closeAt + close.length;
  return html.slice(0, insertAt) + blocks.join('') + html.slice(insertAt);
}
function enrichKnowledgeModels(exam, models) {
  const insertions = new Map(), extras = new Map();
  let enriched = 0;
  for (const p of exam.points) {
    if (p.target.kind === 'exam') continue;
    const docId = p.target.entry;
    const model = models.get(docId);
    const block = supplementHtml(p);
    const supplementId = 'sup-' + p.anchor;
    if (p.target.kind === 'library') {
      const key = docId + '|' + p.target.anchor;
      if (!insertions.has(key)) insertions.set(key,{model,anchor:p.target.anchor,blocks:[]});
      insertions.get(key).blocks.push(block);
    } else {
      if (!extras.has(docId)) extras.set(docId,{model,blocks:[]});
      extras.get(docId).blocks.push(block);
    }
    p.target = {entry:docId, anchor:supplementId, kind:'enriched', score:p.target.score, heading:p.target.heading};
    enriched += 1;
  }
  for (const {model,anchor,blocks} of insertions.values()) model.html = insertAfterHeading(model.html, anchor, blocks);
  for (const {model,blocks} of extras.values()) {
    model.html += `<h2 class="md-h md-h2" id="kb-gap-${model.id}">本篇未单列的考点</h2><p class="md-p">这些考点在本篇没有对应小节。下面保留考点清单里的本质、必答要点、高频追问和易错点，不再挂到「来源档案」或相邻章节。</p>` + blocks.join('');
  }
  return enriched;
}

function tocHtml(toc) {
  const top = toc.length ? Math.min(...toc.map((x) => x.level)) : 2;
  const items = toc.filter((x) => x.level === top);
  return items.length ? `<nav class="kb-page-toc" aria-label="本篇目录"><span>本篇目录</span><div>${items.map((x) => `<a href="#${esc(x.id)}">${esc(x.text)}</a>`).join('')}</div></nav>` : '';
}
function pointHref(p) { return `#/e/${encodeURIComponent(p.target.entry)}/${encodeURIComponent(p.target.anchor)}`; }
function topTable(rows, track) {
  return `<div class="tbl-wrap kb-top-table"><table class="tbl"><thead><tr><th>#</th><th>考点</th><th>方向</th><th>一句话结论</th><th>次数</th></tr></thead><tbody>${rows.map((r) => {
    const p = r.point;
    return `<tr><td class="kb-rank">${r.rank}</td><td>${p ? `<a href="${pointHref(p)}">${esc(r.title)}</a>` : esc(r.title)}</td><td><span class="kb-direction">${esc(r.direction)}</span></td><td>${esc(r.conclusion)}</td><td class="kb-frequency"><b>${r.frequency}</b> 次</td></tr>`;
  }).join('')}</tbody></table></div>`;
}
function mapHtml(exam) {
  const backend = exam.points.filter((p) => p.track === 'backend');
  const agent = exam.points.filter((p) => p.track === 'agent');
  const allGroups = (track) => exam.sections.filter((s) => s.track === track).map((s) => `<section class="kb-map-section"><h3 class="md-h md-h3">${esc(cleanTitle(s.title))}</h3>${s.groups.map((g) => `<details class="kb-group"><summary><span>${esc(g.title)}</span><b>${g.points.length} 个考点</b></summary><div class="kb-points">${g.points.map((p) => `<article class="kb-point" id="${p.anchor}"><div class="kb-point-main"><span class="kb-point-no">${p.no}</span><div><a class="kb-point-title" href="${pointHref(p)}">${esc(p.title)}</a><p>${esc(p.summary)}</p></div></div><div class="kb-point-meta">${p.stars ? `<span class="kb-stars">${esc(p.stars)}</span>` : ''}${p.frequency ? `<span class="kb-frequency"><b>${p.frequency}</b> 次</span>` : ''}<span>${p.target.kind === 'enriched' ? '知识库 · 已补强 →' : '考点详解 →'}</span></div></article>`).join('')}</div></details>`).join('')}</section>`).join('');
  return `<div class="kb-map-intro"><a href="#kb-backend-top">后端 Top 40</a><a href="#kb-agent-top">Agent Top 40</a><a href="#kb-backend-all">后端全部 ${backend.length}</a><a href="#kb-agent-all">Agent 全部 ${agent.length}</a></div>
    <h2 class="md-h md-h2" id="kb-backend-top">传统后端 · 高频考点 Top 40</h2><p class="md-p">只统计后端方向面试；次数与 Agent 方向互不混算。点击考点进入对应知识小节。</p>${topTable(exam.tops.backend,'backend')}
    <h2 class="md-h md-h2" id="kb-agent-top">AI Agent · 高频考点 Top 40</h2><p class="md-p">按 Agent 方向面试出现次数排序；点击考点进入对应知识小节。</p>${topTable(exam.tops.agent,'agent')}
    <h2 class="md-h md-h2" id="kb-backend-all">传统后端 · 全部 ${backend.length} 个考点</h2>${allGroups('backend')}
    <h2 class="md-h md-h2" id="kb-agent-all">AI Agent · 全部 ${agent.length} 个考点</h2>${allGroups('agent')}`;
}
function detailHtml(exam, track) {
  const sections = exam.sections.filter((s) => s.track === track);
  return sections.map((s) => `<h2 class="md-h md-h2">${esc(cleanTitle(s.title))}</h2>${s.groups.map((g) => {
    const intro = g.intro.join('\n').trim();
    const introHtml = intro ? mdToSiteHtml(intro,{idPrefix:'exam-intro',dropFirstHeading:false,knowledge:true}).html : '';
    return `<h3 class="md-h md-h3">${esc(g.title)}</h3>${introHtml}${g.points.map((p) => `<h4 class="md-h md-h4 exam-point-heading" id="${p.anchor}">${p.no}. ${esc(p.title)}${p.stars ? ` <span class="kb-stars">${esc(p.stars)}</span>` : ''}</h4><p class="exam-point-summary">${esc(p.summary)}</p>${mdToSiteHtml(p.body,{idPrefix:p.anchor,dropFirstHeading:false,knowledge:true}).html}`).join('')}`;
  }).join('')}`).join('');
}
function studyGuideHtml(markdown) {
  const start = markdown.indexOf('## 十六、备考建议与速查');
  if (start < 0) throw new Error('Knowledge map: study guide section missing');
  return mdToSiteHtml(markdown.slice(start), {idPrefix:'study', dropFirstHeading:false, knowledge:true}).html;
}

export async function mergeKnowledgeLibrary(entries, dir) {
  const models = new Map();
  for (const doc of KNOWLEDGE_DOCS) {
    const original = await readFile(path.join(dir, doc.id + '.md'), 'utf8');
    const markdown = cleanLibraryMarkdown(original);
    const rendered = mdToSiteHtml(markdown,{idPrefix:doc.id,imageBase:'assets/knowledge/' + doc.id + '/',knowledge:true});
    models.set(doc.id,{...doc,original,markdown,...rendered});
  }
  const examSource = await readFile(path.join(dir,'exam-map.md'),'utf8');
  const exam = parseExam(examSource);
  for (const p of exam.points) p.target = resolveTarget(p,models);
  const topTitles = new Set([...exam.tops.backend, ...exam.tops.agent].map((row) => row.title));
  const unpinnedTop = [...topTitles].filter((title) => title.includes('多态与虚函数表') ? false : !TOP_EXACT.some(([needle]) => title.includes(needle)));
  if (unpinnedTop.length) throw new Error('Knowledge map: unpinned top points ' + unpinnedTop.join(' | '));
  const enriched = enrichKnowledgeModels(exam,models);
  const added = [];
  const push = (entry) => { entries.push(entry); added.push(entry.id); };
  push({id:'interview-map',kind:'doc',mod:'knowledge',part:'考点总览',cat:'后端 + Agent',title:'后端 + Agent 面试考点地图',number:'总览',source:SOURCE,
    lead:`按面试出现次数排序：后端 ${exam.points.filter((p)=>p.track==='backend').length} 个、Agent ${exam.points.filter((p)=>p.track==='agent').length} 个考点。点击题目跳到对应知识小节。知识主干 25 篇，不含面经专题和归档；模型版本与价格以资料生成日 2026-11-12 为准。`,html:mapHtml(exam)});
  push({id:'exam-study-guide',kind:'doc',mod:'knowledge',part:'考点总览',cat:'备考建议',title:'备考建议与速查',number:'建议',source:SOURCE,
    lead:'按优先级分配时间，而不是把 375 个考点平均过一遍。含三条复习路线、40 条速查和复盘模板。',
    html:studyGuideHtml(examSource)});
  for (const track of ['backend','agent']) {
    const ps = exam.points.filter((p) => p.track === track);
    push({id:'exam-' + track + '-detail',kind:'doc',mod:'knowledge',part:'考点总览',cat:track === 'backend' ? '后端考点详解' : 'Agent 考点详解',
      title:(track === 'backend' ? '传统后端' : 'AI Agent') + ` · ${ps.length} 个考点详解`,number:'详解',source:SOURCE,
      lead:'考点清单原文按原顺序排在这里。地图优先跳到知识库里的对应小节；只有资料库没有模块的 C++ 和行为面，锚点落在本页。',html:detailHtml(exam,track)});
  }
  for (const doc of KNOWLEDGE_DOCS) {
    const model = models.get(doc.id);
    const top = model.toc.length ? Math.min(...model.toc.map((x) => x.level)) : 2;
    const chapters = model.toc.filter((x) => x.level === top).length;
    push({id:doc.id,kind:'doc',mod:'knowledge',part:doc.part,cat:doc.cat,title:doc.title,number:'知识',source:SOURCE,
      lead:`${chapters} 个知识章节。可从考点地图带锚点进入，也可按本篇目录顺序学习。`,
      html:`<div class="kb-doc-tools"><a class="btn" href="#/e/interview-map">← 返回考点地图</a><span>${chapters} 章 · 完整讲义</span></div>${tocHtml(model.toc)}${model.html}`});
  }
  const libraryLinks = exam.points.filter((p) => p.target.kind === 'enriched').length;
  const report = {documents:KNOWLEDGE_DOCS.length,backendPoints:exam.points.filter((p)=>p.track==='backend').length,
    agentPoints:exam.points.filter((p)=>p.track==='agent').length,topBackend:exam.tops.backend.length,topAgent:exam.tops.agent.length,
    enriched,libraryLinks,examLinks:exam.points.length-libraryLinks,
    answerDimensions:Object.fromEntries(['本质','必答','高频追问','易错点'].map((label)=>[label,exam.points.filter((p)=>p.body.includes(label)).length])),
    unmatchedTop:[...exam.tops.backend,...exam.tops.agent].filter((x)=>!x.point).map((x)=>x.title)};
  if (report.topBackend !== 40 || report.topAgent !== 40 || report.backendPoints !== 270 || report.agentPoints !== 105 || report.unmatchedTop.length) throw new Error('Knowledge map: extraction drift ' + JSON.stringify(report));
  if (exam.points.some((p) => !p.target || !p.summary)) throw new Error('Knowledge map: incomplete point extraction');
  return {added,report,exam,models};
}

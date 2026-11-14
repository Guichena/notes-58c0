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
    if (p.topic === 'LLM 基础' && /上下文窗口|长度外推/.test(p.title)) return 'kb-llm';
    if (/Prompt|提示词|四类消息/i.test(t) || (/上下文/.test(t) && !/上下文窗口|长度外推/.test(t))) return 'kb-prompt';
    if (/RAG|检索|向量|Embedding|召回|重排|文档切分|父子块/i.test(t)) return 'kb-rag';
    if (/评测|评估|可观测|Trace|回放/i.test(t)) return 'kb-eval';
    if (/AI 编程|Coding|Claude Code|Codex|生成代码/i.test(t)) return 'kb-aicoding';
    if (/Runtime|Harness|Orchestrator|工程化|长任务|成本|流式|SSE|沙箱|执行引擎/i.test(t)) return 'kb-runtime';
    if (/Transformer|LLM|微调|训练|推理部署|多模态|模型|Token 成本/i.test(t)) return 'kb-llm';
    if (/越权|权限|注入|审批/.test(t) || /安全对齐|安全治理/.test(t)) return 'kb-security';
    return 'kb-agent';
  }
  // Topic wins over a single shared word. 缓存/算法/索引 must not pull a point
  // into Redis, the algorithm notes, or the MySQL index family.
  if (/手写 SQL/.test(p.title)) return 'kb-mysql';
  if (/^(?:算法|数据结构|手撕代码题)/.test(p.topic) || /海量数据/.test(p.topic)) return 'kb-algorithm';
  if (/MySQL|数据库（通用/.test(t)) return 'kb-mysql';
  if (/^Java 基础|^Java 集合/.test(p.topic) || /包装类/.test(p.title)) return 'kb-javase';
  if (/^Redis|^缓存/.test(p.topic) || /缓存击穿|缓存雪崩|缓存穿透|Cache Aside|缓存一致性|缓存与 DB|多级缓存/.test(t)) return 'kb-redis';
  if (/消息队列|Kafka|RabbitMQ|RocketMQ|Netty/i.test(t)) return 'kb-mq';
  if (/^JVM/.test(p.topic) || /^JVM/.test(t)) return 'kb-jvm';
  if (/Spring|MyBatis|ORM/i.test(p.topic)) return 'kb-spring';
  if (/并发编程|多线程|JUC/.test(p.topic)) return 'kb-juc';
  if (/^Java/.test(p.topic)) return 'kb-javase';
  if (/计算机网络|^安全/.test(p.topic)) return 'kb-network';
  if (/操作系统|^Linux/.test(p.topic)) return 'kb-os';
  if (/设计模式/.test(p.topic)) return 'kb-patterns';
  if (/Python|^C\+\+/.test(p.topic)) return 'kb-python';
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
  ['滑动窗口（变长','kb-algorithm','*'],
  ['滑动窗口（无重复','kb-algorithm','*'],
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
  ['LRU / LFU 缓存设计','kb-algorithm','*'],
  ['LRU 缓存（HashMap','kb-algorithm','*'],
  ['GC Roots、可达性分析','kb-jvm','03 垃圾回收'],
  ['消息可靠性三段式','kb-mq','消息的可靠性'],
  ['AOP 原理与 JDK/CGLIB','kb-spring','什么是AOP'],
  ['连接治理：长短连接','kb-network','*'],
  ['CAS 原理与 ABA','kb-juc','ABA 问题'],
  ['树形 DP 与树的深度','kb-algorithm','*'],
  ['图与网格搜索','kb-algorithm','*'],
  ['字符串解析与大数运算','kb-algorithm','*'],
  ['手写 SQL（深分页','kb-mysql','*'],
  ['二叉树遍历与递归','kb-algorithm','二叉树遍历怎么理解'],
  ['DP 一维与计数','kb-algorithm','*'],
  ['双指针·贪心·单调栈','kb-algorithm','*'],
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
  const tokens = [...String(p.title).matchAll(/[A-Za-z][A-Za-z0-9+#.-]{2,}|[\u4e00-\u9fa5]{3,8}/g)].map((m) => m[0])
    .filter((token) => !/^(什么|怎么|如何|原理|机制|实现|设计|区别|问题|考点|场景|高频|基础|核心)$/.test(token));
  for (const candidate of candidates) {
    let value = similarity(p.title, candidate.text);
    if (tokens.some((token) => candidate.text.toLowerCase().includes(token.toLowerCase()))) value += 0.3;
    if (value > score) { score = value; best = candidate; }
  }
  if (best && score >= 0.55) return {entry:docId, anchor:best.id, kind:'library', score, heading:best.text};
  return {entry:docId, anchor:'', kind:'extra', score, heading:'本篇未单列的考点'};
}

const FAMILIES = [
  [/LRU|LFU/, 'design', '缓存设计题', 'LRU 用哈希表定位节点，双向链表维持访问顺序：命中后摘下再接到头部，淘汰尾部。LFU 再按频次分桶。TTL 和线程安全是外壳，先讲清结构不变量。'],
  [/布隆过滤器原理/, 'bloom', '布隆过滤器', '多个哈希把存在性压成位图。返回不存在一定正确，返回存在可能误判。位数和哈希个数由元素量与可接受误判率决定，标准布隆不能删除。'],
  [/滑动窗口（/, 'slide', '滑动窗口', '窗口维护一段连续区间的不变量。变长窗口由条件决定何时收缩，定长窗口只平移；无重复子串、最小覆盖和窗口最大值的出窗规则不同。'],
  [/双指针·贪心·单调栈/, 'mono', '双指针、贪心与单调栈', '对撞指针从两端收缩，贪心要说明这次选择为什么不会后悔，单调栈保存还没算出答案的下标。三数之和、接雨水和最大矩形不是同一类不变量。'],
  [/双指针/, 'ptr', '双指针', '同向指针一读一写，对撞指针从两端往中间收。先写清每个指针代表什么，再写移动条件和循环不变量。'],
  [/字符串解析与大数|字符串与数字模拟/, 'bignum', '字符串与大数', '从左到右扫描时保存已经确认的状态，非法字符和溢出要有明确出口。大数按位模拟进位，不要先转成语言里的有限整数。'],
  [/工程实现类/, 'impl', '工程实现', '先把需求拆成能定位的数据结构和边界，再写能跑完的实现。递归要有深度上限，重复请求要有幂等键，类型冲突不能静默丢掉。'],
  [/大文件求交集|分片查找/, 'massive', '海量数据', '先按内存切分，再在片内计算，最后归并。同一键必须进同一片；Top-K 用每片一个小顶堆再归并，不要把全量装进一台机器。'],
  [/使用场景与选型/, 'choose', '选型与场景', '先问数据能不能丢、访问是否够热、结构是否匹配。热数据放缓存，权威数据留在数据库；复杂查询或严格不丢的消息不要用 Redis 硬扛。'],
  [/高并发瓶颈、容量与线上排查/, 'cap', '容量与排查', '先估算热数据内存、QPS 和带宽，再区分慢命令、大 Key 和单线程阻塞。本地缓存挡热点，Redis 挡共享流量，容量按副本和余量一起算。'],
  [/接口超时|响应慢的分层|P99 突增/, 'trace', '线上排障', '先把拐点和发布、配置、流量对齐，再用 trace 把 P99 拆到 span。和 GC 时间窗重叠就是自己停顿，不重叠再看下游；不要只看平均值。'],
  [/上下文窗口|长度外推/, 'ctxwin', '上下文窗口', '窗口要同时留下系统提示、历史、检索结果和输出预留。长度外推改变的是位置编码能看多远，不会让模型多记住一件事实。'],
  [/Kafka 高吞吐|顺序写|页缓存|消息模型/, 'mqcore', '消息吞吐', '吞吐来自顺序写、页缓存和批量压缩，不是把消息当成缓存。零拷贝只减少拷贝次数；可靠性仍要看生产、存储和消费三段。'],
  [/包装类|equals|hashCode|集合框架|接口与抽象|面向对象|重载|重写|编译解释/, 'java', '语言契约', 'equals 和 hashCode 必须成对。重载看编译期参数，重写看运行期类型；接口给能力，抽象类给一部分实现。'],
  [/链表/, 'list', '链表', '改 next 之前先保存后继。dummy 用来消掉头结点特判；快慢指针用来找中点、判环和倒数第 N 个。'],
  [/动态规划|DP |背包|打家劫舍|编辑距离|LIS|LCS|系列题进阶/, 'dp', '动态规划', '先定义状态和最后一步转移，再定初始化和遍历方向。环形、限次和可重复通常是在线性 DP 上破环或加一维，不要另起一套状态。'],
  [/二叉树|树形|LCA|树的递归|子结构|直径/, 'tree', '树', '先说清递归函数返回什么。路径类题在后序汇总全局答案，函数本身通常只返回单边信息。'],
  [/图搜索|岛屿|BFS|拓扑排序|并查集/, 'graph', '图与搜索', '网格当成隐式图。BFS 入队时就标记，否则会重复入队；要最短步数用 BFS，不要求最短才考虑 DFS 或并查集。'],
  [/排序|Top-?K|快速选择|二分|哈希|前缀和|位运算|回溯|区间|矩阵|数组|字符串|大数|概率|摩尔|红黑树|AVL|栈与|括号|表达式/, 'algo', '其余算法与结构', '先说出暴力复杂度，再指出有序性、单调性或可判定性把复杂度降下来。边界和返回值语义要比模板更容易错。'],
  [/装饰器|深拷贝|浅拷贝|list\/tuple|容器对比/, 'py', 'Python 对象与容器', '先分清对象身份和值。浅拷贝只复制外层容器，嵌套对象仍然共享；装饰器本质是返回新函数，注意被替换的元数据。'],
  [/幂等|超卖|重复提交|重复消费|Exactly-Once|防重/, 'idem', '幂等与防重', '先把请求幂等、业务唯一和内容去重分开。最终裁决放在唯一约束或状态机上，缓存只负责并发抑制和结果缓存。'],
  [/连接治理|长短连接|半\/全连接|心跳|WebSocket|SSE|epoll|粘包|NAT|HTTP\/1|队头阻塞|状态码|send 语义|自定义协议/, 'net', '连接与协议', '连接数受文件描述符、backlog 和四元组共同限制。长连接靠应用层心跳，TCP Keepalive 保不住业务是否还活着。'],
  [/JWT|Cookie|Session|Token|越权|RBAC|ABAC|Web 安全/, 'sec', '登录态与权限', '认证解决你是谁，授权解决你能做什么。令牌无状态不等于不能失效，高风险动作必须在服务端再校验一次。'],
  [/MVCC|分库分表|索引|SQL |分页|行锁|表锁|主键|调优|数据类型|容量|PostgreSQL|MongoDB|倒排|存储选型/, 'db', '索引、事务与容量', '先看执行计划和索引能不能定位，再谈锁、日志和拆分。分库分表是最后手段，拆之前要能说清分片键、跨片查询和扩容。'],
  [/Lua|过期删除|哈希槽|淘汰|Pipeline|Cache Aside|布隆|Bitmap|HyperLogLog|Stream|缓存/, 'cache', '缓存与失效', '穿透是数据不存在，击穿是热点刚好失效，雪崩是大面积同时失效。展示数据可以逻辑过期，库存和余额要互斥重建。'],
  [/阻塞队列|锁的分类|ctl |并发容器|死锁|读写锁|线程数|CompletableFuture|无锁|自旋|伪共享|交替打印|等待多线程|上下文切换|生产者-消费者|并发手撕/, 'juc', '并发协作', '先定共享状态，以及谁在等谁。条件等待要放在 while 里，多角色等待用 notifyAll，锁放在 finally 里释放。'],
  [/Conditional|全局异常|MyBatis|#\{\}|\$\{}|SQL 注入/, 'spring', 'Spring 与 ORM', '条件装配看 classpath 和配置，不满足就不注册 Bean。${} 会拼进 SQL，#{} 才是预编译参数。'],
  [/垃圾回收|分代|回收器|G1 |OOM|StackOverflow|排查工具|CPU 100%/, 'jvm', 'GC 与排查', '先分清对象是分配太快，还是回收之后仍然活着。CPU 高先看线程栈，内存涨先看支配树和大对象。'],
  [/IPC|系统调用|零拷贝|malloc|页缓存|缓存局部性|物理内存|僵尸|孤儿|守护进程|ps\/top|lsof|awk|Shell/, 'os', '操作系统与 Linux', '进程隔离地址空间，线程共享堆和文件描述符。malloc 失败和页缓存是操作系统的内存账，不是某个 JVM 区域 OOM。线上先定位进程、端口和线程。'],
  [/积压处理|消费扩容/, 'mq', '消息积压', '先看是生产太快、消费太慢，还是单分区把并行度卡住。扩容不能超过分区数，重复投递靠业务幂等吸收。'],
  [/RPC|Protobuf|Dubbo|OpenFeign|Nacos|压测|恶意流量|Docker|K8s|Kubernetes|灰度|多租户|状态机|短链|表结构|QPS|瓶颈|重试|定时任务|Git |ZooKeeper|Raft|一致性哈希|搜索与推荐|红包|购物车|开放平台|推送|降级|玩法/, 'dist', '分布式与场景', '先给量级、一致性和失败代价，再选组件。正常路径、失败兜底和扩容方式要一起讲，不能只画一张成功时的架构图。'],
  [/意图识别|自进化|多智能体|故障定位|结构化输出|实时风控|幻觉治理|越权防护|提示注入/, 'agentx', '路由、安全与治理', '意图决定走哪条路径，权限决定这个路径能不能执行。模型可以提出动作，删除、付款和外发必须由代码校验。'],
  [/上下文传递|任务分解|协作拓扑|通信机制|结果仲裁|Planner/, 'multi', '多 Agent 协作', '拆开是为了隔离上下文和并行，不是为了多几个角色。每个子任务要有完成条件；结果冲突时先查外部证据，而不是再问一次同一个模型。'],
  [/多轮对话历史|最近窗口/, 'mem', '会话历史', '整段历史直接塞进窗口会越来越贵，也会冲掉约束。进窗口的应是任务状态、摘要和最近几轮，长输出放到会话外。'],
  [/流式输出|流式调用|断点续跑|传统后端差异|Java 对接|推理框架|工程化落地|从 0 到 1/, 'rt', '运行时与交付', '长任务的状态不能只放在进程内存里。流式事件要带序号才能断线续传；上线前先补幂等、观测和回滚。'],
  [/文档解析|Rerank|父子块|语义切分|Embedding 模型选型|混合检索与召回|错召回|漏召回/, 'ragx', '检索工程', '解析和切分决定能不能召回到，重排决定哪几段进上下文。父子块解决的是小块召回、大块阅读，不是数据库索引。错召回和漏召回要分开查。'],
  [/强制结构化|JSON Schema|长度外推|微调 vs RAG|微调vsRAG/, 'promptx', '提示与路线选择', '下游程序要消费的内容必须有 schema。会变化的事实用检索，稳定的窄任务才考虑微调。'],
  [/训练范式|Tokenizer|BPE|显存|SFT |LoRA|端侧|Q-Former|多模态|投影层/, 'llm', '训练、微调与多模态', '先分清参数、梯度和 KV Cache 各占哪一块显存。微调改变行为，检索补充事实，二者不要互相替代。'],
  [/测试用例|任务成功率|消融|无 GT|A-B|A\/B/, 'eval', '评测方法', '先准备能判定对错的题目，再看分数。自动裁判要和人工抽检对过，不能单独当作发布依据。'],
  [/AI 辅助开发|工具选型|日常 AI Coding|Claude Code \/ Codex|工作流与最难/, 'aicoding', 'AI Coding', '生成结果要能对上需求、跑过测试，并且可以回滚。工具之间的差别主要在上下文、权限和编辑方式。']
];
function fam(slug) {
  const hit = FAMILIES.find((row) => row[1] === slug);
  if (!hit) throw new Error('Knowledge map: unknown family ' + slug);
  return {slug: hit[1], title: hit[2], intro: hit[3]};
}
function algoFamily(text) {
  if (/LRU|LFU/.test(text)) return fam('design');
  if (/布隆过滤器原理/.test(text)) return fam('bloom');
  if (/滑动窗口/.test(text)) return fam('slide');
  if (/双指针·贪心|单调栈/.test(text)) return fam('mono');
  if (/双指针/.test(text)) return fam('ptr');
  if (/字符串解析与大数|字符串与数字模拟/.test(text)) return fam('bignum');
  if (/系列题进阶|动态规划|DP |背包|打家劫舍|编辑距离|LIS|LCS/.test(text)) return fam('dp');
  if (/二叉树|树形|LCA|树的递归|子结构|直径/.test(text)) return fam('tree');
  if (/图搜索|图与网格|岛屿|BFS|并查集/.test(text)) return fam('graph');
  if (/链表/.test(text)) return fam('list');
  if (/并发手撕|生产者-消费者|交替打印/.test(text)) return fam('juc');
  if (/工程实现类/.test(text)) return fam('impl');
  if (/大文件求交集|分片查找|海量统计/.test(text)) return fam('massive');
  return fam('algo');
}
function redisFamily(text) {
  if (/使用场景与选型/.test(text)) return fam('choose');
  if (/高并发瓶颈|容量与线上排查/.test(text)) return fam('cap');
  return fam('cache');
}
function mqFamily(text) {
  if (/积压|消费扩容/.test(text)) return fam('mq');
  if (/幂等|Exactly|重复消费/.test(text)) return fam('idem');
  return fam('mqcore');
}
function familyOf(p) {
  const text = p.topic + ' ' + p.title;
  const topic = p.topic;
  // Family is chosen inside the point's own topic. A shared word such as 缓存,
  // 索引, 链表, 容量 or OOM must not borrow another module's chapter.
  if (/手写 SQL/.test(text)) return fam('db');
  if (/^(?:算法|数据结构|手撕代码题)/.test(topic) || /海量数据/.test(topic)) return algoFamily(text);
  if (/^Java 基础|^Java 集合/.test(topic)) return fam('java');
  if (topic === 'JVM') return fam('jvm');
  if (/^Redis|^缓存/.test(topic)) return redisFamily(text);
  if (topic === '操作系统' || topic === 'Linux') return fam('os');
  if (topic === 'Spring' || topic === 'MyBatis / ORM') return fam('spring');
  if (topic === 'RAG') return fam('ragx');
  if (/^消息队列/.test(topic)) return mqFamily(text);
  if (topic === '多 Agent 协作') return fam('multi');
  if (/^流式输出/.test(topic)) return fam('rt');
  if (topic === 'Prompt 工程') return fam('promptx');
  if (/上下文窗口|长度外推/.test(text)) return fam('ctxwin');
  if (p.track === 'agent' && /场景题/.test(topic)) {
    if (/检索|召回|切分|父子块/.test(text)) return fam('ragx');
    if (/工程化落地|从 0 到 1/.test(text)) return fam('rt');
    return fam('agentx');
  }
  if (p.track !== 'agent' && /场景题/.test(topic)) {
    if (/积压|消费扩容/.test(text)) return fam('mq');
    if (/幂等|超卖|重复提交|重复下单|防重|防重复/.test(text)) return fam('idem');
    if (/超时|响应慢|P99|bad case|排查/.test(text)) return fam('trace');
    return fam('dist');
  }
  if (p.track !== 'agent' && /^(?:分布式系统|微服务|高并发|云原生|测试)/.test(topic)) {
    if (/幂等|超卖|重复|Exactly|防重/.test(text)) return fam('idem');
    return fam('dist');
  }
  for (const [needle, slug, title, intro] of FAMILIES) if (needle.test(text)) return {slug, title, intro};
  return {slug:'other', title:'其他考点', intro:'下面按该考点自己的本质、必答要点、高频追问和易错点展开，不并进相邻章节。'};
}
function lectureSection(p) {
  const body = mdToSiteHtml(p.body,{idPrefix:'sup-' + p.anchor,dropFirstHeading:false,knowledge:true}).html;
  return `<section class="kb-lecture" id="sup-${p.anchor}"><h3 class="md-h md-h3">${p.no}. ${esc(p.title)}</h3><p class="exam-point-summary">${esc(p.summary)}</p>${algoLink(p.title)}${body}</section>`;
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
      if (!extras.has(docId)) extras.set(docId,{model,points:[]});
      extras.get(docId).points.push(p);
    }
    p.target = {entry:docId, anchor:supplementId, kind:'enriched', score:p.target.score, heading:p.target.heading};
    enriched += 1;
  }
  for (const {model,anchor,blocks} of insertions.values()) model.html = insertAfterHeading(model.html, anchor, blocks);
  for (const {model,points} of extras.values()) {
    const groups = new Map();
    for (const point of points) {
      const family = familyOf(point);
      if (!groups.has(family.slug)) groups.set(family.slug, {family, points:[]});
      groups.get(family.slug).points.push(point);
      point.target.heading = family.title;
    }
    for (const {family, points: grouped} of groups.values()) {
      model.html += `<h2 class="md-h md-h2" id="kb-gap-${model.id}-${family.slug}">${esc(family.title)}</h2><p class="md-p">${esc(family.intro)}</p>` + grouped.map(lectureSection).join('');
    }
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
function routeHtml(exam) {
  const find = (needle) => {
    const hits = exam.points.filter((point) => point.title.includes(needle));
    if (hits.length !== 1) throw new Error('Interview route: ' + needle + ' -> ' + hits.map((point) => point.title).join(' | '));
    return hits[0];
  };
  const step = (title, links, note) => `<li><h3 class="md-h md-h3">${esc(title)}</h3>${links.length ? `<p class="kb-route-links">${links.map((needle) => `<a href="${pointHref(find(needle))}">${esc(find(needle).title)}</a>`).join('')}</p>` : ''}${note ? `<p class="md-p">${note}</p>` : ''}</li>`;
  const block = (id, title, intro, steps) => `<section class="kb-route" id="${id}"><h2 class="md-h md-h2">${esc(title)}</h2><p class="md-p">${intro}</p><ol class="kb-route-list">${steps}</ol></section>`;
  const mysql = block('route-mysql', 'MySQL：先索引，再事务', '图上的赢面是从索引和慢 SQL 开口，再收束到隔离级别、MVCC 和主从。讲义按事务、日志、索引、锁、主从排，答题时按下面这条走。', [
    step('索引和慢 SQL', ['联合索引与最左前缀', '索引结构与 B+ 树', '慢 SQL 排查'], '先讲联合索引能不能从最左列连续用，再讲三层 B+ 树大约 2000 万行从哪来，最后用 EXPLAIN 的 type、key_len、Extra 落地。'),
    step('列顺序、下推和覆盖', ['按条件设计索引', '回表与覆盖索引'], '等值列放前面，范围列放后面。索引下推是先在索引里滤掉再回表；覆盖索引是不用回表。'),
    step('分表还是分库', ['单表容量与性能量级', '分库分表与分片键'], '行数和行宽决定树高，点查变慢先归档、加索引，再分表。写入 QPS、连接和磁盘把一台机器打满，才拆到多台物理库。多建几个逻辑库仍在同一实例上，不加写入能力。'),
    step('隔离级别、日志和 MVCC', ['事务隔离级别与 RC/RR', 'InnoDB 引擎与 ACID', '三大日志', 'MVCC：undo'], '读未提交只用来说明脏读，不要拿去扣库存。RC 和 RR 的差别是 ReadView 建一次还是每条语句重建。崩溃恢复看 redo 和两阶段提交，不另记一套 bit ring。'),
    step('锁和主从', ['锁机制：行锁', '死锁：成因、定位与避免', '主从复制、延迟与读写分离'], '间隙锁和临键锁跟着 RR 一起讲。主库挂了的切换就在主从这条的追问里，MHA 或 MGR，不要再开一章。')
  ].join(''));
  const redis = block('route-redis', 'Redis：先结构，再排查，最后一致性', '图上从数据结构走到排查、高可用、单线程，一致性和持久化放后面。讲义把持久化放在高可用里，BigKey 放得靠后，答题按这条收。', [
    step('五种结构和编码', ['数据结构与底层编码', 'String 与 SDS', 'ZSet、跳表与排行榜'], 'List、Hash、ZSet 的小对象走 listpack，大了才换链表、哈希表或跳表。排行榜用 ZSet，不要用 List 硬做。'),
    step('同分再按时间排', [], 'ZSet 的 score 是 double，只有 53 位能精确表示整数，不能把 32 位分数和 32 位时间戳原样拼进去。同分用放大：<code class="tok-inline">points * 10^10 + (10^10 - ts)</code>，时间戳不超过 10 位，再用 ZREVRANGE 取高分。跨度更大就不要挤进一个 double。'),
    step('布隆、位图、基数和地理位置', ['布隆过滤器与 HyperLogLog', 'Bitmap 位图', '使用场景与选型'], 'GEO 是 ZSet 加 geohash，写在使用场景里。布隆只保证「一定不存在」，误判率由位数和哈希个数决定。'),
    step('大 Key、热点和同槽', ['大 Key、热 Key', '本地缓存与多级缓存', 'Cluster 哈希槽、迁移与 Gossip'], '大 Key 拆开。热点先用本地缓存挡，再按业务拆 Key。多个 Key 掉进同一个槽，是 CRC16 的结果，用 <code class="tok-inline">{tag}</code> 把该在一起的放一起，把不该挤在一起的 tag 错开。'),
    step('哨兵、集群和单线程', ['哨兵与高可用部署', '单线程模型与 Redis 为什么快'], '从库可以读，但要接受复制延迟。命令仍在主线程执行；6.0 的多线程只分担网络读写。没有「20 万 QPS 就不能开」这条铁律，看的是慢命令会不会堵住主线程。'),
    step('一致性和持久化', ['缓存与数据库一致性', 'Cache Aside 时序与延迟双删', 'RDB/AOF 持久化'], '延迟双删和 Canal 处理删缓存失败、读请求回填旧值。版本号处理并发写：旧版本不能覆盖新版本。分布式锁只挡住同时写，挡不住「库写成功、缓存删失败」。AOF 是把写命令重放，RDB 是某一时刻的快照。')
  ].join(''));
  const kafka = block('route-kafka', 'Kafka：先接到做过的事，再讲不丢和积压', '图上先问项目，再丢消息、积压、高吞吐，高可用收在 ISR。原理章按概念往下排，场景在后面的架构题里。答题从可靠性三段进入，再跳到对应场景。', [
    step('可靠性、顺序和事务', ['消息可靠性三段式', '顺序消息与分区内有序', '分区、Key 设计与 Rebalance', '事务消息与本地消息表', '延迟消息实现'], '分区和 Redis 槽是同一类映射：先哈希，再落到固定分片。热点是同一个 key 打进一个分区，加分区却不改 key 没有用。'),
    step('把题引到真实场景', ['秒杀系统全链路', '消息与 IM', '三大日志'], '秒杀不要停在「用了 Kafka」，要讲预热、扣减和削峰。IM 的顺序是同会话一个分区。Canal 订阅 binlog，既出现在 MySQL 日志里，也用来异步删缓存。'),
    step('积压、幂等和副本', ['积压处理与扩容上限', '重复消费归因与业务幂等', '布隆过滤器原理与误判率', 'ISR、副本与 Controller 选举'], '布隆放在消费入口只能挡「一定没见过」。返回「可能见过」仍要查业务唯一键，误判会把新消息丢掉。消费线程若停在 Full GC，超过 max.poll.interval.ms 会被踢出组并触发 Rebalance。协议不绑定 Java，可靠性参数仍是 acks、重试和手动提交。'),
    step('高吞吐', ['Kafka 高吞吐原理', '海量统计 Top-K'], '顺序写、页缓存和零拷贝是这条的主体。日志量大以后的窗口聚合才引到 Flink，不要把 Flink 当成 Kafka 原理的一部分。KRaft 是去掉 ZooKeeper 之后的元数据选主，写在 ISR 这条里。')
  ].join(''));
  return `<div class="kb-map-intro"><a href="#route-mysql">MySQL</a><a href="#route-redis">Redis</a><a href="#route-kafka">Kafka</a><a href="#/e/interview-map">考点地图</a></div>
    <p class="md-p">三张路线图决定答题时先说哪一叉。下面每个节点都进已经写好的考点；只有图上有、原来没写成一句的判断，补在节点下面。不含「含金量」和临场话术。</p>${mysql}${redis}${kafka}`;
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
    lead:`按面试出现次数排序：后端 ${exam.points.filter((p)=>p.track==='backend').length} 个、Agent ${exam.points.filter((p)=>p.track==='agent').length} 个考点。点击题目跳到对应知识小节。MySQL、Redis、Kafka 的答题分叉在面试路线。`,html:mapHtml(exam)});
  push({id:'kb-interview-routes',kind:'doc',mod:'knowledge',part:'考点总览',cat:'后端 + Agent',title:'MySQL / Redis / Kafka 面试路线',number:'路线',source:SOURCE,
    lead:'按面试时的分叉顺序走：MySQL 先索引，Redis 先数据结构，Kafka 先接到做过的事。每个节点进入已有考点。',
    html:routeHtml(exam)});
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
      html:`<div class="kb-doc-tools"><a class="btn" href="#/e/interview-map">← 返回考点地图</a>${doc.id === 'kb-mysql' || doc.id === 'kb-redis' || doc.id === 'kb-mq' ? `<a class="btn" href="#/e/kb-interview-routes/${doc.id === 'kb-mq' ? 'route-kafka' : 'route-' + doc.id.slice(3)}">面试路线 →</a>` : ''}<span>${chapters} 章 · 完整讲义</span></div>${tocHtml(model.toc)}${model.html}`});
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

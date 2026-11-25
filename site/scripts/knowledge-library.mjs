// Interview exam map + imported backend/Agent knowledge library.
// All source Markdown and images are checked in; this projection runs after the
// legacy content guards, just like the design lectures.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {mdToSiteHtml} from './md-lite.mjs';
import {renderProjectStackPage} from './project-stack.mjs';

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
    if (/^>\s*(?:\*\*)?来源(?:\*\*)?[：:]\s*购买资料/.test(line)) continue;
    if (/^>\s*题目是我出的/.test(line)) continue;
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
function renderInlineMd(text) {
  return esc(text)
    .replace(/`([^`]+)`/g, '<code class="tok-inline">$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}
function splitInlinePoints(text) {
  const s = text.trim();
  if (/^①/.test(s) && /(?:[；;。]|\n)\s*②/.test(s)) {
    return s.split(/(?:[；;。]|\n)\s*(?=[②③④⑤⑥⑦⑧⑨⑩])/).map((item) => item.replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, '').trim()).filter(Boolean);
  }
  if (/^1[）)]/.test(s) && /(?:[；;。]|\n)\s*2[）)]/.test(s)) {
    return s.split(/(?:[；;。]|\n)\s*(?=[2-9][）)])/).map((item) => item.replace(/^\d+[）)]\s*/, '').trim()).filter(Boolean);
  }
  return null;
}
function splitFollowUps(rawList) {
  const out = [];
  for (const raw of rawList) {
    const pieces = raw.trim()
      .split(/(?<=[。！？；;])\s*(?=追问[「"“：:]|追问[^。！？；;→]{2,55}→|「[^」]{3,70}」\s*→|"[^"]{3,90}"\s*→|\*\*["「]|[^。！？；;→]{4,60}[？?]\s*→)/)
      .map((s) => s.trim()).filter(Boolean);
    for (const piece of pieces) {
      const cleaned = piece.replace(/^追问(?:者常追加)?[：:]?\s*/, '').trim();
      const arrow = cleaned.indexOf('→');
      if (arrow > 0) {
        const q = cleaned.slice(0, arrow).trim().replace(/^[「"“]|["”」]$/g, '').replace(/^\*\*|\*\*$/g, '').replace(/^[「"“]|["”」]$/g, '').trim();
        const a = cleaned.slice(arrow + 1).trim().replace(/[；;]+$/, '');
        out.push({q, a});
      } else {
        out.push({q: '', a: cleaned});
      }
    }
  }
  return out;
}
function splitPitfalls(rawList) {
  const items = [];
  for (const raw of rawList) {
    let cur = '', depth = 0, inCode = false;
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === '`') inCode = !inCode;
      else if (!inCode && (ch === '（' || ch === '(')) depth++;
      else if (!inCode && (ch === '）' || ch === ')')) depth = Math.max(0, depth - 1);
      if (!inCode && depth === 0 && ch === '；') {
        if (cur.trim()) items.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    if (cur.trim()) items.push(cur.trim());
  }
  return items;
}
function renderExamPointBody(p, idPrefix) {
  const lines = String(p.body || '').replace(/\r\n?/g, '\n').split('\n');
  let mode = '';
  const essence = [];
  const mustBlocks = [];
  const followUps = [];
  const pitfalls = [];
  const variants = [];
  const extras = [];
  let curMust = null;
  const flushMust = () => { if (curMust) { mustBlocks.push(curMust); curMust = null; } };
  for (const line of lines) {
    let m;
    if ((m = /^- 本质[：:]\s*(.*)$/.exec(line))) {
      flushMust(); mode = 'essence';
      if (m[1].trim()) essence.push(m[1].trim());
      continue;
    }
    if ((m = /^- 必答要点(?:[①②③④⑤]|（[^）]*）)?[：:]\s*(.*)$/.exec(line))) {
      flushMust(); mode = 'must';
      curMust = [];
      if (m[1].trim()) curMust.push(m[1].trim());
      continue;
    }
    if ((m = /^- 高频追问[：:]\s*(.*)$/.exec(line))) {
      flushMust(); mode = 'fup';
      let rest = m[1].trim();
      const inlinePit = rest.split(/[｜|]\s*易错点[：:]\s*/);
      if (inlinePit.length > 1) {
        if (inlinePit[0].trim()) followUps.push(inlinePit[0].trim());
        pitfalls.push(inlinePit.slice(1).join('；').trim());
      } else if (rest) {
        followUps.push(rest);
      }
      continue;
    }
    if ((m = /^- 易错点[：:]\s*(.*)$/.exec(line))) {
      flushMust(); mode = 'pitfall';
      if (m[1].trim()) pitfalls.push(m[1].trim());
      continue;
    }
    if ((m = /^- （同组细分）\s*(.*)$/.exec(line))) {
      flushMust(); mode = 'variant';
      if (m[1].trim()) variants.push(m[1].trim());
      continue;
    }
    if (mode === 'must' && curMust) {
      curMust.push(line.replace(/^\s+(?=\|)/, '').replace(/^  /, ''));
    } else if (mode === 'fup' && line.trim()) {
      const rest = line.trim();
      const inlinePit = rest.split(/[｜|]\s*易错点[：:]\s*/);
      if (inlinePit.length > 1) {
        if (inlinePit[0].trim()) followUps.push(inlinePit[0].trim());
        pitfalls.push(inlinePit.slice(1).join('；').trim());
      } else followUps.push(rest);
    } else if (mode === 'essence' && line.trim()) {
      essence.push(line.trim());
    } else if (mode === 'pitfall' && line.trim()) {
      pitfalls.push(line.trim());
    } else if (mode === 'variant' && line.trim()) {
      variants.push(line.trim());
    } else if (line.trim()) {
      extras.push(line);
    }
  }
  flushMust();

  const out = [];
  if (essence.length) {
    out.push(`<div class="kb-ans-block kb-ans-essence"><div class="kb-ans-kicker">核心本质</div><div class="kb-ans-body">${essence.map((t) => `<p class="md-p">${renderInlineMd(t)}</p>`).join('')}</div></div>`);
  }
  if (mustBlocks.length) {
    let renderedMust;
    if (mustBlocks.length > 1 && mustBlocks.every((b) => b.length === 1 && !/^\s*(?:\||[-*]|\d+\.)/.test(b[0]))) {
      renderedMust = `<ol class="md-list kb-must-list">${mustBlocks.map((b) => `<li>${renderInlineMd(b[0])}</li>`).join('')}</ol>`;
    } else {
      renderedMust = mustBlocks.map((blockLines, bIdx) => {
        const joined = blockLines.join('\n').trim();
        if (!joined) return '';
        if (!blockLines.some((l) => /^\s*(?:\||```)/.test(l))) {
          const split = splitInlinePoints(joined);
          if (split) return `<ol class="md-list kb-must-list">${split.map((item) => `<li>${renderInlineMd(item)}</li>`).join('')}</ol>`;
        }
        return mdToSiteHtml(joined, {idPrefix: idPrefix + '-m' + bIdx, dropFirstHeading: false, knowledge: false}).html;
      }).join('');
    }
    out.push(`<div class="kb-ans-block kb-ans-must"><div class="kb-ans-kicker">必答要点</div><div class="kb-ans-body">${renderedMust}</div></div>`);
  }
  if (followUps.length) {
    const qas = splitFollowUps(followUps);
    out.push(`<div class="kb-ans-block kb-ans-fup"><div class="kb-ans-kicker">高频追问</div><div class="kb-qa-list">${qas.map((qa) => qa.q
      ? `<div class="kb-qa-item"><div class="kb-qa-q">${renderInlineMd(qa.q)}</div><div class="kb-qa-a">${renderInlineMd(qa.a)}</div></div>`
      : `<div class="kb-qa-item"><div class="kb-qa-a">${renderInlineMd(qa.a)}</div></div>`
    ).join('')}</div></div>`);
  }
  if (pitfalls.length) {
    const pitItems = splitPitfalls(pitfalls);
    out.push(`<div class="kb-ans-block kb-ans-pitfall"><div class="kb-ans-kicker">易错点与边界</div><ul class="md-list kb-pitfall-list">${pitItems.map((t) => `<li>${renderInlineMd(t)}</li>`).join('')}</ul></div>`);
  }
  if (variants.length) {
    out.push(`<div class="kb-ans-block kb-ans-variants"><div class="kb-ans-kicker">关联延伸</div><ul class="md-list kb-variant-list">${variants.map((t) => `<li>${renderInlineMd(t)}</li>`).join('')}</ul></div>`);
  }
  if (extras.length) {
    out.push(mdToSiteHtml(extras.join('\n'), {idPrefix: idPrefix + '-x', dropFirstHeading: false, knowledge: false}).html);
  }
  return `<div class="kb-ans-grid">${out.join('')}</div>`;
}
function lectureSection(p) {
  const body = renderExamPointBody(p, 'sup-' + p.anchor);
  return `<section class="kb-lecture" id="sup-${p.anchor}"><h3 class="md-h md-h3">${p.no}. ${esc(p.title)}</h3><p class="exam-point-summary">${esc(p.summary)}</p>${algoLink(p.title)}${body}</section>`;
}
function supplementHtml(p) {
  const labels = ['本质','必答','高频追问','易错点'].filter((label) => p.body.includes(label));
  const body = renderExamPointBody(p, 'sup-' + p.anchor);
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
function detailPointHref(p) { return `#/e/exam-${p.track}-detail/${encodeURIComponent(p.anchor)}`; }
function isHandwriteAlgorithm(point) {
  if (!point) return false;
  if (/^(?:算法|数据结构)/.test(point.topic)) return true;
  return point.topic === '手撕代码题' && !point.title.includes('手写 SQL');
}
const BACKEND_BUCKETS = ['MySQL 与存储','Redis 与缓存','并发编程','Java 与集合','Spring 与 ORM','JVM','消息队列','网络与安全','操作系统与 Linux','分布式与场景','工程与其他'];
const AGENT_BUCKETS = ['RAG 与检索','记忆与上下文','工具与 MCP','Agent 架构与编排','Runtime 与工程化','评测与安全','模型与推理','AI 编程'];
function pointBucket(p) {
  if (p.track === 'agent') {
    if (/^(?:RAG|向量检索|Embedding)/.test(p.topic)) return 'RAG 与检索';
    if (/^(?:记忆|Prompt)/.test(p.topic)) return '记忆与上下文';
    if (/^(?:工具调用|MCP)/.test(p.topic)) return '工具与 MCP';
    if (/^(?:Agent 架构|多 Agent|LangChain)/.test(p.topic)) return 'Agent 架构与编排';
    if (/^(?:AI 工程化|流式输出|场景题)/.test(p.topic)) return 'Runtime 与工程化';
    if (/^(?:Agent 评测|幻觉)/.test(p.topic)) return '评测与安全';
    if (/^(?:AI 编程)/.test(p.topic)) return 'AI 编程';
    return '模型与推理';
  }
  if (/^(?:MySQL|数据库)/.test(p.topic) || p.title.includes('手写 SQL')) return 'MySQL 与存储';
  if (/^(?:Redis|缓存)/.test(p.topic)) return 'Redis 与缓存';
  if (/^并发编程/.test(p.topic)) return '并发编程';
  if (/^Java/.test(p.topic)) return 'Java 与集合';
  if (/^(?:Spring|MyBatis)/.test(p.topic)) return 'Spring 与 ORM';
  if (/^JVM/.test(p.topic)) return 'JVM';
  if (/^消息队列/.test(p.topic)) return '消息队列';
  if (/^(?:计算机网络|安全)/.test(p.topic)) return '网络与安全';
  if (/^(?:操作系统|Linux)/.test(p.topic)) return '操作系统与 Linux';
  if (/^(?:分布式系统|微服务|高并发|云原生|场景题)/.test(p.topic)) return '分布式与场景';
  return '工程与其他';
}
function highFreqList(exam, track) {
  if (track === 'agent') {
    return exam.tops.agent.filter((r) => r.point).map((r) => ({point: r.point, conclusion: r.conclusion || r.point.summary, bucket: pointBucket(r.point)}));
  }
  const topRows = exam.tops.backend.filter((r) => r.point && !isHandwriteAlgorithm(r.point) && !/^(?:C\+\+|Python|行为面)/.test(r.point.topic));
  const seen = new Set(topRows.map((r) => r.point));
  const extra3 = exam.points.filter((p) => p.track === 'backend' && !isHandwriteAlgorithm(p) && p.stars === '★★★' && !seen.has(p) && !/^(?:C\+\+|Python|行为面)/.test(p.topic) && !/海量数据/.test(p.topic));
  return [
    ...topRows.map((r) => ({point: r.point, conclusion: r.conclusion || r.point.summary, bucket: pointBucket(r.point)})),
    ...extra3.map((p) => ({point: p, conclusion: p.summary, bucket: pointBucket(p)}))
  ];
}
function boardHtml(exam, track) {
  const items = highFreqList(exam, track);
  const buckets = (track === 'backend' ? BACKEND_BUCKETS : AGENT_BUCKETS).filter((b) => items.some((it) => it.bucket === b));
  const backendTotal = exam.points.filter((p) => p.track === 'backend' && !isHandwriteAlgorithm(p)).length;
  const agentTotal = exam.points.filter((p) => p.track === 'agent').length;
  const head = track === 'backend'
    ? `<div class="kb-board-head"><a class="btn primary" href="#/e/exam-backend-detail">传统后端全量考点详解（${backendTotal} 题） →</a><a class="btn" href="#/e/kb-agent-board">AI Agent 高频榜 →</a><a class="btn" href="#/e/algo-handwrite-board">手撕算法原题榜 →</a></div>`
    : `<div class="kb-board-head"><a class="btn primary" href="#/e/exam-agent-detail">AI Agent 全量考点详解（${agentTotal} 题） →</a><a class="btn" href="#/e/interview-map">← 传统后端高频榜</a></div>`;
  const filters = `<div class="ab-filters kb-filter-bar"><button type="button" class="on" data-kb-type="all">全部 <b>${items.length}</b></button>${buckets.map((b) => {
    const n = items.filter((it) => it.bucket === b).length;
    return `<button type="button" data-kb-type="${esc(b)}">${esc(b)} <b>${n}</b></button>`;
  }).join('')}</div>`;
  const routeTips = track === 'backend' ? [
    ['MySQL 与存储', 'route-mysql', '开口串联：先答联合索引能从最左连续定位几列、三层 B+ 树约两千万行怎么推，再用 EXPLAIN 落地；追问时收束到 RC/RR 快照差异与覆盖索引下的 MVCC 回表。'],
    ['Redis 与缓存', 'route-redis', '开口串联：先说业务用哪种结构解决什么问题，再讲大 Key / 热 Key 拆分与本地缓存，最后收口到先改库再删缓存的一致性边界与持久化取舍。'],
    ['消息队列', 'route-kafka', '开口串联：先绑定业务要保不丢、保顺序还是削峰，按生产回执、ISR 副本、手动提交三段确认展开，再接分区热点、积压扩容上限与业务唯一键幂等。']
  ].map(([b, rid, text]) => `<div class="kb-route-tip" data-kb-route="${esc(b)}" hidden><span>${esc(text)}</span><a href="#/e/kb-interview-routes/${rid}">完整开口路线 →</a></div>`).join('') : '';
  const list = `<ol class="ab-list kb-board-list">${items.map((it, idx) => {
    const p = it.point;
    const rank = String(idx + 1).padStart(2, '0');
    const twin = p.target.kind === 'enriched' ? `<a class="ab-twin" href="${pointHref(p)}">讲义 →</a>` : '';
    return `<li class="ab-row kb-board-row kb-filter-item${idx < 10 ? ' ab-top' : ''}" data-kb-type="${esc(it.bucket)}" data-kb-key="${p.anchor}"><a class="kb-board-hit" href="${detailPointHref(p)}"><span class="ab-rank">${rank}</span><span class="ab-main"><span class="kb-btitle-row"><span class="ab-title">${esc(p.title)}</span><span class="ab-chip">${esc(p.topic)}</span><span class="kb-board-badge" data-kb-badge="${p.anchor}" hidden></span></span><span class="kb-bdesc">${esc(it.conclusion)}</span></span></a>${twin}</li>`;
  }).join('')}</ol>`;
  const note = track === 'backend'
    ? '按真实面试高频度从前到后排好，不标具体次数；算法与数据结构手撕已独立归入《手撕算法原题榜》。点任意考点直达完整解析卡片，需要看全量细分考点可点上方全量详解。'
    : '按 AI Agent 面试高频度从前到后排好，不标具体次数。点任意考点直达完整解析卡片，全部 105 个考点收录在上方全量详解页。';
  return `<div class="ab-page kb-board-page kb-filter-page">${head}<p class="ab-lead">${esc(note)}</p>${filters}${routeTips}${list}</div>`;
}
function detailHtml(exam, track) {
  const allPoints = exam.points.filter((p) => p.track === track && (track !== 'backend' || !isHandwriteAlgorithm(p)));
  const buckets = (track === 'backend' ? BACKEND_BUCKETS : AGENT_BUCKETS).filter((b) => allPoints.some((p) => pointBucket(p) === b));
  const backHref = track === 'backend' ? '#/e/interview-map' : '#/e/kb-agent-board';
  const backText = track === 'backend' ? '← 返回传统后端高频榜' : '← 返回 AI Agent 高频榜';
  const head = `<div class="kb-board-head"><a class="btn" href="${backHref}">${backText}</a><span class="kb-detail-stat">共 ${allPoints.length} 个考点 · 保留完整原理、参数边界、连环追问与易错点</span></div>`;
  const studyBar = `<div class="kb-study-bar"><div class="kb-mfilter-group" role="group" aria-label="掌握状态筛选"><span class="kb-study-label">掌握筛选</span><button type="button" class="on" data-kb-mfilter="all">全部</button><button type="button" data-kb-mfilter="0">未学</button><button type="button" data-kb-mfilter="1">模糊</button><button type="button" data-kb-mfilter="2">已掌握</button></div><div class="kb-study-right"><span class="kb-mastery-stat" data-kb-stat data-kb-total="${allPoints.length}">掌握 0 · 模糊 0 · 未学 ${allPoints.length}</span><button type="button" class="kb-recite-btn" data-kb-recite aria-pressed="false">背诵自测：遮挡答案</button></div></div>`;
  const filters = `<div class="ab-filters kb-filter-bar"><button type="button" class="on" data-kb-type="all">全部 <b>${allPoints.length}</b></button>${buckets.map((b) => {
    const n = allPoints.filter((p) => pointBucket(p) === b).length;
    return `<button type="button" data-kb-type="${esc(b)}">${esc(b)} <b>${n}</b></button>`;
  }).join('')}</div>`;
  const sections = exam.sections.filter((s) => s.track === track).map((s) => ({
    ...s,
    groups: s.groups.map((g) => ({...g, points: track === 'backend' ? g.points.filter((p) => !isHandwriteAlgorithm(p)) : g.points})).filter((g) => g.points.length)
  })).filter((s) => s.groups.length);
  const body = sections.flatMap((s) => s.groups.map((g) => {
    const bucket = pointBucket(g.points[0]);
    const intro = g.intro.map((line) => line.replace(/^>\s?/, '').trim()).filter(Boolean).join(' ');
    const introHtml = intro ? `<div class="kb-group-intro">${renderInlineMd(intro)}</div>` : '';
    const cards = g.points.map((p) => {
      const lec = p.target.kind === 'enriched' ? `<a class="kb-lec-link" href="${pointHref(p)}">对应讲义 →</a>` : '';
      const marks = `<div class="kb-mark-group" data-kb-mark-group="${p.anchor}"><button type="button" data-kb-mark="0" class="on">未学</button><button type="button" data-kb-mark="1">模糊</button><button type="button" data-kb-mark="2">掌握</button></div>`;
      const reveal = `<button type="button" class="kb-reveal-bar" data-kb-reveal>先在脑中口述核心结论与连环追问 · 点击展开核对答案</button>`;
      return `<article class="kb-detail-card" id="${p.anchor}" data-kb-key="${p.anchor}"><div class="kb-dcard-head"><h3 class="md-h md-h3 exam-point-heading"><span class="kb-dcard-no">${String(p.no).padStart(2, '0')}</span>${esc(p.title)}</h3><div class="kb-dcard-acts">${marks}${lec}</div></div>${reveal}<p class="exam-point-summary">${esc(p.summary)}</p>${renderExamPointBody(p, p.anchor)}</article>`;
    }).join('');
    return `<section class="kb-dgroup kb-filter-item" data-kb-type="${esc(bucket)}"><h2 class="md-h md-h2">${esc(g.title)}</h2>${introHtml}${cards}</section>`;
  })).join('');
  return `<div class="kb-detail-page kb-filter-page">${head}${studyBar}${filters}${body}</div>`;
}

export function resolveRetiredKnowledgeRoute(id) {
  const raw = String(id || '').trim();
  if (!raw) return null;
  const exact = {
    'ai-': 'kb-agent-board',
    'bg-': 'interview-map',
    'ai-agent-1': 'kb-agent',
    'ai-agent-3': 'kb-agent',
    'ai-agent-4': 'kb-agent',
    'ai-agent-5': 'kb-multiagent',
    'ai-agent-6': 'kb-aicoding',
    'ai-agent-7': 'kb-runtime',
    'ai-agent-8': 'kb-security',
    'ai-agent-9': 'kb-eval',
    'doc-17': 'kb-multiagent',
    'own-es-reading-guide': 'kb-mq',
    'own-os-containers': 'kb-distributed',
    'own-practice-analysis-artifact-gates': 'new-systems-billion-row-analysis-agent'
  }[raw];
  if (exact) return exact;
  if (/^(?:ai-rag-|own-rag-)/.test(raw)) return 'kb-rag';
  if (/^(?:bg-elasticsearch-|bg-kafka-|bg-rabbitmq-|bg-rocketmq-|own-mq-)/.test(raw)) return 'kb-mq';
  if (/^(?:bg-redis-|own-redis-)/.test(raw)) return 'kb-redis';
  if (/^own-mysql-/.test(raw)) return 'kb-mysql';
  if (/^own-network-/.test(raw)) return 'kb-network';
  if (/^own-spring-/.test(raw)) return 'kb-spring';
  if (/^own-java-/.test(raw)) return 'kb-javase';
  if (/^own-juc-/.test(raw)) return 'kb-juc';
  if (/^(?:own-jvm-|q-own-jvm-)/.test(raw)) return 'kb-jvm';
  if (/^own-os-/.test(raw)) return 'kb-os';
  if (/^own-distributed-/.test(raw)) return 'kb-distributed';
  if (/^own-memory-/.test(raw)) return 'kb-memory';
  if (/^own-runtime-/.test(raw)) return 'kb-runtime';
  if (/^own-tools-/.test(raw)) return 'kb-tools';
  if (/^own-theory-/.test(raw)) return 'kb-llm';
  if (/^ai-/.test(raw)) return 'kb-agent';
  if (/^bg-/.test(raw)) return 'interview-map';
  return null;
}

export function remapRetiredArchivedRoutes(archivedRoutes, liveIds) {
  const next = {};
  for (const [id, info] of Object.entries(archivedRoutes || {})) {
    if (info && liveIds.has(info.ownerId)) {
      next[id] = info;
      continue;
    }
    const fallback = resolveRetiredKnowledgeRoute(id) || resolveRetiredKnowledgeRoute(info?.ownerId) || 'interview-map';
    next[id] = { ownerId: liveIds.has(fallback) ? fallback : 'interview-map', mod: 'knowledge' };
  }
  return next;
}
function routeHtml(exam) {
  const find = (needle) => {
    const hits = exam.points.filter((point) => point.title.includes(needle));
    if (hits.length !== 1) throw new Error('Interview route: ' + needle + ' -> ' + hits.map((point) => point.title).join(' | '));
    return hits[0];
  };
  const step = (title, links, note) => `<li><h3 class="md-h md-h3">${esc(title)}</h3>${links.length ? `<p class="kb-route-links">${links.map((needle) => `<a href="${pointHref(find(needle))}">${esc(find(needle).title)}</a>`).join('')}</p>` : ''}${note ? `<p class="md-p">${note}</p>` : ''}</li>`;
  const block = (id, title, intro, steps) => `<section class="kb-route" id="${id}"><h2 class="md-h md-h2">${esc(title)}</h2><p class="md-p">${intro}</p><ol class="kb-route-list">${steps}</ol></section>`;
  const mysql = block('route-mysql', 'MySQL：先答索引，再答事务', '问到 MySQL，我先答这条 SQL 为什么慢、索引用上了几列。他追问，我再讲隔离级别和主从。下面是我会怎么开口，参数和执行计划进后面的考点。', [
    step('索引和慢 SQL', ['联合索引与最左前缀', '索引结构与 B+ 树', '慢 SQL 排查'], '我先给结论：联合索引是一棵按列排好的树，只能从最左边连续用。比如三列索引上只查第一列和第三列，中间断了，就只用到第一列。然后再补一句，普通行宽下三层大约能放下两千万行，所以单表变大先看是不是还查得动。他拿出一条 SQL，我就说清有没有走到索引、用了几列、要不要再查一次整行。'),
    step('列顺序、下推和覆盖', ['按条件设计索引', '回表与覆盖索引'], '等值条件放前面，范围条件放后面，能定位的列更多。下推是先在索引里丢掉不满足的行，再去拿整行，次数少了，但不是完全不拿。覆盖索引是要的列都在索引里，取列不用再查整行。他要是问覆盖了还会不会再查一次，我会说：取列不用；可重复读下，如果这一行对当前事务还不可见，仍然要拿主键回到主键索引上找能看见的版本，因为旧版本挂在主键那棵树上。'),
    step('分表还是分库', ['单表容量与性能量级', '分库分表与分片键'], '我先问慢在读还是写。行变宽、按主键查变慢，先归档、把索引补好，再按行数拆表。一台机器的写入、连接或磁盘满了，才把库拆开。只多建几个库、还在同一台机器上，写入能力不会变。'),
    step('隔离级别、日志和多版本', ['事务隔离级别与 RC/RR', 'InnoDB 引擎与 ACID', '三大日志', 'MVCC：undo'], '四种级别我只区分一件事：能不能看见别人还没提交的修改，以及能不能看见别人刚提交的修改。读未提交会读到后来回滚的数据，不要拿去扣库存。可重复读和读已提交的差别，是快照建一次，还是每条语句重新看一眼。库崩了能不能恢复，看重做日志刷下去没有，以及这次提交有没有做完。'),
    step('锁和主从', ['锁机制：行锁', '死锁：成因、定位与避免', '主从复制、延迟与读写分离'], '可重复读里，范围查询会把中间的空档也锁上，避免别人插进行。死锁我就说能打破的那个条件，一般是大家按同一个顺序加锁。从库可以读，但复制有延迟，刚写完可能还读到旧的。主库挂了怎么切，答到能自动选出新主就停，不再报一串组件名。')
  ].join(''));
  const redis = block('route-redis', 'Redis：先说这个结构干什么', '我先答业务上用它解决什么，再答线上会坏在哪。他不追问，我不会把编码名字全部报出来。', [
    step('五种结构和编码', ['数据结构与底层编码', 'String 与 SDS', 'ZSet、跳表与排行榜'], '排行榜我用有序集合，不用列表硬排。数据量小的时候用更紧凑的打包格式，变大才换成跳表或哈希表。他问普通字符串为什么不够，我再讲长度存在头里，取长度不用把内容扫一遍。'),
    step('同分再按时间排', [], '有序集合的分数是浮点数，精确的整数位数不够同时放下分数和时间。所以我不会说高 32 位放分数、低 32 位放时间。同分时把分数放大，再加上一个随时间变小的数，让更早的排在前面，再从高分往低分取。写法是 <code class="tok-inline">points * 10^10 + (10^10 - ts)</code>，时间不能超过这个放大倍数。再大就不要塞进一个分数里。'),
    step('布隆、位图和地理位置', ['布隆过滤器与 HyperLogLog', 'Bitmap 位图', '使用场景与选型'], '布隆过滤器我只承诺：它说没有，就一定没有；它说可能有，还要再查一次库。误判多不多，看位图多大、哈希做几次。签到、附近的人、大概有多少人来过，按要不要精确来选，不把名字堆在前面。'),
    step('大 Key、热点和挤在一个槽', ['大 Key、热 Key', '本地缓存与多级缓存', 'Cluster 哈希槽、迁移与 Gossip'], '值太大，会把处理命令的那条线程堵住；访问太集中，会打满一个分片。两种都要拆。特别热的先放在本机内存里挡一层。多个键算到同一个槽，是取模的结果：该在一起的用同一个标签，不该挤在一起的把标签错开。'),
    step('从库、哨兵和单线程', ['哨兵与高可用部署', '单线程模型与 Redis 为什么快'], '从库可以读，但要接受刚写的数据还没复制过去。命令仍然是一个线程在执行，后来加的线程只负责网络收发。我不会背一个 QPS 数字当作开关，就看慢命令会不会把这个线程堵住。'),
    step('和数据库一致，以及掉电怎么办', ['缓存与数据库一致性', 'Cache Aside 时序与延迟双删', 'RDB/AOF 持久化'], '我默认先改数据库，再删缓存。删失败就重试，必要时过一小会儿再删一次，避免旧值被填回去。订阅数据库日志再删，是失败后的兜底。版本号解决两个人一起写、旧的不能覆盖新的。加锁只能让他们不要同时写，不能保证库写成功了、缓存却没删掉。掉电恢复分两种：一种把每次写命令记下来重放，一种留一份某个时刻的整库快照。')
  ].join(''));
  const kafka = block('route-kafka', 'Kafka：先说当时要保证什么', '问我用过没有，我先说当时不能丢、要有序，还是要挡住突发流量。再按发出、存住、消费完三段说怎么确认。他追场景，我再讲秒杀或即时通讯，不先画架构图。', [
    step('不丢、有序和事务', ['消息可靠性三段式', '顺序消息与分区内有序', '分区、Key 设计与 Rebalance', '事务消息与本地消息表', '延迟消息实现'], '不丢要三段都确认：发出去有回执，副本写够了才算成功，处理完再记消费位置。顺序只在同一个分区里成立。热点常常是同一个键进了同一个分区，只加分区、键不变，热点还在。'),
    step('接到做过的事', ['秒杀系统全链路', '消息与 IM', '三大日志'], '秒杀我不会停在用了队列。我会讲请求怎么在进数据库之前被拦住，库存怎么一次扣成，订单怎么异步写下去。即时通讯要有序，就把同一个会话放进同一个分区。数据库变更要通知别人，我订阅提交日志，不在业务事务里直接发消息。'),
    step('积压、重复和副本', ['积压处理与扩容上限', '重复消费归因与业务幂等', '布隆过滤器原理与误判率', 'ISR、副本与 Controller 选举'], '积压先分清是生产太快、消费太慢，还是一个分区把并行卡住了。重复消费靠业务上的唯一编号，不能只靠布隆过滤器。它说没见过才可信，它说见过还要再查；判错会把新消息丢掉。消费如果长时间停住，比如停在垃圾回收，超过轮询间隔会被移出组，分区重新分配。换一种语言，确认方式还是这套。'),
    step('为什么吞吐高', ['Kafka 高吞吐原理', '海量统计 Top-K'], '我会说三件事：顺序写盘、数据先留在系统的页缓存里、少几次内存拷贝。日志大到要按时间窗统计，再引到流计算，那是下一条，不是这道题本身。去掉外置的协调组件之后，选主就在副本这条里说完。')
  ].join(''));
  return `<div class="kb-map-intro"><a href="#route-mysql">MySQL</a><a href="#route-redis">Redis</a><a href="#route-kafka">Kafka</a><a href="#/e/interview-map">← 传统后端高频榜</a></div>
    <p class="md-p">这里按面试里怎么开口来写：先给结论，再用一个例子接住追问。点进去是展开后的参数和边界，开口时不用全部背出来。</p>${mysql}${redis}${kafka}`;
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
  push({id:'interview-map',kind:'doc',mod:'knowledge',part:'考点总览',cat:'高频考点榜',title:'传统后端高频榜',number:'后端榜',source:SOURCE,
    lead:'只列传统后端核心高频考点，按重要度排好顺序、不标具体次数。全部 222 个后端考点完整收录在《传统后端 · 全量考点详解》。',html:boardHtml(exam,'backend')});
  push({id:'kb-agent-board',kind:'doc',mod:'knowledge',part:'考点总览',cat:'高频考点榜',title:'AI Agent 高频榜',number:'Agent榜',source:SOURCE,
    lead:'只列 AI Agent 核心高频考点，按重要度排好顺序、不标具体次数。全部 105 个 Agent 考点完整收录在《AI Agent · 全量考点详解》。',html:boardHtml(exam,'agent')});
  const projectStackSource = await readFile(path.join(dir,'project-stack.md'),'utf8');
  const projectStack = renderProjectStackPage(projectStackSource);
  push({id:'kb-project-stack',kind:'doc',mod:'knowledge',part:'考点总览',cat:'项目八股专题',title:'项目技术栈与中间件八股（三段经历串联）',number:'项目',source:SOURCE,
    lead:`串联 NoteWeave、制造业生产事件平台与 TencentDB Agent Memory 的 ${projectStack.topics.length} 个核心专题（含 5 套同名工程手撕与全量指标口径卡），支持按经历、技术域与掌握状态筛选。`,
    html:projectStack.html});
  for (const track of ['backend','agent']) {
    const ps = exam.points.filter((p) => p.track === track && (track !== 'backend' || !isHandwriteAlgorithm(p)));
    push({id:'exam-' + track + '-detail',kind:'doc',mod:'knowledge',part:'考点总览',cat:'全量考点详解',
      title:(track === 'backend' ? '传统后端' : 'AI Agent') + ` · 全量考点详解（${ps.length} 题）`,number:'全量',source:SOURCE,
      lead:track === 'backend'
        ? '完整收录传统后端全部非算法考点（手写 SQL 保留在本页，算法归入《手撕算法原题榜》）。支持按模块一键筛选，每题保留本质、必答要点、高频追问与易错点。'
        : '完整收录 AI Agent 全部考点，支持按模块一键筛选，每题保留本质、必答要点、高频追问与易错点。',html:detailHtml(exam,track)});
  }
  push({id:'kb-interview-routes',kind:'doc',mod:'knowledge',part:'考点总览',cat:'路线与速查',title:'MySQL / Redis / Kafka 面试路线',number:'路线',source:SOURCE,
    lead:'按面试里怎么开口来排。先给结论，再用一个例子接住追问。点进去才是参数和边界。',
    html:routeHtml(exam)});
  push({id:'exam-study-guide',kind:'doc',mod:'knowledge',part:'考点总览',cat:'路线与速查',title:'备考建议与 40 条速查',number:'速查',source:SOURCE,
    lead:'按优先级分配时间，含三条复习路线、最容易被问倒的 40 条速查和复盘模板。',
    html:studyGuideHtml(examSource)});
  for (const doc of KNOWLEDGE_DOCS) {
    const model = models.get(doc.id);
    const top = model.toc.length ? Math.min(...model.toc.map((x) => x.level)) : 2;
    const chapters = model.toc.filter((x) => x.level === top).length;
    const isAgentDoc = doc.part === 'Agent 知识库';
    const backBoard = isAgentDoc
      ? '<a class="btn" href="#/e/kb-agent-board">← AI Agent 高频榜</a><a class="btn" href="#/e/exam-agent-detail">全量考点详解</a>'
      : '<a class="btn" href="#/e/interview-map">← 传统后端高频榜</a><a class="btn" href="#/e/exam-backend-detail">全量考点详解</a>';
    push({id:doc.id,kind:'doc',mod:'knowledge',part:doc.part,cat:doc.cat,title:doc.title,number:'知识',source:SOURCE,
      lead:`${chapters} 个知识章节。可从高频榜或全量详解直达对应小节，也可按本篇目录系统学习。`,
      html:`<div class="kb-doc-tools"><div class="kb-doc-btns">${backBoard}${doc.id === 'kb-mysql' || doc.id === 'kb-redis' || doc.id === 'kb-mq' ? `<a class="btn" href="#/e/kb-interview-routes/${doc.id === 'kb-mq' ? 'route-kafka' : 'route-' + doc.id.slice(3)}">面试路线 →</a>` : ''}</div><span>${chapters} 章 · 完整讲义</span></div>${tocHtml(model.toc)}${model.html}`});
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

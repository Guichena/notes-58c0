// Presentation only: never write to an entry, repository, question key or store.
// Keep the original content and renderer bytes as the auditable source of truth.
const pageCleanups = new WeakMap();
const HEADING = /^H[2-6]$/;
const OPTIONAL_PANEL_TITLES = new Set(['?看到这些关键词就想到它', 'O复杂度备忘', '!必测边界']);
const TEXT_REPAIRS = Object.freeze([
  {
    entryId: 'own-practice-event-time-billing',
    selector: '.qa[data-key="own-practice-event-time-billing#q-own-practice-event-time-billing"] .md-p',
    tokens: [{text: '[《算法与数据结构面试手册》的“AVL、实时排行榜与乱序时间戳计费”](https://my.feishu.cn/wiki/PU07w5G8zi0MqjkjGEecc33Mnxd)',
      label: '《算法与数据结构面试手册》的“AVL、实时排行榜与乱序时间戳计费”', href: 'https://my.feishu.cn/wiki/PU07w5G8zi0MqjkjGEecc33Mnxd'}],
  },
  {
    entryId: 'own-rag-service',
    selector: '.qa[data-key="own-rag-service#q-own-rag-shopping-incident"] .md-p',
    tokens: [{text: '[《推理部署与性能优化面试手册》](https://my.feishu.cn/wiki/TiMywuJr9icJdAkVFo2cnivsn1d)',
      label: '《推理部署与性能优化面试手册》', href: 'https://my.feishu.cn/wiki/TiMywuJr9icJdAkVFo2cnivsn1d'}],
  },
  {
    entryId: 'sceneqa-4', selector: '.qa[data-key="sceneqa-4#7"] .cmp td',
    exact: '`start_time`、`end_time`',
    tokens: [{text: '`start_time`', label: 'start_time'}, {text: '`end_time`', label: 'end_time'}],
  },
  {
    entryId: 'bg-redis-8', selector: '.qa[data-key="bg-redis-8#2"] .cmp td',
    exact: '命令先入队，`EXEC` 时按顺序跑',
    tokens: [{text: '`EXEC`', label: 'EXEC'}],
  },
  {
    entryId: 'doc-29', selector: '.callout.plain > p',
    exact: '两张图都围绕智能 AI Debug/告警处理工具。`智能 AI DEBUG 工具.jpg` 偏系统架构：监控、告警 Agent、大模型、RAG-ES、RRF 双路召回。`复杂版.jpg` 偏执行流程：告警平台、AI 平台、大模型生成处理计划、状态机/workflow 执行、MCP 查询 Git/DB/EXPLAIN、生成修复建议并提交合并请求。本文合并整理，但保留两张图各自的结构。',
    tokens: [{text: '`智能 AI DEBUG 工具.jpg`', label: '智能 AI DEBUG 工具.jpg'}, {text: '`复杂版.jpg`', label: '复杂版.jpg'}],
  },
]);

// Ten individually reviewed paragraph breaks. Joining each segment list is the
// exact original text; punctuation, links and technical examples are unchanged.
const PARAGRAPH_BREAKS = [
  {
    "entryId": "pattern-transaction-ha",
    "selector": ".md p.md-p",
    "segments": [
      "TCC 正确答案的完整参与者边界：stock 表示尚未消费的总量，frozen 是其中已预留部分，须保持 0≤frozen≤stock；Try(q) 仅在 stock−frozen≥q 时令 frozen+=q，Confirm 令 stock-=q 且 frozen-=q，Cancel 仅令 frozen-=q。",
      "唯一身份至少为(tenant,globalTransactionId,branchId)，本文一个订单只有一个库存分支时才能简写orderId；收据绑定SKU、正数量及规范化输入，不把调用方新传数量用于释放。",
      "对ABSENT收到Confirm必须拒绝或进入待核实，不能扣库存或伪造成功；CANCELLED只幂等接受Cancel，CONFIRMED只幂等接受Confirm，反向终态拒绝。Try库存不足的确定失败也需记录稳定REJECTED结果，同号重试返回它；若允许再次预留，应另开新业务尝试身份。",
      "协调者必须先持久记录唯一COMMIT/CANCEL决定并验证全部Try结果，恢复只重发该决定，参与者不能因本地超时自行推翻已决事务。收据/墓碑保留覆盖重放、备份恢复及迟到窗口；否则拒绝旧时代请求而非删除后重新受理。",
      "所有写入遵循先收据后库存的锁序、同一本地事务和行数检查；同键冲突需回滚后核验原收据，未知提交查询原键。这里给的是可实现与可验收的协议，未提供跨资源协调器/JDBC实现或数据库运行证明。"
    ]
  },
  {
    "entryId": "own-tools-protocol",
    "selector": ".qa[data-key=\"own-tools-protocol#q-own-tools-http-generations\"] p.md-p",
    "segments": [
      "现代 HTTP 的 JSON-RPC 请求 POST 要求带 MCP-Protocol-Version、Mcp-Method，tools/call、resources/read、prompts/get 还带相应 Mcp-Name，并与消息体一致。Accept 声明 application/json 和 text/event-stream。",
      "这一版核心协议没有客户端到服务端的 HTTP 通知；notifications/cancelled 只用于 stdio。传输文档虽定义通知 POST 的一般接收规则，却没有定义其 header 要求，不能将请求头表直接外推到通知扩展。",
      "缺失、非法或不一致的必需元数据返回 HTTP 400 与 -32020；不支持版本返回 400 与 -32022；现代未知方法返回 404 与 -32601。存在且非法的 Origin 必须拒绝为 403，本地服务优先只绑定 loopback。",
      "代理与应用不能看到不同的路由目标。存在特殊字符的名称与被声明映射到 header 的参数，必须按规范编码；大小写规则、重复 header、缺失值和非法工具定义都要验证。",
      "原 http_contract.py 的教学定位仅是这些纯函数合同，本页没有交付该文件或执行记录，不代表已经实现 HTTP、OAuth 或 SSE 服务。"
    ]
  },
  {
    "entryId": "own-rag-workflow",
    "selector": ".qa[data-key=\"own-rag-workflow#q-own-rag-qa-note-wiki\"] p.md-p",
    "segments": [
      "以 2026-10-10 核对的固定提交 c60decb1a94470e732ce54a7b3cc854410095073 解释时，可以进一步说：上传完成入口的本地事务建立 Source、Snapshot 与 Task；对象存储复制等外部效果不受这个数据库事务原子覆盖；Kafka 异步模式启用时，再在该事务内写入 parse outbox，随后由 Java 消费 parse、chunk、embed、index 阶段。",
      "关闭 Kafka 的开发/测试分支直接调用同步解析与索引。中间产物有对象存储引用，并非所有解析都由 Python 承担。",
      "multipart 的 max-file-size 与 max-request-size 均配置为 128 MiB（128×1024×1024 字节），实际可上传文件还受请求封装开销及其他入口限制约束。它证明配置限制，不证明每种格式的满尺寸文件都实际成功跑过。",
      "PDF 路径有临时文件缓冲，但仍存在读全量字节或保留完整文本的阶段，不能说端到端恒定内存。当前源码也不能倒推为简历期间完全相同的实现。"
    ]
  },
  {
    "entryId": "ai-agent-6",
    "selector": ".qa[data-key=\"ai-agent-6#11\"] p.md-p",
    "segments": [
      "追问：Mock 底层怎样实现？ fake 通常是手写的简化实现，例如内存仓库；调用拦截式 mock 则把方法名、参数和调用顺序交给处理器，按参数匹配规则返回预设值、抛异常或执行 Answer，同时记录调用，供 verify 核对次数、参数和必要顺序。配置行为与验证实际调用是两个阶段，不能只让测试“返回想要的答案”。",
      "Java 接口可用动态代理把调用分派给 InvocationHandler；类 mock 可生成子类并覆盖可重写方法，因此普通子类路线受 final 等限制。",
      "以 Mockito 5.24.0 的 MockMaker 区分为例，PROXY 仅支持接口，SUBCLASS 通过子类拦截，INLINE 可借助 instrumentation 支持部分子类方案无法拦截的 final 类型/方法，但仍受 JDK、模块、运行环境和具体引擎能力限制。",
      "不是所有 mock 都靠反射，也不是开启 inline 就能模拟任意底层行为；优先选择可注入接口与清晰的调用合同。"
    ]
  },
  {
    "entryId": "bg-elasticsearch-3",
    "selector": ".qa[data-key=\"bg-elasticsearch-3#0\"] p.md-p",
    "segments": [
      "同一提交中的 ResearchAgentCompletionCommitter 对 canonical ResearchAgent 完成提交检查 worker 身份、epoch、fencing、lease、摘要和预期 cell 版本；这不是所有 worker 回调共用的校验路径。",
      "checkpoint hydration 恢复的是有身份与 hash 约束的业务账本，不是 JVM 堆栈；ArtifactJobService.completeFromWorker 在本地关系事务内追加 artifact 版本与候选回执；这不包含外部文件发布的原子性，也不意味着独立的 WorkerTaskCallbackService 回调具有同样的 ResearchAgent epoch 校验。",
      "检索回查 MySQL 的 workspace、状态和最新已索引快照，说明读取侧有资格与版本过滤，不能推出索引与关系库同步事务提交。最新已索引版本也不一定等于刚上传的最新版本。"
    ]
  },
  {
    "entryId": "own-rag-service",
    "selector": ".qa[data-key=\"own-rag-service#q-own-rag-shopping-incident\"] p.md-p",
    "segments": [
      "前十分钟优先保可用和正确性。冻结高风险发布并比对近期配置，查看入口到达率、线程与连接池排队、embedding、ANN、重排和生成各段；若与某次发布高度相关且有安全回退代，就回滚整套兼容配置。",
      "对非必要的多轮改写、额外图通道或重排按预先验证的降级策略限量，限制重试和队列，保留关键词与精确商品查询兜底。价格、库存、权限与上下架校验不能关掉。缩小候选或跳过重排若未经质量验证，应标记能力下降、收紧可回答范围，而不是暗称无损。"
    ]
  },
  {
    "entryId": "own-rag-service",
    "selector": ".qa[data-key=\"own-rag-service#q-own-rag-shopping-incident\"] p.md-p",
    "segments": [
      "临近 618 这类大促，更应优先发布可回滚、已有回归证据的低风险改动，提前压测混合读写和限流恢复，预热合法热点并保留容量余量。不能为了节省单次费用引入未验证的大模型切换，也不能只按平日平均 QPS 估算峰值。",
      "离线指标上升而线上无收益时，检查问题分布、曝光与使用率、答案覆盖、拒答、时延、商品新鲜度及实验样本；离线检索提升可能未进入用户实际看到的答案，业务转化还受价格、库存和页面体验影响。"
    ]
  },
  {
    "entryId": "own-rag-service",
    "selector": ".qa[data-key=\"own-rag-service#q-own-rag-shopping-incident\"] p.md-p",
    "segments": [
      "Continuous Batching可改善混合长短请求的设备利用率，但排队策略、prefill/decode干扰、KV容量与长请求饥饿会影响TTFT/p99；是否值得要在同输入/输出长度分布与质量下测。",
      "KV字节量粗估为2×层数×活跃序列长度总和×KV头数×头维度×每元素字节数，加分页/对齐/元数据及复制；不能误用Q头数替代GQA/MQA的KV头数。",
      "限制长度、量化KV、共享合法前缀和更合理调度均有质量/实现边界。完整部署机制见[《推理部署与性能优化面试手册》](https://my.feishu.cn/wiki/TiMywuJr9icJdAkVFo2cnivsn1d)。"
    ]
  },
  {
    "entryId": "own-rag-service",
    "selector": ".qa[data-key=\"own-rag-service#q-own-rag-shopping-incident\"] p.md-p",
    "segments": [
      "预算砍半时先计算每模块单位请求成本及增量业务收益，保留硬约束、主要召回与可靠排序，削减边际贡献低的重叠通道、过大上下文或多次重复模型调用。缓存、蒸馏和分层路由可能降本，但需考虑缓存命中率与更新成本。",
      "Continuous Batching 适合请求长度与生成过程可动态调度的推理服务，仍需保护短请求、控制批等待和并发 KV；并非所有小型打分任务都值得引入完整生成调度栈。"
    ]
  },
  {
    "entryId": "own-rag-service",
    "selector": ".qa[data-key=\"own-rag-service#q-own-rag-shopping-incident\"] p.md-p",
    "segments": [
      "打车推荐还受时空供给、司机可达性、车型、价格、取消、等待和跨订单竞争约束。先明确推荐对象是车型、上车点、路线还是司机匹配；位置与当前时刻属于核心上下文，需满足授权和隐私要求。",
      "模型可估计 ETA、接单/取消概率或偏好，调度层在实时供给与服务约束下求解。单个用户推荐更容易接单的司机，可能影响其他用户，因此实验要考虑地域和时间干扰，不能直接照搬独立 item 点击实验。"
    ]
  }
];

function reflowReviewedParagraphs(page, entry) {
  for (const rule of PARAGRAPH_BREAKS) {
    if (rule.entryId !== entry?.id) continue;
    const original = rule.segments.join('');
    const matches = [...page.querySelectorAll(rule.selector)].filter(p => !p.childElementCount && p.textContent === original);
    if (matches.length !== 1) continue;
    const paragraph = matches[0];
    const additions = rule.segments.slice(1).map(text => {
      const part = paragraph.cloneNode(false);
      part.removeAttribute('id');
      part.textContent = text;
      return part;
    });
    paragraph.textContent = rule.segments[0];
    const next = paragraph.nextSibling;
    for (const part of additions) paragraph.parentNode.insertBefore(part, next);
  }
}

const LITERAL_BULLET_ENTRIES = new Set(["ai-agent-1", "ai-agent-3", "ai-agent-4", "ai-agent-5", "ai-agent-6", "ai-agent-7", "ai-agent-8", "ai-agent-9", "ai-模型与评测-2", "ai-模型与评测-3", "ai-模型与评测-4", "ai-模型与评测-6", "doc-01", "handwrite-45", "handwrite-46", "handwrite-48", "handwrite-49", "handwrite-51", "handwrite-52", "handwrite-60", "handwrite-61", "hwqa-2", "interview-biased-bit-uniform", "own-algo-gap-reservoir", "own-distributed-ch06", "own-distributed-ch07", "own-distributed-ch08", "own-mq-reliability", "own-os-diagnostics", "own-practice-av-sync-latency", "own-practice-candy-counting", "own-practice-client-server-timing", "own-practice-cross-client-reconciliation", "own-practice-gift-receipt-contract", "own-practice-latency-attribution", "own-practice-pirate-voting", "own-practice-probability-guide", "own-practice-purchase-preflight", "own-practice-purchase-preflight-parser", "own-practice-python-data-processing", "own-practice-request-signing-replay", "own-practice-scheduler-evidence", "own-practice-simultaneous-shooters", "own-practice-source-guide", "own-practice-state-machine-evolution", "own-rag-ingestion", "own-rag-service", "own-rag-workflow", "own-runtime-api-log-cli", "own-runtime-domain-designs", "own-runtime-incident-workflow", "own-runtime-moderation", "own-runtime-usage", "own-runtime-weekly-report", "own-tools-execution", "own-tools-governance", "plan-智力题-1", "scenario-hot-search", "scenario-live-comment-system", "scenario-qps-capacity-planning", "scenario-service-prewarm", "scenario-short-url", "sceneqa-6", "sceneqa-7"]);
function formatLiteralBulletParagraphs(page, entry) {
  if (!LITERAL_BULLET_ENTRIES.has(entry?.id)) return;
  for (const paragraph of page.querySelectorAll('.md p.md-p')) {
    if (!paragraph.textContent.startsWith('- ') || paragraph.closest('pre, code, .code-card') ||
        paragraph.querySelector('pre, .code-card, table, textarea, script, style')) continue;
    paragraph.classList.add('reading-literal-bullet');
  }
}

// One legacy Markdown emphasis pair crossed two inline-code elements and ate
// their wildcard stars. Require the exact audited source and rendered leaf.
const LEGACY_WILDCARD_ITEM = "<li><b>再找谁占满</b>：用 <code class=\"tok-inline\">du -sh <i> | sort -h</code>、<code class=\"tok-inline\">du -sh /var/log/</i></code> 逐层往下，挖到具体文件。工程上高频来源通常是日志、临时文件、dump 文件、上传目录、容器卷和没清掉的归档。</li>";
function repairLegacyWildcardMarkup(page, entry) {
  if (entry?.id !== 'bg-线上排障-2' ||
      entry.items?.[5]?.a?.split(LEGACY_WILDCARD_ITEM).length !== 2) return;
  const tail = ' 逐层往下，挖到具体文件。工程上高频来源通常是日志、临时文件、dump 文件、上传目录、容器卷和没清掉的归档。';
  const expected = '再找谁占满：用 du -sh  | sort -h、du -sh /var/log/' + tail;
  for (const item of page.querySelectorAll('.qa[data-key="bg-线上排障-2#5"] .md-list li')) {
    if (item.textContent !== expected || item.querySelector('[id]')) continue;
    const code = [...item.querySelectorAll('code')];
    const label = item.querySelector('b');
    if (code.length !== 2 || code[0].textContent !== 'du -sh  | sort -h' ||
        code[1].textContent !== 'du -sh /var/log/' || !label || label.childElementCount ||
        label.textContent !== '再找谁占满') continue;
    if ([...item.querySelectorAll('*')].some(node => !['B', 'I', 'CODE'].includes(node.tagName))) continue;
    const document = item.ownerDocument;
    code[0].textContent = 'du -sh * | sort -h';
    code[1].textContent = 'du -sh /var/log/*';
    item.replaceChildren(label, document.createTextNode('：用 '), code[0],
      document.createTextNode('、'), code[1], document.createTextNode(tail));
  }
}

function replaceWithAnchors(node) {
  const document = node.ownerDocument;
  const ids = [node, ...node.querySelectorAll('[id]')].map(n => n.id).filter(Boolean);
  for (const id of ids) {
    const anchor = document.createElement('span');
    anchor.className = 'reading-heading-anchor';
    anchor.id = id;
    node.parentNode.insertBefore(anchor, node);
  }
  node.remove();
}

function removeExactDuplicateHeadings(page) {
  for (const heading of page.querySelectorAll('.md h2, .md h3, .md h4, .md h5, .md h6')) {
    const previous = heading.previousElementSibling;
    if (!previous || !HEADING.test(previous.tagName) || !HEADING.test(heading.tagName)) continue;
    // Plain text only. Links, spans, inline code and other authored markup are
    // deliberately excluded even when their flattened text happens to match.
    if (heading.childElementCount || previous.childElementCount || !heading.textContent.trim()) continue;
    if (heading.textContent !== previous.textContent) continue;
    let between = previous.nextSibling;
    while (between && between !== heading && !between.textContent.trim()) between = between.nextSibling;
    if (between !== heading) continue;
    replaceWithAnchors(heading);
  }
}

function omitEmptyPatternPanels(page, entry) {
  if (entry?.kind !== 'pattern') return;
  const affectedGrids = new Set();
  for (const panel of page.querySelectorAll('.grid2 > .panel')) {
    const title = panel.firstElementChild;
    if (panel.childElementCount !== 1 || title?.tagName !== 'H4' || !OPTIONAL_PANEL_TITLES.has(title.textContent)) continue;
    // Only the exact empty optional shells, not vaguely "empty-looking" content.
    if ([...panel.childNodes].some(n => n !== title && n.textContent.trim())) continue;
    if (title.querySelector('a, button, input, img, svg, video, audio, canvas, table, pre, code, iframe')) continue;
    const grid = panel.parentElement;
    affectedGrids.add(grid);
    replaceWithAnchors(panel);
  }
  for (const grid of affectedGrids) {
    const panels = [...grid.children].filter(n => !n.classList.contains('reading-heading-anchor'));
    if (panels.length === 1) grid.classList.add('reading-single-panel');
    if (panels.length || grid.textContent.trim()) continue;
    const section = grid.parentElement;
    replaceWithAnchors(grid);
    const remaining = [...section.children].filter(n => !n.classList.contains('reading-heading-anchor'));
    const title = remaining[0];
    if (section.matches('section.sec') && remaining.length === 1 && title?.matches('h2.sec-h') &&
        [...title.childNodes].filter(n => !n.classList?.contains('n')).map(n => n.textContent).join('') === '正确性 · 复杂度 · 边界' &&
        ![...section.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) replaceWithAnchors(section);
  }
}

function repairReviewedText(page, entry) {
  for (const repair of TEXT_REPAIRS) {
    if (repair.entryId !== entry?.id) continue;
    for (const element of page.querySelectorAll(repair.selector)) {
      // Exact audited plain-text leaves only. Never reinterpret code, nested
      // links or arbitrary Markdown, and never use an HTML-string replacement.
      if (element.childElementCount || (repair.exact && element.textContent !== repair.exact)) continue;
      if (!repair.tokens.every(token => element.textContent.split(token.text).length === 2)) continue;
      const document = element.ownerDocument;
      let text = element.textContent;
      const nodes = [];
      for (const token of repair.tokens) {
        const at = text.indexOf(token.text);
        if (at < 0) break;
        nodes.push(document.createTextNode(text.slice(0, at)));
        const inline = document.createElement(token.href ? 'a' : 'code');
        inline.textContent = token.label;
        if (token.href) {
          inline.setAttribute('href', token.href);
          inline.setAttribute('target', '_blank');
          inline.setAttribute('rel', 'noopener noreferrer');
        } else inline.className = 'tok-inline';
        nodes.push(inline);
        text = text.slice(at + token.text.length);
      }
      nodes.push(document.createTextNode(text));
      element.replaceChildren(...nodes);
    }
  }
}

function wrapReadingTables(page, entry) {
  const wrappers = [];
  let tableNumber = 0;
  for (const table of page.querySelectorAll('.md table')) {
    if (table.closest('.md-table-wrap, .tbl-wrap, .cmp-table-wrap, .sx-tbl-wrap, .reading-table-scroll')) continue;
    const wrapper = page.ownerDocument.createElement('div');
    wrapper.className = 'md-table-wrap reading-table-scroll';
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', `${entry?.title || '正文'}：表格 ${++tableNumber}`);
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  }
  // Include our existing wrappers on repeat enhancement, without nesting them.
  wrappers.push(...page.querySelectorAll('.reading-table-scroll'));
  // The preserved app uses document-level left/right shortcuts for entry
  // navigation. A focused table region must keep those arrows for native scroll.
  const keepTableArrowKeys = event => {
    if (!event.ctrlKey && !event.metaKey && !event.altKey &&
        (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) event.stopPropagation();
  };
  for (const wrapper of wrappers) wrapper.addEventListener('keydown', keepTableArrowKeys, true);
  const refresh = () => {
    for (const wrapper of wrappers) {
      if (wrapper.clientWidth > 0 && wrapper.scrollWidth > wrapper.clientWidth + 1) wrapper.setAttribute('tabindex', '0');
      else wrapper.removeAttribute('tabindex');
    }
  };
  refresh();
  const view = page.ownerDocument.defaultView;
  let observer;
  if (view?.ResizeObserver && wrappers.length) {
    observer = new view.ResizeObserver(refresh);
    for (const wrapper of wrappers) { observer.observe(wrapper); observer.observe(wrapper.firstElementChild); }
  } else if (wrappers.length) {
    view?.addEventListener('resize', refresh);
    // Capture toggle (non-bubbling) and click fallbacks for answer reveals.
    page.addEventListener('toggle', refresh, true);
    page.addEventListener('click', refresh);
  }
  return () => {
    observer?.disconnect();
    for (const wrapper of wrappers) wrapper.removeEventListener('keydown', keepTableArrowKeys, true);
    view?.removeEventListener('resize', refresh);
    page.removeEventListener('toggle', refresh, true);
    page.removeEventListener('click', refresh);
  };
}

export function enhanceReadingPage(page, entry) {
  pageCleanups.get(page)?.();
  removeExactDuplicateHeadings(page);
  omitEmptyPatternPanels(page, entry);
  reflowReviewedParagraphs(page, entry);
  repairReviewedText(page, entry);
  repairLegacyWildcardMarkup(page, entry);
  formatLiteralBulletParagraphs(page, entry);
  pageCleanups.set(page, wrapReadingTables(page, entry));
}

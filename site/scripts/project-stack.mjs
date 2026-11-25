// Dedicated parser & structured renderer for the project-anchored interview
// handbook (`project-stack.md`). Converts chapters, nested lists, formulas,
// spoken answers, follow-up Q&A pairs, code templates, and the quantitative
// metrics appendix into the site's interactive study-card layout.

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function inlineHtml(text) {
  const tokens = [];
  let s = String(text ?? '');
  // Protect inline code spans first so bold/link replacements never touch code.
  s = s.replace(/`([^`]+)`/g, (_, code) => {
    const idx = tokens.push(`<code class="tok-inline">${esc(code)}</code>`) - 1;
    return `\u0000T${idx}\u0000`;
  });
  s = esc(s)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\[([^\]]+)\]\((#\/e\/[^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  return s.replace(/\u0000T(\d+)\u0000/g, (_, idx) => tokens[Number(idx)]);
}

const DOMAIN_META = [
  { match: /^一、/, slug: '并发与基础', short: '并发与基础', title: '一、并发容器、JUC、JVM、Spring 与网络 IO' },
  { match: /^二、/, slug: '数据库', short: '数据库', title: '二、MySQL 8 与 PostgreSQL (pgvector)' },
  { match: /^三、/, slug: 'Redis 缓存', short: 'Redis 缓存', title: '三、Redis 7、租约限流、Stream 与缓存一致性' },
  { match: /^四、/, slug: 'MQ 与调度', short: 'MQ 与调度', title: '四、Kafka、RabbitMQ Outbox 与 XXL-Job 调度' },
  { match: /^五、/, slug: '检索与 RAG', short: '检索与 RAG', title: '五、Elasticsearch 与 Hybrid RAG 漏斗工程' },
  { match: /^六、/, slug: 'Agent 工程', short: 'Agent 工程', title: '六、Agent 编排、Context / Memory、MCP 与评测推理' },
  { match: /^七、/, slug: '项目手撕', short: '项目手撕', title: '七、项目同名高频工程手撕（五大模板）' },
  { match: /^附录/, slug: '量化指标卡', short: '量化指标卡', title: '附录：三段经历全量量化指标与实验口径' }
];

// 这个页面独立成册：不放站内跳转，只保留项目经历标签。
// 高频考点本身已完整合入 project-stack.md，避免读者来回跳转。
const PROJECT_TAGS = {
  '1.1': ['NoteWeave', '制造业平台'],
  '1.2': ['NoteWeave', '制造业平台'],
  '1.3': ['NoteWeave'],
  '1.4': ['NoteWeave', '制造业平台'],
  '1.5': ['NoteWeave'],
  '1.6': ['NoteWeave'],
  '1.7': ['NoteWeave', '制造业平台', 'TencentDB'],
  '2.1': ['NoteWeave', '制造业平台'],
  '2.2': ['制造业平台', 'NoteWeave'],
  '2.3': ['NoteWeave', '制造业平台'],
  '2.4': ['NoteWeave', '制造业平台'],
  '2.5': ['制造业平台'],
  '3.1': ['NoteWeave', '制造业平台'],
  '3.2': ['NoteWeave'],
  '3.3': ['制造业平台'],
  '3.4': ['NoteWeave'],
  '3.5': ['NoteWeave', '制造业平台'],
  '3.6': ['NoteWeave', '制造业平台'],
  '4.1': ['NoteWeave', '制造业平台'],
  '4.2': ['NoteWeave'],
  '4.3': ['制造业平台'],
  '4.4': ['制造业平台'],
  '5.1': ['NoteWeave'],
  '5.2': ['NoteWeave', '制造业平台'],
  '5.3': ['NoteWeave', '制造业平台'],
  '6.1': ['NoteWeave', '制造业平台'],
  '6.2': ['NoteWeave', 'TencentDB', '制造业平台'],
  '6.3': ['NoteWeave', 'TencentDB'],
  '6.4': ['NoteWeave', '制造业平台', 'TencentDB'],
  '6.5': ['NoteWeave', '制造业平台', 'TencentDB'],
  '6.6': ['NoteWeave', 'TencentDB'],
  '6.7': ['NoteWeave', '制造业平台'],
  '6.8': ['NoteWeave', '制造业平台', 'TencentDB'],
  '7.1': ['NoteWeave', '制造业平台'],
  '7.2': ['NoteWeave', '制造业平台'],
  '7.3': ['NoteWeave'],
  '7.4': ['NoteWeave'],
  '7.5': ['制造业平台']
};
const TOPIC_META = Object.fromEntries(
  Object.entries(PROJECT_TAGS).map(([code, projects]) => [code, { projects }])
);

function projectBadgeClass(name) {
  if (name === 'NoteWeave') return 'proj-tag-nw';
  if (name === '制造业平台') return 'proj-tag-mfg';
  if (name === 'TencentDB') return 'proj-tag-tdb';
  return '';
}

function renderRichMarkdown(md, { colorizeMetrics = false } = {}) {
  const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;

  function renderTable(rows) {
    const parsed = rows.map((r) => r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()));
    const isDiv = (row) => row.every((c) => /^:?-{2,}:?$/.test(c));
    const head = parsed[0];
    const body = parsed.slice(1).filter((r) => !isDiv(r));
    return `<div class="tbl-wrap kb-proj-tbl"><table class="tbl"><thead><tr>${head.map((c) => `<th>${inlineHtml(c)}</th>`).join('')}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((c, ci) => {
      if (colorizeMetrics && ci === 0) {
        const clean = c.replace(/\*\*/g, '').trim();
        return `<td><span class="kb-proj-tag ${projectBadgeClass(clean)}">${esc(clean)}</span></td>`;
      }
      return `<td>${inlineHtml(c)}</td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function renderList(startIdx) {
    const firstMatch = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(lines[startIdx]);
    const baseIndent = firstMatch[1].length;
    const isOrdered = /^\d+\./.test(firstMatch[2]);
    const tag = isOrdered ? 'ol' : 'ul';
    const items = [];
    let idx = startIdx;

    while (idx < lines.length) {
      const line = lines[idx];
      if (/^\s*$/.test(line)) {
        // Peek ahead: if the next non-blank line continues this list or nests deeper, keep going.
        let peek = idx + 1;
        while (peek < lines.length && /^\s*$/.test(lines[peek])) peek++;
        if (peek < lines.length) {
          const nextLine = lines[peek];
          const nextList = /^(\s*)([-*]|\d+\.)\s+/.exec(nextLine);
          if (nextList && nextList[1].length > baseIndent) { idx = peek; continue; }
          if (nextList && nextList[1].length === baseIndent && (/^\d+\./.test(nextList[2]) === isOrdered)) { idx = peek; continue; }
          if (/^\s{2,}(?:```|\||>|\S)/.test(nextLine) && (nextLine.match(/^\s*/)[0].length > baseIndent)) { idx = peek; continue; }
        }
        break;
      }

      const itemMatch = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(line);
      if (itemMatch && itemMatch[1].length === baseIndent && (/^\d+\./.test(itemMatch[2]) === isOrdered)) {
        items.push({ head: itemMatch[3], extra: [] });
        idx++;
        continue;
      }
      if (itemMatch && itemMatch[1].length > baseIndent && items.length) {
        const nested = renderList(idx);
        items[items.length - 1].extra.push(nested.html);
        idx = nested.nextIdx;
        continue;
      }
      const indent = (line.match(/^\s*/)[0] || '').length;
      if (indent > baseIndent && items.length) {
        // Indented formula/code fence inside a list item
        const fence = /^\s*```(.*)$/.exec(line);
        if (fence) {
          const lang = fence[1].trim();
          const buf = [];
          idx++;
          while (idx < lines.length && !/^\s*```/.test(lines[idx])) { buf.push(lines[idx]); idx++; }
          if (idx < lines.length) idx++;
          items[items.length - 1].extra.push(renderFence(lang, buf));
          continue;
        }
        // Indented continuation paragraph
        items[items.length - 1].extra.push(`<p class="md-p">${inlineHtml(line.trim())}</p>`);
        idx++;
        continue;
      }
      break;
    }

    const html = `<${tag} class="md-list kb-proj-list">${items.map((it) => `<li>${inlineHtml(it.head)}${it.extra.join('')}</li>`).join('')}</${tag}>`;
    return { html, nextIdx: idx };
  }

  function renderFence(lang, buf) {
    const clean = buf.join('\n').replace(/^\n+|\n+$/g, '');
    if (lang === 'formula') {
      return `<div class="kb-formula-card"><code>${esc(clean)}</code></div>`;
    }
    const label = lang || 'text';
    return `<div class="code-card md-code-card"><div class="code-toolbar"><span class="file-label">${esc(label)}</span></div><div class="code-scroll"><pre class="md-pre" data-lang="${esc(label)}">${esc(clean)}</pre></div></div>`;
  }

  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) { i++; continue; }
    const fence = /^\s*```(.*)$/.exec(line);
    if (fence) {
      const lang = fence[1].trim();
      const buf = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) { buf.push(lines[i]); i++; }
      if (i < lines.length) i++;
      out.push(renderFence(lang, buf));
      continue;
    }
    if (/^\|/.test(line.trim())) {
      const buf = [];
      while (i < lines.length && /^\|/.test(lines[i].trim())) { buf.push(lines[i]); i++; }
      out.push(renderTable(buf));
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const res = renderList(i);
      out.push(res.html);
      i = res.nextIdx;
      continue;
    }
    if (/^>\s?/.test(line.trim())) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        buf.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<blockquote class="md-quote">${buf.map((b) => `<p class="md-p">${inlineHtml(b)}</p>`).join('')}</blockquote>`);
      continue;
    }
    const pBuf = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^\s*(?:```|\||>|[-*]\s+|\d+\.\s+)/.test(lines[i])) {
      pBuf.push(lines[i].trim());
      i++;
    }
    if (pBuf.length) out.push(`<p class="md-p">${inlineHtml(pBuf.join(' '))}</p>`);
  }
  return out.join('\n');
}

function renderSpokenAndFollowUps(md) {
  const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
  const spokenLines = [];
  const qaItems = [];
  let curQ = null;
  let curA = [];
  const flushQa = () => {
    if (curQ) {
      qaItems.push({ q: curQ, a: curA.join(' ').trim() });
      curQ = null;
      curA = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^>\s*\*\*【面试口述】\*\*/.test(line)) {
      flushQa();
      spokenLines.push(line.replace(/^>\s*\*\*【面试口述】\*\*\s*/, '').trim());
      continue;
    }
    const qMatch = /^[-*]\s+\*\*追问(?:\s*\d+)?[：:]\s*(.+?)\*\*\s*$/.exec(line);
    if (qMatch) {
      flushQa();
      curQ = qMatch[1].trim();
      continue;
    }
    if (curQ && /^>\s*\*\*答\*\*[：:]/.test(line)) {
      curA.push(line.replace(/^>\s*\*\*答\*\*[：:]\s*/, '').trim());
      continue;
    }
    if (curQ && /^>\s*/.test(line)) {
      curA.push(line.replace(/^>\s*/, '').trim());
      continue;
    }
    if (spokenLines.length && !curQ && /^>\s*/.test(line)) {
      spokenLines.push(line.replace(/^>\s*/, '').trim());
    }
  }
  flushQa();

  const parts = [];
  if (spokenLines.length) {
    parts.push(`<div class="kb-ans-block kb-proj-spoken"><div class="kb-ans-kicker">面试现场口述表达</div><div class="kb-ans-body">${spokenLines.map((p) => `<p class="md-p">${inlineHtml(p)}</p>`).join('')}</div></div>`);
  }
  if (qaItems.length) {
    parts.push(`<div class="kb-ans-block kb-ans-fup"><div class="kb-ans-kicker">高频连环追问</div><div class="kb-qa-list">${qaItems.map((qa) => `<div class="kb-qa-item"><div class="kb-qa-q">${inlineHtml(qa.q)}</div><div class="kb-qa-a">${inlineHtml(qa.a)}</div></div>`).join('')}</div></div>`);
  }
  return parts.join('');
}

function renderTopicBody(topicMd, { isHandwrite = false, isAppendix = false } = {}) {
  if (isAppendix) {
    return `<div class="kb-ans-grid"><div class="kb-ans-block kb-ans-must"><div class="kb-ans-kicker">全量指标与实验对照</div><div class="kb-ans-body">${renderRichMarkdown(topicMd, { colorizeMetrics: true })}</div></div></div>`;
  }
  if (isHandwrite) {
    return `<div class="kb-ans-grid"><div class="kb-ans-block kb-ans-must"><div class="kb-ans-kicker">题眼与生产级参考实现</div><div class="kb-ans-body">${renderRichMarkdown(topicMd)}</div></div></div>`;
  }

  // Split by #### subheadings inside normal topics (1.1 .. 6.4), or handle 4.1 which has table + follow-up directly
  const subs = [];
  let cur = null;
  for (const line of String(topicMd || '').split('\n')) {
    const m = /^####\s+(?:\d+\.\s+)?(.+)$/.exec(line);
    if (m) {
      if (cur) subs.push(cur);
      cur = { title: m[1].trim(), lines: [] };
    } else if (cur) {
      cur.lines.push(line);
    } else {
      if (!subs.length && !cur) cur = { title: '', lines: [line] };
    }
  }
  if (cur) subs.push(cur);

  // Special case: 4.1 has a comparison table followed by a follow-up Q&A without #### subheadings
  if (subs.length === 1 && !subs[0].title) {
    const raw = subs[0].lines.join('\n');
    const fupIdx = raw.search(/^\*\s+\*\*追问/m);
    const tablePart = fupIdx >= 0 ? raw.slice(0, fupIdx).trim() : raw.trim();
    const fupPart = fupIdx >= 0 ? raw.slice(fupIdx).trim() : '';
    const out = [];
    if (tablePart) {
      out.push(`<div class="kb-ans-block kb-ans-must"><div class="kb-ans-kicker">选型对比与项目落点</div><div class="kb-ans-body">${renderRichMarkdown(tablePart)}</div></div>`);
    }
    if (fupPart) out.push(renderSpokenAndFollowUps(fupPart));
    return `<div class="kb-ans-grid">${out.join('')}</div>`;
  }

  const out = [];
  for (const sub of subs) {
    const body = sub.lines.join('\n').trim();
    if (!body) continue;
    if (/面试口述|连环追问/.test(sub.title)) {
      out.push(renderSpokenAndFollowUps(body));
    } else if (/核心定位|常考主线/.test(sub.title)) {
      out.push(`<div class="kb-ans-block kb-ans-essence"><div class="kb-ans-kicker">${inlineHtml(sub.title)}</div><div class="kb-ans-body">${renderRichMarkdown(body)}</div></div>`);
    } else if (/项目落地|系统设计权衡/.test(sub.title) && !/底层机制/.test(sub.title)) {
      out.push(`<div class="kb-ans-block kb-proj-tradeoff"><div class="kb-ans-kicker">${inlineHtml(sub.title)}</div><div class="kb-ans-body">${renderRichMarkdown(body)}</div></div>`);
    } else {
      out.push(`<div class="kb-ans-block kb-ans-must"><div class="kb-ans-kicker">${inlineHtml(sub.title)}</div><div class="kb-ans-body">${renderRichMarkdown(body)}</div></div>`);
    }
  }
  return `<div class="kb-ans-grid">${out.join('')}</div>`;
}

export function parseProjectStack(markdown) {
  const lines = String(markdown).replace(/\r\n?/g, '\n').split('\n');
  const introLines = [];
  const chapters = [];
  let curChapter = null;
  let curTopic = null;

  for (const line of lines) {
    if (/^#\s+/.test(line)) continue;
    const h2 = /^##\s+(.+)$/.exec(line);
    if (h2) {
      const rawTitle = h2[1].trim();
      const meta = DOMAIN_META.find((d) => d.match.test(rawTitle));
      if (!meta) throw new Error('Project stack: unknown chapter heading ' + rawTitle);
      if (chapters.some((chapter) => chapter.slug === meta.slug)) {
        throw new Error('Project stack: duplicate chapter heading ' + rawTitle);
      }
      curChapter = { ...meta, rawTitle, intro: [], topics: [] };
      chapters.push(curChapter);
      curTopic = null;
      continue;
    }
    const h3 = /^###\s+(.+)$/.exec(line);
    if (h3 && curChapter) {
      const rawTitle = h3[1].trim();
      const numMatch = /^(\d+\.\d+)\s+(.+)$/.exec(rawTitle);
      const code = numMatch ? numMatch[1] : String(curChapter.topics.length + 1);
      const title = numMatch ? numMatch[2].trim() : rawTitle;
      const anchor = 'proj-' + code.replace(/\./g, '-');
      curTopic = { code, title, anchor, chapterSlug: curChapter.slug, lines: [] };
      curChapter.topics.push(curTopic);
      continue;
    }
    if (!curChapter) {
      if (line.trim()) introLines.push(line.trim());
    } else if (curTopic) {
      curTopic.lines.push(line);
    } else {
      curChapter.intro.push(line);
    }
  }

  // Convert the Appendix chapter into a single structured topic card so it works cleanly with filtering & search.
  for (const ch of chapters) {
    if (ch.slug === '量化指标卡' && !ch.topics.length) {
      ch.topics.push({
        code: '指标',
        title: '三段经历全量量化指标分子分母与实验口径速查表',
        anchor: 'proj-metrics-appendix',
        chapterSlug: ch.slug,
        isAppendix: true,
        lines: ch.intro
      });
      ch.intro = [];
    }
  }
  return { intro: introLines.join(' '), chapters };
}

export function renderProjectStackPage(markdown) {
  const { intro, chapters } = parseProjectStack(markdown);
  const allTopics = chapters.flatMap((c) => c.topics);
  const totalCards = allTopics.length;

  const projectHero = `<div class="kb-proj-hero">
    <div class="kb-proj-hero-top">
      <div class="kb-proj-standalone">独立成册 · 围绕三段简历经历与高频考点展开</div>
      <p class="kb-proj-lead">${inlineHtml(intro)}</p>
    </div>
    <div class="kb-proj-pillars">
      <div class="kb-proj-pillar proj-pillar-nw">
        <span class="kb-proj-tag proj-tag-nw">NoteWeave</span>
        <strong>AI 资料研究工作台</strong>
        <p>Table-as-State 深度研究 · Hybrid RAG · Redis 墓碑 / Stream 续读 · Kafka 长任务背压 · 128MB 流式接入</p>
      </div>
      <div class="kb-proj-pillar proj-pillar-mfg">
        <span class="kb-proj-tag proj-tag-mfg">制造业平台</span>
        <strong>生产事件可靠触达与智能维修</strong>
        <p>Outbox + RabbitMQ 仲裁队列 · RC + SKIP LOCKED · Redis 令牌桶 · pgvector 工业预过滤 · HITL 短事务</p>
      </div>
      <div class="kb-proj-pillar proj-pillar-tdb">
        <span class="kb-proj-tag proj-tag-tdb">TencentDB</span>
        <strong>Agent Memory 代理与评测</strong>
        <p>Prefix KV Cache 五段固定装配 · 信息缺口门控 · 三层契约工具卡编译器 · 1,140 条正负 Pair 基准</p>
      </div>
    </div>
  </div>`;

  const studyBar = `<div class="kb-study-bar">
    <div class="kb-mfilter-group" role="group" aria-label="掌握状态筛选">
      <span class="kb-study-label">掌握筛选</span>
      <button type="button" class="on" data-kb-mfilter="all">全部</button>
      <button type="button" data-kb-mfilter="0">未学</button>
      <button type="button" data-kb-mfilter="1">模糊</button>
      <button type="button" data-kb-mfilter="2">已掌握</button>
    </div>
    <div class="kb-pfilter-group" role="group" aria-label="按项目经历筛选">
      <span class="kb-study-label">经历</span>
      <button type="button" class="on" data-kb-pfilter="all">全部</button>
      <button type="button" data-kb-pfilter="NoteWeave">NoteWeave</button>
      <button type="button" data-kb-pfilter="制造业平台">制造业平台</button>
      <button type="button" data-kb-pfilter="TencentDB">TencentDB</button>
    </div>
    <div class="kb-study-right">
      <span class="kb-mastery-stat" data-kb-stat data-kb-total="${totalCards}">已掌握 0 · 模糊 0 · 未学 ${totalCards}</span>
      <button type="button" class="kb-recite-btn" data-kb-recite aria-pressed="false">背诵自测：遮挡答案</button>
    </div>
  </div>`;

  const domainFilters = `<div class="ab-filters kb-filter-bar"><button type="button" class="on" data-kb-type="all">全部专题 <b>${totalCards}</b></button>${chapters.map((ch) => `<button type="button" data-kb-type="${esc(ch.slug)}">${esc(ch.short)} <b>${ch.topics.length}</b></button>`).join('')}</div>`;

  const bodyHtml = chapters.map((ch) => {
    const chIntro = ch.intro.join('\n').trim();
    const chIntroHtml = chIntro ? `<div class="kb-group-intro">${renderRichMarkdown(chIntro)}</div>` : '';
    const cards = ch.topics.map((topic) => {
      const meta = TOPIC_META[topic.code] || { projects: ['NoteWeave', '制造业平台', 'TencentDB'] };
      const projects = meta.projects;
      const projBadges = projects.map((name) => `<span class="kb-proj-tag ${projectBadgeClass(name)}">${esc(name)}</span>`).join('');
      const marks = `<div class="kb-mark-group" data-kb-mark-group="${topic.anchor}"><button type="button" data-kb-mark="0" class="on">未学</button><button type="button" data-kb-mark="1">模糊</button><button type="button" data-kb-mark="2">掌握</button></div>`;
      const reveal = `<button type="button" class="kb-reveal-bar" data-kb-reveal>先结合项目经历在脑中口述核心机制与权衡 · 点击展开核对完整解析</button>`;
      const renderedBody = renderTopicBody(topic.lines.join('\n'), {
        isHandwrite: ch.slug === '项目手撕',
        isAppendix: Boolean(topic.isAppendix)
      });
      return `<article class="kb-detail-card kb-proj-card" id="${topic.anchor}" data-kb-key="${topic.anchor}" data-kb-projects="${esc(projects.join('|'))}">
        <div class="kb-dcard-head kb-pcard-head">
          <div class="kb-pcard-title-wrap">
            <h3 class="md-h md-h3 exam-point-heading"><span class="kb-dcard-no">${esc(topic.code)}</span>${inlineHtml(topic.title)}</h3>
            <div class="kb-proj-tags">${projBadges}</div>
          </div>
          <div class="kb-dcard-acts">${marks}</div>
        </div>
        ${reveal}
        ${renderedBody}
      </article>`;
    }).join('\n');
    return `<section class="kb-dgroup kb-filter-item" data-kb-type="${esc(ch.slug)}"><h2 class="md-h md-h2">${esc(ch.title)}</h2>${chIntroHtml}${cards}</section>`;
  }).join('\n');

  return {
    html: `<div class="kb-detail-page kb-filter-page kb-proj-page">${projectHero}${studyBar}${domainFilters}${bodyHtml}</div>`,
    topics: allTopics
  };
}

// Minimal Markdown → site HTML for the imported design lectures.
// The source files only use headings, paragraphs, lists, pipe tables, fenced
// code, inline code and bold, so this stays a small, predictable converter.
const esc = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function inline(text, imageBase = '') {
  return esc(text)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
      const href = /^https?:\/\//i.test(src) ? src : imageBase + src;
      return '<img class="kb-image" src="' + href + '" alt="' + alt + '" loading="lazy">';
    })
    .replace(/`([^`]+)`/g, '<code class="tok-inline">$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}

function codeBlock(lang, lines) {
  const label = lang || 'text';
  if (/^mermaid$/i.test(label)) {
    // A div, not a pre: the site turns every bare <pre> into a code card.
    return '<div class="sd-mmd"><div class="mermaid">' + esc(lines.join('\n')) + '</div></div>';
  }
  return '<div class="code-card md-code-card"><div class="code-toolbar"><span class="file-label">' +
    esc(label) + '</span></div><div class="code-scroll"><pre class="md-pre" data-lang="' +
    esc(label) + '">' + esc(lines.join('\n')) + '</pre></div></div>';
}

function tableBlock(rows, imageBase = '') {
  const cells = rows.map((line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()));
  const isDivider = (row) => row.every((c) => /^:?-{2,}:?$/.test(c));
  const head = cells[0];
  const body = cells.slice(1).filter((row) => !isDivider(row));
  return '<div class="tbl-wrap"><table class="tbl"><thead><tr>' +
    head.map((c) => '<th>' + inline(c, imageBase) + '</th>').join('') + '</tr></thead><tbody>' +
    body.map((row) => '<tr>' + row.map((c) => '<td>' + inline(c, imageBase) + '</td>').join('') + '</tr>').join('') +
    '</tbody></table></div>';
}

export function mdToSiteHtml(markdown, { idPrefix = 'sd', dropFirstHeading = true, imageBase = '', knowledge = false } = {}) {
  const lines = String(markdown).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  const toc = [];
  const renderInline = (text) => inline(text, imageBase);
  // Headings are mapped relative to the shallowest level left in the document,
  // so a file that starts at "#" and one that starts at "##" both nest correctly.
  const levels = [];
  let skippedTitle = false;
  for (const line of lines) {
    const m = /^(#{1,6})\s+/.exec(line);
    if (!m) continue;
    if (m[1].length === 1 && !skippedTitle && dropFirstHeading) { skippedTitle = true; continue; }
    levels.push(m[1].length);
  }
  const base = levels.length ? Math.min(...levels) : 2;
  let i = 0;
  let headingIndex = 0;
  let quoteIndex = 0;
  let droppedTitle = !dropFirstHeading;
  let paragraph = [];
  const flushParagraph = () => {
    if (!paragraph.length) return;
    out.push('<p class="md-p">' + renderInline(paragraph.join(' ')) + '</p>');
    paragraph = [];
  };
  while (i < lines.length) {
    const line = lines[i];
    const fence = /^```(.*)$/.exec(line);
    if (fence) {
      flushParagraph();
      const lang = fence[1].trim();
      const buf = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i += 1; }
      i += 1;
      out.push(codeBlock(lang, buf));
      continue;
    }
    if (/^\s*$/.test(line)) { flushParagraph(); i += 1; continue; }
    if (/^(?:---+|___+|\*\*\*+)\s*$/.test(line)) { flushParagraph(); i += 1; continue; }
    if (/^>\s?/.test(line)) {
      flushParagraph();
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i += 1; }
      if (knowledge) {
        const first = buf.find((x) => x.trim()) || '';
        const kind = /💡|🔎|\*\*(?:Q|面试官|追问)/.test(first) ? 'question' : /📝/.test(first) ? 'answer' : 'note';
        const cleaned = buf.map((x) => x.replace(/^\s*(?:💡|🔎|📝)\s*/, ''));
        const innerResult = mdToSiteHtml(cleaned.join('\n'), {idPrefix:idPrefix + '-q' + (++quoteIndex), dropFirstHeading:false, imageBase});
        toc.push(...innerResult.toc);
        const label = kind === 'question' ? (/🔎|追问/.test(first) ? '连续追问' : '面试题') : kind === 'answer' ? '参考答案' : '笔记';
        out.push('<blockquote class="md-quote kb-quote kb-' + kind + '"><span class="kb-quote-label">' + label + '</span>' + innerResult.html + '</blockquote>');
      } else {
        const inner = buf.length > 1 && buf.every((l) => l.trim().length <= 30)
          ? buf.map((l) => renderInline(l.trim())).join('<br>')
          : renderInline(buf.join(' ').trim());
        if (inner) out.push('<blockquote class="md-quote"><p class="md-p">' + inner + '</p></blockquote>');
      }
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      const text = heading[2].trim();
      if (level === 1 && !droppedTitle) { droppedTitle = true; i += 1; continue; }
      headingIndex += 1;
      const id = idPrefix + '-' + headingIndex;
      const depth = Math.min(4, Math.max(2, level - base + 2));
      out.push('<h' + depth + ' class="md-h md-h' + depth + '" id="' + id + '">' + renderInline(text) + '</h' + depth + '>');
      toc.push({ id, text, level: depth });
      i += 1;
      continue;
    }
    if (/^\|/.test(line)) {
      flushParagraph();
      const buf = [];
      while (i < lines.length && /^\|/.test(lines[i])) { buf.push(lines[i]); i += 1; }
      out.push(tableBlock(buf, imageBase));
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      flushParagraph();
      const buf = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { buf.push(lines[i].replace(/^\s*[-*]\s+/, '')); i += 1; }
      out.push('<ul class="md-list">' + buf.map((t) => '<li>' + renderInline(t) + '</li>').join('') + '</ul>');
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      flushParagraph();
      const buf = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { buf.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i += 1; }
      out.push('<ol class="md-list">' + buf.map((t) => '<li>' + renderInline(t) + '</li>').join('') + '</ol>');
      continue;
    }
    paragraph.push(line.trim());
    i += 1;
  }
  flushParagraph();
  return { html: out.join('\n'), toc };
}

export function firstParagraph(markdown) {
  const lines = String(markdown).replace(/\r\n?/g, '\n').split('\n');
  const buf = [];
  let started = false;
  for (const line of lines) {
    if (/^#{1,4}\s+/.test(line) || /^```/.test(line) || /^\|/.test(line)) {
      if (started) break;
      continue;
    }
    if (/^\s*$/.test(line)) {
      if (started) break;
      continue;
    }
    started = true;
    buf.push(line.trim());
  }
  return buf.join(' ');
}

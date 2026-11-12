// Minimal Markdown → site HTML for the imported design lectures.
// The source files only use headings, paragraphs, lists, pipe tables, fenced
// code, inline code and bold, so this stays a small, predictable converter.
const esc = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function inline(text) {
  return esc(text)
    .replace(/`([^`]+)`/g, '<code class="tok-inline">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}

function codeBlock(lang, lines) {
  const label = lang || 'text';
  return '<div class="code-card md-code-card"><div class="code-toolbar"><span class="file-label">' +
    esc(label) + '</span></div><div class="code-scroll"><pre class="md-pre" data-lang="' +
    esc(label) + '">' + esc(lines.join('\n')) + '</pre></div></div>';
}

function tableBlock(rows) {
  const cells = rows.map((line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()));
  const isDivider = (row) => row.every((c) => /^:?-{2,}:?$/.test(c));
  const head = cells[0];
  const body = cells.slice(1).filter((row) => !isDivider(row));
  return '<div class="tbl-wrap"><table class="tbl"><thead><tr>' +
    head.map((c) => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>' +
    body.map((row) => '<tr>' + row.map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') +
    '</tbody></table></div>';
}

export function mdToSiteHtml(markdown, { idPrefix = 'sd', dropFirstHeading = true } = {}) {
  const lines = String(markdown).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  const toc = [];
  let i = 0;
  let headingIndex = 0;
  let droppedTitle = !dropFirstHeading;
  let paragraph = [];
  const flushParagraph = () => {
    if (!paragraph.length) return;
    out.push('<p class="md-p">' + inline(paragraph.join(' ')) + '</p>');
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
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      const text = heading[2].trim();
      if (level === 1 && !droppedTitle) { droppedTitle = true; i += 1; continue; }
      headingIndex += 1;
      const id = idPrefix + '-' + headingIndex;
      if (level <= 2) {
        out.push('<h2 class="md-h md-h2" id="' + id + '">' + inline(text) + '</h2>');
        toc.push({ id, text, level: 2 });
      } else {
        out.push('<h3 class="md-h md-h3" id="' + id + '">' + inline(text) + '</h3>');
        toc.push({ id, text, level: 3 });
      }
      i += 1;
      continue;
    }
    if (/^\|/.test(line)) {
      flushParagraph();
      const buf = [];
      while (i < lines.length && /^\|/.test(lines[i])) { buf.push(lines[i]); i += 1; }
      out.push(tableBlock(buf));
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      const buf = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) { buf.push(lines[i].replace(/^[-*]\s+/, '')); i += 1; }
      out.push('<ul class="md-list">' + buf.map((t) => '<li>' + inline(t) + '</li>').join('') + '</ul>');
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      flushParagraph();
      const buf = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) { buf.push(lines[i].replace(/^\d+\.\s+/, '')); i += 1; }
      out.push('<ol class="md-list">' + buf.map((t) => '<li>' + inline(t) + '</li>').join('') + '</ol>');
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

// Kept semantically identical to the original buildIndex: same fields, order,
// HTML stripping, first 400 algorithm-code characters, and QA answer text.
export const SEARCH_DIMENSIONS = ['requirements', 'capacityPlan', 'architecture', 'dataFlow', 'consistency', 'failureModes', 'keyPoints', 'observability', 'tradeoffs', 'security', 'followups'];
export const stripTags = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
export function buildSearchRecords(entries, topics) {
  const records = [];
  for (const e of entries) {
    if (e.id === 'exam-backend-detail' || e.id === 'exam-agent-detail' || e.id === 'kb-project-stack') {
      records.push({ id: e.id, title: e.title, text: stripTags([e.title, e.number, e.cat, e.part, e.lead].filter(Boolean).join(' ')) });
      for (const m of String(e.html || '').matchAll(/<article class="kb-detail-card[^"]*" id="([^"]+)"[^>]*>([\s\S]*?)<\/article>/g)) {
        const anchor = m[1];
        const bodyHtml = m[2];
        const headingMatch = /<h3[^>]*class="[^"]*exam-point-heading[^"]*"[^>]*>(?:<span class="kb-dcard-no">[\s\S]*?<\/span>)?([\s\S]*?)<\/h3>/.exec(bodyHtml);
        const cardTitle = stripTags(headingMatch ? headingMatch[1] : e.title);
        const cleanBody = bodyHtml
          .replace(/<div class="kb-mark-group"[\s\S]*?<\/div>/g, ' ')
          .replace(/<button[^>]*data-kb-reveal[^>]*>[\s\S]*?<\/button>/g, ' ');
        records.push({ id: e.id, anchor, title: cardTitle, text: stripTags(cleanBody) });
      }
      continue;
    }
    // Lecture bodies are long (tens of KB each). Indexing all of them made
    // search.json balloon to 8 MB for no real gain: a hit deep inside a lecture
    // still opens the top of that page. Keep every heading plus the opening
    // 4k characters, which covers titles, summaries and the first sections.
    const searchableHtml = e.mod === 'knowledge'
      ? [...String(e.html || '').matchAll(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/g)].map((match) => match[1]).join(' ') + ' ' +
        stripTags(String(e.html || '')
          .replace(/<details class="kb-supplement"[\s\S]*?<\/details>/g, ' ')
          .replace(/<section class="kb-lecture"[\s\S]*?<\/section>/g, ' ')).slice(0, 4000)
      : e.html;
    const parts = [e.title, e.number, e.cat, e.part, e.subtitle, e.idea, e.description, e.walkthrough, e.pitfall, e.correctness, e.interviewAnswer, e.interviewPitch,
      e.metrics, e.components, ...(e.methodCompare || []), ...(e.followupQuestions || []), ...(e.signals || []), ...(e.pitfalls || []),
      ...SEARCH_DIMENSIONS.flatMap((k) => Array.isArray(e[k]) ? e[k] : []), searchableHtml, e.readingNotesHtml, e.supplementHtml, e.questionHtml, e.answerHtml, e.analysisHtml, e.relatedHtml, ...(e.knowledge || []),
      ...(e.kind !== 'qa' && Array.isArray(e.items) ? e.items.map((it) => (it.q || '') + ' ' + (it.a || '')) : [])];
    if (e.kind === 'topic') { const t = topics[e.topicKey]; parts.push(t.knowledge, t.list, ...t.patterns.map(p => p.title + ' ' + p.html), ...t.explains.map(x => x.title)); }
    if (e.kind === 'algo' && e.code) parts.push(e.code.slice(0, 400));
    const text = stripTags(parts.filter(Boolean).join(' '));
    records.push({ id: e.id, title: e.title, text });
    if (e.kind === 'qa' && e.items) e.items.forEach((it, qi) => records.push({ id: e.id, qi, title: stripTags(it.q), text: stripTags(it.a), mk: it.mk }));
  }
  return records;
}

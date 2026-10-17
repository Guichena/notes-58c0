// Kept semantically identical to the original buildIndex: same fields, order,
// HTML stripping, first 400 algorithm-code characters, and QA answer text.
export const SEARCH_DIMENSIONS = ['requirements', 'capacityPlan', 'architecture', 'dataFlow', 'consistency', 'failureModes', 'keyPoints', 'observability', 'tradeoffs', 'security', 'followups'];
export const stripTags = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
export function buildSearchRecords(entries, topics) {
  const records = [];
  for (const e of entries) {
    const parts = [e.title, e.number, e.cat, e.part, e.subtitle, e.idea, e.description, e.walkthrough, e.pitfall, e.correctness, e.interviewAnswer, e.interviewPitch,
      e.metrics, e.components, ...(e.methodCompare || []), ...(e.followupQuestions || []), ...(e.signals || []), ...(e.pitfalls || []),
      ...SEARCH_DIMENSIONS.flatMap((k) => Array.isArray(e[k]) ? e[k] : []), e.html, e.readingNotesHtml, e.supplementHtml, e.questionHtml, e.answerHtml, e.analysisHtml, e.relatedHtml, ...(e.knowledge || [])];
    if (e.kind === 'topic') { const t = topics[e.topicKey]; parts.push(t.knowledge, t.list, ...t.patterns.map(p => p.title + ' ' + p.html), ...t.explains.map(x => x.title)); }
    if (e.kind === 'algo' && e.code) parts.push(e.code.slice(0, 400));
    const text = stripTags(parts.filter(Boolean).join(' '));
    records.push({ id: e.id, title: e.title, text });
    if (e.items) e.items.forEach((it, qi) => records.push({ id: e.id, qi, title: stripTags(it.q), text: stripTags(it.a), mk: it.mk }));
  }
  return records;
}

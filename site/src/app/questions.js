/* ---------------- 问答交互 ---------------- */
function qaCards() { return $$('#page .qa'); }
function focusQuestion(anchor, scroll) {
  const card = document.getElementById('q-' + anchor) || qaCards()[+anchor];
  if (!card) return;
  qaCards().forEach((c) => c.classList.remove('cur'));
  card.classList.add('cur');
  state.curQ = qaCards().indexOf(card);
  if (scroll) {
    card.classList.add('open');
    requestAnimationFrame(() => card.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  }
}
function moveQuestion(d) {
  const cards = qaCards();
  if (!cards.length) return false;
  let i = state.curQ < 0 ? (d > 0 ? 0 : cards.length - 1) : Math.max(0, Math.min(cards.length - 1, state.curQ + d));
  cards.forEach((c) => c.classList.remove('cur'));
  cards[i].classList.add('cur');
  state.curQ = i;
  cards[i].scrollIntoView({ block: 'center', behavior: 'smooth' });
  return true;
}
function markCard(card, s) {
  const key = card.dataset.key;
  const next = statusOf(key) === s ? 0 : s;
  setStatus(key, next);
  syncKeyCard(key, next);
  card.classList.remove('s0', 's1', 's2');
  card.classList.add('s' + next);
  $$('.qa-foot [data-s]', card).forEach((b) => b.classList.toggle('on', +b.dataset.s === next));
  refreshStatusUI();
}


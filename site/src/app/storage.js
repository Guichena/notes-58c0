/* ---------------- 存储：掌握度 / 最近浏览 / 偏好 ---------------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 隐私模式等情况下忽略 */ } },
};
let PROG = store.get('iv8-progress', null);
if (!PROG || typeof PROG !== 'object') {
  PROG = {};
  // 兼容 v7 的「已复习」记录：视为已掌握
  const old = store.get('lc-v7-progress', []);
  if (Array.isArray(old)) old.forEach((id) => { if (byId.has(String(id))) PROG[String(id)] = { s: 2, t: Date.now() }; });
  store.set('iv8-progress', PROG);
}
// Original questions retain numeric identities; new questions carry stable IDs.
const qAnchor = (eid, qi) => byId.get(eid)?.items?.[qi]?.id || qi;
const qKey = (eid, qi) => `${eid}#${qAnchor(eid, qi)}`;
const statusOf = (key) => (PROG[key] && PROG[key].s) || 0;
function setStatus(key, s) {
  if (!s) delete PROG[key]; else PROG[key] = { s, t: Date.now() };
  store.set('iv8-progress', PROG);
}
function entryStatus(e) {
  if (e.kind !== 'qa') return statusOf(e.progressKey || e.id);
  let m = 0, any = false;
  e.items.forEach((_, i) => { const s = statusOf(qKey(e.id, i)); if (s === 2) m++; if (s) any = true; });
  return m === e.items.length ? 2 : any ? 1 : 0;
}
function unitsOf(list) {
  let total = 0, ok = 0, fuzzy = 0;
  for (const e of list) {
    if (e.kind === 'qa') {
      e.items.forEach((_, i) => { total++; const s = statusOf(qKey(e.id, i)); if (s === 2) ok++; else if (s === 1) fuzzy++; });
    } else { total++; const s = statusOf(e.progressKey || e.id); if (s === 2) ok++; else if (s === 1) fuzzy++; }
  }
  return { total, ok, fuzzy };
}
function pushRecent(id) {
  const r = store.get('iv8-recent', []).filter((x) => x !== id);
  r.unshift(id);
  store.set('iv8-recent', r.slice(0, 12));
}


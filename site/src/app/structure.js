/* ---------------- 结构：模块 → 分区 → 分类 → 条目 ---------------- */
const TREE = {};
for (const e of ENTRIES) {
  const m = (TREE[e.mod] ||= { parts: [], all: [] });
  m.all.push(e);
  let part = m.parts.find((p) => p.name === e.part);
  if (!part) { part = { name: e.part, cats: [] }; m.parts.push(part); }
  let cat = part.cats.find((c) => c.name === e.cat);
  if (!cat) { cat = { name: e.cat, items: [] }; part.cats.push(cat); }
  cat.items.push(e);
}
const ORDER = MODS.filter((m) => TREE[m.id]).flatMap((m) => TREE[m.id].all);
ORDER.forEach((e, i) => { e._o = i; });

const state = { mod: 'home', route: { view: 'home' }, filter: '', sfilter: '', open: new Set(store.get('iv8-open', [])), qaMode: store.get('iv8-qamode', 'lead'), mustOnly: false, curQ: -1 };


// Pure view projection. Entry objects and QA arrays remain canonical references.
// Shared verbatim by Node tests and the generated classic-script runtime.
import {createHash} from 'node:crypto';
export function buildLearningOrder(entries, registry, warn = message => console.warn(message)) {
  const fail = message => { throw new Error('Learning order: ' + message); };
  const valid = value => typeof value === 'string' && value.length > 0;
  if (registry?.schemaVersion !== 1 || !Array.isArray(registry.modules) || !Array.isArray(registry.moduleOrder)) fail('invalid registry');
  const mods = new Set(), parts = new Set(), groups = new Set(), ranks = new Map();
  for (const [mi, m] of registry.modules.entries()) {
    if (!valid(m.mod) || mods.has(m.mod) || registry.moduleOrder[mi] !== m.mod || !Array.isArray(m.parts)) fail('invalid module rank');
    mods.add(m.mod);
    for (const [pi, p] of m.parts.entries()) {
      if (!valid(p.partId) || parts.has(p.partId) || !Array.isArray(p.categories) || !p.categories.length) fail('invalid part rank');
      parts.add(p.partId);
      for (const [ci, c] of p.categories.entries()) {
        if (!valid(c.groupId) || groups.has(c.groupId) || !Array.isArray(c.entryIds) || !c.entryIds.length) fail('invalid category rank');
        groups.add(c.groupId);
        for (const [ei, id] of c.entryIds.entries()) {
          if (!valid(id) || ranks.has(id)) fail('duplicate or malformed entry rank: ' + id);
          ranks.set(id, {mod:m.mod, part:p.partId, group:c.groupId, pi, ci, ei});
        }
      }
    }
  }
  if (registry.moduleOrder.length !== mods.size) fail('invalid module ranks');
  const tree = Object.create(null), seen = new Set(), knownParts = new Map(), knownGroups = new Map();
  const partRank = new Map(), catRank = new Map();
  const unknown = [], newParts = [], newGroups = [];
  for (const e of entries) {
    if (!valid(e.id) || seen.has(e.id)) fail('duplicate or invalid entry ID: ' + e.id);
    seen.add(e.id);
    if (!mods.has(e.mod)) fail('unreviewed module: ' + e.mod);
    const m = tree[e.mod] ||= {parts:[], all:[]};
    let p = m.parts.find(p => p.name === e.part);
    if (!p) { p = {name:e.part,cats:[]}; m.parts.push(p); }
    let c = p.cats.find(c => c.name === e.cat);
    if (!c) { c = {name:e.cat,items:[]}; p.cats.push(c); }
    c.items.push(e);
    const r = ranks.get(e.id);
    if (!r) { unknown.push(e.id); continue; }
    if (r.mod !== e.mod) fail('reviewed entry moved module: ' + e.id);
    if ((knownParts.has(r.part) && knownParts.get(r.part) !== p) || (partRank.has(p) && partRank.get(p).part !== r.part)) fail('reviewed part split or merged: ' + e.id);
    if ((knownGroups.has(r.group) && knownGroups.get(r.group) !== c) || (catRank.has(c) && catRank.get(c).group !== r.group)) fail('reviewed category split or merged: ' + e.id);
    knownParts.set(r.part,p); knownGroups.set(r.group,c); partRank.set(p,r); catRank.set(c,r);
  }
  // Stable sorting leaves new entries/groups in canonical encounter order.
  const rankSort = (map, key) => (a,b) => (map.get(a)?.[key] ?? Infinity) - (map.get(b)?.[key] ?? Infinity) || 0;
  for (const [mod,m] of Object.entries(tree)) {
    m.parts.sort(rankSort(partRank,'pi'));
    for (const p of m.parts) {
      if (!partRank.has(p)) newParts.push([mod,p.name]);
      p.cats.sort(rankSort(catRank,'ci'));
      for (const c of p.cats) {
        if (!catRank.has(c)) newGroups.push([mod,p.name,c.name]);
        c.items.sort((a,b) => (ranks.get(a.id)?.ei ?? Infinity) - (ranks.get(b.id)?.ei ?? Infinity) || 0);
      }
    }
    m.all = m.parts.flatMap(p => p.cats.flatMap(c => c.items));
  }
  const missing = [...ranks.keys()].filter(id => !seen.has(id));
  if (unknown.length || newParts.length || newGroups.length || missing.length) warn('Learning order editor review: ' + JSON.stringify({unlistedEntries:unknown,newParts,newGroups,missingReviewedEntries:missing}));
  return {tree, order:registry.moduleOrder.flatMap(mod => tree[mod]?.all || [])};
}
const sha = value => createHash('sha256').update(value).digest('hex');
export function projectLearningOrderRuntime(file, source, registry, {baselineTest=false}={}) {
  if (baselineTest || file !== 'src/app/structure.js') return source;
  if (sha(source) !== STRUCTURE_SHA256) throw new Error('Learning order: structure source drift');
  if (sha(JSON.stringify(registry)) !== REGISTRY_SHA256) throw new Error('Learning order: unreviewed registry drift');
  // Validate before emitting; no manifest is interpreted as executable code.
  buildLearningOrder([], registry, () => {});
  const tail = source.slice(source.indexOf('const state ='));
  return '/* Reviewed display-only traversal; original source retained. */\n' + buildLearningOrder.toString() + '\nconst LEARNING_ORDER_REGISTRY = ' + JSON.stringify(registry).replaceAll('<','\\u003c') + ';\nconst learningView = buildLearningOrder(ENTRIES, LEARNING_ORDER_REGISTRY);\nconst TREE = learningView.tree;\nconst ORDER = learningView.order;\nORDER.forEach((e, i) => { e._o = i; });\n\n' + tail;
}

export const STRUCTURE_SHA256 = 'd8fccb68de605177154a6ea3a050e23de12c6d4293b1563e723f937154c69fc9';
export const REGISTRY_SHA256 = '4494ae8f003121b3468fa89e2b412b68bd3d07a9c292a27c895f639d87ebda5f';

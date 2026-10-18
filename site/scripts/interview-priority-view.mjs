// Display-only ordering. Never sort canonical entries/items or derive keys from display rank.
import {createHash} from 'node:crypto';
export const PRIORITY_VIEW_SHA256 = '879033a5247e775cb95ba49f3eff8b8ad33a146678925f3a95a1fc38b431c1c1';
const fail = message => { throw Error('Priority view: '+message); };
export function priorityQuestionView(entry, registry) {
  const rule = registry?.records?.find(r=>r.entryId===entry.id);
  const ranks = new Map((rule?.order || []).map((key,index)=>[key,index]));
  const emphasis = new Set(rule?.emphasis || []);
  let block = -1, previousSub;
  const rows = (entry.items || []).map((item,canonicalIndex)=>{
    if(canonicalIndex===0 || item.sub!==previousSub) block++;
    previousSub=item.sub;
    const anchor=item.id || canonicalIndex, key=entry.id+'#'+anchor;
    return {item,canonicalIndex,anchor,key,originalNo:canonicalIndex+1,block,emphasis:emphasis.has(key)};
  });
  return rows.sort((a,b)=>a.block-b.block || (ranks.get(a.key)??Infinity)-(ranks.get(b.key)??Infinity) || a.canonicalIndex-b.canonicalIndex);
}
export function validatePriorityView(entries, registry) {
  if(registry?.schemaVersion!==1 || !Array.isArray(registry.records)) fail('invalid registry');
  const byId=new Map(entries.map(e=>[e.id,e])), seen=new Set();
  for(const rule of registry.records) {
    if(typeof rule.entryId!=='string' || seen.has(rule.entryId)) fail('duplicate or malformed entry');
    seen.add(rule.entryId);
    const e=byId.get(rule.entryId);
    if(!e || e.kind!=='qa' || !Array.isArray(e.items)) fail('missing QA entry '+rule.entryId);
    const rows=priorityQuestionView(e,null), keys=new Set(rows.map(r=>r.key));
    if(keys.size!==rows.length) fail('duplicate canonical question key '+e.id);
    for(const field of ['order','emphasis']) {
      if(!Array.isArray(rule[field]) || new Set(rule[field]).size!==rule[field].length) fail('duplicate or malformed '+field);
      for(const key of rule[field]) if(typeof key!=='string' || !keys.has(key)) fail('unknown question key '+key);
    }
    let lastBlock=-1;
    for(const key of rule.order) {
      const block=rows.find(r=>r.key===key).block;
      if(block<lastBlock) fail('rank crosses existing section '+key);
      lastBlock=block;
    }
  }
  return true;
}
export function projectPriorityViewRuntime(file,text,registry,{baselineTest=false}={}) {
  if(baselineTest) return text;
  if(!['src/app/structure.js','src/app/renderers.js','src/app/highlight-map.js','src/app/questions.js'].includes(file)) return text;
  if(createHash('sha256').update(JSON.stringify(registry)).digest('hex')!==PRIORITY_VIEW_SHA256) fail('unreviewed registry drift');
  const replace=(before,after)=>{if(text.split(before).length!==2) fail('expected exactly one runtime target in '+file+': '+before.slice(0,70));text=text.replace(before,after);};
  if(file==='src/app/structure.js') return text+'\n'+priorityQuestionView.toString()+'\nconst PRIORITY_VIEW_REGISTRY = '+JSON.stringify(registry).replaceAll('<','\\u003c')+';\nconst orderedQuestionView = e => priorityQuestionView(e, PRIORITY_VIEW_REGISTRY);\nconst priorityChip = key => PRIORITY_VIEW_REGISTRY.records.some(r=>r.emphasis.includes(key)) ? \'<span class="cmp-tag priority-tag">重点</span>\' : \'\';\n';
  if(file==='src/app/questions.js') {
    replace("  const card = document.getElementById('q-' + anchor) || qaCards()[+anchor];\n  if (!card) return;", `  let card = document.getElementById('q-' + anchor);
  // Legacy numeric bookmarks address canonical items, never the display rank.
  if (!card && /^(0|[1-9]\\d*)$/.test(String(anchor))) {
    const index = Number(anchor);
    const item = Number.isSafeInteger(index) && byId.get(state.route?.id)?.items?.[index];
    if (item) card = document.getElementById('q-' + (item.id || index));
  }
  if (!card) {
    const section = document.getElementById(anchor);
    if (scroll && section) requestAnimationFrame(() => section.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    return;
  }`);
  }
  if(file==='src/app/renderers.js') {
    replace('const items = e.items.map((it, i) => ({ ...it, key: qKey(e.id, i), no: i + 1, anchor: qAnchor(e.id, i) }));','const items = orderedQuestionView(e).map(({item, canonicalIndex}) => ({ ...item, key: qKey(e.id, canonicalIndex), no: canonicalIndex + 1, anchor: qAnchor(e.id, canonicalIndex) }));');
    replace('<div class="qa-tags">${HLC[it.key]', '<div class="qa-tags">${priorityChip(it.key)}${HLC[it.key]');
  }
  if(file==='src/app/highlight-map.js') {
    replace('e.items.map((it, i) => `<li class="s${statusOf(qKey(e.id, i))}', 'orderedQuestionView(e).map(({item:it, canonicalIndex:i}) => `<li class="s${statusOf(qKey(e.id, i))}');
    replace('${h(stripTags(it.q))}</a>${HLC[qKey(e.id, i)]', '${h(stripTags(it.q))}</a>${priorityChip(qKey(e.id, i))}${HLC[qKey(e.id, i)]');
    replace('e.items.map((it, qi) => { const k = qKey(e.id, qi)', 'orderedQuestionView(e).map(({item:it, canonicalIndex:qi}) => { const k = qKey(e.id, qi)');
    replace("</a>${HLC[k] ? '<span class=\"cmp-tag\">", "</a>${priorityChip(k)}${HLC[k] ? '<span class=\"cmp-tag\">");
  }
  return text;
}

import {createHash} from 'node:crypto';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const targets = new Set(['ai-模型与评测-1#1','ai-模型与评测-4#8','ai-模型与评测-5#6']);
const fail = message => { throw new Error('AI answer correction: '+message); };
function exactKeys(value, keys, where) {
 if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join('|') !== [...keys].sort().join('|')) fail(where+' has unknown or missing fields');
}
function byId(entries, where) {
 if (!Array.isArray(entries)) fail(where+' must be an array');
 const map = new Map();
 for (const e of entries) { if (!e || typeof e.id !== 'string' || map.has(e.id)) fail(where+' has missing/duplicate entry identity'); map.set(e.id,e); }
 return map;
}
/** Display-only correction. Originals and compiler output are never mutated.
 * Invoke after compileAuthoring and before any display/reading projection.
 * Bypass is intentionally first, matching the unmodified baseline-test path.
 */
export function correctAIAnswers(compiledEntries, originalEntries, registry, {baselineTest=false}={}) {
 if (baselineTest) return compiledEntries;
 exactKeys(registry,['schemaVersion','corrections'],'registry');
 if (registry.schemaVersion !== 1 || !Array.isArray(registry.corrections) || registry.corrections.length !== 3) fail('expected version 1 and exactly three corrections');
 const originals=byId(originalEntries,'originals'), compiled=byId(compiledEntries,'compiled');
 const seen=new Set(), edits=new Map();
 for (const r of registry.corrections) {
  exactKeys(r,['entryId','questionIndex','questionId','expectedOriginalHash','question','oldAnswer','newAnswer','oldLeadPresent','oldLead','newLead'],'record');
  const key=r.entryId+'#'+r.questionIndex;
  if (!targets.has(key) || seen.has(key) || !Number.isSafeInteger(r.questionIndex)) fail('unknown/duplicate target '+key);
  seen.add(key);
  const oe=originals.get(r.entryId), ce=compiled.get(r.entryId), oq=oe?.items?.[r.questionIndex], cq=ce?.items?.[r.questionIndex];
  if (oe?.kind!=='qa' || ce?.kind!=='qa' || !oq || !cq) fail('missing QA target '+key);
  if ((oq.id || String(r.questionIndex))!==r.questionId || (cq.id || String(r.questionIndex))!==r.questionId || oq.q!==r.question || cq.q!==r.question) fail('question identity mismatch '+key);
  if (hash(oq)!==r.expectedOriginalHash) fail('original hash mismatch '+key);
  if (typeof r.oldAnswer!=='string' || oq.a!==r.oldAnswer || typeof r.newAnswer!=='string' || !r.newAnswer || r.newAnswer===r.oldAnswer) fail('original answer mismatch or invalid replacement '+key);
  if (typeof r.oldLeadPresent!=='boolean' || Object.hasOwn(oq,'lead')!==r.oldLeadPresent || Object.hasOwn(cq,'lead')!==r.oldLeadPresent || (r.oldLeadPresent ? oq.lead!==r.oldLead || cq.lead!==r.oldLead : r.oldLead!==null)) fail('lead mismatch '+key);
  if (typeof r.newLead!=='string' || !r.newLead) fail('invalid lead replacement '+key);
  if (typeof cq.a!=='string' || !cq.a.startsWith(r.oldAnswer)) fail('compiled original prefix mismatch '+key);
  // Only the locked original prefix is replaced; appended source material stays exact.
  const next={...cq,a:r.newAnswer+cq.a.slice(r.oldAnswer.length)};
  if (r.oldLeadPresent) next.lead=r.newLead;
  else if (!r.newAnswer.startsWith('<p class="md-p">')) fail('answer must expose a splitLead paragraph '+key);
  edits.set(key,next);
 }
 return compiledEntries.map(e=>{
  if (![...seen].some(k=>k.startsWith(e.id+'#'))) return e;
  return {...e,items:e.items.map((q,i)=>edits.get(e.id+'#'+i)||q)};
 });
}

// A final, reversible correction layer. Original source/registry guards run first.
// The practice document is maintained in authoring and survives the question-bank
// future-authoring boundary; this layer only changes reviewed QA answer strings.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {projectInterviewVoiceReview} from './interview-voice-review.mjs';

export const PRACTICE_BOUNDARY_SHA256 = "b82e7f2c8b60b8da24bdd47146dc43afec0007e3cca4edc4b092abd0f1b13e8d";
const sha = value => createHash('sha256').update(value).digest('hex');
const fail = message => { throw Error('Practice boundary: '+message); };
export async function readPracticeBoundaryCorrections() {
  return JSON.parse(await readFile(new URL('../content/practice-boundary-corrections.json',import.meta.url),'utf8'));
}
function validateRegistry(registry) {
  if(!registry || sha(JSON.stringify(registry)) !== PRACTICE_BOUNDARY_SHA256) fail('registry integrity mismatch');
  if(registry.schemaVersion !== 1 || !Array.isArray(registry.records) || !Array.isArray(registry.practiceEntries) || (registry.postReviewRecords!==undefined && !Array.isArray(registry.postReviewRecords))) fail('invalid registry');
  for(const record of [...registry.records,...registry.postReviewRecords||[]]) {
    if(record.path.length !== 3 || record.path[0] !== 'items' || !Number.isInteger(record.path[1]) || record.path[1] < 0 || record.path[2] !== 'a') fail('only QA answer replacements are allowed');
    if(record.insertion) {
      const operation=record.insertion;
      if(operation.type!=='insert-before-exact-anchor' || operation.expectedAnchorOccurrences!==1 || typeof operation.anchorHtml!=='string' || !operation.anchorHtml || typeof operation.insertHtml!=='string' || !operation.insertHtml.trim()) fail('invalid reviewed insertion');
      if(record.before.split(operation.anchorHtml).length!==2 || record.after.split(operation.anchorHtml).length!==2) fail('reviewed insertion anchor is not unique');
      if(record.before.includes(operation.insertHtml) || record.after.split(operation.insertHtml).length!==2) fail('reviewed insertion is duplicated');
      if(record.before.replace(operation.anchorHtml,operation.insertHtml+operation.anchorHtml)!==record.after) fail('changes exceed reviewed insertion');
    }
  }
  for(const record of registry.postReviewRecords||[]) {
    if(!Array.isArray(record.edits) || !record.edits.length) fail('post-review changes require exact edits');
    let expected=record.before;
    for(const edit of record.edits) {
      if(typeof edit.beforeHtml!=='string' || !edit.beforeHtml || typeof edit.afterHtml!=='string' || edit.beforeHtml===edit.afterHtml || sha(edit.beforeHtml)!==edit.beforeSha256 || sha(edit.afterHtml)!==edit.afterSha256) fail('post-review edit hash/type mismatch');
      if(sha(expected)!==edit.beforeAnswerSha256) fail('post-review edit input hash mismatch');
      if(expected.split(edit.beforeHtml).length!==2) fail('post-review edit anchor is not unique');
      expected=expected.replace(edit.beforeHtml,edit.afterHtml);
      if(sha(expected)!==edit.afterAnswerSha256) fail('post-review edit output hash mismatch');
    }
    if(expected!==record.after) fail('changes exceed exact post-review edits');
  }
}
function validatePracticeEntries(entries,registry) {
  const byId=new Map(entries.map(entry=>[entry.id,entry]));
  if(byId.size!==entries.length) fail('duplicate entry');
  for(const practice of registry.practiceEntries) {
    const entry=byId.get(practice.entryId);
    if(!entry || entry.kind!=='doc' || entry.mod!=='code' || sha(JSON.stringify(entry))!==practice.entrySha256) fail('practice entry changed or missing '+practice.entryId);
    for(const transfer of practice.transfers) {
      if(!entry.html.includes('href="'+transfer.backlinkHref+'"') || !entry.html.includes('id="'+transfer.sectionId+'"')) fail('missing practice section/backlink');
      const record=registry.records.find(r=>r.entryId===transfer.sourceEntryId && r.path[1]===transfer.sourceQuestionIndex);
      if(!record || !record.after.includes('href="'+transfer.forwardHref+'"')) fail('missing theory-to-practice link');
      let expected=record.before;
      if(typeof transfer.linkHtml!=='string' || !transfer.linkHtml.includes('href="'+transfer.forwardHref+'"')) fail('invalid practice link');
      for(const [index,payload] of transfer.payloads.entries()) {
        if(!Number.isInteger(payload.start) || !Number.isInteger(payload.end) || payload.start<0 || payload.end>record.before.length || payload.start>=payload.end) fail('invalid experiment boundary');
        const moved=record.before.slice(payload.start,payload.end);
        if(!moved || sha(moved)!==payload.sha256 || entry.html.split(moved).length!==2 || record.after.includes(moved)) fail('moved experiment payload mismatch');
        if(expected.split(moved).length!==2) fail('overlapping experiment payload');
        expected=expected.replace(moved,index===0?transfer.linkHtml:'');
      }
      for(const edit of transfer.conceptualEdits) {
        if(sha(edit.before)!==edit.beforeSha256 || sha(edit.after)!==edit.afterSha256 || expected.split(edit.before).length!==2) fail('conceptual wording edit drift');
        expected=expected.replace(edit.before,edit.after);
      }
      if(expected!==record.after) fail('changes exceed reviewed experiment transfer');
    }
  }
}
export function projectPracticeBoundaryCorrections(entries,registry,{baselineTest=false,reverse=false}={}) {
  if(baselineTest) return entries;
  validateRegistry(registry);
  validatePracticeEntries(entries,registry);
  // Keep the original reviewed insertion hashes intact. A later exact review
  // consumes that intermediate output and must be undone before the first layer.
  const stages=[registry.records,registry.postReviewRecords||[]];
  if(reverse) stages.reverse();
  return stages.reduce((current,records)=>projectRecords(current,records,{reverse}),entries);
}
function projectRecords(entries,records,{reverse}) {
  if(!records.length) return entries;
  // Independent future QA additions update an explicit "N 问" label. Validate
  // that derivation before restoring only that label for the existing identity
  // validator. All other identity and exact before/after checks remain strict.
  const expectedById=new Map(records.map(r=>[r.entryId,r.entryIdentity]));
  const guarded=entries.map(entry=>{
    const expected=expectedById.get(entry.id);
    if(!expected || entry.number===expected.number) return entry;
    const count=/^(\s*)(\d+)(\s*问\s*)$/.exec(expected.number||'');
    if(!count || !Array.isArray(entry.items) || entry.items.length<Number(count[2]) || entry.number!==count[1]+entry.items.length+count[3]) fail('derived question count drift '+entry.id);
    return {...entry,number:expected.number};
  });
  const corrected=projectInterviewVoiceReview(guarded,{schemaVersion:1,records},{reverse});
  const changed=new Map(corrected.map(entry=>[entry.id,entry]));
  // Do not leak normalized identities or change any unreviewed field.
  return entries.map(entry=>{
    if(!expectedById.has(entry.id)) return entry;
    const answerIndexes=new Set(records.filter(r=>r.entryId===entry.id).map(r=>r.path[1]));
    return {...entry,items:entry.items.map((question,index)=>answerIndexes.has(index)?{...question,a:changed.get(entry.id).items[index].a}:question)};
  });
}
// Historical corpus tests explicitly remove only this newly authored document
// after reversing the exact replacements. Ordinary reverse preserves authoring.
export function restoreBeforePracticeBoundary(entries,registry) {
  const reversed=projectPracticeBoundaryCorrections(entries,registry,{reverse:true});
  const practiceIds=new Set(registry.practiceEntries.map(entry=>entry.entryId));
  return reversed.filter(entry=>!practiceIds.has(entry.id));
}

// The existing route's third segment already holds stable question keys. Extend
// that segment to the new workbook's stable section IDs without changing QA
// parsing, question focus, stored progress keys, or the compatibility build.
export function projectPracticeBoundaryRuntime(file,text,{baselineTest=false}={}) {
  if(baselineTest || file!=='src/app/routing.js') return text;
  const before='if (r.q != null) focusQuestion(r.q, true);';
  if(text.split(before).length!==2) fail('section route anchor drift');
  const after="if (r.q != null) {\n    if (e?.id === 'own-practice-es-write-visibility' && /^s-es-[a-z]+$/.test(r.q)) document.getElementById(r.q)?.scrollIntoView({block: 'start'});\n    else focusQuestion(r.q, true);\n  }";
  return text.replace(before,after);
}

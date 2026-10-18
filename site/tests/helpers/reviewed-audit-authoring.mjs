// Explicit historical reconstruction for the three independently reviewed audit
// questions. Verify source bytes and exact compiler output before removing them;
// never filter arbitrary future questions or normalize any unrelated content.
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {compileUnextendedAuthoring,readAuthoring} from '../../scripts/authoring.mjs';
import {expectedNoteDisplay} from './note-display-oracle.mjs';
export const REVIEWED_AUDIT_QUESTIONS = [
  ['authoring/questions/ai-agent-6--q-agent-extension-lifecycle.json','53a8ebac7970d76fc800786b1939adedc8a1b7094436024789075c94d3329542'],
  ['authoring/questions/ai-agent-9--q-no-gold-relational-evaluation.json','2c2dc84ed3cfa29d9596d1af500e071aae68640c8776fcf9549a214c59f68d21'],
  ['authoring/questions/ai-模型与评测-7--q-multimodal-admission-budget.json','420707ab1de6b5bc66dd4e9977d2df27117ffb0c73ad42c503a5635900ee4a35']
];
export async function restoreReviewedAuditQuestions(entries) {
  const root=fileURLToPath(new URL('../../',import.meta.url));
  const read=p=>readFile(path.join(root,p),'utf8');
  const docs=[];
  for(const [file,hash] of REVIEWED_AUDIT_QUESTIONS) {
    const bytes=await read(file);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),hash,'reviewed authoring source changed '+file);
    docs.push({type:'questions',file,data:JSON.parse(bytes)});
  }
  const originals=[];
  for(const file of (await readdir(path.join(root,'content/chapters'))).filter(file=>file.endsWith('.json')).sort()) originals.push(...JSON.parse(await read('content/chapters/'+file)).entries);
  // Existing authored questions may be related-link targets of these new ones.
  // Compile the complete ordinary authoring input to validate those references;
  // only the three explicitly byte-pinned questions may be removed below.
  const compiled=compileUnextendedAuthoring(originals,await readAuthoring(root),JSON.parse(await read('content/legacy-identities.json')));
  let result=entries;
  for(const {data} of docs) {
    const expected=compiled.find(entry=>entry.id===data.entryId).items.find(question=>question.id===data.id);
    const actual=result.find(entry=>entry.id===data.entryId);
    assert.ok(actual,'reviewed question target exists');
    const indexes=actual.items.flatMap((question,index)=>question.id===data.id?[index]:[]);
    assert.deepEqual(indexes,[actual.items.length-1],'reviewed authoring must be the exact current tail');
    assert.deepEqual(actual.items.at(-1),expected,'reviewed compiled question changed');
    result=result.map(entry=>entry===actual?{...entry,items:entry.items.slice(0,-1)}:entry);
  }
  return expectedNoteDisplay(result);
}

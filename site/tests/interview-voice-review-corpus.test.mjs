import {projectInterviewConsolidation,readInterviewConsolidation} from '../scripts/interview-consolidation.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {projectInterviewVoiceReview,readInterviewVoiceReview,sha256} from '../scripts/interview-voice-review.mjs';
const json=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
test('interview voice: all final edits reverse to exact immutable 768-entry corpus',async()=>{
 const catalog=await json('dist/data/catalog.json');const chunks=new Map();for(const e of catalog.entries)if(!chunks.has(e._chunk))chunks.set(e._chunk,await json('dist/'+e._chunk));
 const all=new Map([...chunks.values()].flatMap(c=>c.entries).map(e=>[e.id,e]));const entries=catalog.entries.map(e=>all.get(e.id));
 const consolidation=await readInterviewConsolidation();
 const voiceEntries=projectInterviewConsolidation(entries,consolidation,{reverse:true});
 const registry=await readInterviewVoiceReview();const reversed=projectInterviewVoiceReview(voiceEntries,registry,{reverse:true});
 assert.equal(entries.length,768);assert.equal(entries.reduce((n,e)=>n+(e.kind==='qa'?e.items.length:1),0),1603);
 assert.equal(sha256(JSON.stringify(reversed)),'0f271ce6496bc48a5d322ce368211dcb103788deb4eafe19fe5f494366dfc4af','Only explicitly reviewed fields may change; IDs, progress, questions, code and every other value remain exact');
 assert.deepEqual(projectInterviewConsolidation(projectInterviewVoiceReview(reversed,registry),consolidation),entries);
});

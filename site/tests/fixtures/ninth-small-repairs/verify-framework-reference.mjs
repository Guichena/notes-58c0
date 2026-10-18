import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(x).digest('hex');
const at=(o,p)=>p.reduce((v,k)=>v?.[k],o);
const key=(file,pointer)=>JSON.stringify([file,pointer]);
const canonical=x=>JSON.stringify((function sorted(v){return Array.isArray(v)?v.map(sorted):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sorted(v[k])])):v;})(x));
const plain=s=>s.replace(/<[^>]*>/g,'');
const substance=s=>s.replace(/<details\b[\s\S]*?<\/details>/g,'').replace(/<h[1-6]\b[^>]*>(?:常见问法|追问|标签|关联知识|其他问法[^<]*)<\/h[1-6]>[\s\S]*?(?=<h[1-6]\b|$)/g,'');
const readPinned=(relative,expected)=>{const b=fs.readFileSync(new URL(relative,import.meta.url));assert.equal(sha(b),expected,'immutable framework bridge input '+relative);return JSON.parse(b);};
const INDEX_SHA='a8b97d7ca9807ef3e6a7641373c9f720a6cf15db921b6c09277992ddcb09e3df';
const PROOF_SHA='5b1b868277336269c106ce1abbbcbd505fef1085d13d5ef776831869bd73bbf9';
const PACKAGE_SHA='51f05f21d37780feb986ef2e0ab886f8539838489da50f11b089e7ac00d5b168';
const MAP_FILE='tests/fixtures/agent-frameworks/source-block-map.json';
const VAR_FILE='tests/fixtures/agent-frameworks/variant-map.json';

// Every argument is immutable original fixture data. Actual entries are read from the real dist
// by the consumer and are never edited, substituted, reconstructed, or overlaid here.
export function createFrameworkNinthBridge(E,{sourceMap,variants,snapshots}){
 const ix=readPinned('./framework-legacy-dependency-index.json',INDEX_SHA);
 const proof=readPinned('./transition-proof.json',PROOF_SHA);
 const hashes=readPinned('../framework-adapter-cleanup/fixture-hashes.json',PACKAGE_SHA);
 for(const [name,h]of Object.entries(hashes))readBytesPinned('../framework-adapter-cleanup/'+name,h);
 function readBytesPinned(relative,h){assert.equal(sha(fs.readFileSync(new URL(relative,import.meta.url))),h,'original adapter package drift '+relative);}
 const A=n=>JSON.parse(fs.readFileSync(new URL('../framework-adapter-cleanup/'+n,import.meta.url),'utf8'));
 const R=A('records.json').records,B=A('source-blocks.json'),P=A('paragraph-destinations.json').maps;
 const O=A('source-variants.json'),V=A('variant-condition-map.json').variants,W=A('evidence-witnesses.json').witnesses,D=A('display-questions.json');
 const originals=new Map([[MAP_FILE,sourceMap],[VAR_FILE,variants]]),wm=new Map(W.map(w=>[w.key,w]));
 const bodyIndex=new Map(ix.bodyHashOccurrences.map(r=>[key(r.file,r.pointer),r]));
 const movedIndex=new Map(ix.movedSnippetOccurrences.map(r=>[key(r.file,r.pointer),r]));
 const wordingIndex=new Map(ix.originalQuestionLocationPredicates.map(r=>[r.pointer[0],r]));
 const source=R.find(r=>r.entryId==='ai-agent-6'),byAlias=new Map(snapshots.map(s=>[s.alias,s]));
 const blocks=[...source.before.matchAll(/<(p|h[1-6]|li|summary|pre|tr)\b[^>]*>[\s\S]*?<\/\1>/g)].map(m=>m[0]);
 const get=(id,i)=>{const e=E.get(id);assert.ok(e,'missing actual framework destination '+id);const q=e.items[i];assert.ok(q,'missing actual framework item '+id+'#'+i);return q;};
 const counts={bodyPins:452,movedSnippetOccurrences:29,movedSourceParagraphs:4,originalQuestions:49,fineConditions:79,substantiveWitnesses:154};
 let fixtureChecked=false,currentChecked=false;
 function conditions(cs){assert.ok(cs.length,'independent conditions cannot be empty');for(const c of cs){assert.ok(c.condition&&c.witnessKeys.length,'empty independent condition');for(const k of c.witnessKeys)assert.ok(wm.has(k),'unmapped substantive witness '+k);}}
 function fixtureReview(){
  if(fixtureChecked)return counts;
  assert.equal(ix.immutableOriginalSourceAssertionsRemain,true);assert.equal(ix.noOracleWritten,true);
  assert.equal(bodyIndex.size,452);assert.equal(movedIndex.size,29);assert.equal(wordingIndex.size,49);
  assert.equal(R.length,4);assert.equal(B.length,87);assert.equal(P.length,87);assert.equal(blocks.length,87);
  assert.equal(O.sourceLeafSha256,source.beforeSha256);assert.equal(V.length,49);assert.equal(O.variants.length,49);
  assert.equal(W.length,154);assert.equal(wm.size,154);assert.equal(V.reduce((n,v)=>n+v.conditions.length,0),79);assert.equal(D.length,8);
  for(const r of R){assert.equal(sha(r.before),r.beforeSha256);assert.equal(sha(r.after),r.afterSha256);const nr=proof.records.find(x=>x.entryId===r.entryId&&canonical(x.path)===canonical(r.path));assert.ok(nr,'missing exact ninth adapter transition');assert.equal(nr.before,r.before);assert.equal(nr.after,r.after);}
  for(let i=0;i<87;i++){assert.equal(B[i].index,i);assert.equal(P[i].sourceBlockIndex,i);assert.equal(B[i].html,blocks[i]);assert.equal(P[i].sourceHtml,blocks[i]);assert.equal(B[i].sha256,sha(blocks[i]));assert.equal(P[i].sourceSha256,sha(blocks[i]));}
  const sections=A('source-sections.json');assert.equal(sections.length,6);assert.equal(sections.map(s=>s.html).join(''),source.before);for(const s of sections){assert.equal(sha(s.html),s.sha256);assert.equal([...source.before].slice(s.start,s.end).join(''),s.html);}
  const used=new Set();
  for(const w of W){assert.equal(sha(w.html),w.sha256);assert.match(w.html,/^<(p|tr)\b/,'link or heading cannot be a substantive witness');assert.ok(plain(w.html.replace(/<a\b[^>]*>[\s\S]*?<\/a>/g,'')).trim().length>=35,'independent non-link substance '+w.key);}
  for(let i=0;i<V.length;i++){const v=V[i],o=O.variants[i];assert.equal(v.sourceVariantIndex,i);assert.equal(o.index,i);assert.equal(v.sourceHtml,o.html);assert.equal(v.sourceHtml,blocks[v.sourceBlockIndex]);assert.equal(sha(v.sourceHtml),v.sourceSha256);assert.equal(v.sourceSha256,o.sha256);assert.equal(v.sourceQuestion,o.question);assert.equal(v.sourceQuestionHtml,o.questionHtml);conditions(v.conditions);for(const c of v.conditions)for(const k of c.witnessKeys)used.add(k);}
  for(const p of P)for(const c of p.conditions){conditions([c]);for(const k of c.witnessKeys)used.add(k);}
  assert.deepEqual([...used].sort(),[...wm.keys()].sort(),'all 154 witnesses have original paragraph or question provenance');
  // Enumerate the original structures independently, so no one can silently omit a pin.
  const enumerated=[];
  function walk(file,x,p=[]){if(Array.isArray(x)){x.forEach((v,i)=>walk(file,v,[...p,i]));return;}if(!x||typeof x!=='object')return;
   if(Object.hasOwn(x,'bodySha256')&&['adapter','arch','workspace','report'].includes(x.alias))enumerated.push(key(file,[...p,'bodySha256']));
   for(const[k,v]of Object.entries(x))if(v&&typeof v==='object')walk(file,v,[...p,k]);}
  for(const[file,data]of originals)walk(file,data);
  assert.deepEqual(enumerated.sort(),[...bodyIndex.keys()].sort(),'complete 452 original body-pin locations');
  for(const r of ix.bodyHashOccurrences){const d=at(originals.get(r.file),r.pointer.slice(0,-1)),s=byAlias.get(r.alias);assert.ok(s);assert.equal(at(originals.get(r.file),r.pointer),r.oldBodySha256);assert.equal(d.alias,r.alias);assert.equal(d.bodySha256,s.sha256);assert.equal(sha(s.expectedBody),s.sha256);const ar=R.find(a=>a.entryId===s.entryId&&a.itemIndex===(typeof s.questionId==='number'?s.questionId:proof.originalEntries[s.entryId].items.findIndex(q=>q.id===s.questionId)));assert.ok(ar);assert.equal(ar.before,s.expectedBody);assert.equal(ar.afterSha256,r.candidateBodySha256);
   const changed=d.snippets.filter(w=>!ar.after.includes(w));assert.equal(changed.length,r.changedSnippetCount);assert.equal(d.snippets.length-changed.length,r.unchangedOldSnippetCount);
   for(let j=0;j<d.snippets.length;j++)if(!ar.after.includes(d.snippets[j]))assert.ok(movedIndex.has(key(r.file,[...r.pointer.slice(0,-1),'snippets',j])),'every missing original snippet has an exact indexed migration');}
  assert.deepEqual([...new Set(ix.movedSnippetOccurrences.map(r=>r.source369BlockIndex))].sort((a,b)=>a-b),[23,24,25,26]);
  for(const r of ix.movedSnippetOccurrences){const old=at(originals.get(r.file),r.pointer),d=at(originals.get(r.file),r.pointer.slice(0,-2));assert.equal(old,r.oldSnippet);assert.equal(sha(old),r.oldSnippetSha256);assert.deepEqual(d,r.oldDestination,'complete original destination object');assert.equal(B[r.source369BlockIndex].html,old);assert.equal(B[r.source369BlockIndex].sha256,r.oldSnippetSha256);assert.deepEqual(r.conditionDisposition,P[r.source369BlockIndex].conditions);conditions(r.conditionDisposition);const keys=[...new Set(r.conditionDisposition.flatMap(c=>c.witnessKeys))];assert.deepEqual(r.newActualDestinations,keys.map(k=>wm.get(k)),'full witness objects, identities and prose must remain exact');}
  assert.deepEqual([...wordingIndex.values()].map(r=>r.source369VariantIndex).sort((a,b)=>a-b),Array.from({length:49},(_,i)=>i));
  const actualSourceIndexes=variants.map((v,i)=>({v,i})).filter(({v})=>v.sourceKey==='ai-agent-6#8').map(({i})=>i);
  assert.deepEqual([...wordingIndex.keys()].sort((a,b)=>a-b),actualSourceIndexes,'every original-place adapter question is represented');
  for(const [i,r]of wordingIndex){assert.equal(r.file,VAR_FILE);assert.deepEqual(r.pointer,[i]);const old=variants[i],v=V[r.source369VariantIndex];assert.equal(old.blockId,r.blockId);assert.equal(old.publicText,r.exactOldPublicText);assert.equal(old.originalText,r.exactOldPublicText);assert.equal(sha(old.publicText),r.exactOldPublicTextSha256);assert.equal(v.sourceQuestion,r.exactOldPublicText);assert.equal(v.sourceSha256,r.source369VariantSha256);assert.deepEqual(v.display,r.candidateDisplay);assert.deepEqual(v.conditions,r.candidateFineConditions);}
  fixtureChecked=true;return counts;
 }
 function assertCurrent(){
  fixtureReview();if(currentChecked)return counts;
  // Validate complete real current entries first, including all identity/metadata and sibling fields.
  // Unchanged entries use the frozen actual500 canonical hashes; changed entries use full527 objects.
  const ids=new Set([...R.map(r=>r.entryId),...W.map(w=>w.entryId)]);
  for(const id of ids){const e=E.get(id);assert.ok(e);if(Object.hasOwn(proof.finalEntries,id))assert.deepEqual(e,proof.finalEntries[id],'complete current entry before framework migration '+id);else assert.equal(sha(canonical(e)),proof.originalCanonicalHashes[id],'complete unchanged current witness entry '+id);}
  for(const r of R){const q=get(r.entryId,r.itemIndex);assert.equal(q.q,r.questionGuard);assert.equal(q.id??null,r.questionId);assert.equal(q.a,r.after,'exact current adapter/canonical leaf '+r.entryId);}
  for(const w of W){const q=get(w.entryId,w.itemIndex);assert.equal(q.id??null,w.questionId);assert.equal(q.q,w.question);assert.ok(substance(q.a).includes(w.html),'actual substantive witness missing '+w.key);}
  for(const d of D){assert.ok(get(d.entryId,d.itemIndex).a.includes(d.html),'exact normalized adapter question missing '+d.displayId);assert.equal(plain(d.html),d.question);}
  for(const v of V){if(v.display.kind==='normalized-adapter-question'){const d=D.find(d=>d.displayId===v.display.displayId);assert.ok(d&&d.sourceVariantIndexes.includes(v.sourceVariantIndex));}else{assert.equal(v.display.kind,'existing-canonical-question-and-body');assert.deepEqual(v.display.questionRoutes,v.targetRoutes);for(const route of v.display.questionRoutes){const match=/^#\/e\/([^/]+)\/([^/]+)$/.exec(route);assert.ok(match);const [,id,qid]=match;const e=E.get(id);assert.ok(e);const q=/^\d+$/.test(qid)?e.items[+qid]:e.items.find(x=>x.id===qid);assert.ok(q,'original question destination exists '+route);const matching=v.conditions.flatMap(c=>c.witnessKeys).map(k=>wm.get(k)).filter(w=>w.route===route);assert.ok(matching.length,'a route alone cannot satisfy an original question '+route);for(const w of matching){assert.equal(q.q,w.question);assert.ok(substance(q.a).includes(w.html));}}}}
  for(const r of ix.bodyHashOccurrences){const s=byAlias.get(r.alias),e=E.get(s.entryId),q=typeof s.questionId==='number'?e.items[s.questionId]:e.items.find(x=>x.id===s.questionId);assert.equal(sha(q.a),r.candidateBodySha256,'current exact body for old pin '+key(r.file,r.pointer));}
  currentChecked=true;return counts;
 }
 return{
  fixtureReview,assertCurrent,
  destinations(r,index){return r.destinations.map((d,i)=>({d,pointer:['blocks',index,'destinations',i]})).concat((r.conditionUnits??[]).flatMap((u,j)=>u.destinations.map((d,k)=>({d,pointer:['blocks',index,'conditionUnits',j,'destinations',k]}))));},
  migratedSnippet(pointer,d,w){const r=movedIndex.get(key(MAP_FILE,pointer));if(!r)return false;assertCurrent();assert.deepEqual(d,r.oldDestination);assert.equal(w,r.oldSnippet);for(const dest of r.newActualDestinations)assert.ok(substance(get(dest.entryId,dest.itemIndex).a).includes(dest.html),'mapped independent old-paragraph condition missing');return true;},
  hasWording(i){return wordingIndex.has(i);},
  migratedWording(i,old){const r=wordingIndex.get(i);assert.ok(r,'unreviewed original question relocation');assertCurrent();assert.deepEqual(old,variants[i]);assert.equal(old.publicText,r.exactOldPublicText);const v=V[r.source369VariantIndex];assert.equal(v.sourceQuestion,old.publicText);for(const c of v.conditions)for(const k of c.witnessKeys){const w=wm.get(k);assert.ok(substance(get(w.entryId,w.itemIndex).a).includes(w.html),'original question independent condition lost '+old.blockId+':'+c.condition);}return true;}
 };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {createComparisonVerifier,readComparisonEquivalence,projectComparisonVisibilityRuntime as project} from '../scripts/comparison-visibility.mjs';
import {ContentRepository} from '../src/runtime/content-repository.js';

const read=file=>readFile(new URL('../'+file,import.meta.url),'utf8');
const json=async file=>JSON.parse(await read(file));
const sha=value=>createHash('sha256').update(value).digest('hex');
const digest=async value=>Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),byte=>byte.toString(16).padStart(2,'0')).join('');
const registry=await readComparisonEquivalence();
const catalog=await json('dist/data/catalog.json'),entries=[],byId=new Map();
for(const file of new Set(catalog.entries.map(entry=>entry._chunk)))for(const entry of (await json('dist/'+file)).entries){entries.push(entry);byId.set(entry.id,entry);}
const cards=catalog.HL.cards;
function fixture() {
  const card={title:'A vs B',cols:['A','B'],rows:[{dim:'Role',cells:['one','two']}],dup:1};
  const table='<table><tr><th></th><th>A</th><th>B</th></tr><tr><th>Role</th><td>one</td><td>two</td></tr></table>';
  const item={id:'q-one',q:'Which?',lead:'<p>Summary.</p>',a:'<p>Answer.</p>'+table};
  const entry={id:'fixture',kind:'qa',mod:'ai',items:[item]},cards={'fixture#0':card},owners=new Map([[entry.id,entry]]);
  const record={key:'fixture#0',entryId:'fixture',questionIndex:0,questionId:item.id,questionText:item.q,expectedCardSha256:sha(JSON.stringify(card)),expectedAnswerSha256:sha(item.a),expectedLeadSha256:sha(item.lead),tableIndex:0,expectedTableHtmlSha256:sha(table)};
  const create=(options={})=>createComparisonVerifier({records:[record],cards,digest,entryForId:id=>owners.get(id),...options});
  return {card,table,item,entry,cards,owners,record,create};
}

test('unverified cards are visible and exact same-question card/a/lead/table hashes alone permit duplicate treatment',async()=>{
  const f=fixture(),v=f.create();
  assert.equal(v.isDuplicate(f.record.key,f.item),false);
  const pending=v.verifyEntry(f.entry);
  assert.equal(v.isDuplicate(f.record.key,f.item),false,'never hide before verification finishes');
  await pending;assert.equal(v.isDuplicate(f.record.key,{...f.item}),true);
  f.card.dup=0;assert.equal(v.isDuplicate(f.record.key,f.item),false);
  f.record.expectedCardSha256=sha(JSON.stringify(f.card));await v.verifyEntry(f.entry);
  assert.equal(v.isDuplicate(f.record.key,f.item),false,'a table never promotes source dup=0');
  const unknown=f.create({records:[]});await unknown.verifyEntry(f.entry);assert.equal(unknown.isDuplicate(f.record.key,f.item),false);
});

test('no table, neighboring table, lead-only table and unrelated same-question table never qualify',async()=>{
  for(const change of [
    f=>{f.item.a='<p>No table.</p>';},
    f=>{f.entry.items.push({...f.item,id:'q-neighbor'});f.item.a='<p>No table.</p>';},
    f=>{f.item.lead+=f.table;f.item.a='<p>No table.</p>';},
    f=>{f.item.a=f.item.a.replace('one','different claim');},
    f=>{f.item.id='q-neighbor';},
    f=>{f.item.q='Neighbor question?';}
  ]) {const f=fixture();change(f);const v=f.create();await v.verifyEntry(f.entry);assert.equal(v.isDuplicate(f.record.key,f.item),false);}
});

test('receipts invalidate immediately on same-object mutations to answer, lead, table, card, pick or question identity',async()=>{
  for(const change of [
    f=>{f.item.a+='outside-table change';},f=>{f.item.a=f.item.a.replace('one','changed');},
    f=>{f.item.lead+='new qualification';},f=>{f.card.rows[0].cells[0]='unique card detail';},
    f=>{f.card.pick='A';f.card.pickLabel='recommended';},f=>{f.item.q='Changed?';},
    f=>{f.item.id='changed';},f=>{f.entry.items[0]={...f.item};},f=>{f.owners.set(f.entry.id,{...f.entry});}
  ]) {const f=fixture(),v=f.create();await v.verifyEntry(f.entry);assert.equal(v.isDuplicate(f.record.key,f.item),true);change(f);assert.equal(v.isDuplicate(f.record.key,f.item),false);}
});

test('missing/rejecting WebCrypto, in-flight content changes and obsolete routes remain safely visible',async()=>{
  for(const badDigest of [async()=>null,async()=>{throw Error('Digest unavailable');}]) {
    const f=fixture(),v=f.create({digest:badDigest});await v.verifyEntry(f.entry);assert.equal(v.isDuplicate(f.record.key,f.item),false);
  }
  for(const invalidate of ['answer','route','entry']) {
    const f=fixture();let release,current=true;const gate=new Promise(resolve=>{release=resolve;});
    const v=f.create({digest:async value=>{await gate;return digest(value);}}),pending=v.verifyEntry(f.entry,{isCurrent:()=>current});
    if(invalidate==='answer')f.item.a+='changed during digest';
    if(invalidate==='route')current=false;
    if(invalidate==='entry')f.owners.set(f.entry.id,{...f.entry});
    release();await pending;assert.equal(v.isDuplicate(f.record.key,f.item),false);
  }
});

test('an older asynchronous verification cannot overwrite the newer receipt for the same hydrated entry',async()=>{
  const f=fixture();let release,calls=0;const gate=new Promise(resolve=>{release=resolve;});
  const v=f.create({digest:async value=>{if(++calls<=4)await gate;return digest(value);}});
  const old=v.verifyEntry(f.entry);await v.verifyEntry(f.entry);
  assert.equal(v.isDuplicate(f.record.key,f.item),true);
  release();await old;assert.equal(v.isDuplicate(f.record.key,f.item),true);
});

test('all reviewed live pairs are checked against final data; all absent or mismatched pairs stay visible',async()=>{
  assert.equal(registry.records.length,23);
  for(const key of ['ai-模型与评测-3#1'])assert.ok(!registry.records.some(record=>record.key===key),'withdrawn equivalence stays visible: '+key);
  const v=createComparisonVerifier({records:registry.records,cards,digest,entryForId:id=>byId.get(id)});
  await Promise.all(entries.filter(entry=>entry.kind==='qa').map(entry=>v.verifyEntry(entry)));
  const approved=new Map(registry.records.map(record=>[record.key,record]));let matches=0,visible=0;
  for(const [key,card] of Object.entries(cards)) {
    const [id,index]=key.split('#'),entry=byId.get(id),item=entry?.items?.[Number(index)];
    const r=approved.get(key),table=item&&r?[...item.a.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)][r.tableIndex]?.[0]:undefined;
    const expected=Boolean(card.dup&&r&&item&&(item.id??null)===r.questionId&&item.q===r.questionText&&table&&sha(JSON.stringify(card))===r.expectedCardSha256&&sha(item.a)===r.expectedAnswerSha256&&sha(item.lead||'')===r.expectedLeadSha256&&sha(table)===r.expectedTableHtmlSha256);
    assert.equal(v.isDuplicate(key,item),expected,key);if(expected)matches++;else visible++;
  }
  assert.equal(matches,23);assert.equal(visible,99);
  assert.equal(v.isDuplicate('bg-mysql-1#3',byId.get('bg-mysql-1').items[3]),false,'an unrelated table is not equivalent');
});

test('actual compiled renderer preserves cards across q/lead/full and print while only verified equivalents get the dup class',async()=>{
  const app=await read('dist/assets/app.js'),css=await read('dist/assets/styles/main.css');
  const v=createComparisonVerifier({records:registry.records,cards,digest,entryForId:id=>byId.get(id)});
  await Promise.all(entries.filter(entry=>entry.kind==='qa').map(entry=>v.verifyEntry(entry)));
  const cmp=app.slice(app.indexOf('function cmpCard('),app.indexOf('function keyCard('));
  const qa=app.slice(app.indexOf('function splitLead('),app.indexOf('function qaToolbar('));
  const exactLead=app.match(/^function exactLeadAnswerRest\(lead, answer\) \{[\s\S]*?^\}/m)?.[0];
  assert.ok(exactLead,'actual compiled exactLeadAnswerRest helper is present');
  const context={HLC:cards,comparisonVerifier:v,h:String,statusOf:()=>0,priorityChip:()=>'',removeExactIntroRepeat:(_lead,rest)=>rest,state:{qaMode:'lead'}};
  const key='ai-agent-2#6',item={...byId.get('ai-agent-2').items[6],key,no:7};
  for(const mode of ['q','lead','full']) {
    const html=runInNewContext(cmp+exactLead+qa+';qaListHtml([item],{mode})',{...context,item,mode});
    assert.ok(html.includes('data-mode="'+mode+'"'));assert.ok(html.includes('<div class="cmp">'));
    assert.ok(!html.includes('<div class="cmp dup">'));assert.ok(!html.includes('正文里有完整对比表'));
    assert.ok(html.includes('显示答案 · Space'));assert.ok(html.includes('qa-lead'));
  }
  assert.match(css,/\.qa-list\[data-mode="full"\] div\.cmp\.dup\{display:none\}/);
  assert.match(css,/@media print[\s\S]*\.qa-list div\.cmp\.dup\{display:none!important\}/);
  const r=registry.records.find(record=>v.isDuplicate(record.key,byId.get(record.entryId).items[record.questionIndex]));
  const html=runInNewContext(cmp+';cmpCard(key,item)',{...context,key:r.key,item:byId.get(r.entryId).items[r.questionIndex]});
  assert.ok(html.includes('<div class="cmp dup">'));assert.ok(html.includes('正文里有完整对比表'));
});

test('real lazy hydration including a cross-version chapter validates actual content, not the catalog or neighbor',async()=>{
  for(const stale of [false,true]) {
    const f=fixture(),chunk='data/chapters/fixture.json';
    const payload=structuredClone(f.entry);if(stale)payload.items[0].a='<p>Older body without table.</p>';
    const repository=new ContentRepository({baseURL:'https://example.test/',fetcher:async url=>({ok:true,json:async()=>structuredClone(url.pathname.endsWith('catalog.json')?{entries:[{id:f.entry.id,kind:'qa',mod:'ai',_chunk:chunk,items:[{id:f.item.id}]}]}:{entries:[payload]})})});
    await repository.loadCatalog();await repository.loadMap('ai');
    const hydrated=await repository.loadEntry(f.entry.id);
    const v=f.create({entryForId:id=>repository.byId.get(id)});
    await v.verifyEntry(hydrated);assert.equal(v.isDuplicate(f.record.key,hydrated.items[0]),!stale);
  }
});

test('runtime projection is guarded, baseline-excluded and ships only minimal verification data',async()=>{
  for(const file of ['src/app/highlight-map.js','src/app/renderers.js','src/app/routing.js']) {
    const source=await read(file),out=project(file,source,registry);
    assert.equal(project(file,source,null,{baselineTest:true}),source);
    assert.throws(()=>project(file,out,registry),/anchor drift/);
    assert.ok(!out.includes('evidenceFile'));assert.ok(!out.includes('comparison-first-cell-review.json'));assert.ok(!out.includes('audit-20261017/reports'));
  }
  assert.equal(project('src/app/questions.js','untouched',null),'untouched');
  const changed=structuredClone(registry);changed.records[0].expectedAnswerSha256='0'.repeat(64);
  const highlight=await read('src/app/highlight-map.js');
  assert.throws(()=>project('src/app/highlight-map.js',highlight,changed),/registry integrity/);
  const app=await read('dist/assets/app.js');
  assert.ok(app.includes('cmpCard(it.key, it)'));
  assert.ok(app.includes('await comparisonVerifier.verifyEntry(byId.get(pendingEntry.id), {isCurrent: () => sequence === renderSequence})'));
  assert.ok(app.indexOf('await comparisonVerifier.verifyEntry')>app.indexOf('repository.loadEntry(pendingEntry.id)'));
});

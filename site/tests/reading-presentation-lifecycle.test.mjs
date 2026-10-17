import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {READING_PRESENTATION_LIFECYCLE, addReadingPresentationLifecycle} from '../scripts/reading-presentation-runtime.mjs';

const site = new URL('../', import.meta.url);
const rawRouter = await readFile(new URL('src/app/routing.js',site),'utf8');
const rawFragments = await readFile(new URL('src/app/fragments.js',site),'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

test('adapter insertion preserves entire original blocks and guards only the real lifecycle contract',()=>{
  const files=['catalog','fragments','routing','events'];
  const blocks=['catalog sentinel',rawFragments,rawRouter,'events sentinel'];
  const original=[...blocks];
  const out=addReadingPresentationLifecycle('app',files,blocks);
  assert.deepEqual(blocks,original);assert.equal(out.length,5);assert.equal(out[3],READING_PRESENTATION_LIFECYCLE);
  for(const block of blocks)assert.ok(out.join('\n;\n').includes(block));
  assert.equal(out.at(-1),'events sentinel');
  assert.equal(addReadingPresentationLifecycle('app',files,blocks,{baselineTest:true}),blocks);
  assert.equal(addReadingPresentationLifecycle('visuals',files,blocks),blocks);
  const changed=[...blocks];changed[2]=rawRouter.replace('面试手册 v17','legitimate isolated fixture');
  assert.equal(addReadingPresentationLifecycle('app',files,changed)[2],changed[2]);
  for(const [f,b] of [
    [files,blocks.slice(1)],
    [['fragments','routing'],[rawFragments,rawRouter]],
    [['fragments','routing','events','events'],[rawFragments,rawRouter,'events','events']],
    [['routing','fragments','events'],[rawRouter,rawFragments,'events']],
    [files,[blocks[0],rawFragments.replace('function hydrateCode(root) {','function renamed(root) {'),rawRouter,blocks[3]]],
    [files,[blocks[0],rawFragments,rawRouter.replace('    hydrateCode(page);',''),blocks[3]]],
    [files,[blocks[0],rawFragments,rawRouter+'\n    hydrateCode(page);',blocks[3]]],
    [files,[blocks[0],rawFragments,rawRouter.replace('    buildRail();',''),blocks[3]]],
    [files,[blocks[0],rawFragments,rawRouter,READING_PRESENTATION_LIFECYCLE]],
  ])assert.throws(()=>addReadingPresentationLifecycle('app',f,b),/Reading presentation:/);
});

test('adapter installs once and preserves original arguments, receiver, return value and unrelated roots',()=>{
  const first={textContent:'01'}, removed={textContent:'02'}, last={textContent:'03'};
  const page={numbers:[first,removed,last],querySelectorAll(){return this.numbers;}};
  const other={};const sentinel={result:'same object'};const receiver={identity:'receiver'};
  const calls=[];const entry={id:'active'};
  const context=vm.createContext({page,other,receiver,sentinel,calls,document:{getElementById:()=>page},state:{route:{view:'entry',id:'active'}},byId:new Map([['active',entry]]),pad2:n=>String(n).padStart(2,'0'),window:{__NOTES_RUNTIME__:{enhanceReadingPage(root,e){calls.push(['enhance',root,e]);root.numbers.splice(1,1);}}}});
  vm.runInContext('function hydrateCode() { calls.push(["hydrate", this, ...arguments]); return sentinel; }',context);
  vm.runInContext(READING_PRESENTATION_LIFECYCLE,context);const wrapped=context.hydrateCode;
  vm.runInContext(READING_PRESENTATION_LIFECYCLE,context);assert.equal(context.hydrateCode,wrapped);
  const returned=vm.runInContext('hydrateCode.call(receiver,page,"extra",17)',context);
  assert.equal(returned,sentinel);assert.equal(calls.length,2);assert.equal(calls[0][2],entry);
  assert.equal(calls[1][1],receiver);assert.equal(calls[1][2],page);assert.equal(calls[1][3],'extra');assert.equal(calls[1][4],17);
  assert.equal(first.textContent,'01');assert.equal(last.textContent,'02');
  vm.runInContext('hydrateCode.call(receiver,other,"untouched")',context);
  assert.equal(calls.length,3);assert.equal(calls[2][2],other);assert.equal(calls[2][3],'untouched');
  context.state.route={view:'home'};page.numbers=[];vm.runInContext('hydrateCode(page)',context);assert.equal(calls[3][2],null);
});

function routerHarness() {
  const events=[], nodes=new Map(), pending=new Map();
  const node=id=>{
    if(!nodes.has(id))nodes.set(id,{_html:'',numbers:[],style:{},value:'',classList:{toggle(){}},querySelectorAll(){return this.numbers;},addEventListener(){},
      get innerHTML(){return this._html;},set innerHTML(value){this._html=value;this.numbers=[{textContent:'01'},{textContent:'02'},{textContent:'03'}];}});
    return nodes.get(id);
  };
  const page=node('#page');
  const entries=[{id:'a',kind:'doc',mod:'ai',title:'A',_chunk:'a.json'},{id:'b',kind:'doc',mod:'ai',title:'B',_chunk:'b.json'}];
  const byId=new Map(entries.map(e=>[e.id,e]));
  const repository={loaded:new Set(),loadEntry(id){
    if(this.loaded.has(byId.get(id)._chunk))return Promise.resolve(byId.get(id));
    if(!pending.has(id)){
      let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
      pending.set(id,{promise,resolve:()=>{repository.loaded.add(byId.get(id)._chunk);resolve(byId.get(id));},reject});
    }
    return pending.get(id).promise;
  },loadMap:async()=>{}};
  const context=vm.createContext({events,byId,DATA:{},ALGO_ALIAS:{},TREE:{ai:{}},HL_MODS:[],ENTRIES:entries,MOD:{ai:{full:'AI'}},
    location:{hash:'#/'},history:{replaceState(){}},document:{body:{dataset:{}},getElementById:id=>node('#'+id)},
    state:{route:null,mod:'home',filter:'',mustOnly:false},window:{scrollTo(){},__NOTES_RUNTIME__:{repository,loadVisuals:async()=>{},enhanceReadingPage(p,e){events.push(['enhance',e?.id??null]);p.numbers.splice(1,1);}}},
    console:{error(){}},DG:{stopAll(){},mountAll(){}},unwireMap(){},wireMap(){},renderModnav(){},renderSidebar(){},closeNav(){},pushRecent(){},store:{set(){}},modColor:()=>'',pad2:n=>String(n).padStart(2,'0'),$:node,$$:()=>[],
    renderHome:()=>'<home>',renderModHome:()=>'<module>',renderMap:()=>'<map>',renderNotFound:()=>'<notfound>',renderDoc:e=>'<entry>'+e.id,
    renderAlgo(){},renderPTopic(){},renderPattern(){},renderTopic(){},renderScenario(){},renderHandwrite(){},renderSyntax(){},renderQA(){},
    buildRail(){events.push(['rail']);},focusQuestion(q){events.push(['focus',q]);},staggerViz(){},
  });
  vm.runInContext('function hydrateCode(page) { events.push(["hydrate", page.innerHTML]); }',context);
  vm.runInContext(rawRouter,context);vm.runInContext(READING_PRESENTATION_LIFECYCLE,context);
  return {context,page,events,pending,repository,render:hash=>{context.location.hash=hash;return vm.runInContext('render()',context);}};
}

test('unchanged router applies enhancement on initial successful render before hydration, rail and question focus',async()=>{
  const h=routerHarness();const rendering=h.render('#/e/a/2');assert.equal(h.events.length,0);assert.ok(h.page.innerHTML.includes('load-state'));
  h.pending.get('a').resolve();await rendering;
  assert.deepEqual(plain(h.events),[['enhance','a'],['hydrate','<entry>a'],['rail'],['focus','2']]);
  assert.deepEqual(h.page.numbers.map(n=>n.textContent),['01','02']);
  h.events.length=0;await h.render('#/e/a/3');assert.deepEqual(plain(h.events),[['focus','3']]);
});

test('stale and failed async render paths never run enhancement; successful retry and home do',async()=>{
  const h=routerHarness();const older=h.render('#/e/a');const newer=h.render('#/e/b');
  h.pending.get('b').resolve();await newer;const newestEvents=plain(h.events);
  h.pending.get('a').resolve();await older;assert.deepEqual(plain(h.events),newestEvents);assert.equal(h.page.innerHTML,'<entry>b');
  assert.equal(h.events.filter(e=>e[0]==='enhance').length,1);
  const fail=routerHarness();const bad=fail.render('#/e/a');fail.pending.get('a').reject(new Error('offline'));await bad;
  assert.equal(fail.events.length,0);assert.ok(fail.page.innerHTML.includes('load-error'));
  fail.pending.delete('a');const retry=fail.render('#/e/a');fail.pending.get('a').resolve();await retry;
  assert.deepEqual(plain(fail.events),[['enhance','a'],['hydrate','<entry>a'],['rail']]);
  fail.events.length=0;await fail.render('#/');assert.deepEqual(plain(fail.events),[['enhance',null],['hydrate','<home>'],['rail']]);
});

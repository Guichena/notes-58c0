import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ContentRepository } from '../src/runtime/content-repository.js';
const baseURL='https://example.test/notes-58c0/';
const distURL=new URL('../'+(process.env.NOTES_TEST_DIST||'dist')+'/',import.meta.url);
const sample={entries:[{id:'qa-one',kind:'qa',mod:'bagu',_chunk:'data/chapters/bagu-one.json',items:[{mk:true},{mk:false}]},{id:'algo-one',kind:'algo',mod:'algo',number:146,_chunk:'data/chapters/algo-one.json'}]};
const chunks={
 'data/catalog.json':sample,
 'data/chapters/bagu-one.json':{entries:[{id:'qa-one',kind:'qa',mod:'bagu',items:[{q:'Q1',a:'A1',mk:true},{q:'Q2',a:'A2',mk:false}]}]},
 'data/chapters/algo-one.json':{entries:[{id:'algo-one',kind:'algo',mod:'algo',number:146,code:'original code'}]},
 'data/search.json':[{id:'algo-one',title:'LRU',text:'Cache'}, {id:'qa-one',qi:0,title:'Question',text:'Answer',mk:true}],
};
const response=(data,status=200)=>({ok:status===200,status,json:async()=>structuredClone(data)});
function setup(custom) {
 const requests=[];
 const fetcher=async url=>{requests.push(String(url));const key=String(url).slice(baseURL.length);return custom?custom(key,requests):response(chunks[key]);};
 return {repo:new ContentRepository({baseURL,fetcher}),requests};
}
test('catalog-only startup makes no chapter or search requests, under the Pages base path',async()=>{
 const {repo,requests}=setup();await repo.loadCatalog();assert.deepEqual(requests,[baseURL+'data/catalog.json']);assert.equal(repo.loaded.size,0);
});
test('entry/chapter requests deduplicate, retain object identity and cache successful content',async()=>{
 const {repo,requests}=setup();const catalog=await repo.loadCatalog();const original=catalog.entries[0];
 const [one,two]=await Promise.all([repo.loadEntry('qa-one'),repo.loadEntry('qa-one')]);
 assert.equal(one,original);assert.equal(two,original);assert.equal(one.items[1].a,'A2');
 await repo.loadEntry('qa-one');assert.equal(requests.filter(x=>x.includes('bagu-one')).length,1);assert.equal(repo.loaded.size,1);
 assert.equal(catalog.entries[1].code,undefined);
});
test('HTTP, network and malformed JSON failures are evicted so retry can succeed',async()=>{
 for(const mode of ['http','network','json']) {
  let fail=true;
  const {repo,requests}=setup(async key=>{if(key.includes('chapters')&&fail){fail=false;if(mode==='http') return response(null,503);if(mode==='network')throw new Error('offline');return{ok:true,json:async()=>{throw new SyntaxError('invalid JSON');}};}return response(chunks[key]);});
  await assert.rejects(repo.loadEntry('qa-one'));assert.equal(repo.loaded.size,0);await repo.loadEntry('qa-one');assert.equal(requests.filter(x=>x.includes('bagu-one')).length,2);
 }
});
test('invalid chapter identities never partially hydrate and can be retried',async()=>{
 let bad=true;const {repo}=setup(async key=>key.includes('bagu-one')&&bad?response({entries:[{id:'alien'}]}):response(chunks[key]));
 await assert.rejects(repo.loadEntry('qa-one'),/Invalid chapter/);assert.equal(repo.byId.get('qa-one').items[0].a,undefined);bad=false;await repo.loadEntry('qa-one');assert.equal(repo.byId.get('qa-one').items[0].a,'A1');
});
test('highlight map loads only QA chapters from the selected module',async()=>{
 const {repo,requests}=setup();await repo.loadMap('bagu');assert.equal(repo.loaded.size,1);assert.ok(!requests.some(x=>x.includes('algo-one')));assert.ok(!requests.some(x=>x.includes('search')));
});
test('global search loads one compact index and no chapter body, with exact legacy lowercase fields',async()=>{
 const {repo,requests}=setup();const records=await repo.loadSearch();assert.equal(records[0].tl,'lru 146');assert.equal(records[0].tx,'cache');assert.equal(records[1].tl,'question');assert.equal(records[1].e,repo.byId.get('qa-one'));assert.equal(repo.loaded.size,0);assert.ok(!requests.some(x=>x.includes('chapters')));
});
test('all built chapters can hydrate without losing any catalog identity or count',async()=>{
 const repo=new ContentRepository({baseURL,fetcher:async url=>response(JSON.parse(await readFile(new URL(String(url).slice(baseURL.length),distURL),'utf8')))});
 const data=await repo.loadCatalog();const refs=[...data.entries];await Promise.all(data.entries.map(e=>repo.loadEntry(e.id)));assert.equal(repo.loaded.size,63);assert.equal(data.entries.length,524);for(let i=0;i<refs.length;i++)assert.equal(data.entries[i],refs[i]);
 const records=await repo.loadSearch();assert.equal(records.length,1031);
});

test('malformed search records and invalid question identities are evicted before retry',async()=>{
 for(const invalid of [{id:'qa-one',title:'missing text'}, {id:'unknown',title:'x',text:'y'}, {id:'qa-one',qi:99,title:'x',text:'y'}]) {
  let fail=true;
  const {repo,requests}=setup(async key=>{if(key==='data/search.json'&&fail){fail=false;return response([invalid]);}return response(chunks[key]);});
  await assert.rejects(repo.loadSearch(),/Invalid search/);
  const records=await repo.loadSearch();assert.equal(records.length,2);assert.equal(requests.filter(x=>x.endsWith('search.json')).length,2);
 }
});

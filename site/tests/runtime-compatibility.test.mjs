import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { fixture, plain, readJSON, root } from './compatibility-helpers.mjs';

const routes = await readJSON(resolve(root,'tests/fixtures/original-routes.json'));
const source = await readFile(resolve(root,'src/app/routing.js'),'utf8');
const routeMatch = /function parseHash\(\)\s*\{[\s\S]*?\n\}/.exec(source);
assert.ok(routeMatch,'The production router exposes parseHash for isolated compatibility testing');

function routeContext(code) {
  const context = vm.createContext({
    DATA: {FACE_PARENTS:fixture.faceParents},
    ALGO_ALIAS:fixture.aliases,
    TREE:Object.fromEntries(fixture.modules.map(mod => [mod,true])),
    HL_MODS:fixture.highlightModules,
    byId:new Map(fixture.metadata.map(entry => [entry.id,entry])),
    location:{hash:''},
    history:{replaceState(_state,_title,hash) { this.replaced=hash; }},
  });
  vm.runInContext(code,context);
  return context;
}

test('production router preserves 1,780 original routes, QA anchors, aliases and redirects', () => {
  const context = routeContext(routeMatch[0]);
  assert.equal(routes.length,1780);
  for (const expected of routes) {
    context.location.hash = expected.hash;
    delete context.history.replaced;
    assert.deepEqual(plain(vm.runInContext('parseHash()',context)),expected.result,expected.hash);
    assert.equal(context.history.replaced,expected.replaceState,`Redirect changed for ${expected.hash}`);
  }
});

test('portable route fixtures reproduce the independently pinned original oracle', async () => {
  const original = await readFile(resolve(root,'tests/fixtures/original-route-function.js'),'utf8');
  const context = routeContext(original);
  for (const expected of routes) {
    context.location.hash = expected.hash;
    delete context.history.replaced;
    assert.deepEqual(plain(vm.runInContext('parseHash()',context)),expected.result,expected.hash);
    assert.equal(context.history.replaced,expected.replaceState,expected.hash);
  }
});

const storage = await readFile(resolve(root,'src/app/storage.js'),'utf8');
function storageContext(initial = {}, denied = false) {
  const values = new Map(Object.entries(initial));
  const writes = [];
  const context = vm.createContext({
    localStorage:{
      getItem(key) { if(denied) throw new Error('Storage denied'); return values.get(key) ?? null; },
      setItem(key,value) { if(denied) throw new Error('Storage denied'); values.set(key,String(value));writes.push({key,value:String(value)}); },
    },
    Date:{now:() => 1234567890},
    byId:new Map(fixture.metadata.map(entry => [entry.id,entry])),
    ENTRIES:fixture.metadata,
  });
  vm.runInContext(storage,context);
  return {context,values,writes,run:code => vm.runInContext(code,context)};
}

test('all 934 old review keys remain readable without migration or renaming', () => {
  const progress = Object.fromEntries(fixture.reviewIdentities.map((unit,index) => [unit.key,{s:index % 2 + 1,t:index}]));
  const stored = JSON.stringify(progress);
  const {run,values,writes} = storageContext({'iv8-progress':stored});
  assert.deepEqual(plain(run('PROG')),progress);
  assert.equal(values.get('iv8-progress'),stored,'Existing progress is not reserialized during initialization');
  assert.equal(writes.length,0,'Existing valid iv8 progress does not trigger writes');
  const total = plain(run('unitsOf(ENTRIES)'));
  assert.deepEqual(total,{total:934,ok:467,fuzzy:467});
  for (const unit of fixture.reviewIdentities) assert.equal(run(`statusOf(${JSON.stringify(unit.key)})`),progress[unit.key].s,unit.key);
});

test('marking and clearing progress preserves exact legacy keys and timestamps', () => {
  const {run,values} = storageContext({'iv8-progress':'{}'});
  for (const unit of fixture.reviewIdentities) run(`setStatus(${JSON.stringify(unit.key)},2)`);
  const marked = JSON.parse(values.get('iv8-progress'));
  assert.deepEqual(Object.keys(marked).sort(),fixture.reviewIdentities.map(unit => unit.key).sort());
  assert.ok(Object.values(marked).every(value => value.s === 2 && value.t === 1234567890));
  assert.deepEqual(plain(run('unitsOf(ENTRIES)')),{total:934,ok:934,fuzzy:0});
  for (const unit of fixture.reviewIdentities) run(`setStatus(${JSON.stringify(unit.key)},0)`);
  assert.deepEqual(JSON.parse(values.get('iv8-progress')),{});
  assert.deepEqual(plain(run('unitsOf(ENTRIES)')),{total:934,ok:0,fuzzy:0});
});

test('v7 migration retains the original recognized-ID rules and ignores unknown IDs', () => {
  const old = [fixture.ids[0],1,'unknown-deleted-id','nonlc-1#15'];
  const {run,values} = storageContext({'lc-v7-progress':JSON.stringify(old)});
  const recognized = old.map(String).filter(id => fixture.ids.includes(id));
  const expected = Object.fromEntries(recognized.map(id => [id,{s:2,t:1234567890}]));
  assert.deepEqual(plain(run('PROG')),expected);
  assert.deepEqual(JSON.parse(values.get('iv8-progress')),expected);
});

test('empty, malformed, and unavailable storage all retain usable default behavior', () => {
  for (const initial of [{},{'iv8-progress':'not-json'},{'iv8-progress':'null'}]) {
    const {run} = storageContext(initial);
    assert.deepEqual(plain(run('PROG')),{});
    assert.equal(run('statusOf("missing")'),0);
    assert.equal(run('qKey("hwqa-1",0)'),'hwqa-1#0');
  }
  const denied = storageContext({},true);
  assert.doesNotThrow(() => denied.run('setStatus("hwqa-1#0",2)'));
  assert.equal(denied.run('statusOf("hwqa-1#0")'),2);
});

test('recent-history ordering and twelve-item limit match existing storage behavior', () => {
  const {run,values} = storageContext({'iv8-progress':'{}'});
  for (const id of fixture.ids.slice(0,15)) run(`pushRecent(${JSON.stringify(id)})`);
  const expected = fixture.ids.slice(3,15).reverse();
  assert.deepEqual(JSON.parse(values.get('iv8-recent')),expected);
  run(`pushRecent(${JSON.stringify(expected[5])})`);
  assert.deepEqual(JSON.parse(values.get('iv8-recent')),[expected[5],...expected.filter(id => id !== expected[5])]);
});

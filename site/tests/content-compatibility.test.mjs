import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ContentRepository } from '../src/runtime/content-repository.js';
import { resolve } from 'node:path';
import { fixture, fingerprint, loadBuild, readJSON, reviewKeys, resolveChunk, root } from './compatibility-helpers.mjs';

const build = await loadBuild();

test('catalog preserves all 524 original IDs and original order', () => {
  assert.equal(build.catalog.entries.length, 524);
  assert.equal(build.entries.length, 524);
  assert.deepEqual(build.catalog.entries.map(entry => entry.id), fixture.ids);
  assert.deepEqual([...build.byId.keys()].sort(), [...fixture.ids].sort());
});

test('every full chapter entry has exactly its original semantic content', () => {
  for (const original of fixture.content) {
    const entry = build.byId.get(original.id);
    assert.ok(entry, `Missing entry ${original.id}`);
    assert.equal(fingerprint(entry), original.sha256, `Content changed for ${original.id}; includes all prose, code, HTML, tables, question order, image links, and nested values`);
  }
});

test('catalog metadata is lossless for navigation and review identity fields', () => {
  const metadataKeys = ['id','kind','mod','part','cat','title','number','progressKey'];
  const actual = build.catalog.entries.map(entry => ({
    ...Object.fromEntries(metadataKeys.filter(key => key in entry).map(key => [key,entry[key]])),
    ...(entry.kind === 'qa' ? {items:entry.items.map(item => ('mk' in item ? {mk:item.mk} : {}))} : {}),
  }));
  assert.deepEqual(actual, fixture.metadata);
});

test('catalog globals preserve exact aliases, face parents, highlight cards and build date', () => {
  for (const [key,expected] of Object.entries(fixture.globals)) assert.equal(fingerprint(build.catalog[key]),expected.sha256, `Changed global ${key}`);
});

test('all 934 review identities and corresponding QA question positions are unchanged', () => {
  const expectedKeys = fixture.reviewIdentities.map(unit => unit.key);
  assert.equal(expectedKeys.length, 934);
  assert.equal(new Set(expectedKeys).size, 934);
  assert.deepEqual(reviewKeys(build.orderedEntries), expectedKeys);
  assert.deepEqual(reviewKeys(build.catalog.entries), expectedKeys, 'Lazy metadata preserves progress before content loads');
  for (const unit of fixture.reviewIdentities) if ('index' in unit) {
    assert.equal(fingerprint(build.byId.get(unit.id).items[unit.index]),unit.questionSha256,`Question ${unit.key} moved or changed`);
  }
});

test('each catalog entry resolves to exactly one matching local chunk', async () => {
  const cache = new Map();
  for (const entry of build.catalog.entries) {
    const path = resolveChunk(build.dist,entry._chunk);
    if (!cache.has(path)) cache.set(path,await readJSON(path));
    assert.equal(cache.get(path).entries.filter(full => full.id === entry.id).length,1,`Incorrect chunk pointer for ${entry.id}`);
  }
  assert.equal(cache.size,build.chunks.length,'No orphan chapter chunk files');
  assert.equal(cache.size,63,'The original 63 module/part/category groups form independent chunks');
  for (const chunk of build.chunks) {
    const groupKeys = new Set(chunk.entries.map(entry => JSON.stringify([entry.mod,entry.part,entry.cat])));
    assert.equal(groupKeys.size,1,`${chunk.name} mixes content groups`);
    const expectedOrder = fixture.metadata.filter(entry => JSON.stringify([entry.mod,entry.part,entry.cat]) === [...groupKeys][0]).map(entry => entry.id);
    assert.deepEqual(chunk.entries.map(entry => entry.id),expectedOrder,`${chunk.name} changed chapter ordering`);
  }
});

test('full-text search is byte-semantic equivalent to the original 1,031 records', async () => {
  // Exercise production normalization, so a bug in tl/tx reconstruction is caught.
  const repository = new ContentRepository({
    baseURL:'https://compatibility.test/notes-58c0/',
    fetcher:async url => {
      assert.equal(url.origin,'https://compatibility.test');
      assert.ok(url.pathname.startsWith('/notes-58c0/'));
      const value = await readJSON(resolve(build.dist,url.pathname.slice('/notes-58c0/'.length)));
      return {ok:true,status:200,json:async () => value};
    },
  });
  const records = (await repository.loadSearch()).map(({e,...record}) => record);
  assert.equal(records.length,1031);
  assert.equal(records.length,fixture.search.length);
  for (let index = 0; index < records.length; index++) {
    const expected = fixture.search[index];
    assert.equal(fingerprint(records[index]),expected.sha256,`Search record ${index} (${expected.id}${expected.qi == null ? '' : '#' + expected.qi}) changed content/order`);
  }
});

test('all 31 pre-existing missing image references are retained and separately inventoried', async () => {
  const expected = await readJSON(resolve(root,'tests/fixtures/original-images.json'));
  assert.equal(expected.length,31);
  assert.ok(expected.every(image => image.missingAtBaseline));
  const images = build.orderedEntries.flatMap(entry => (entry.images || []).map((image,index) => ({id:entry.id,index,name:image.name,href:image.href})));
  assert.deepEqual(images,expected.map(({id,index,name,href}) => ({id,index,name,href})));
  const report = await readFile(resolve(root,'reports/missing-image-assets.md'),'utf8');
  for (const image of expected) assert.ok(report.includes(image.href),`Missing asset ${image.name} is documented`);
});

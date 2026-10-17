import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const readJSON = async path => JSON.parse(await readFile(path, 'utf8'));
export const fixture = await readJSON(resolve(root, 'tests/fixtures/original-compatibility.json'));
export const canonicalize = value => Array.isArray(value) ? value.map(canonicalize) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])])) : value;
export const fingerprint = value => createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
export const plain = value => JSON.parse(JSON.stringify(value));
export const reviewKeys = entries => entries.flatMap(entry => entry.kind === 'qa' ? entry.items.map((_, index) => `${entry.id}#${index}`) : [entry.progressKey || entry.id]);
export async function loadBuild() {
  const dist = resolve(root, process.env.NOTES_TEST_DIST || 'dist');
  const catalog = await readJSON(resolve(dist, 'data/catalog.json'));
  const chunksDir = resolve(dist, 'data/chapters');
  const chunks = await Promise.all((await readdir(chunksDir)).filter(name => name.endsWith('.json')).sort().map(async name => ({name, ...await readJSON(resolve(chunksDir,name))})));
  const entries = chunks.flatMap(chunk => {
    assert.ok(Array.isArray(chunk.entries), `${chunk.name} exposes an entries array`);
    return chunk.entries;
  });
  const byId = new Map(entries.map(entry => [entry.id,entry]));
  assert.equal(byId.size, entries.length, 'Chapter chunks must not duplicate entry identities');
  return {dist, catalog, chunks, entries, byId, orderedEntries:catalog.entries.map(entry => byId.get(entry.id))};
}
export function resolveChunk(dist, chunkPath) {
  assert.equal(typeof chunkPath, 'string', 'Catalog entry has a chunk path');
  assert.ok(!isAbsolute(chunkPath) && !/^[a-z]+:/i.test(chunkPath), 'Chunk path is a local relative URL');
  const path = resolve(dist,chunkPath);
  assert.ok(!relative(dist,path).startsWith('..' + sep), 'Chunk path stays inside dist');
  return path;
}

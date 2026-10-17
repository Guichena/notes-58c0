/**
 * Explicit baseline capture only. Normal tests never regenerate fixtures.
 * Run: node tests/capture-original-fixtures.mjs /path/to/original/index.html
 * The input SHA-256 is pinned to the independently verified upstream revision.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const EXPECTED_SHA256 = '88f78788cd4086948072b6af23df831054c0e849b763c6937c04ee3f65004f4f';
const file = process.argv[2];
assert.ok(file, 'Supply the byte-verified original index.html, never a build output.');
const bytes = await readFile(file);
const sha256 = value => createHash('sha256').update(value).digest('hex');
assert.equal(sha256(bytes), EXPECTED_SHA256, 'Baseline source does not match the pinned original revision.');
const html = bytes.toString('utf8');
const embedded = /<script type="application\/json" id="data">([\s\S]*?)<\/script>/.exec(html);
assert.ok(embedded, 'Original embedded data script exists.');
const data = JSON.parse(embedded[1]);
const canonicalize = value => Array.isArray(value) ? value.map(canonicalize) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])])) : value;
const fingerprint = value => sha256(JSON.stringify(canonicalize(value)));
const between = (start, end) => {
  const a = html.indexOf(start), b = html.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Original source markers exist: ${start}`);
  return html.slice(a, b);
};
// Run only these original pure contracts, rather than reimplementing their rules.
const strip = between('const stripTags =', '\n\nconst MODS');
const dims = between('const DIMS =', '\nfunction renderScenario');
const indexBuilder = between('let INDEX = null;', '\nconst pal =');
const routeSource = between('function parseHash()', '\nfunction render()');
const ctx = vm.createContext({ ENTRIES: data.entries, TOPICS: data.TOPICS });
vm.runInContext(strip + '\n' + dims + '\n' + indexBuilder, ctx);
const records = JSON.parse(vm.runInContext('JSON.stringify(buildIndex().map(({e,...record}) => ({id:e.id,...record})))', ctx));
const modules = [...new Set(data.entries.map(entry => entry.mod))];
const highlightModules = modules.filter(mod => data.entries.some(entry => entry.mod === mod && entry.kind === 'qa'));
const routeContext = vm.createContext({
  DATA: data, ALGO_ALIAS: data.ALGO_ALIAS,
  TREE: Object.fromEntries(modules.map(mod => [mod, true])),
  HL_MODS: highlightModules,
  byId: new Map(data.entries.map(entry => [entry.id, entry])),
  location: { hash: '' }, history: { replaceState(_state, _title, hash) { this.replaced = hash; } },
});
vm.runInContext(routeSource, routeContext);
const hashes = new Set(['', '#', '#/', '#/m/missing', '#/hl/missing', '#/must/missing', '#/e/missing', '#missing', '#h-heading', '#s-1', '#q-0']);
for (const mod of modules) hashes.add('#/m/' + mod);
for (const mod of highlightModules) { hashes.add('#/hl/' + mod); hashes.add('#/must/' + mod); }
for (const entry of data.entries) {
  hashes.add('#/e/' + encodeURIComponent(entry.id));
  hashes.add('#' + entry.id);
  if (entry.kind === 'qa') for (let i = 0; i < entry.items.length; i++) hashes.add('#/e/' + encodeURIComponent(entry.id) + '/' + i);
}
for (const alias of Object.keys(data.ALGO_ALIAS)) {
  hashes.add('#/e/' + alias);
  hashes.add('#/e/' + encodeURIComponent(alias));
  hashes.add('#/e/' + encodeURIComponent(encodeURIComponent(alias)));
}
for (const [parent, count] of Object.entries(data.FACE_PARENTS)) {
  hashes.add('#/e/' + parent);
  for (const n of ['', '-1', '0', 'not-a-number', '1.5', '999', ...Array.from({length: count}, (_, i) => String(i + 1))]) hashes.add('#/e/' + parent + '/' + n);
}
const routes = [...hashes].map(hash => {
  routeContext.location.hash = hash;
  delete routeContext.history.replaced;
  const result = vm.runInContext('JSON.stringify(parseHash())', routeContext);
  return { hash, result: JSON.parse(result), ...(routeContext.history.replaced ? { replaceState: routeContext.history.replaced } : {}) };
});
const reviewIdentities = data.entries.flatMap(entry => entry.kind === 'qa'
  ? entry.items.map((item, index) => ({ id: entry.id, index, key: `${entry.id}#${index}`, questionSha256: fingerprint(item) }))
  : [{ id: entry.id, key: entry.progressKey || entry.id }]);
const metadataKeys = ['id', 'kind', 'mod', 'part', 'cat', 'title', 'number', 'progressKey'];
const metadata = data.entries.map(entry => ({ ...Object.fromEntries(metadataKeys.filter(key => key in entry).map(key => [key, entry[key]])), ...(entry.kind === 'qa' ? {items: entry.items.map(item => ('mk' in item ? {mk:item.mk} : {}))} : {}) }));
const images = [];
for (const entry of data.entries) for (const [index, image] of (entry.images || []).entries()) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(image.href)) continue;
  const decodedPath = decodeURIComponent(image.href);
  let missingAtBaseline = false;
  try { await access(resolve(dirname(file), decodedPath)); } catch { missingAtBaseline = true; }
  images.push({ id: entry.id, index, name: image.name, href: image.href, decodedPath, missingAtBaseline });
}
assert.equal(data.entries.length, 524);
assert.equal(reviewIdentities.length, 934);
assert.equal(new Set(reviewIdentities.map(unit => unit.key)).size, 934);
assert.equal(images.length, 31);
assert.ok(images.every(image => image.missingAtBaseline));
const fixture = {
  provenance: { repository: 'Guichena/notes-58c0', revision: 'a1b8e212f32e23c7a29c1a695bb1255d93ee18a4', source: 'index.html', sourceBytes: bytes.length, sourceSha256: EXPECTED_SHA256, fingerprintAlgorithm: 'sha256(JSON.stringify(recursively sorted object keys; array order unchanged))' },
  counts: { entries: data.entries.length, reviewUnits: reviewIdentities.length, searchRecords: records.length, qaEntries: data.entries.filter(entry => entry.kind === 'qa').length, qaQuestions: data.entries.reduce((sum,entry) => sum + (entry.kind === 'qa' ? entry.items.length : 0),0), imageReferences: images.length },
  ids: data.entries.map(entry => entry.id), metadata, modules, highlightModules,
  content: data.entries.map(entry => ({ id: entry.id, sha256: fingerprint(entry) })),
  globals: Object.fromEntries(['TOPICS','built','ALGO_ALIAS','FACE_PARENTS','HL'].map(key => [key, {sha256: fingerprint(data[key])}])),
  aliases: data.ALGO_ALIAS, faceParents: data.FACE_PARENTS, reviewIdentities,
  search: records.map(record => ({ id: record.id, ...(record.qi !== undefined ? {qi:record.qi} : {}), sha256: fingerprint(record) })),
};
const out = dirname(fileURLToPath(import.meta.url));
await writeFile(resolve(out,'fixtures/original-compatibility.json'), JSON.stringify(fixture,null,2) + '\n');
await writeFile(resolve(out,'fixtures/original-routes.json'), JSON.stringify(routes,null,2) + '\n');
await writeFile(resolve(out,'fixtures/original-images.json'), JSON.stringify(images,null,2) + '\n');
await writeFile(resolve(out,'fixtures/original-route-function.js'), '// Verbatim route function from the pinned original, retained only as a test oracle.\n' + routeSource + '\n');
await writeFile(resolve(out,'../reports/missing-image-assets.md'), '# Original missing image assets\n\nThe pinned upstream snapshot already contains these 31 local image references, and none of their target files exists in that snapshot. They are pre-existing missing assets, not regressions introduced by content splitting. References remain unchanged. No placeholder or replacement content is substituted.\n\n' + images.map((image,index) => `${index+1}. Entry \`${image.id}\`: ${image.name}\n   - Original href: \`${image.href}\`\n   - Decoded path: \`${image.decodedPath}\``).join('\n\n') + '\n');
console.log(JSON.stringify({ ...fixture.counts, routes:routes.length, output:out },null,2));

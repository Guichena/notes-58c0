import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPlan, runComposite, runPit, runOcc, localTransport, assertCompleteSearch} from '../public/assets/examples/final-es-practice/run-cursors.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(resolve(root, p.startsWith('resources/') ? 'public/assets/examples/final-es-practice/' + p.slice(10) : 'tests/fixtures/final-es-practice/' + p), 'utf8');
const plan = await loadPlan(new URL('../public/assets/examples/final-es-practice/requests.json', import.meta.url));
const all = Object.values(plan.groups).flat(), byId = id => all.find(x => x.id === id);
const sha = s => createHash('sha256').update(s).digest('hex');
const decode = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function parseHttp(s) {
  const clean = s.split('\n').filter(l => !l.startsWith('#')).join('\n');
  const parts = clean.split(/^(GET|POST|PUT|DELETE|HEAD) (\/[^\n]*)\n/m), out = [];
  for (let i = 1; i < parts.length; i += 3) out.push({method: parts[i], path: parts[i + 1], body: parts[i + 2].trim()});
  return out;
}
function bodyOf(q) {
  if (!q.body) return null;
  if (q.path.includes('/_bulk')) return q.body.trim().split('\n').map(JSON.parse);
  return JSON.parse(q.body);
}
const search = hits => ({timed_out: false, _shards: {total: 1, successful: 1, failed: 0}, hits: {hits}});
const bucketResult = (buckets, after) => ({...search([]), aggregations: {all_tags: {buckets, ...(after === undefined ? {} : {after_key: after})}}});
const bucket = (tag, doc_count) => ({key: {tag}, doc_count});

// Decode the old Chinese path tables independently from the prepare.py source parser.
function tableObject(table) {
  let rootObject;
  for (const row of table.matchAll(/<tr><td>(.*?)<\/td><td>(.*?)<\/td><\/tr>/gs)) {
    const path = decode(row[1]).split(' / ').slice(1).map(k => /^第 \d+ 项$/.test(k) ? Number(k.match(/\d+/)[0]) - 1 : k);
    const raw = decode(row[2]);
    const value = raw === '对象' ? {} : raw.startsWith('数组，共 ') ? [] : raw.startsWith('数值：') ? Number(raw.slice(3)) : raw === '布尔值 true' ? true : raw === '布尔值 false' ? false : raw.startsWith('字符串：') ? raw.slice(4) : undefined;
    assert.notEqual(value, undefined, `Unknown old table value: ${raw}`);
    if (!path.length) { rootObject = value; continue; }
    let obj = rootObject;
    for (const part of path.slice(0, -1)) obj = obj[part];
    obj[path.at(-1)] = value;
  }
  return rootObject;
}
function oldRequests(html) {
  const out = [];
  for (const m of html.matchAll(/<p>请求步骤：方法 (GET|POST|PUT|DELETE|HEAD)；目标 (.*?)。<\/p>|(<table>.*?<\/table>)/gs)) {
    if (m[1]) out.push({method: m[1], path: decode(m[2]), tables: []});
    else out.at(-1).tables.push(tableObject(m[3]));
  }
  return out;
}

test('all 51 HTTP request payloads and every NDJSON line parse; no hidden dependency on cwd', () => {
  assert.equal(all.length, 51);
  assert.equal(new Set(all.map(x => x.id)).size, all.length);
  for (const [file, requests] of Object.entries(plan.groups)) {
    const rendered = parseHttp(read('resources/' + file));
    assert.equal(rendered.length, requests.length, file);
    rendered.forEach((q, i) => {
      assert.equal(q.method, requests[i].method); assert.equal(q.path, requests[i].path);
      assert.deepEqual(bodyOf(q), bodyOf(requests[i]), requests[i].id);
      assert.ok(requests[i].expect.startsWith('HTTP '));
    });
  }
  for (const [name, count] of [['filter-seed.ndjson', 16], ['visibility-mixed.ndjson', 4]]) {
    const body = read('resources/' + name);
    assert.ok(body.endsWith('\n') && !body.endsWith('\n\n'));
    const lines = body.slice(0, -1).split('\n'); assert.equal(lines.length, count);
    for (let i = 0; i < lines.length; i += 2) {
      const action = JSON.parse(lines[i]), source = JSON.parse(lines[i + 1]);
      assert.equal(Object.keys(action).length, 1); assert.ok(action.index || action.create);
      assert.equal(typeof source, 'object');
    }
  }
});

test('every original flattened request survives as equivalent HTTP, with declared token substitution only', () => {
  const old = oldRequests(read('before.html'));
  const originals = all.filter(x => x.origin);
  assert.equal(old.length, originals.length);
  for (const q of old) {
    const candidates = originals.filter(n => n.method === q.method && (n.path === q.path || (q.path.includes('if_seq_no=7&if_primary_term=2') && n.id === 'occ-write')));
    const payload = q.path.includes('/_bulk') ? q.tables : q.tables[0] ?? null;
    assert.ok(candidates.some(n => JSON.stringify(bodyOf(n)) === JSON.stringify(payload)), q.method + ' ' + q.path);
  }
  const canonical = q => JSON.stringify({method: q.method, path: q.path.replace('if_seq_no=7&if_primary_term=2', 'if_seq_no=REPLACE_WITH_SEQ_NO&if_primary_term=REPLACE_WITH_PRIMARY_TERM'), body: q.tables ? (q.path.includes('/_bulk') ? q.tables : q.tables[0] ?? null) : bodyOf(q)});
  assert.deepEqual(old.map(canonical).sort(), originals.map(canonical).sort(), 'The whole original request multiset must survive');
  const composite = old.find(q => q.tables.length === 2);
  assert.deepEqual(composite.tables[1], {size: 1, after: {tag: 'java'}, sources: [{tag: {terms: {field: 'tags', order: 'asc'}}}]});
  const continuation = bodyOf(byId('composite-next')).aggs.all_tags.composite;
  assert.equal(continuation.size, composite.tables[1].size);
  assert.deepEqual(continuation.sources, composite.tables[1].sources);
  assert.equal(continuation.after.tag, 'REPLACE_WITH_RETURNED_AFTER_KEY_TAG');
});

test('all old prose and section IDs preserved except exact documented corrections; no theory mutations', () => {
  const before = read('before.html'), after = read('after.html'), map = JSON.parse(read('preservation-map.json'));
  assert.deepEqual([...before.matchAll(/<h2[^>]+id="([^"]+)"/g)].map(m => m[1]), [...after.matchAll(/<h2[^>]+id="([^"]+)"/g)].map(m => m[1]));
  const prose = before.replace(/<table>.*?<\/table>|<p>请求步骤：.*?<\/p>/gs, '');
  for (const block of prose.match(/<h[23]\b.*?<\/h[23]>|<p\b.*?<\/p>|<ol\b.*?<\/ol>/gs) ?? []) {
    let corrected = block;
    for (const c of map.proseReplacements) corrected = corrected.replace(c.before, c.after);
    assert.ok(after.includes(corrected), `Lost original prose: ${corrected.slice(0, 100)}`);
  }
  const beforeEntry = JSON.parse(read('before-entry.json')), afterEntry = JSON.parse(read('after-entry.json'));
  delete beforeEntry.html; delete afterEntry.html; assert.deepEqual(afterEntry, beforeEntry);
  const records = JSON.parse(read('records.json')).records;
  assert.equal(records.length, 1); assert.equal(records[0].entryId, 'own-practice-es-write-visibility');
  assert.deepEqual(records[0].path, ['html']);
  assert.equal(sha(records[0].before), records[0].beforeSha256); assert.equal(sha(records[0].after), records[0].afterSha256);
  assert.equal(records[0].after, after);
  assert.ok(!after.includes('请求数据位置')); assert.equal((after.match(/<pre /g) ?? []).length, 6);
  assert.ok(!after.includes('if_seq_no=7&amp;if_primary_term=2'));
});

test('mapping settings, search-only synonym graph, independent fixture, and real boundary inputs', () => {
  const m = bodyOf(byId('mapping-create'));
  assert.equal(m.settings.number_of_shards, 1); assert.equal(m.settings.number_of_replicas, 0);
  assert.equal(m.settings['index.translog.durability'], 'request');
  assert.deepEqual(m.settings.analysis.analyzer.cjk_mixed.filter, ['cjk_width', 'lowercase', 'cjk_bigram']);
  assert.deepEqual(m.settings.analysis.analyzer.en_index.filter, ['lowercase']);
  assert.deepEqual(m.settings.analysis.analyzer.en_search.filter, ['lowercase', 'tech_synonyms']);
  assert.equal(m.settings.analysis.filter.tech_synonyms.type, 'synonym_graph');
  assert.equal(m.mappings.dynamic, 'strict'); assert.equal(m.mappings.properties.title.fields.raw.ignore_above, 256);
  assert.equal(bodyOf(byId('long-title')).title.length, 257);
  assert.ok(!('unexpected_field' in m.mappings.properties)); assert.ok('unexpected_field' in bodyOf(byId('strict-negative')));
  assert.equal(m.mappings.properties.metadata.enabled, false);
  const f = bodyOf(byId('filter-create'));
  assert.equal(f.mappings.dynamic, 'strict');
  for (const key of ['tenant_id', 'acl', 'generation', 'tags', 'doc_id']) assert.equal(f.mappings.properties[key].type, 'keyword');
  assert.equal(f.mappings.properties.body.analyzer, 'cjk_mixed');
  assert.ok(!('aliases' in f)); assert.ok(!all.some(q => q.path.includes('/_aliases')));
  assert.deepEqual(plan.groups['00-preflight.http'].slice(1).map(q => q.method), ['HEAD', 'HEAD', 'HEAD']);
});

test('static fixture qualification proves each negative independently; this is not an ES execution', () => {
  const fixtures = bodyOf(byId('filter-seed')).filter((_, i) => i % 2);
  const eligible = d => d.tenant_id === 'demo' && d.acl.includes('reader') && d.generation === 'r1' && d.deleted === false && d.created_at <= '2026-10-10T12:00:00Z';
  assert.deepEqual(fixtures.filter(eligible).map(x => x.doc_id), ['a', 'b', 'c']);
  const should = d => d.body.includes('缓存') || d.tags.includes('java');
  assert.deepEqual(fixtures.filter(d => eligible(d) && should(d)).map(x => x.doc_id), ['a', 'b']);
  const filter = bodyOf(byId('qualified-query')).query.bool.filter;
  assert.equal(filter.length, 5); assert.equal(bodyOf(byId('qualified-query')).query.bool.minimum_should_match, 1);
  for (const id of ['composite-first', 'composite-next', 'pit-first']) assert.deepEqual(bodyOf(byId(id)).query.bool.filter, filter);
  const counts = new Map();
  for (const d of fixtures.filter(eligible)) for (const tag of new Set(d.tags)) counts.set(tag, (counts.get(tag) || 0) + 1);
  assert.deepEqual([...counts].sort(), [['java', 2], ['python', 1], ['search', 1]]);
});

test('visibility order, external protocol, partial bulk and internal OCC are kept separate', () => {
  const qs = plan.groups['05-visibility.http'], index = id => qs.findIndex(x => x.id === id);
  assert.equal(bodyOf(byId('visibility-create')).settings.refresh_interval, '-1');
  assert.ok(index('search-before-refresh') < index('realtime-get'));
  assert.ok(index('manual-refresh') < index('search-after-refresh'));
  assert.ok(index('restore-refresh') < index('bulk-mixed'));
  assert.equal(bodyOf(byId('restore-refresh')).index.refresh_interval, '1s');
  for (const q of qs.slice(0, index('restore-refresh'))) assert.ok(!q.path.includes('refresh=wait_for'));
  const mixed = bodyOf(byId('bulk-mixed'));
  assert.equal(mixed[0].index.version_type, 'external'); assert.equal(mixed[1].version, 20);
  assert.equal(mixed[3].version, 'not-a-long');
  assert.ok(byId('occ-write').path.includes('if_seq_no=REPLACE_WITH_SEQ_NO&if_primary_term=REPLACE_WITH_PRIMARY_TERM'));
  assert.ok(!byId('occ-write').path.includes('version_type'));
  assert.equal(byId('stats').path, '/interview_visibility_v1/_stats/docs,segments,translog,refresh,flush,merge');
});

test('mock composite follows actual after_key even when unlike last bucket; preserves the query', async () => {
  const calls = [], responses = [bucketResult([bucket('java', 2)], {tag: 'actual-after-java'}), bucketResult([bucket('python', 1)], {tag: 'actual-after-python'}), bucketResult([bucket('search', 1)], {tag: 'actual-after-search'}), bucketResult([], undefined)];
  const result = await runComposite(async (method, path, body) => {calls.push({method, path, body}); return responses.shift();}, plan);
  assert.equal(result.length, 3);
  assert.deepEqual(calls[1].body.aggs.all_tags.composite.after, {tag: 'actual-after-java'});
  for (const c of calls) assert.deepEqual(c.body.query, calls[0].body.query);
  assert.equal(calls[1].path, '/interview_java_demo/_search?allow_partial_search_results=false');
});

test('mock composite stops on timeout, failures, repeated cursor; never declares partial results complete', async () => {
  await assert.rejects(runComposite(async () => ({...bucketResult([], undefined), timed_out: true}), plan), /Timed-out/);
  await assert.rejects(runComposite(async () => ({...bucketResult([], undefined), _shards: {total: 2, successful: 1, failed: 1}}), plan), /Failed/);
  await assert.rejects(runComposite(async () => bucketResult([bucket('java', 2)], {tag: 'same'}), plan), /Repeated/);
});

test('mock PIT extracts full true sort arrays and latest id; closes latest context', async () => {
  const calls = [], pages = [
    {...search([{_id: 'a', sort: ['a', 87]}]), pit_id: 'pit-new-a'},
    {...search([{_id: 'b', sort: ['b', 56]}]), pit_id: 'pit-new-b'},
    {...search([{_id: 'c', sort: ['c', 99]}]), pit_id: 'pit-new-c'},
    {...search([]), pit_id: 'pit-final'}
  ];
  const result = await runPit(async (method, path, body) => {
    calls.push({method, path, body});
    if (path.includes('/_pit?')) return {id: 'pit-opened'};
    if (method === 'DELETE') return {succeeded: true, num_freed: 1};
    return pages.shift();
  }, plan);
  assert.deepEqual(result, ['a', 'b', 'c']);
  assert.deepEqual(calls[2].body.search_after, ['a', 87]); assert.equal(calls[2].body.pit.id, 'pit-new-a');
  assert.deepEqual(calls.at(-1), {method: 'DELETE', path: '/_pit', body: {id: 'pit-final'}});
  const queries = calls.filter(c => c.path.includes('/_search'));
  for (const c of queries) {assert.equal(c.path, '/_search?allow_partial_search_results=false'); assert.deepEqual(c.body.query, queries[0].body.query); assert.deepEqual(c.body.sort, queries[0].body.sort);}
});

test('mock PIT closes latest context on timeout, malformed sort, duplicate hit and cleanup failure', async () => {
  for (const bad of [{...search([]), timed_out: true, pit_id: 'last-timeout'}, {...search([{_id: 'a', sort: ['a']}]), pit_id: 'last-bad-sort'}]) {
    let close;
    await assert.rejects(runPit(async (method, path, body) => {
      if (path.includes('/_pit?')) return {id: 'opened'};
      if (method === 'DELETE') {close = body.id; return {succeeded: true};}
      return bad;
    }, plan));
    assert.equal(close, bad.pit_id);
  }
  let closed = false;
  await assert.rejects(runPit(async (method, path) => {
    if (path.includes('/_pit?')) return {id: 'opened'};
    if (method === 'DELETE') {closed = true; throw Error('cleanup failed');}
    return {...search([{_id: 'a', sort: ['a', 1]}]), pit_id: 'latest'};
  }, plan), e => e instanceof AggregateError && e.errors.length === 2);
  assert.ok(closed);
});

test('mock OCC reads actual seq/term, replays stale condition and expects 409', async () => {
  const calls = [];
  const result = await runOcc(async (method, path, body, expectedStatus = 200) => {
    calls.push({method, path, body, expectedStatus});
    if (method === 'GET') return {found: true, _source: {version: 1}, _seq_no: 123, _primary_term: 9};
    return expectedStatus === 409 ? {error: {type: 'version_conflict_engine_exception'}} : {result: 'updated'};
  }, plan);
  assert.deepEqual(result, {updated: true, staleStatus: 409});
  assert.ok(calls[1].path.includes('if_seq_no=123&if_primary_term=9'));
  assert.equal(calls[1].path, calls[2].path); assert.equal(calls[2].expectedStatus, 409);
  await assert.rejects(runOcc(async () => ({found: true, _source: {version: 21}, _seq_no: 1, _primary_term: 1}), plan), /fresh teaching fixture/);
});

test('transport refuses remote/credentialed origins, redirects and unexpected statuses', async () => {
  for (const url of ['https://127.0.0.1:9200', 'http://example.com', 'http://u:p@127.0.0.1:9200', 'http://127.0.0.1:9200/private']) assert.throws(() => localTransport(url));
  let options;
  const request = localTransport('http://127.0.0.1:9200', async (url, opts) => {options = opts; assert.equal(url.origin, 'http://127.0.0.1:9200'); return {status: 409, text: async () => JSON.stringify({error: {type: 'version_conflict_engine_exception'}})};});
  await request('PUT', '/interview_visibility_v1/_doc/4?if_seq_no=3&if_primary_term=1', {version: 21}, 409);
  assert.equal(options.redirect, 'error'); assert.equal(options.headers['Content-Type'], 'application/json');
  await assert.rejects(request('GET', '//example.com/path'), /relative/);
  await assert.rejects(request('GET', '/\\example.com/path'), /escaped/);
  await assert.rejects(request('GET', '/'), /Unexpected HTTP status/);
  assert.throws(() => assertCompleteSearch({timed_out: false, _shards: {failed: 0}}), /shard total/);
});

test('every on-page download matches resource manifest hash and exact filename', () => {
  const resources = JSON.parse(read('resources.json')).resources;
  const after = read('after.html');
  for (const r of resources) {
    assert.equal(r.beforeSha256, null);
    assert.equal(sha(read(r.source)), r.afterSha256);
    assert.ok(after.includes(r.path.replace(/^public\//, '')));
  }
  const files = [...after.matchAll(/href="assets\/examples\/final-es-practice\/([^"]+)"/g)].map(m => m[1]);
  for (const file of files) assert.ok(existsSync(resolve(root, 'public/assets/examples/final-es-practice', file)));
});

// Check the final integrated leaf and deployed resources, not just evidence copies.
test('actual final dist contains the reviewed practice and exact deployed downloads', () => {
  let entry;
  for (const f of readdirSync(resolve(root, 'dist/data/chapters'))) {
    if (!f.endsWith('.json')) continue;
    const chapter = JSON.parse(readFileSync(resolve(root, 'dist/data/chapters', f), 'utf8'));
    const found = chapter.entries.find(e => e.id === 'own-practice-es-write-visibility');
    if (found) {assert.ok(!entry, 'Duplicate practice entry'); entry = found;}
  }
  assert.ok(entry); assert.equal(entry.html, read('after.html'));
  for (const resource of JSON.parse(read('resources.json')).resources) {
    const deployed = resolve(root, 'dist', resource.path.slice(7));
    assert.equal(sha(readFileSync(deployed, 'utf8')), resource.afterSha256);
  }
});

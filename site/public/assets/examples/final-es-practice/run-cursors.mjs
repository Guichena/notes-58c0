// Elasticsearch 8.15.3 isolated teaching fixture. No network activity on import.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export async function loadPlan(url = new URL('./requests.json', import.meta.url)) {
  return JSON.parse(await readFile(url, 'utf8'));
}
const find = (plan, id) => {
  const q = Object.values(plan.groups).flat().find(q => q.id === id);
  assert.ok(q, `Missing request ${id}`);
  return structuredClone(q);
};
export function assertCompleteSearch(r) {
  assert.equal(r.timed_out, false, 'Timed-out search is not a completed page');
  assert.equal(r._shards?.failed, 0, 'Failed/missing shard information');
  assert.ok(Number.isInteger(r._shards?.total) && r._shards.total > 0, 'Missing shard total');
  assert.ok(Number.isInteger(r._shards?.successful) && r._shards.successful > 0, 'No successful shard');
}
export async function runComposite(request, plan) {
  const q = find(plan, 'composite-first'), base = JSON.parse(q.body), seen = new Set(), buckets = [];
  let after;
  for (let page = 0; page < 20; page++) {
    const body = structuredClone(base);
    if (after !== undefined) body.aggs.all_tags.composite.after = structuredClone(after);
    const r = await request(q.method, q.path, body);
    assertCompleteSearch(r);
    const agg = r.aggregations?.all_tags;
    assert.ok(Array.isArray(agg?.buckets), 'Missing composite buckets');
    buckets.push(...agg.buckets);
    if (!agg.buckets.length || agg.after_key === undefined) {
      assert.deepEqual(buckets.map(x => [x.key.tag, x.doc_count]), [['java', 2], ['python', 1], ['search', 1]], 'Fixture totals differ');
      return buckets;
    }
    assert.ok(agg.after_key && typeof agg.after_key === 'object' && !Array.isArray(agg.after_key), 'Invalid after_key');
    const serialized = JSON.stringify(agg.after_key);
    assert.ok(!seen.has(serialized), 'Repeated composite cursor');
    seen.add(serialized);
    after = structuredClone(agg.after_key); // Never infer from the last bucket key.
  }
  throw Error('Fixture page budget exceeded; traversal incomplete');
}
export async function runPit(request, plan) {
  const open = find(plan, 'pit-open'), first = find(plan, 'pit-first'), base = JSON.parse(first.body);
  let pitId, failure, result;
  const ids = [], seenSorts = new Set();
  try {
    const opened = await request(open.method, open.path);
    assert.ok(typeof opened.id === 'string' && opened.id.length, 'Missing PIT id');
    pitId = opened.id;
    let searchAfter, ended = false;
    for (let page = 0; page < 20; page++) {
      const body = structuredClone(base);
      body.pit.id = pitId;
      if (searchAfter !== undefined) body.search_after = structuredClone(searchAfter);
      const r = await request(first.method, first.path, body);
      if (typeof r.pit_id === 'string' && r.pit_id.length) pitId = r.pit_id; // Latest ID also on a rejected page.
      assertCompleteSearch(r);
      assert.ok(Array.isArray(r.hits?.hits), 'Missing hits');
      if (!r.hits.hits.length) { ended = true; break; }
      for (const hit of r.hits.hits) {
        assert.ok(typeof hit._id === 'string' && !ids.includes(hit._id), 'Missing/duplicate document');
        ids.push(hit._id);
      }
      const sort = r.hits.hits.at(-1).sort;
      assert.ok(Array.isArray(sort) && sort.length === 2 && typeof sort[0] === 'string' && Number.isSafeInteger(sort[1]), 'Fixture requires complete [doc_id, shard_doc] sort');
      const key = JSON.stringify(sort);
      assert.ok(!seenSorts.has(key), 'Repeated PIT sort cursor');
      seenSorts.add(key);
      searchAfter = structuredClone(sort); // Advance only after validating and processing the entire page.
    }
    assert.ok(ended, 'Fixture page budget exceeded; traversal incomplete');
    assert.deepEqual(ids, ['a', 'b', 'c'], 'PIT fixture membership/order differs');
    result = ids;
  } catch (e) { failure = e; }
  if (pitId) {
    try {
      const closed = await request('DELETE', '/_pit', {id: pitId});
      assert.equal(closed.succeeded, true, 'PIT close did not succeed');
    } catch (cleanupError) {
      failure = failure ? new AggregateError([failure, cleanupError], 'Traversal and PIT cleanup failed') : cleanupError;
    }
  }
  if (failure) throw failure;
  return result;
}
export async function runOcc(request, plan) {
  const read = find(plan, 'occ-get');
  const r = await request(read.method, read.path);
  assert.equal(r.found, true, 'Initialize document 4 first');
  assert.equal(r._source?.version, 1, 'Use the fresh teaching fixture, not an already updated document');
  assert.ok(Number.isSafeInteger(r._seq_no) && r._seq_no >= 0, 'Invalid sequence number');
  assert.ok(Number.isSafeInteger(r._primary_term) && r._primary_term >= 1, 'Invalid primary term');
  const write = find(plan, 'occ-write');
  const path = write.path.replace('REPLACE_WITH_SEQ_NO', String(r._seq_no)).replace('REPLACE_WITH_PRIMARY_TERM', String(r._primary_term));
  const body = JSON.parse(write.body);
  const updated = await request(write.method, path, body);
  assert.equal(updated.result, 'updated');
  const stale = await request(write.method, path, body, 409);
  assert.equal(stale.error?.type, 'version_conflict_engine_exception');
  return {updated: true, staleStatus: 409};
}
export function localTransport(base, fetchImpl = fetch) {
  const url = new URL(base);
  assert.ok(url.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(url.hostname), 'Only loopback HTTP isolated fixtures are accepted');
  assert.ok(!url.username && !url.password && url.pathname === '/' && !url.search && !url.hash, 'Use a plain loopback origin, without credentials or path');
  return async (method, path, body, expectedStatus = 200) => {
    assert.ok(path.startsWith('/') && !path.startsWith('//') && !path.includes('://'), 'Expected relative ES path');
    const target = new URL(path, url);
    assert.equal(target.origin, url.origin, 'Relative path escaped the isolated origin');
    const r = await fetchImpl(target, {
      method, headers: body === undefined ? {} : {'Content-Type': 'application/json'},
      ...(body === undefined ? {} : {body: JSON.stringify(body)}),
      signal: AbortSignal.timeout(15000), redirect: 'error'
    });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { throw Error(`Non-JSON response: ${method} ${path} (HTTP ${r.status})`); }
    assert.equal(r.status, expectedStatus, `Unexpected HTTP status: ${method} ${path}; operation outcome may need inspection`);
    return data;
  };
}
export async function main(args = process.argv.slice(2)) {
  const [mode, base, confirmation] = args;
  if (!['composite', 'pit', 'occ'].includes(mode) || !base || confirmation !== '--isolated-test' || args.length !== 3) {
    console.log('Usage: node run-cursors.mjs <composite|pit|occ> http://127.0.0.1:9200 --isolated-test');
    console.log('First initialize the corresponding HTTP fixture. No implicit setup, login, deletion, or retries.');
    return;
  }
  const request = localTransport(base), plan = await loadPlan();
  const version = await request('GET', '/');
  assert.equal(version.version?.number, plan.targetVersion, 'This exercise is bound to Elasticsearch 8.15.3');
  const result = await ({composite: runComposite, pit: runPit, occ: runOcc}[mode])(request, plan);
  console.log(JSON.stringify({mode, actualLiveResult: result}, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error(e); process.exitCode = 1; });
}

import assert from 'node:assert/strict';

/** Limits active async calls; it does not create CPU-parallel JavaScript threads. */
export async function mapLimit(items, limit, run, externalSignal) {
  if (!Number.isInteger(limit) || limit <= 0) throw new RangeError('positive integer limit');
  const aborter = new AbortController();
  const propagate = () => aborter.abort(externalSignal.reason);
  if (externalSignal?.aborted) propagate();
  else externalSignal?.addEventListener('abort', propagate, { once: true });
  let next = 0;
  const results = new Array(items.length);
  let primary;
  let failed = false;
  async function worker() {
    while (!aborter.signal.aborted) {
      const index = next++; // No await between reserving the index and checking its bound.
      if (index >= items.length) return;
      try { results[index] = await run(items[index], index, aborter.signal); }
      catch (error) {
        if (!failed) { failed = true; primary = error; }
        aborter.abort(error);
        return;
      }
    }
  }
  try {
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    if (failed) throw primary;
    aborter.signal.throwIfAborted();
    return results;
  } finally { externalSignal?.removeEventListener('abort', propagate); }
}

/** Returns topological parallel batches; the chosen barrier may delay newly ready tasks. */
export function dependencyBatches(nodes) {
  const byId = new Map();
  for (const node of nodes) {
    if (typeof node.id !== 'string' || node.id.length === 0)
      throw new TypeError('task id must be a nonempty string');
    if (!Array.isArray(node.dependencies) || node.dependencies.some(dep => typeof dep !== 'string' || dep.length === 0))
      throw new TypeError('dependencies must be an array of nonempty strings');
    if (byId.has(node.id)) throw new Error('duplicate task id');
    byId.set(node.id, node);
  }
  const indegree = new Map(), outgoing = new Map(nodes.map(n => [n.id, []]));
  for (const node of nodes) {
    const deps = new Set(node.dependencies);
    if (deps.size !== node.dependencies.length) throw new Error('duplicate dependency');
    indegree.set(node.id, deps.size);
    for (const dep of deps) {
      if (!byId.has(dep)) throw new Error('missing dependency');
      outgoing.get(dep).push(node.id);
    }
  }
  let ready = nodes.filter(n => indegree.get(n.id) === 0).map(n => n.id);
  const batches = [];
  let visited = 0;
  while (ready.length) {
    const batch = ready;
    ready = [];
    batches.push(batch); visited += batch.length;
    for (const id of batch) for (const child of outgoing.get(id)) {
      indegree.set(child, indegree.get(child) - 1);
      if (indegree.get(child) === 0) ready.push(child);
    }
  }
  if (visited !== nodes.length) throw new Error('dependency cycle');
  return batches;
}

/** Execute each validated batch with the same explicit concurrency bound. */
export async function runDag(nodes, limit, signal) {
  const batches = dependencyBatches(nodes);
  const byId = new Map(nodes.map(node => [node.id, node]));
  const results = new Map();
  for (const batch of batches) {
    const values = await mapLimit(batch, limit, async (id, index, branchSignal) => {
      const node = byId.get(id);
      const inputs = Object.freeze(Object.fromEntries(node.dependencies.map(dep => [dep, results.get(dep)])));
      return node.run(inputs, branchSignal);
    }, signal);
    batch.forEach((id, index) => results.set(id, values[index]));
  }
  return results;
}

export class MapLru {
  #map = new Map();
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity < 0) throw new RangeError('nonnegative integer capacity');
    this.capacity = capacity;
  }
  get(key) {
    if (!this.#map.has(key)) return { found: false };
    const value = this.#map.get(key);
    this.#map.delete(key); this.#map.set(key, value);
    return { found: true, value }; // Stored undefined is distinguishable from a miss.
  }
  put(key, value) {
    if (!this.capacity) return;
    this.#map.delete(key); this.#map.set(key, value);
    if (this.#map.size > this.capacity) this.#map.delete(this.#map.keys().next().value);
  }
}

let active = 0, peak = 0;
const values = await mapLimit(Array.from({ length: 100 }, (_, i) => i), 5,
  async (value, index, signal) => {
    signal.throwIfAborted(); active++; peak = Math.max(peak, active);
    try { await new Promise(resolve => setImmediate(resolve)); return value * 2; }
    finally { active--; }
  });
assert.equal(peak, 5); assert.equal(active, 0);
assert.deepEqual(values, Array.from({ length: 100 }, (_, i) => i * 2));
const failure = new Error('controlled');
await assert.rejects(mapLimit([1, 2, 3], 2, async value => {
  if (value === 1) throw failure;
  await new Promise(resolve => setImmediate(resolve));
  return value;
}), error => error === failure);
const cancelled = new AbortController(); cancelled.abort(new Error('cancelled'));
let calls = 0;
await assert.rejects(mapLimit([1], 1, async () => { calls++; }, cancelled.signal), /cancelled/);
assert.equal(calls, 0);
assert.deepEqual(dependencyBatches([
  { id: 'a', dependencies: [] }, { id: 'b', dependencies: [] },
  { id: 'c', dependencies: ['a', 'b'] }, { id: 'd', dependencies: ['c'] }
]), [['a', 'b'], ['c'], ['d']]);
assert.throws(() => dependencyBatches([{ id: 'a', dependencies: ['a'] }]), /cycle/);
assert.throws(() => dependencyBatches([{ id: 'a', dependencies: ['missing'] }]), /missing/);
assert.throws(() => dependencyBatches([{ id: 1, dependencies: [] }, { id: '1', dependencies: [] }]), /nonempty string/);
assert.throws(() => dependencyBatches([{ id: '', dependencies: [] }]), /nonempty string/);
assert.throws(() => dependencyBatches([{ id: 'a', dependencies: [1] }]), /nonempty strings/);
assert.throws(() => dependencyBatches([{ id: 'a', dependencies: 'b' }]), /array/);
const lru = new MapLru(2);
lru.put('a', undefined); lru.put('b', 0);
assert.deepEqual(lru.get('a'), { found: true, value: undefined });
lru.put('c', false);
assert.deepEqual(lru.get('b'), { found: false });
assert.deepEqual(lru.get('c'), { found: true, value: false });

const dag = await runDag([
  { id: 'a', dependencies: [], run: async () => 2 },
  { id: 'b', dependencies: [], run: async () => 3 },
  { id: 'c', dependencies: ['a', 'b'], run: async inputs => inputs.a + inputs.b }
], 2);
assert.equal(dag.get('c'), 5);
console.log('native_js OK');

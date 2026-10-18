import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const expected=JSON.parse(fs.readFileSync(new URL('./fixtures/serving-cache/expected.json',import.meta.url),'utf8'));
const catalog=JSON.parse(fs.readFileSync(new URL('../dist/data/catalog.json',import.meta.url),'utf8'));
const all=new Map();for(const file of new Set(catalog.entries.map(e=>e._chunk))){for(const e of JSON.parse(fs.readFileSync(new URL('../dist/'+file,import.meta.url),'utf8')).entries)all.set(e.id,e);}
const e=all.get(expected.entryId);
test('final Serving cache leaves, identities, alternatives and routes are exact',()=>{
 assert.deepEqual(e.items.map((item,index)=>({index,...Object.fromEntries(Object.entries(item).filter(([k])=>!['a','lead'].includes(k)))})),expected.identity);
 for(const r of expected.records){let v=e;for(const k of r.path)v=v[k];assert.equal(sha(v),r.afterSha256);for(const m of v.matchAll(/href="(#\/e\/[^" ]+)"/g)){const[id,q]=decodeURIComponent(m[1].slice(4)).split('/');const target=all.get(id);assert.ok(target,m[1]);if(q!==undefined)assert.ok((/^\d+$/.test(q)&&Number(q)<(target.items||[]).length)||(target.items||[]).some(x=>x.id===q),m[1]);}}
 assert.equal(sha(e.items[5].a),expected.protectedItem5.bodySha256);assert.equal(sha(e.items[5].lead),expected.protectedItem5.leadSha256);
 assert.ok(e.items[1].a.includes('其他问法（30）'));assert.ok(e.items[2].a.includes('其他问法（12）'));
});
let rngState = 20261017 >>> 0;
const random = () => { rngState = (Math.imul(1664525, rngState) + 1013904223) >>> 0; return rngState / 4294967296; };
function reference(scores, values) {
  const valid = scores.map((s, i) => i).filter(i => scores[i] !== -Infinity);
  if (!valid.length) return values[0].map(() => 0);
  const m = Math.max(...valid.map(i => scores[i]));
  const weights = valid.map(i => Math.exp(scores[i] - m));
  const den = weights.reduce((a, b) => a + b, 0);
  return values[0].map((_, d) => valid.reduce((acc, i, n) => acc + weights[n] * values[i][d], 0) / den);
}
function online(scores, values, blockSize) {
  let m = -Infinity, l = 0, acc = values[0].map(() => 0);
  for (let start = 0; start < scores.length; start += blockSize) {
    const indices = [];
    for (let i = start; i < Math.min(start + blockSize, scores.length); i++) {
      if (scores[i] !== -Infinity) indices.push(i);
    }
    if (!indices.length) continue;
    const nextM = Math.max(m, ...indices.map(i => scores[i]));
    const alpha = l ? Math.exp(m - nextM) : 0;
    const weights = indices.map(i => Math.exp(scores[i] - nextM));
    l = alpha * l + weights.reduce((a, b) => a + b, 0);
    acc = acc.map((a, d) => alpha * a + indices.reduce((sum, i, n) => sum + weights[n] * values[i][d], 0));
    m = nextM;
  }
  return l ? acc.map(a => a / l) : acc.map(() => 0);
}
test('cpu-online-softmax-versus-full-normalization', () => {
  let cases = 0, maxAbsError = 0;
  for (const n of [1, 2, 7, 8, 9, 31, 64])
    for (const block of [1, 3, 8, 16, 128])
      for (const scale of [1, 1000])
        for (const mask of ['full', 'masked', 'all-masked']) {
          let scores = Array.from({ length: n }, () => (random() * 4 - 2) * scale);
          if (mask === 'masked') scores = scores.map((s, i) => i % 3 ? s : -Infinity);
          if (mask === 'all-masked') scores.fill(-Infinity);
          const values = Array.from({ length: n }, () => Array.from({ length: 5 }, () => random() * 6 - 3));
          const a = reference(scores, values), b = online(scores, values, block);
          const error = Math.max(...a.map((v, i) => Math.abs(v - b[i])));
          maxAbsError = Math.max(maxAbsError, error);
          assert.ok(error < 5e-12, `${n}/${block}/${mask}: ${error}`);
          cases++;
        }
  assert.equal(cases, 210);
  return { cases, maxAbsError, tolerance: 5e-12,
    allMaskedContract: 'Toy implementation explicitly returns zero; production kernel behavior must be checked.' };
});
test('cpu-noncontiguous-page-addressing-and-tail-bound', () => {
  let cases = 0;
  for (const n of [1, 2, 7, 8, 9, 31, 64, 513]) for (const block of [1, 3, 8, 16, 128]) {
    const pageCount = Math.ceil(n / block);
    const table = Array.from({ length: pageCount }, (_, i) => i);
    for (let i = table.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1)); [table[i], table[j]] = [table[j], table[i]];
    }
    const physical = Array.from({ length: pageCount }, () => Array(block).fill(null));
    for (let t = 0; t < n; t++) physical[table[Math.floor(t / block)]][t % block] = t;
    const recovered = Array.from({ length: n }, (_, t) => physical[table[Math.floor(t / block)]][t % block]);
    assert.deepEqual(recovered, Array.from({ length: n }, (_, t) => t));
    const tail = pageCount * block - n; assert.ok(tail >= 0 && tail < block);
    cases++;
  }
  return { cases, scope: 'Addressing and one-sequence tail bound; no allocator or global memory claim.' };
});
test('cpu-ring-absolute-position-tags', () => {
  let states = 0;
  for (const window of [1, 2, 3, 8, 17]) {
    const ring = Array(window).fill(null);
    for (let t = 0; t < window * 4 + 3; t++) {
      ring[t % window] = { position: t, value: `v${t}` };
      const start = Math.max(0, t - window + 1);
      const expected = Array.from({ length: t - start + 1 }, (_, i) => ({ position: i + start, value: `v${i + start}` }));
      const recovered = expected.map(item => ring[item.position % window]);
      assert.deepEqual(recovered, expected); states++;
    }
  }
  return { states, scope: 'Visible-window ordering across wraps; no global/sink attention equivalence claim.' };
});
test('capacity-units-and-physical-sharing', () => {
  const a = 2 * 32 * 32 * 128 * 4096 * 2, b = 2 * 80 * 8 * 128 * 4096 * 2;
  assert.equal(a, 2147483648); assert.equal(b, 1342177280);
  assert.equal(a / 2 ** 30, 2); assert.equal(b / 2 ** 30, 1.25);
  assert.equal(7_000_000_000 * 2, 14_000_000_000);
  const references = [[1, 2, 3], [1, 2, 4], [1, 2, 5]];
  assert.equal(new Set(references.flat()).size, 5);
  return { kvBytes: [a, b], kvGiB: [2, 1.25], weightDecimalGB: 14,
    logicalBlockReferences: 9, uniquePhysicalBlocks: 5 };
});


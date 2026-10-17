// ES module top-level execution is already part of asynchronous module work.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const top = ['sync'];
process.nextTick(() => top.push('nextTick'));
Promise.resolve().then(() => top.push('promise'));
queueMicrotask(() => top.push('microtask'));
top.push('end');
fs.readFile(new URL(import.meta.url), err => {
  if (err) throw err;
  assert.deepEqual(top, ['sync', 'end', 'promise', 'microtask', 'nextTick']);
  const io = ['io'];
  process.nextTick(() => io.push('nextTick'));
  Promise.resolve().then(() => io.push('promise'));
  queueMicrotask(() => io.push('microtask'));
  setImmediate(() => io.push('immediate'));
  setTimeout(() => {
    io.push('timer');
    assert.deepEqual(io, ['io', 'nextTick', 'promise', 'microtask', 'immediate', 'timer']);
    console.log(JSON.stringify({mode:'ESM', top, io}));
  }, 0);
});


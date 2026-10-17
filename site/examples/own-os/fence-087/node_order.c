// CommonJS teaching fixture; actual I/O callback ordering is separately checked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const top = ['sync'];
process.nextTick(() => top.push('nextTick'));
Promise.resolve().then(() => top.push('promise'));
queueMicrotask(() => top.push('microtask'));
top.push('end');
fs.readFile(__filename, err => {
  if (err) throw err;
  assert.deepEqual(top, ['sync', 'end', 'nextTick', 'promise', 'microtask']);
  const io = ['io'];
  process.nextTick(() => io.push('nextTick'));
  Promise.resolve().then(() => io.push('promise'));
  queueMicrotask(() => io.push('microtask'));
  setImmediate(() => io.push('immediate'));
  setTimeout(() => {
    io.push('timer');
    assert.deepEqual(io, ['io', 'nextTick', 'promise', 'microtask', 'immediate', 'timer']);
    console.log(JSON.stringify({mode:'CJS', top, io}));
  }, 0);
});


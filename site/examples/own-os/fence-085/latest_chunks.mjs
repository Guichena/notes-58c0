// Host-neutral protocol core usable inside a Web Worker or a Node worker.
// schedule must asynchronously run fn in a future TASK, not a microtask.
export function createLatestJob(post, schedule = fn => setTimeout(fn, 0), chunk = 256) {
  if (typeof post !== 'function' || typeof schedule !== 'function' ||
      !Number.isSafeInteger(chunk) || chunk < 1) throw new TypeError('invalid configuration');
  let current = 0, disposed = false, active = false;
  function submit(message) {
    if (disposed) return false;
    if (!message || !Number.isSafeInteger(message.id) || message.id <= current)
      throw new TypeError('strictly increasing safe integer id required');
    // Bounded sample workload: sum squares of integers from 0 through n-1.
    if (!Number.isSafeInteger(message.n) || message.n < 0 || message.n > 100000)
      throw new RangeError('n 0..100000');
    current = message.id; active = true;
    const id = current, n = message.n;
    let index = 0, sum = 0;
    function step() {
      if (disposed || !active || id !== current) return;
      const end = Math.min(n, index + chunk);
      for (; index < end; index++) sum += index * index;
      if (index === n) { active = false; post({id, sum}); }
      else schedule(step);
    }
    schedule(step); return true;
  }
  return {
    submit,
    cancel(id) { if (disposed || !active || id !== current) return false; active = false; return true; },
    dispose() { disposed = true; }
  };
}


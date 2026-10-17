// A single authenticated-session store. Text messages only, no offline send queue.
// Contract: subscribers may stop/start synchronously but must not throw.
// Injected makeSocket/schedule/cancel must not synchronously re-enter the store;
// schedule must return a handle before invoking its callback asynchronously.
// Socket construction failures retry; subscriber/scheduler/cancel exceptions are not isolated.
export function createSocketStore(url, options = {}) {
  const {
    makeSocket = u => new WebSocket(u),
    schedule = (f, ms) => setTimeout(f, ms),
    cancel = id => clearTimeout(id),
    random = Math.random,
    maxRetries = 7,
    maxBytes = 65536,
    highWaterBytes = 262144,
  } = options;
  let running = false, socket = null, timer = null, epoch = 0, attempts = 0;
  const listeners = new Set();
  const initial = Object.freeze({ status: 'idle', message: null });
  let state = initial;
  const bytes = text => new TextEncoder().encode(text).byteLength;
  const emit = patch => {
    state = Object.freeze({ ...state, ...patch });
    for (const listener of [...listeners]) listener();
  };
  const alive = (ws, generation) => running && socket === ws && epoch === generation;
  function retry() {
    if (!running || timer !== null) return;
    if (attempts >= maxRetries) { emit({ status: 'failed' }); return; }
    const delay = Math.floor(Math.min(30000, 500 * 2 ** attempts++) * (0.5 + random() * 0.5));
    const generation = epoch;
    emit({ status: 'retrying' });
    if (!running || epoch !== generation) return;
    timer = schedule(() => {
      if (!running || epoch !== generation) return;
      timer = null; connect();
    }, delay);
  }
  function connect() {
    const generation = ++epoch;
    let ws;
    emit({ status: 'connecting' });
    if (!running || epoch !== generation) return;
    try { ws = makeSocket(url); socket = ws; }
    catch { socket = null; retry(); return; }
    ws.onopen = () => {
      if (!alive(ws, generation)) return;
      attempts = 0; emit({ status: 'open' });
    };
    ws.onmessage = event => {
      if (!alive(ws, generation)) return;
      if (typeof event.data !== 'string' || bytes(event.data) > maxBytes) {
        running = false; ++epoch; socket = null;
        emit({ status: 'protocol-error' }); ws.close(4009, 'invalid message size/type'); return;
      }
      emit({ message: event.data });
    };
    ws.onerror = () => { /* Browser close event determines reconnect policy. */ };
    ws.onclose = event => {
      if (!alive(ws, generation)) return;
      socket = null;
      if ([1000, 1008, 4401, 4403].includes(event.code)) {
        running = false; emit({ status: 'closed' }); return;
      }
      retry();
    };
  }
  return {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => state,
    getServerSnapshot: () => initial,
    start() { if (running) return; running = true; attempts = 0; connect(); },
    stop() {
      running = false; ++epoch;
      if (timer !== null) { cancel(timer); timer = null; }
      const old = socket; socket = null;
      emit({ status: 'closed', message: null });
      if (old) old.close(1000, 'provider stopped');
    },
    send(text) {
      if (typeof text !== 'string' || bytes(text) > maxBytes) throw new Error('invalid outbound text');
      if (!socket || socket.readyState !== 1) throw new Error('not connected');
      if (socket.bufferedAmount + bytes(text) > highWaterBytes) throw new Error('backpressure');
      socket.send(text); // Successful enqueue is not a business acknowledgement.
    },
  };
}

/** Native JS teaching code: finite input; no server, database, Worker or remote side effect. */
export async function mapLimit(items, limit, work, {signal} = {}) {
  if (!Array.isArray(items) || items.length > 10000 || !Number.isInteger(limit) || limit < 1 || limit > 256)
    throw new TypeError('bounded items and positive concurrency required');
  const controller = new AbortController();
  let next = 0, firstFailure, failed = false;
  const result = new Array(items.length);
  function stop(reason) {
    if (!failed) { failed = true; firstFailure = reason; }
    controller.abort(firstFailure);
  }
  const externalAbort = () => stop(signal.reason ?? new Error('cancelled'));
  if (signal?.aborted) externalAbort();
  else signal?.addEventListener('abort', externalAbort, {once:true});
  async function one(item, index) {
    if (controller.signal.aborted) throw controller.signal.reason;
    let onAbort;
    const cancelled = new Promise((_, reject) => {
      onAbort = () => reject(controller.signal.reason);
      controller.signal.addEventListener('abort', onAbort, {once:true});
    });
    try {
      // Attach rejection handlers immediately. Abort stops waiting, not arbitrary external effects.
      return await Promise.race([Promise.resolve().then(() => {
        if (controller.signal.aborted) throw controller.signal.reason;
        return work(item, index, controller.signal);
      }), cancelled]);
    } finally { controller.signal.removeEventListener('abort', onAbort); }
  }
  async function runner() {
    while (!failed) {
      const index = next++;
      if (index >= items.length) return;
      try { result[index] = await one(items[index], index); }
      catch (error) { stop(error);return; }
    }
  }
  try {
    await Promise.all(Array.from({length:Math.min(limit,items.length)}, runner));
    if (failed) throw firstFailure;
    return result;
  } finally { signal?.removeEventListener('abort', externalAbort); }
}

/** Topological layers: edges mean prerequisites, never just display position. */
export function dependencyBatches(nodes) {
  if (!Array.isArray(nodes) || nodes.length > 10000) throw new TypeError('bounded nodes required');
  const byId = new Map(), indegree = new Map(), children = new Map();
  for (const node of nodes) {
    if (!node || typeof node.id !== 'string' || !node.id || byId.has(node.id) || !Array.isArray(node.deps))
      throw new TypeError('unique task IDs and dependency arrays required');
    byId.set(node.id,node);children.set(node.id,[]);
  }
  let edges=0;
  for (const node of nodes) {
    const unique=new Set(node.deps);
    if (unique.size!==node.deps.length) throw new TypeError('duplicate dependency');
    indegree.set(node.id,unique.size);
    for (const dep of unique) {
      if (!byId.has(dep) || dep===node.id || ++edges > 50000) throw new TypeError('invalid/big dependency graph');
      children.get(dep).push(node.id);
    }
  }
  let ready=nodes.filter(n=>indegree.get(n.id)===0).map(n=>n.id), visited=0;
  const batches=[];
  while (ready.length) {
    batches.push(ready);visited+=ready.length;
    const next=[];
    for(const id of ready) for(const child of children.get(id)) {
      indegree.set(child,indegree.get(child)-1);
      if(indegree.get(child)===0) next.push(child);
    }
    ready=next;
  }
  if(visited!==nodes.length)throw new Error('dependency cycle');
  return batches;
}
export async function runDag(nodes, limit, work, options={}) {
  const batches=dependencyBatches(nodes); // Validate all dependencies before any action.
  const byId=new Map(nodes.map(n=>[n.id,n])), result=new Map();
  for(const batch of batches) {
    const values=await mapLimit(batch,limit,(id,_,signal)=>{
      const node=byId.get(id);
      const inputs=new Map(node.deps.map(dep=>[dep,result.get(dep)]));
      return work(node,inputs,signal);
    },options);
    batch.forEach((id,i)=>result.set(id,values[i]));
  }
  return result;
}
export class LatestResult {
  #generation=0; #controller; value;
  begin() {
    if(this.#generation>=Number.MAX_SAFE_INTEGER)throw new Error('generation exhausted');
    this.#controller?.abort(new Error('superseded'));
    this.#controller=new AbortController();
    return {generation:++this.#generation,signal:this.#controller.signal};
  }
  complete(ticket,value) {
    if(ticket.generation!==this.#generation||ticket.signal!==this.#controller.signal||ticket.signal.aborted)return false;
    this.value=value;return true;
  }
}
export async function cooperativeSum(values, signal, chunk=1024) {
  if(!Array.isArray(values)||values.length>100000||!Number.isInteger(chunk)||chunk<1)throw new TypeError('bounded input');
  let total=0;
  for(let i=0;i<values.length;i++) {
    if(signal.aborted)throw signal.reason;
    if(typeof values[i]!=='number'||!Number.isFinite(values[i]))throw new TypeError('finite number');
    total+=values[i];
    if(!Number.isFinite(total))throw new RangeError('overflow');
    if((i+1)%chunk===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
  if(signal.aborted)throw signal.reason;
  return total;
}

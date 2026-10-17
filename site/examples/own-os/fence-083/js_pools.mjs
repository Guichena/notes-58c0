import {Worker, isMainThread, parentPort, workerData} from 'node:worker_threads';
// Promise pool: controls task invocation, does not create CPU threads.
// Accepted task functions must eventually settle. No timeout can force JS functions
// to stop. Results are per-task fulfilled/rejected, in input order.
export async function promisePool(tasks, limit=5) {
  if (!Array.isArray(tasks)) throw new TypeError('bounds');
  const length=tasks.length; // Capture once; do not invoke a caller-defined iterator.
  if (!Number.isInteger(length) || length<0 || length>1000) throw new TypeError('bounds');
  const work=new Array(length);
  // Indexed getters must finish; a slot bound cannot preempt arbitrary user code.
  for (let i=0;i<length;i++) work[i]=tasks[i];
  if (work.some(t=>typeof t!=='function') ||
      !Number.isInteger(limit) || limit<1 || limit>32) throw new TypeError('bounds');
  const result=new Array(work.length); let next=0;
  async function consume() {
    for (;;) {
      const i=next++; if (i>=work.length) return;
      try { result[i]={status:'fulfilled',value:await work[i]()}; }
      catch (reason) { result[i]={status:'rejected',reason}; }
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,work.length)},consume));
  return result;
}
// Actual Node worker-thread pool, not OS-process pool. Fixed square workload;
// -1 throws; -2 deliberately omits its response for a timeout test.
if (!isMainThread && workerData==='bounded-square-worker') {
  parentPort.on('message', ({id,n}) => {
    if (n===-1) throw new Error('intentional task failure');
    if (n===-2) return;
    parentPort.postMessage({id,value:n*n});
  });
}
export async function workerPool(numbers, limit=5, deadlineMs=2000) {
  if (!isMainThread || !Array.isArray(numbers)) throw new TypeError('bounds');
  const length=numbers.length;
  if (!Number.isInteger(length) || length<0 || length>100) throw new TypeError('bounds');
  const work=new Array(length);
  for (let i=0;i<length;i++) work[i]=numbers[i];
  if (work.some(n=>!Number.isInteger(n)||n< -2||n>10000) ||
      !Number.isInteger(limit)||limit<1||limit>5 ||
      !Number.isInteger(deadlineMs)||deadlineMs<1||deadlineMs>10000) throw new TypeError('bounds');
  if (!work.length) return [];
  const workers=[]; let finish=false, next=0, done=0, timer;
  try {
    return await new Promise((resolve,reject) => {
      const values=new Array(work.length);
      function fail(error) { if (!finish) {finish=true;reject(error);} }
      timer=setTimeout(()=>fail(new Error('batch deadline exceeded')),deadlineMs);
      try {
        for (let k=0;k<Math.min(limit,work.length);k++) {
          const w=new Worker(new URL(import.meta.url),{workerData:'bounded-square-worker'});
          workers.push(w); let inFlight=-1;
          function send() {
            if (finish || next>=work.length) return;
            inFlight=next++; w.postMessage({id:inFlight,n:work[inFlight]});
          }
          w.on('message', msg => {
            if (finish) return;
            if (inFlight<0 || !msg || msg.id!==inFlight || !Number.isInteger(msg.value)) {
              fail(new Error('worker protocol violation')); return;
            }
            values[inFlight]=msg.value; inFlight=-1; done++;
            if (done===work.length) {finish=true;resolve(values);} else send();
          });
          w.on('error',fail);
          w.on('exit', code=>{if(!finish)fail(new Error('worker exited: '+code));});
          send();
        }
      } catch(error) {fail(error);}
    });
  } finally {
    finish=true; clearTimeout(timer);
    await Promise.all(workers.map(w=>w.terminate()));
  }
}


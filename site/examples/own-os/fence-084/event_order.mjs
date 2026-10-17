// Teaching example of synchronous work, microtasks, and a timer.
export function orderExample() {
  const log=[];
  return new Promise(resolve=>{
    log.push('sync');
    setTimeout(()=>{log.push('timer');resolve(log);},0);
    Promise.resolve().then(()=>{
      log.push('promise');queueMicrotask(()=>log.push('nested'));
    });
    queueMicrotask(()=>log.push('microtask'));
    log.push('end');
  });
}


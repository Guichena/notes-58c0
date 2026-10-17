// Node24 adapter for exercising actual worker-thread execution.
// Browser adaptation: post = result => self.postMessage(result),
// and self.onmessage = event => core.submit(event.data).
import {parentPort} from 'node:worker_threads';
import {createLatestJob} from './latest_chunks.mjs';
if (!parentPort) throw new Error('worker-only entry');
const core = createLatestJob(result => parentPort.postMessage(result));
parentPort.on('message', message => {
  try {
    if (message?.type === 'cancel') core.cancel(message.id);
    else core.submit(message);
  } catch (e) {
    parentPort.postMessage({id: message?.id, error: e.message});
  }
});
parentPort.postMessage({ready: true});


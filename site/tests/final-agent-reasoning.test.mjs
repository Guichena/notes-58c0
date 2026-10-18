import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {verifyFinal} from './helpers/agent-reasoning-verifier.mjs';
test('agent reasoning semantic consolidation exists in actual final built dist',async()=>{
 await verifyFinal({dist:fileURLToPath(new URL('../dist/',import.meta.url)),fixtures:fileURLToPath(new URL('./fixtures/agent-reasoning/',import.meta.url))});
});

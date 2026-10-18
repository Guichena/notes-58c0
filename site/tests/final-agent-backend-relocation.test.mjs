import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {verifyFinal} from './fixtures/interruption-observation/backend-verifier.mjs';
test('Agent backend intrusions are relocated in actual final dist, and its existing Java queue passes contracts',async()=>{
 await verifyFinal({dist:fileURLToPath(new URL('../dist/',import.meta.url)),fixtures:fileURLToPath(new URL('./fixtures/agent-backend-relocation/',import.meta.url))});
});

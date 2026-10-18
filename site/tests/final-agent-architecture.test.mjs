import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {verifyFinal} from './helpers/agent-architecture-verifier.mjs';
test('agent architecture and persistent recovery are consolidated in actual final dist',async()=>{
 await verifyFinal({dist:fileURLToPath(new URL('../dist/',import.meta.url)),fixtures:fileURLToPath(new URL('./fixtures/agent-architecture/',import.meta.url))});
});

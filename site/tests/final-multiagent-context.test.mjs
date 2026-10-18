import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {verifyFinal} from './fixtures/ninth-small-repairs/bridged/tests/fixtures/multiagent-context/verify-final.mjs';
test('actual final dist preserves role/context consolidation and every source destination',async()=>{
 for(const [file,h]of Object.entries({"dependency-proof.json": "a2cf2b9aaf0a47904a2cdc5c83b47db52cd5581ae7b1bb673f71e22eafcc7e57", "original-code-transition-proof.json": "52e92b75cbbbe80d569dcb911c8d210c9a2ea33027af6f180eb3437d9adc5e88", "verify-dependencies.mjs": "212b2db13fc27f8c8ac8eb3df202ea73b7f211557472192e23162b9650f2d1ef"}))assert.equal(createHash('sha256').update(fs.readFileSync(new URL('./fixtures/seventh-reconciliation/'+file,import.meta.url))).digest('hex'),h,'reviewed seventh dependency code/proof changed');
 await verifyFinal({dist:fileURLToPath(new URL('../dist/',import.meta.url)),fixtures:fileURLToPath(new URL('./fixtures/multiagent-context/',import.meta.url))});
});

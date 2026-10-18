import {ninthExecutablePath,ninthExecutionHash} from './fixtures/ninth-small-repairs/verify-reference.mjs';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('Agent dependency scheduling preserves all claims and routes repository, DSL and graph variants to their full answers',()=>{
 execFileSync(process.execPath,[ninthExecutablePath(fileURLToPath(new URL('./fixtures/agent-dag-dispatch/verify-final.mjs',import.meta.url))),'--dist',fileURLToPath(new URL('../dist/',import.meta.url))],{stdio:'pipe'});
});

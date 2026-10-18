import {ninthExecutablePath,ninthExecutionHash} from './fixtures/ninth-small-repairs/verify-reference.mjs';
import test from 'node:test';import {execFileSync} from 'node:child_process';import{fileURLToPath}from'node:url';
test('Agent interview summaries preserve state and selection boundaries in actual final dist',()=>{execFileSync(process.execPath,[ninthExecutablePath(fileURLToPath(new URL('./fixtures/agent-clarity/verify-final.mjs',import.meta.url))),'--dist',fileURLToPath(new URL('../dist/',import.meta.url))],{stdio:'pipe'});});

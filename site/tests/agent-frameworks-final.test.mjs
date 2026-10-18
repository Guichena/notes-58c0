import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {verify,names} from './fixtures/ninth-small-repairs/bridged/tests/fixtures/agent-frameworks/verify-final-dist.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));const result=verify(process.env.SITE_DIST?path.resolve(process.env.SITE_DIST):path.resolve(root,'../dist'));
for(const name of names)test('agent frameworks: '+name,()=>{const c=result.checks.find(c=>c.name===name);assert.ok(c?.passed,c?.error??'missing check');});

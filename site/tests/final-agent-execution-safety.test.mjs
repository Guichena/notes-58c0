import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const here=path.dirname(fileURLToPath(import.meta.url));
test('final dist preserves agent execution safety and unchanged local experiment',()=>{
 const r=spawnSync('python3',[path.join(here,'verify-final-agent-execution-safety.py'),'--dist',path.resolve(here,'../dist'),'--fixtures',path.join(here,'fixtures/agent-execution-safety.json')],{encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
 assert.equal(r.status,0,[r.stdout,r.stderr,String(r.error||'')].join('\n'));
});

import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';
const site=fileURLToPath(new URL('../',import.meta.url)),dist=path.join(site,'dist'),fixtures=path.join(site,'tests/fixtures/parallel-quantization');
const pins={
  "verify-final-dist.mjs": "b1a24cf8b193ef9be6f3aec757529c7d139ba60f4b44b23715bb1c471325517d",
  "records.json": "2b16cfa0f2407cb4e6680eeb952427ce5568654e2fde445dd933758ef619a096",
  "append-manifest.json": "069ebaf0c245666c8eb8b106e32a747fca539b5e4e2349f2090c4f835ce08c97",
  "identity-baseline.json": "3596927b70b4f54efc642d50c022a752fed76d8e6373a11dc1ccf8438fc713f7",
  "preservation-map.json": "50fe2f441bddf4ef5ada01e5218c3afd8724b5ea08f6c009181f5da7e6f4453e",
  "variant-map.json": "4147e8b97e50f07eb6eec89ec60ca36d059a1ce838bc5902af950ce9d46faae7",
  "sections.json": "ef989b7326118300d63f254b3ff62e42f91c78d471b9320e869eb89964041a3f",
  "archive-extension-proposal.json": "cdfb8181872b32f12b8657ce9884a7b0f053999ed5c5119754b7c714111ddf4a"
};
test('actual final dist satisfies parallel and quantization reconciliation',async t=>{for(const [n,h] of Object.entries(pins))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(fixtures,n))).digest('hex'),h,'Reviewed dependency changed: '+n);const r=spawnSync(process.execPath,[path.join(fixtures,'verify-final-dist.mjs'),'--dist',dist],{cwd:site,encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024});assert.ifError(r.error);assert.equal(r.signal,null);assert.equal(r.stderr,'');const report=JSON.parse(r.stdout);assert.equal(report.mode,'final-dist-only');assert.equal(report.dist,dist);assert.equal(report.stagedInMemory,0);assert.equal(report.siteWrites,0);assert.equal(report.checks.length,9);for(const c of report.checks)await t.test(c.name,()=>assert.equal(c.status,'passed',c.error));assert.equal(report.passed,9);assert.equal(report.failed,0);assert.equal(r.status,0);});

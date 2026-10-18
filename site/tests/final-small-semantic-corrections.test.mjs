import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(x).digest('hex');
const root=new URL('../',import.meta.url);
const fixture=new URL('tests/fixtures/small-semantic-corrections/records.json',root);
const raw=fs.readFileSync(fixture);
assert.equal(sha(raw),'d8228eef2c9e8f721ebefa13fe04a42644a0593622bae7cf68c90ee8e8bbffbc');
const records=JSON.parse(raw).records;
const entries=new Map();
for(const f of fs.readdirSync(new URL('dist/data/chapters/',root)).filter(f=>f.endsWith('.json'))){
 for(const e of JSON.parse(fs.readFileSync(new URL('dist/data/chapters/'+f,root))).entries||[]){assert.ok(!entries.has(e.id));entries.set(e.id,e);}
}
const leaf=(e,p)=>p.reduce((v,k)=>v[k],e);
test('actual built leaves contain every reviewed minimal correction without overlay',()=>{
 assert.equal(records.length,15);
 const keys=new Set();
 for(const r of records){const k=r.entryId+'|'+JSON.stringify(r.path);assert.ok(!keys.has(k));keys.add(k);assert.equal(sha(r.before),r.beforeSha256);assert.equal(sha(r.after),r.afterSha256);assert.notEqual(r.before,r.after);assert.equal(leaf(entries.get(r.entryId),r.path),r.after,k);}
});
test('precise paragraph edits preserve all surrounding prose and original evidence',()=>{
 for(const r of records.filter(r=>r.replacements)){
  let restored=r.after;
  for(const p of [...r.replacements].reverse()){assert.equal(restored.split(p.after).length,2);restored=restored.replace(p.after,p.before);}
  assert.equal(restored,r.before,r.entryId+' old entire leaf reconstruction');
 }
});

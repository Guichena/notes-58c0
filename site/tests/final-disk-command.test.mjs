import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const records=JSON.parse(await readFile(new URL('tests/fixtures/disk-command/records.json',root),'utf8')).records;
const entries=(await Promise.all((await readdir(new URL('dist/data/chapters/',root))).filter(f=>f.endsWith('.json')).map(async f=>JSON.parse(await readFile(new URL('dist/data/chapters/'+f,root),'utf8')).entries))).flat();
for(const r of records)test(r.entryId+'#'+r.path.join('.')+' retains the full answer with bounded GNU du command',()=>{
 const e=entries.find(e=>e.id===r.entryId);assert.ok(e);let value=e;for(const key of r.path)value=value[key];assert.equal(value,r.after);
 assert.equal(createHash('sha256').update(r.before).digest('hex'),r.beforeSha256);
 assert.ok(value.includes('du -x -h --max-depth=1 -- /目标目录'));assert.ok(!value.includes('du -sh <i>'));assert.ok(!value.includes('du -sh * | sort -h'));
});

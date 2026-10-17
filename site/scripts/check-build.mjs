import {execFileSync} from 'node:child_process';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
async function snapshot(dir,base=dir,out={}) {
 for(const ent of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))) {
  const p=path.join(dir,ent.name);
  if(ent.isDirectory()) await snapshot(p,base,out);
  else out[path.relative(base,p)]=createHash('sha256').update(await readFile(p)).digest('hex');
 }
 return out;
}
const before=await snapshot(path.join(root,'dist'));
execFileSync(process.execPath,['scripts/build.mjs'],{cwd:root,stdio:'pipe'});
const after=await snapshot(path.join(root,'dist'));
assert.deepEqual(after,before,'Repeated builds must produce byte-identical output');
console.log(`Deterministic build verified: ${Object.keys(after).length} emitted files are byte-identical.`);

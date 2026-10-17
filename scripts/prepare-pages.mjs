import {execFileSync} from 'node:child_process';
import {readFile, mkdir, cp, rm, readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const site=path.join(root,'site');
execFileSync(process.execPath,['scripts/build.mjs'],{cwd:site,stdio:'inherit'});
const out=path.join(site,'dist');
const names=await readdir(out);
const allowed=new Set(['.nojekyll','index.html','assets','data','project','build-manifest.json','reading-report.json']);
for(const name of names)if(!allowed.has(name))throw new Error('Unexpected build output: '+name);
for(const name of names){const target=path.join(root,name);await rm(target,{recursive:true,force:true});await cp(path.join(out,name),target,{recursive:true});}
console.log('Pages files prepared locally. Review and test before committing; nothing was pushed.');

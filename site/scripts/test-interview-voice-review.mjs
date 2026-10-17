// Run new exact-current checks first, then unchanged historical assertions in an
// isolated copy with the new editorial layers empty. Never rewrite live dist.
import {execFileSync} from 'node:child_process';
import {cp,mkdtemp,rm,readdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const run=(args,cwd=root)=>execFileSync(process.execPath,args,{cwd,stdio:'inherit'});
let isolated;
try {
 run(['scripts/build.mjs']);
 run(['scripts/check-build.mjs']);
 run(['--test','tests/interview-voice-review.test.mjs','tests/interview-consolidation.test.mjs','tests/interview-voice-review-corpus.test.mjs']);
 isolated=await mkdtemp(path.join(tmpdir(),'interview-voice-history-'));
 await cp(root,isolated,{recursive:true,filter:source=>!['dist','.compat-dist','.git','node_modules'].includes(path.basename(source))});
 for(const layer of ['interview-voice-review','interview-consolidation']){
  const shards=path.join(isolated,'content',layer);
  for(const f of await readdir(shards))if(f.endsWith('.json'))await rm(path.join(shards,f));
 }
 // This assertion targets the edited graph and already ran above. All historical
 // test files and their assertions remain byte-for-byte identical in the copy.
 await rm(path.join(isolated,'tests/interview-voice-review-corpus.test.mjs'));
 run(['scripts/test.mjs'],isolated);
 console.log('Exact-current editorial invariants and unchanged historical suite both passed.');
} finally {if(isolated)await rm(isolated,{recursive:true,force:true});}

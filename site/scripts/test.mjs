import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readdir,rm} from 'node:fs/promises';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const run=(args,extra={})=>execFileSync(process.execPath,args,{cwd:root,stdio:'inherit',...extra});
try {
 // Validate/build the real future corpus, including active authoring additions.
 run(['scripts/build.mjs']);
 run(['scripts/check-build.mjs']);
 // The old-corpus parity oracle uses the same current runtime and original-source
 // layer, isolated from intentional additions. Never overwrite the real dist/.
 run(['scripts/build.mjs','--baseline-test'],{stdio:'pipe'});
 const tests=(await readdir(path.join(root,'tests'))).filter(x=>x.endsWith('.test.mjs')).sort().map(x=>'tests/'+x);
 // Bound parallel registry-heavy test workers; preserve every test and assertion.
 run(['--test','--test-concurrency=1',...tests],{env:{...process.env,NOTES_TEST_DIST:'.compat-dist'}});
} catch(error) {process.exitCode=error.status||1;}
finally {await rm(path.join(root,'.compat-dist'),{recursive:true,force:true});}

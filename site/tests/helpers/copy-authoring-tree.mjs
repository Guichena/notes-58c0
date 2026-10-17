import {cpSync,readdirSync} from 'node:fs';
import path from 'node:path';
const [source,destination]=process.argv.slice(2);
if(!source||!destination||process.argv.length!==4)throw Error('Expected source and destination directories');
// A disposable child owns copy buffers; retain the exact source-tree exclusions.
for(const name of readdirSync(source))if(!['dist','.compat-dist'].includes(name)){
 cpSync(path.join(source,name),path.join(destination,name),{recursive:true,preserveTimestamps:true,verbatimSymlinks:true,errorOnExist:true,force:false});
}

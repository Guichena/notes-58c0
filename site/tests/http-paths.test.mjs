import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createPreviewServer} from '../scripts/serve.mjs';
test('all 63 chapters and emitted runtime URLs resolve beneath /notes-58c0/',async()=>{
 const distURL=new URL('../'+(process.env.NOTES_TEST_DIST||'dist')+'/',import.meta.url);
 const server=createPreviewServer(fileURLToPath(distURL));
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 try {
  const base='http://127.0.0.1:'+server.address().port+'/notes-58c0/';
  const catalog=JSON.parse(await readFile(new URL('data/catalog.json',distURL),'utf8'));
  const paths=['','assets/app.js','assets/visuals.js','assets/runtime/bootstrap.js','assets/runtime/content-repository.js','assets/styles/main.css','assets/styles/loading.css','data/catalog.json','data/search.json','project/','project/arch.svg',...new Set(catalog.entries.map(e=>e._chunk))];
  for(const p of paths) {const response=await fetch(base+p);assert.equal(response.status,200,p);const bytes=Buffer.from(await response.arrayBuffer());const file=p===''?'index.html':p.endsWith('/')?p+'index.html':p;assert.deepEqual(bytes,await readFile(new URL(file,distURL)),p);}
  const missing=await fetch(base+'data/chapters/not-a-real-chapter.json');assert.equal(missing.status,404);
 } finally {await new Promise(resolve=>server.close(resolve));}
});

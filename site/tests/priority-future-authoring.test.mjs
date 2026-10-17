import {expectedNoteDisplay} from './helpers/note-display-oracle.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url)),read=p=>readFile(path.join(root,p),'utf8'),json=async p=>JSON.parse(await read(p));
test('actual disposable future authoring build preserves every current output and permits a new entry and question',async()=>{
 const temp=await mkdtemp(path.join(tmpdir(),'priority-future-'));
 try{
 // Copy in a short-lived process so transient fs.cp buffers do not overlap the full build heap.
 execFileSync(process.execPath,[path.join(root,'tests/helpers/copy-authoring-tree.mjs'),root,temp],{stdio:'pipe',timeout:120000});
 const entry={schemaVersion:1,draft:false,id:'future-independent-entry',kind:'doc',module:'code',part:'Future authoring',category:'Independent',title:'Future entry',sections:[{id:'future-section',title:'Future section',body:'Independent future text.'}]};
 const question={schemaVersion:1,draft:false,entryId:'bg-mysql-1',id:'q-future-independent',question:'Future independently authored question?',shortAnswer:'Future answer.',explanation:'Future independent explanation.'};
 await writeFile(path.join(temp,'authoring/entries/future-independent-entry.json'),JSON.stringify(entry));
 await writeFile(path.join(temp,'authoring/questions/q-future-independent.json'),JSON.stringify(question));
 execFileSync(process.execPath,['scripts/build.mjs'],{cwd:temp,env:{...process.env,NODE_OPTIONS:'--max-old-space-size=384'},stdio:'pipe',timeout:120000});
 const load=async(base,p)=>JSON.parse(await readFile(path.join(base,p),'utf8'));
 const entries=async base=>{const c=await load(base,'dist/data/catalog.json');const chunks=await Promise.all([...new Set(c.entries.map(e=>e._chunk))].map(p=>load(base,'dist/'+p)));const by=new Map(chunks.flatMap(c=>c.entries).map(e=>[e.id,e]));return c.entries.map(e=>by.get(e.id));};
 const newEntries=await entries(temp),current=await entries(root);assert.ok(newEntries.some(e=>e.id===entry.id));
 assert.ok(newEntries.find(e=>e.id===question.entryId).items.some(q=>q.id===question.id));
 const restore=es=>es.filter(e=>e.id!==entry.id).map(e=>{if(e.items)e.items=e.items.filter(q=>q.id!==question.id);return e;});
 // Verify the actual future build updates counts before removing the new question.
 assert.deepEqual(newEntries,expectedNoteDisplay(newEntries));
 const changed=newEntries.find(e=>e.id===question.entryId),prior=current.find(e=>e.id===question.entryId);
 assert.equal(changed.items.length,prior.items.length+1);
 assert.equal(changed.number,prior.number.replace(/[0-9]+/,String(changed.items.length)));
 const futureCatalog=await load(temp,'dist/data/catalog.json');
 assert.equal(futureCatalog.entries.find(e=>e.id===question.entryId).number,changed.number);
 assert.deepEqual(expectedNoteDisplay(restore(newEntries)),current);
 assert.deepEqual(restore(await load(temp,'dist/data/archives/source-entries.json')),await load(root,'dist/data/archives/source-entries.json'));
 }finally{await rm(temp,{recursive:true,force:true});}
});

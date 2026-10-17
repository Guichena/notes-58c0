import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {answerFields,entryIdentity,questionIdentity,sha256} from './interview-voice-review.mjs';
const base=fileURLToPath(new URL('../../',import.meta.url)), dist=path.join(base,'../layout-review-20261016/site/dist/data'),out=path.join(base,'editor-inputs');
const catalog=JSON.parse(await readFile(path.join(dist,'catalog.json'),'utf8'));
const all=(await Promise.all((await readdir(path.join(dist,'chapters'))).filter(f=>f.endsWith('.json')).map(async f=>JSON.parse(await readFile(path.join(dist,'chapters',f),'utf8')).entries))).flat();
const map=new Map(all.map(e=>[e.id,e])),entries=catalog.entries.map(e=>map.get(e.id));
const groups=new Map(),units=[],fields=[];
for(const e of entries){const group=e.mod; if(!groups.has(group))groups.set(group,[]);groups.get(group).push(e);
 const fs=answerFields(e).map(f=>({entryId:e.id,entryIdentity:entryIdentity(e),...(questionIdentity(e,f.path)?{questionIdentity:questionIdentity(e,f.path)}:{}),...f}));fields.push(...fs);
 if(e.kind==='qa')e.items.forEach((it,i)=>units.push({unitId:e.id+'::items.'+i,entryId:e.id,module:e.mod,questionIndex:i,question:it.q,disposition:'pending',rationale:'',fieldPaths:fs.filter(f=>f.path[0]==='items'&&f.path[1]===i).map(f=>f.path)}));
 else units.push({unitId:e.id,entryId:e.id,module:e.mod,disposition:'pending',rationale:'',fieldPaths:fs.map(f=>f.path)});
}
await mkdir(out,{recursive:true});
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const batches=[];
for(const [mod,list]of groups){let batch=[],size=0,n=0;const flush=async()=>{if(!batch.length)return;const name=mod+'-'+String(++n).padStart(2,'0'),ids=new Set(batch.map(e=>e.id)),f=fields.filter(f=>ids.has(f.entryId)),u=units.filter(u=>ids.has(u.entryId));
 const data={schemaVersion:1,batchId:name,entries:batch,fields:f,units:u};
 await writeFile(path.join(out,name+'.json'),JSON.stringify(data,null,2)+'\n');
 await writeFile(path.join(out,name+'.txt'),batch.map(e=>'ENTRY '+e.id+' | '+e.title+' | '+e.kind+'\nFULL ENTRY CONTEXT\n'+JSON.stringify(e,null,2)+'\n\nREVIEWABLE FIELDS\n'+f.filter(x=>x.entryId===e.id).map(x=>JSON.stringify(x.path)+' SHA256 '+x.beforeSha256+'\n'+x.before).join('\n\n')).join('\n\n================================\n\n'));
 await writeFile(path.join(out,name+'.html'),'<!doctype html><meta charset="utf-8"><title>'+name+'</title><style>body{max-width:1100px;margin:32px auto;font:16px/1.7 sans-serif}pre{white-space:pre-wrap;overflow-wrap:anywhere}article{border-top:3px solid #666;margin:32px 0}details{margin:12px 0}code{background:#eee}</style><h1>Editorial input '+name+'</h1>'+batch.map(e=>'<article><h2>'+esc(e.id+' · '+e.title)+'</h2><details><summary>Full entry context</summary><pre>'+esc(JSON.stringify(e,null,2))+'</pre></details>'+f.filter(x=>x.entryId===e.id).map(x=>'<section><h3>'+esc(JSON.stringify(x.path))+'</h3>'+(x.questionIdentity?'<h4>'+x.questionIdentity.q+'</h4>':'')+'<div>'+(/html|lead|^a$/i.test(String(x.path.at(-1)))?x.before:'<pre>'+esc(x.before)+'</pre>')+'</div><details><summary>Exact source and guard</summary><pre>'+esc(x.beforeSha256+'\n'+x.before)+'</pre></details></section>').join('')+'</article>').join(''));
 batches.push({batchId:name,module:mod,entryCount:batch.length,unitCount:u.length,fieldCount:f.length,entryIds:[...ids],json:name+'.json',text:name+'.txt',html:name+'.html'});batch=[];size=0;};
 for(const e of list){const count=e.kind==='qa'?e.items.length:1;if(batch.length&&(size+count>55||batch.length>=25))await flush();batch.push(e);size+=count;}await flush();
}
const manifest={schemaVersion:1,source:'Immutable layout-review-20261016/site/dist/data learner graph before interview-voice-review projection',sourceSha256:sha256(JSON.stringify(entries)),entryCount:entries.length,unitCount:units.length,fieldCount:fields.length,batches};
await writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');await writeFile(path.join(out,'review-ledger.json'),JSON.stringify({schemaVersion:1,units},null,2)+'\n');await writeFile(path.join(out,'all-fields.json'),JSON.stringify({schemaVersion:1,fields},null,2)+'\n');
const f=fields[0];await writeFile(path.join(out,'schema-example.json'),JSON.stringify({schemaVersion:1,records:[{...f,after:f.before,afterSha256:sha256(f.before),review:{rationale:'EXAMPLE ONLY: replace with the actual per-answer editorial judgment',reference:'Huang Feishu reference'}}]},null,2)+'\n');
console.log(JSON.stringify({entryCount:entries.length,unitCount:units.length,fieldCount:fields.length,batches:batches.map(b=>({id:b.batchId,entries:b.entryCount,units:b.unitCount,fields:b.fieldCount}))},null,2));

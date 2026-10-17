import test from 'node:test';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {digest,recordID,validateReceipt,validateComplete} from './helpers/reviewed-exhaustive-coverage.mjs';
const root=new URL('../',import.meta.url),registry=JSON.parse(await readFile(new URL('content/reviewed-content-projection.json',root),'utf8')),registrySHA256=digest(registry);
test('rejects stale inputs double apply missing duplicate targets and every question identity drift',()=>{
 const receipts=[];
 const run=(mode,start,end)=>{
  const raw=execFileSync(process.execPath,['--max-old-space-size=512',fileURLToPath(new URL('tests/helpers/reviewed-exhaustive-child.mjs',root)),mode,String(start),String(end),registrySHA256],{cwd:fileURLToPath(root),env:{...process.env,NODE_OPTIONS:'--max-old-space-size=512'},encoding:'utf8',maxBuffer:8*1024*1024});
  const receipt=JSON.parse(raw);validateReceipt(receipt,{registrySHA256,records:registry.records,start,end,mode});receipts.push(receipt);
  console.log('Exhaustive shard terminal '+JSON.stringify({mode,start,end,calls:receipt.calls,registrySHA256}));
 };
 run('globals',0,0);
 for(let start=0;start<registry.records.length;start+=50)run('range',start,Math.min(start+50,registry.records.length));
 console.log('Exhaustive complete '+JSON.stringify(validateComplete(receipts,registrySHA256,registry.records)));
});
test('exhaustive shard receipts fail closed and preserve the exact original assertion body',async()=>{
 const original=await readFile(new URL('tests/fixtures/reviewed-exhaustive-original.txt',root),'utf8'),helper=await readFile(new URL('tests/helpers/reviewed-exhaustive-assertions.mjs',root),'utf8');
 assert.equal(createHash('sha256').update(original).digest('hex'),'3c6bfa50f3037eb0a486724fc5bcdff2dc3f465d79aab6159cc2dfb2c3d3d310','original assertion fixture changed');
 const body=original.split("',()=>{")[1].slice(0,-4),loopStart=body.indexOf('for(const r of registry.records)'),lastStart=body.lastIndexOf('assert.throws(()=>projectReviewedContent([...input,input[0]],registry)');
 const expected="import assert from 'node:assert/strict';\nexport function runGlobalChecks({input,output,registry,projectReviewedContent,get}){\n"+body.slice(0,loopStart)+body.slice(lastStart)+"\nreturn ['double-apply','duplicate-entry'];\n}\nexport function runRangeChecks({input,output,registry,projectReviewedContent,get},start,end){\n"+body.slice(loopStart,lastStart).replace('registry.records','registry.records.slice(start,end)')+"\n}\n";
 assert.equal(helper,expected,'assertion code changed');
 const records=Array.from({length:51},(_,i)=>({entryId:'fixture-'+i,path:['a'],...(i%2?{questionIdentity:{}}:{})})),hash='fixture-hash';
 const make=(mode,start,end)=>({terminal:true,mode,start,end,registrySHA256:hash,records:mode==='globals'?[]:records.slice(start,end).map((r,i)=>recordID(r,start+i)),globalChecks:mode==='globals'?['double-apply','duplicate-entry']:[],calls:mode==='globals'?2:records.slice(start,end).reduce((n,r)=>n+2+(r.questionIdentity?3:0),0)});
 const valid=[make('globals',0,0),make('range',0,50),make('range',50,51)];assert.deepEqual(validateComplete(valid,hash,records),{records:51,calls:179,registrySHA256:hash,ranges:2});
 for(const mutate of [a=>a.pop(),a=>a.push(a[1]),a=>a.reverse(),a=>a[1].terminal=false,a=>a[1].registrySHA256='wrong',a=>a[1].start=1,a=>a[1].end=49,a=>a[1].records.reverse(),a=>a[1].records[0].entryId='wrong',a=>a[1].records[0].path=['wrong'],a=>a[1].records[0].checks.pop(),a=>a[1].calls++,a=>a[0].globalChecks.pop(),a=>a[1]=null]){const bad=structuredClone(valid);mutate(bad);assert.throws(()=>validateComplete(bad,hash,records));}
});

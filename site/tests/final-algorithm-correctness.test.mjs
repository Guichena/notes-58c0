import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>readFile(path.join(root,p),'utf8');
const catalog=JSON.parse(await read('dist/data/catalog.json')),entries=new Map();
for(const chunk of new Set(catalog.entries.map(e=>e._chunk)))for(const e of JSON.parse(await read('dist/'+chunk)).entries)entries.set(e.id,e);
const java=process.env.JAVA_HOME?path.join(process.env.JAVA_HOME,'bin','java'):'java';
const run=(args,opts={})=>execFileSync(java,args,{encoding:'utf8',timeout:120000,...opts});
const decode=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#x27;/g,"'").replace(/&amp;/g,'&');
test('fixed algorithm display, CLI and downloadable sources stay byte-identical',async()=>{
 for(const [id,dir,name]of [['460','lc460','LFUCache'],['30','lc30','Solution'],['47','lc47','Solution']]){
  const rel='assets/examples/final-algorithm/'+dir+'/'+name+'.java',code=await read('public/'+rel);
  assert.equal(entries.get(id).code,code);assert.equal(await read('dist/'+rel),code);
 }
 for(const [id,idx,dir]of [['p-design',3,'lc460'],['p-window',4,'lc30'],['p-backtrack',13,'lc47']]){
  const code=decode(entries.get(id).folds[idx].html.match(/<pre class="md-pre" data-lang="java">([\s\S]*?)<\/pre>/)[1]);
  assert.equal(code,await read('public/assets/examples/final-algorithm/'+dir+'/cli/Main.java'));
 }
 assert.ok(entries.get('21').supplementHtml.includes('O(K+N)'));
 assert.ok(!entries.get('460').code.includes('LinkedHashSet'));
 assert.ok(!entries.get('30').code.includes('window.clear()'));
});
for(const [dir,name,oracle]of [['lc460','LFUCache','LfuOracleTest'],['lc30','Solution','Lc30OracleTest'],['lc47','Solution','Lc47OracleTest'],['intersection','SortedListIntersection','IntersectionOracleTest']]){
 test('actual Java independent oracle: '+dir,async()=>{
  const work=await mkdtemp(path.join(tmpdir(),'final-algo-'+dir+'-'));
  try{
   const source=path.join(root,'public/assets/examples/final-algorithm',dir,name+'.java');
   const args=['-m','jdk.compiler/com.sun.tools.javac.Main','-d',work,source,path.join(root,'tests/final-algorithm',oracle+'.java')];
   if(dir==='lc30'){
    const src=(await read('public/assets/examples/final-algorithm/lc30/Solution.java')).replace('class Solution {','class InstrumentedSolution {\nlong incoming, removed;').replace('String word = s.substring(right, right + wordLength);','incoming++;\nString word = s.substring(right, right + wordLength);').replace('private static void decrement(','private void decrement(').replace('int count = counts.get(word);','removed++;\nint count = counts.get(word);');
    const p=path.join(work,'InstrumentedSolution.java');await writeFile(p,src);args.push(p);
   }
   run(args);
   const output=run([...(dir==='lc460'?['--add-opens','java.base/java.util=ALL-UNNAMED']:[]),'-cp',work,oracle]);
   assert.match(output,/PASS/);
  }finally{await rm(work,{recursive:true,force:true});}
 });
}
test('actual cleanup failure and disk-counting regression tests',async()=>{
 const work=await mkdtemp(path.join(tmpdir(),'final-cleanup-'));
 try{
  const source=path.join(root,'public/assets/examples/final-cleanup');
  run(['-m','jdk.compiler/com.sun.tools.javac.Main','-d',work,...['ExternalIntTop','ExternalStringCounts','CleanupFaultTests'].map(n=>path.join(source,n+'.java'))]);
  for(const name of ['CleanupFaultTests','ExternalIntTop','ExternalStringCounts'])assert.match(run(['-cp',work,name]),/PASS/);
 }finally{await rm(work,{recursive:true,force:true});}
});

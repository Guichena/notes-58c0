import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import path from 'node:path';

// Resolve the installed test's own site root, never the proposal package or cwd.
const root=fileURLToPath(new URL('../',import.meta.url));
const read=relative=>readFile(path.join(root,relative),'utf8');
const fixture='tests/fixtures/algorithm-contracts/';
const expected=JSON.parse(await read(fixture+'expected-leaves.json'));
const wanted=new Set(expected.map(row=>row.entryId));
const catalog=JSON.parse(await read('dist/data/catalog.json'));
const chunks=new Set(catalog.entries.filter(e=>wanted.has(e.id)).map(e=>e._chunk));
const entries=new Map();
for(const chunk of chunks)for(const entry of JSON.parse(await read('dist/'+chunk)).entries)entries.set(entry.id,entry);
for(const id of wanted)assert.ok(entries.has(id),'Missing final dist entry '+id);
const sha=s=>createHash('sha256').update(s,'utf8').digest('hex');
const get=(entry,parts)=>parts.reduce((value,key)=>value[key],entry);
const java=process.env.JAVA_HOME?path.join(process.env.JAVA_HOME,'bin','java'):'java';
const run=(args,opts={})=>execFileSync(java,args,{encoding:'utf8',timeout:120000,maxBuffer:2*1024*1024,...opts});
const decode=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#(?:x27|39);/g,"'").replace(/&amp;/g,'&');
const withoutImports=s=>s.replace(/^import [^;]+;[^\n]*\n/gm,'');
function renameClass(source,oldName,newName){
 const marker=new RegExp('(?:public )?class '+oldName+' \\{');
 assert.equal((source.match(new RegExp(marker.source,'g'))||[]).length,1,'Exactly one '+oldName+' declaration');
 return withoutImports(source).replace(marker,'class '+newName+' {');
}
function javaFold(id,index){
 const matches=[...entries.get(id).folds[index].html.matchAll(/<pre class="md-pre" data-lang="java">([\s\S]*?)<\/pre>/g)];
 assert.equal(matches.length,1,id+' fold '+index+' must have one Java body');
 return decode(matches[0][1]);
}

test('final dist preserves all 34 source-verified original algorithm contract leaves',()=>{
 assert.equal(expected.length,34);
 const keys=new Set();
 for(const row of expected){
  const key=JSON.stringify([row.entryId,row.path]);assert.ok(!keys.has(key));keys.add(key);
  const actual=get(entries.get(row.entryId),row.path);assert.equal(typeof actual,'string');
  assert.equal(sha(actual),row.sha256,'Changed final dist contract leaf '+key);
 }
 for(const id of ['1','611','lc-face-extra-20','378','437','62','63','440']){
  const entry=entries.get(id);assert.equal(entry.description,entry.simple.statement);
  assert.match(entry.description,/原题范围：/);assert.match(entry.code,/^\/\/ LC\d+ 原题：/);
 }
 // Each cross-page extension points to its actual owner, not to a relative 'below' location.
 assert.match(entries.get('p-hash').folds[1].html,/href="#\/e\/1"/);
 assert.ok(!entries.get('p-hash').folds[1].html.includes('本页 TwoSumAlternatives'));
 assert.match(decode(entries.get('1').supplementHtml),/class TwoSumAlternatives[\s\S]*static int\[\] hashIndices/);
 assert.match(entries.get('p-bsearch').folds[11].html,/href="#\/e\/378"/);
 assert.ok(!entries.get('p-bsearch').folds[11].html.includes('下方非方阵堆接口'));
 const matrix=decode(entries.get('378').supplementHtml);
 assert.match(matrix,/class MatrixRank/);assert.match(matrix,/static int arbitrary\(/);assert.match(matrix,/static int rowSorted\(/);
 assert.match(entries.get('p-tree').folds[13].html,/href="#\/e\/437"/);
 assert.match(decode(entries.get('p-tree').supplementHtml),/class TreeVariants[\s\S]*static long countDownwardPaths\(/);
 assert.match(entries.get('437').supplementHtml,/href="#\/e\/p-tree"/);
 const lexContract=entries.get('p-math').folds[7].html.split('</p>',1)[0];
 assert.ok(lexContract.includes('n&lt;1')&&lexContract.includes('k&lt;1')&&lexContract.includes('k&gt;n'));
 assert.ok(!lexContract.includes('n<1')&&!lexContract.includes('k<1')&&!lexContract.includes('k>n'));
});

test('actual final-dist judge, topic template and ACM code passes independent Java boundary oracles',async()=>{
 const work=await mkdtemp(path.join(tmpdir(),'final-algorithm-contracts-'));
 try{
  const source=['import java.util.*;\nimport java.math.*;\nimport java.io.*;\nclass TreeNode {int val;TreeNode left,right;TreeNode(int v){val=v;}}'];
  for(const id of ['1','611','lc-face-extra-20','378','437','62','63','440']){
   source.push(renameClass(entries.get(id).code,'Solution','LC'+(id==='lc-face-extra-20'?'209':id)));
  }
  for(const [topic,index,id] of [['p-hash',1,'1'],['p-twoptr',9,'611'],['p-bsearch',11,'378'],['p-tree',13,'437'],['p-dp',14,'62'],['p-dp',19,'63'],['p-math',7,'440']]){
   source.push(renameClass(javaFold(topic,index),'Main','Fold'+id));
  }
  source.push('class HashTemplate {\n'+entries.get('p-hash').templates[0].java+'\n}');
  // This LC76 template has only a conversion comment changed, but compile its actual source too.
  source.push('class WindowTemplate {\n'+entries.get('p-window').templates[1].java+'\n}');
  source.push(await read(fixture+'ContractHarness.java'));
  const file=path.join(work,'ContractHarness.java');await writeFile(file,source.join('\n\n'));
  run(['-m','jdk.compiler/com.sun.tools.javac.Main','-encoding','UTF-8','-d',work,file]);
  const output=run(['-cp',work,'ContractHarness']);
  assert.match(output,/TOTAL=113470\b/);
  for(const group of ['LC1 and topic template/CLI','LC611','LC209','LC378','LC437','LC62','LC63','LC440'])assert.ok(output.includes(group+': '),group+' ran');
  console.log(output.trim());
 }finally{await rm(work,{recursive:true,force:true});}
});

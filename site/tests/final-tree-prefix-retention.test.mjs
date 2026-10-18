import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import path from 'node:path';

// Resolve the installed test's site root. No proposal-directory or cwd dependence.
const root=fileURLToPath(new URL('../',import.meta.url));
const read=relative=>readFile(path.join(root,relative),'utf8');
const fixture='tests/fixtures/tree-prefix/';
const expected=JSON.parse(await read(fixture+'expected-leaves.json'));
const catalog=JSON.parse(await read('dist/data/catalog.json'));
const entries=new Map();
for (const chunk of new Set(catalog.entries.filter(e=>['437','p-tree'].includes(e.id)).map(e=>e._chunk))) {
 for (const entry of JSON.parse(await read('dist/'+chunk)).entries) entries.set(entry.id,entry);
}
assert.ok(entries.has('437') && entries.has('p-tree'));
const sha=s=>createHash('sha256').update(s,'utf8').digest('hex');
const get=(entry,keys)=>keys.reduce((x,key)=>x[key],entry);
const canonical=x=>JSON.stringify(Array.isArray(x)?x.map(sorted):sorted(x));
function sorted(x) {
 if(Array.isArray(x)) return x.map(sorted);
 if(x && typeof x==='object') return Object.fromEntries(Object.keys(x).sort().map(k=>[k,sorted(x[k])]));
 return x;
}
const decode=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#(?:x27|39);/g,"'").replace(/&amp;/g,'&');
const contractLeaves=JSON.parse(await read('tests/fixtures/algorithm-contracts/expected-leaves.json'));

test('LC437 final leaves preserve the official contract and independent topic implementations',()=>{
 assert.equal(expected.leaves.length,3);
 const keys=new Set();
 for(const leaf of expected.leaves) {
  const key=JSON.stringify([leaf.entryId,leaf.path]); assert.ok(!keys.has(key)); keys.add(key);
  assert.equal(sha(get(entries.get(leaf.entryId),leaf.path)),leaf.sha256,key);
 }
 const e=entries.get('437'); assert.equal(e.idea,e.simple.analysis);
 assert.ok(!e.code.includes('prefixCount.clear()'));
 assert.match(e.code,/private Map<Long, Integer> prefixCount;/);
 assert.equal((e.code.match(/prefixCount = new HashMap<>\(\);/g)||[]).length,1);
 const unchanged=structuredClone(e); delete unchanged.code; delete unchanged.idea; delete unchanged.simple.analysis;
 assert.equal(sha(canonical(unchanged)),expected.unchanged437Sha256);
 const topic=entries.get('p-tree');
 const blocks=[...topic.folds[13].html.matchAll(/<pre class="md-pre" data-lang="java">([\s\S]*?)<\/pre>/g)];
 assert.equal(blocks.length,1); assert.equal(sha(decode(blocks[0][1])),expected.topicLC437FoldSha256);
 const variants=[...topic.supplementHtml.matchAll(/<pre[^>]*>([\s\S]*?)<\/pre>/g)]
  .map(m=>decode(m[1])).filter(s=>s.includes('public final class TreeVariants {'));
 assert.equal(variants.length,1); assert.equal(sha(variants[0]),expected.treeVariantsSha256);
 const codeLeaf=contractLeaves.filter(x=>x.entryId==='437' && JSON.stringify(x.path)==='["code"]');
 assert.equal(contractLeaves.length,34); assert.equal(codeLeaf.length,1);
 assert.equal(codeLeaf[0].sha256,expected.codeAfterSha256);
 assert.equal(sha(e.code),codeLeaf[0].sha256);
});

test('actual final-dist LC437 passes independent path-count and large-small-empty reuse oracles',async()=>{
 const work=await mkdtemp(path.join(tmpdir(),'final-tree-prefix-'));
 try {
  const code=entries.get('437').code;
  assert.equal(sha(code),expected.codeAfterSha256);
  assert.equal((code.match(/class Solution \{/g)||[]).length,1);
  const body=code.replace(/^import [^;]+;[^\n]*\n/gm,'').replace('class Solution {','class LC437 {');
  const harness=await read(fixture+'TreePrefixHarness.java');
  const source='import java.util.*;\nimport java.lang.reflect.*;\nclass TreeNode {int val;TreeNode left,right;TreeNode(int v){val=v;}}\n'
   +body+'\n'+harness.replace(/^import [^;]+;\s*$/gm,'');
  const file=path.join(work,'TreePrefixHarness.java'); await writeFile(file,source);
  const java=process.env.JAVA_HOME?path.join(process.env.JAVA_HOME,'bin','java'):'java';
  const run=args=>execFileSync(java,args,{encoding:'utf8',timeout:120000,maxBuffer:2*1024*1024});
  run(['-m','jdk.compiler/com.sun.tools.javac.Main','-encoding','UTF-8','-d',work,file]);
  // This portable test does not open java.util internals. Only the dedicated local diagnostic does.
  const output=run(['-cp',work,'TreePrefixHarness']);
  for(const line of ['FUNCTIONAL_BASE_CHECKS=10016','INPUT_PRESERVATION_CHECKS=2000',
   'FUNCTIONAL_TOTAL_CHECKS=10256','LIFECYCLE_CHECKS=720','PASS tree-prefix lifecycle and independent downward-path oracle']) {
   assert.ok(output.split(/\r?\n/).includes(line),line);
  }
  console.log(output.trim());
 } finally {await rm(work,{recursive:true,force:true});}
});

import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const catalog=JSON.parse(await readFile(new URL('../dist/data/catalog.json',import.meta.url),'utf8'));
const meta=catalog.entries.find(e=>e.id==='own-rag-service');
const entry=JSON.parse(await readFile(new URL('../dist/'+meta._chunk,import.meta.url),'utf8')).entries.find(e=>e.id===meta.id),q=entry.items[1];
test('RAG cache answer keeps key, authority, graph and deployment boundaries with stable identity',()=>{
 assert.equal(q.id,'q-own-rag-cache-contract');
 for(const x of ['模型 revision','维度','预处理','索引代','过滤条件','Prompt','事实时间','会话约束','tenant','持久历史','推理 KV Cache','HNSW','近邻导航','实体关系','single-flight','有界批处理','错误复用率','p99','否定','无答案','缓存穿透','不能当成真正“无结果”长期负缓存'])assert.ok(q.a.includes(x),x);
 for(const x of ['旧版本 v1','写入 v2','单调 generation','g1','g2','同一缓存原子操作','ABA','元数据缺失时拒绝旧回填','数据库提交与 Redis 屏障并不是一个事务','实际已可见的索引代'])assert.ok(q.a.includes(x),x);
 assert.equal((q.a.match(/何时可以不调用生成模型？/g)||[]).length,1);
 assert.ok(q.a.includes('其他问法（2）'));assert.ok(q.a.includes('#/e/own-rag-source-guide'));
});
test('generation timeline witnesses reject late fills and missing barriers without claiming real Redis execution',()=>{
 // A deliberately small mathematical model of the described atomic operations.
 const state={generation:1,value:null};const begin=()=>state.generation;
 const fill=(expected,value)=>{if(state.generation===null||expected!==state.generation)return false;state.value=value;return true;};
 const a=begin();state.generation=2;state.value=null;assert.equal(fill(a,'v1'),false);assert.equal(state.value,null);
 const b=begin();assert.equal(fill(b,'v2'),true);assert.equal(state.value,'v2');
 state.generation=null;state.value=null;assert.equal(fill(b,'v2'),false);
 state.generation=3;assert.equal(fill(a,'v1'),false);assert.equal(fill(b,'v2'),false);assert.equal(fill(begin(),'v3'),true);
});

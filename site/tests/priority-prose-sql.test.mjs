import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,cp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {projectInterviewEditorial} from '../scripts/interview-editorial-projection.mjs';
import {upstream} from './helpers/editorial-upstream.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),read=p=>readFile(path.join(root,p),'utf8'),json=async p=>JSON.parse(await read(p));
const registry=await json('content/interview-editorial-projection.json'), reviewed=await json('tests/fixtures/priority-prose/guarded-proposals-readable-variant.json'),plain=await json('tests/fixtures/priority-prose/guarded-proposals.json');
const practice='own-practice-mysql-isolation-workbook';
const strip=s=>s.replace(/(<summary\b[^>]*>)深入追问：/g,'$1').replace(/<[^>]*>/g,'').replace(/\s+/g,'');
const anchors=s=>[...s.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]).sort();
test('legacy target selection rejects index movement, added IDs, removed question and duplicate text even with distinct IDs',()=>{
 for(const r of registry.records.slice(2))for(const mutate of [(e,q)=>e.items.unshift({q:'new question'}),(e,q)=>q.id='q-forbidden-reidentity',(e,q)=>e.items.splice(e.items.indexOf(q),1),(e,q)=>e.items.push({...q,id:'q-distinct-but-duplicate-text'})]){
 const input=structuredClone(upstream.claimEntries),e=input.find(e=>e.id===r.entryId),q=e.items[r.questionIndex];mutate(e,q);assert.throws(()=>projectInterviewEditorial(input,registry),/identity|missing|duplicate/);
 }
});
test('four exact approved rewrites retain disclosure text and original anchors; only isolation link is added',()=>{
 for(const r of registry.records.slice(2)){
 const match=x=>x.entryId===r.entryId&&x.questionIndex===r.questionIndex;
 const approved=reviewed.proposals.find(match),original=plain.proposals.find(match);
 const expected=approved.proposed.a.replace('完整的 isolation-workbook.sql','完整的 <a href="#/e/'+practice+'">isolation-workbook.sql</a>');
 assert.equal(r.fields.a.after,expected);assert.equal(r.fields.lead.after,approved.proposed.lead);
 assert.equal(strip(approved.proposed.a),strip(original.proposed.a));
 assert.deepEqual(anchors(approved.proposed.a),anchors(original.proposed.a));
 for(const id of anchors(r.fields.a.before))assert.ok(anchors(r.fields.a.after).includes(id));
 assert.doesNotMatch(r.fields.a.after,/<pre\b|<code\b|code-card/);
 }
});
test('registered SQL practice retains exact original worksheet and prerequisite blocks without an execution claim',async()=>{
 const proposal=await json('tests/fixtures/priority-prose/visible-sql-practice-proposal.json');
 const doc=await json('authoring/entries/zz-'+practice+'.json');
 assert.deepEqual(doc.sections,[proposal.prerequisites,proposal.originalWorkbookSection]);
 const sql=await read('tests/fixtures/priority-prose/isolation-workbook.sql');assert.equal(doc.sections[1].blocks[1].value,sql);
 assert.equal(createHash('sha256').update(sql).digest('hex'),proposal.origin.sqlSha256);
 assert.deepEqual([doc.module,doc.part,doc.category],['code','SQL 与数据库','事务、锁与日志']);
 const catalog=await json('dist/data/catalog.json');const record=catalog.entries.find(e=>e.id===practice),peer=catalog.entries.find(e=>e.id==='database-87');
 assert.deepEqual([record.mod,record.part,record.cat,record._chunk],[peer.mod,peer.part,peer.cat,peer._chunk]);assert.ok(!catalog.entries.some(e=>e.mod==='code'&&e.part==='SQL与数据库'));
 assert.ok((await json('dist/'+record._chunk)).entries.some(e=>e.id===practice));assert.ok(registry.records.some(r=>r.fields.a.after.includes('href="#/e/'+practice+'"')));
 const final=projectInterviewEditorial(upstream.claimEntries,registry),e=final.find(e=>e.id===practice);
 assert.ok(e);assert.equal(e.html,upstream.reading.sourceArchive.find(e=>e.id===practice).html);
 for(const text of ['MySQL 8.4.0/InnoDB','不包含真实数据库执行结果','两个独立连接','performance_schema.data_lock_waits','CREATE DATABASE mysql_txn_learning','SET autocommit=1'])assert.ok(e.html.includes(text));
 assert.throws(()=>projectInterviewEditorial(upstream.claimEntries.filter(e=>e.id!==practice),registry),/missing linked practice/);
});
